/* PROJECT ATLAS - "Zuletzt gesehen" tracker (forum).
   After a new RPG post in a world thread, a popup asks which characters appear
   in the post and stores the post as their last location (Apps Script action
   updateLastSeen). ATLAS shows these locations as tokens on the map.

   The popup only appears for the author's newest post, right after writing it
   ("vor einer Minute"), not after editing and not for a freshly created thread
   (the first post of a thread is the lot description, not an RPG post). */

import { CHARS_CSV_URL, callAppsScript } from '../shared/backend.js?v=202609211308';
import { fetchCsvObjects } from '../shared/csv.js?v=202609211308';
import { worldFromUrl } from './worlds.js?v=202609211308';
import {
  threadId, loggedInUser, postNumbersOnPage, hasFreshPostTime, cleanPageUrl, copyText, escapeHtml,
} from './page.js?v=202609211308';

const EDIT_FLAG_MAX_AGE = 5 * 60 * 1000;   // an edit counts as "just edited" for 5 minutes
const TRACKED_MAX_AGE  = 10 * 60 * 1000;   // a tracked post is not asked for again for 10 minutes
const FRESH_POST = /vor einer Minute|gerade eben|gerade|vor [1-5] Minuten/i;

const TABS = [
  { id: 'haupt',   label: 'Hauptcharaktere', types: ['hauptcharakter', 'haupt'] },
  { id: 'neben',   label: 'Nebencharaktere', types: ['nebencharakter', 'neben'] },
  { id: 'statist', label: 'Statisten',       types: ['randfigur', 'passant', 'statist'] },
];

export function initLastSeenTracker(){
  const url = location.href;

  // Edit page: remember which post is being edited, so saving the edit does
  // not trigger the popup. The lot tool uses the "first post edited" marker.
  if(/\/msg\.php/i.test(location.pathname) || url.includes('msg.php')){
    rememberEdit(url);
    return;
  }

  if(!/^#msg\d+$/.test(location.hash)) return;   // not the address of a fresh post
  const world = worldFromUrl(url);
  if(!world) return;

  const msgId = location.hash.slice(1);           // "msg123"
  const msgNum = parseInt(msgId.slice(3), 10);
  const tid = threadId(url) || '0';
  if(wasJustEdited(tid, msgNum)) return;

  const username = loggedInUser();
  if(!username) return;

  const trackedKey = 'atlas_tracked_' + tid + '_' + msgId;
  const tracked = sessionStorage.getItem(trackedKey);
  if(tracked){
    if(Date.now() - parseInt(tracked, 10) < TRACKED_MAX_AGE) return;
    sessionStorage.removeItem(trackedKey);
  }

  if(!hasFreshPostTime(FRESH_POST)) return;
  const posts = postNumbersOnPage();
  if(posts.length <= 1) return;                   // freshly created thread
  const newest = Math.max(...posts, 0);
  if(newest > 0 && msgNum < newest) return;       // not the newest post on the page

  sessionStorage.setItem(trackedKey, Date.now().toString());
  const postUrl = cleanPageUrl(url) + '#' + msgId;
  loadCharacters(username).then(chars => {
    if(chars.length) buildPopup({ world, chars, username, postUrl });
  });
}

function rememberEdit(url){
  const thread = (url.match(/[?&]Thread=(\d+)/i) || [])[1];
  const msg    = (url.match(/[?&]msg=(\d+)/i) || [])[1];
  const prev   = (url.match(/[?&]prev=(\d+)/i) || [])[1];
  if(!thread || !msg) return;
  const firstPost = prev === '0';
  try {
    sessionStorage.setItem('atlas_editing_' + thread + '_' + msg, JSON.stringify({ ts: Date.now(), firstPost }));
    if(firstPost) sessionStorage.setItem('atlas_first_post_edited_' + thread, Date.now().toString());
  } catch(_){}
}

function wasJustEdited(tid, msgNum){
  const key = 'atlas_editing_' + tid + '_' + msgNum;
  const raw = sessionStorage.getItem(key);
  if(!raw) return false;
  sessionStorage.removeItem(key);
  let ts;
  try { ts = parseInt(JSON.parse(raw).ts, 10); } catch(_){ ts = parseInt(raw, 10); }
  return Date.now() - ts < EDIT_FLAG_MAX_AGE;
}

// All characters, the user's own first, then alphabetically.
function loadCharacters(username){
  const me = username.toLowerCase();
  return fetchCsvObjects(CHARS_CSV_URL)
    .then(rows => rows
      .map(r => ({ name: r.name, player: r.player, type: r.type, threadUrl: r.threadurl }))
      .filter(c => c.name)
      .sort((a, b) => {
        const aOwn = (a.player || '').toLowerCase() === me;
        const bOwn = (b.player || '').toLowerCase() === me;
        if(aOwn !== bOwn) return aOwn ? -1 : 1;
        return a.name.localeCompare(b.name);
      }))
    .catch(() => []);
}

function buildPopup({ world, chars, username, postUrl }){
  const me = username.toLowerCase();
  const isMobile = window.innerWidth <= 480;
  const checked = new Set();
  let activeTab = 'haupt';
  let searchTerm = '';

  const overlay = document.createElement('div');
  overlay.id = 'atlas-popup-overlay';
  overlay.className = isMobile ? 'is-mobile' : '';
  overlay.innerHTML = `
    <div class="atlas-popup">
      <div class="atlas-popup-head">
        <div>
          <div class="atlas-popup-kicker">PROJEKT ATLAS</div>
          <div class="atlas-popup-title">Standort aktualisieren</div>
          <div class="atlas-popup-world">&#128205; ${escapeHtml(world)}</div>
        </div>
        <button type="button" class="atlas-popup-close" aria-label="Schliessen">✕</button>
      </div>
      <div class="atlas-popup-body">
        <div class="atlas-feature-badge"><span></span> Ein Projekt ATLAS Feature</div>
        <div class="atlas-popup-hint">1. Charaktere anwählen, die in diesem Post vorkommen<br>2. Standort speichern<br>3. Link kopieren &amp; bei jedem Charakter im Bogen eintragen</div>
        <input class="atlas-popup-search" type="text" placeholder="Charakter suchen…">
        <div class="atlas-popup-tabs">${TABS.map(t =>
          `<button type="button" class="atlas-tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
        <div class="atlas-char-list"></div>
        <button type="button" class="atlas-btn-primary">Standort speichern</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const $ = sel => overlay.querySelector(sel);
  const list = $('.atlas-char-list');
  $('.atlas-popup-close').addEventListener('click', () => overlay.remove());
  $('.atlas-popup-search').addEventListener('input', e => { searchTerm = e.target.value.toLowerCase(); renderList(); });
  overlay.querySelectorAll('.atlas-tab').forEach(btn => btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    overlay.querySelectorAll('.atlas-tab').forEach(b => b.classList.toggle('active', b === btn));
    renderList();
  }));

  function renderList(){
    const tab = TABS.find(t => t.id === activeTab);
    const shown = chars.filter(c => searchTerm
      ? c.name.toLowerCase().includes(searchTerm)
      : tab.types.includes((c.type || '').toLowerCase()));
    if(!shown.length){
      list.innerHTML = '<div class="atlas-char-empty">Keine Charaktere in dieser Kategorie</div>';
      return;
    }
    list.innerHTML = '';
    shown.forEach(c => {
      const own = (c.player || '').toLowerCase() === me;
      const item = document.createElement('label');
      item.className = 'atlas-char-item' + (own ? ' own' : '');
      item.innerHTML = `<input type="checkbox"><span class="atlas-char-name">${escapeHtml(c.name)}</span>`
        + (own ? '' : `<span class="atlas-char-player">(${escapeHtml(c.player)})</span>`);
      const cb = item.querySelector('input');
      cb.checked = checked.has(c.name);
      cb.addEventListener('change', () => { cb.checked ? checked.add(c.name) : checked.delete(c.name); });
      list.appendChild(item);
    });
  }
  renderList();

  $('.atlas-btn-primary').addEventListener('click', e => {
    if(!checked.size){ alert('Bitte mindestens einen Charakter auswählen.'); return; }
    const selected = chars.filter(c => checked.has(c.name));
    const btn = e.currentTarget;
    btn.textContent = 'Speichert…';
    btn.disabled = true;
    const now = new Date();
    callAppsScript({
      action: 'updateLastSeen',
      chars: selected.map(c => c.name).join(','),
      lastSeenName: world,
      lastSeenUrl: postUrl,
      lastSeenDate: now.getDate() + '.' + (now.getMonth() + 1) + '.' + now.getFullYear(),
      player: username,
    }, { mode: 'no-cors' })
      .catch(() => {})
      .then(() => showConfirm(selected));
  });

  function showConfirm(selected){
    const withSheet = selected.filter(c => c.threadUrl);
    $('.atlas-popup-body').innerHTML = `
      <div class="atlas-popup-success">✓ Standort für ${selected.length} Charakter${selected.length > 1 ? 'e' : ''} gespeichert</div>
      <div class="atlas-popup-label">Post-Link zum Kopieren:</div>
      <div class="atlas-url-box">${escapeHtml(postUrl)}</div>
      <button type="button" class="atlas-copy-btn">Link kopieren</button>
      ${withSheet.length ? '<div class="atlas-popup-label">Charakterbögen öffnen &amp; Link eintragen:</div>' : ''}
      ${withSheet.map((c, i) => `<button type="button" class="atlas-bogen-btn" data-i="${i}">${escapeHtml(c.name)}</button>`).join('')}
      <button type="button" class="atlas-btn-secondary">Schliessen</button>`;
    const copyBtn = $('.atlas-copy-btn');
    copyBtn.addEventListener('click', () => {
      copyText(postUrl).then(ok => {
        copyBtn.textContent = ok ? '✓ Kopiert!' : 'Kopieren nicht möglich – Link bitte markieren';
        setTimeout(() => { copyBtn.textContent = 'Link kopieren'; }, 2000);
      });
    });
    overlay.querySelectorAll('.atlas-bogen-btn').forEach(b =>
      b.addEventListener('click', () => window.open(withSheet[+b.dataset.i].threadUrl, '_blank')));
    $('.atlas-btn-secondary').addEventListener('click', () => overlay.remove());
  }
}
