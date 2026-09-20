/* PROJECT ATLAS - Character editor (forum).
   Active in the character-sheet forums. Three jobs:
   1. Archive: when a sheet was moved to the archive forum, offers to remove
      the character from the ATLAS list (Apps Script deleteChar).
   2. New sheet: if the thread is not in the sheet yet, offers to add the
      character (addChar), with the first picture of the post as avatar.
   3. The "ATLAS" gear tab on the right: edit name, age, job, home, portrait,
      occult type and gender of one's own characters (updateChar). Admins
      (key icon five times, password) can edit all characters.

   Other scripts call window._atlasTriggerCreatePrompt({force:true}) to show
   the "new character" question again (Blaze in the forum footer). The
   functions called from the panel's inline handlers are attached to window. */

import { CHARS_CSV_URL, APPS_SCRIPT_URL, callAppsScript } from '../shared/backend.js?v=202609201740';
import { fetchCsvObjects } from '../shared/csv.js?v=202609201740';
import { forumId, loggedInUser, escapeHtml } from './page.js?v=202609201740';

const CHAR_FORUMS = ['51849', '51850', '51851', '51852', '52617'];
const ARCHIVE_FORUM = '51852';
const ACTIVE_CHAR_FORUMS = { '51849': 'Hauptcharakter', '51850': 'Nebencharakter', '51851': 'Randfigur', '52617': 'Passant' };
const ADMIN_PASSWORD = 'admin0987';
const OCCULT_TYPES = ['Sim', 'Vampir', 'Werwolf', 'Magier', 'Geist', 'Fee', 'Meersim'];
const GENDERS = ['männlich', 'weiblich', 'divers'];

let url, username, threadCreator, overlay;
let CHARS = [];
let activeChar = null;
let adminMode = false;
let adminClicks = 0, adminClickTimer = null;

export function initCharacterEditor(){
  url = location.href;
  const f = forumId(url);
  if(!f || !CHAR_FORUMS.includes(f)) return;

  if(f === ARCHIVE_FORUM) checkArchived();

  username = loggedInUser();
  if(!username) return;
  threadCreator = detectThreadCreator();

  window._atlasTriggerCreatePrompt = triggerCreatePrompt;
  triggerCreatePrompt();

  buildEditorShell();
  exposeHandlers();
}

// Sheet rows with the fields the editor uses.
function loadAllCharacters(){
  return fetchCsvObjects(CHARS_CSV_URL).then(rows => rows.map(r => ({
    name: r.name, player: r.player, type: r.type, age: r.age, job: r.job, home: r.home,
    portraitUrl: r.portraiturl, threadUrl: r.threadurl, okkult: r.okkult, gender: r.gender,
  })).filter(c => c.name));
}

// Sheet entry whose thread address has the given thread id (names in the
// sheet are often shortened, so the thread id is the reliable key).
function findByThreadId(chars, tid){
  const re = new RegExp('/t' + tid + 'f\\d+');
  return chars.find(c => c.threadUrl && re.test(c.threadUrl));
}

// --- 1. Archive -------------------------------------------------------------
function checkArchived(){
  const tid = (url.match(/\/t(\d+)f51852-/) || [])[1];
  if(!tid) return;
  loadAllCharacters().then(chars => {
    const match = findByThreadId(chars, tid);
    if(!match) return;
    if(!confirm('Wurde "' + match.name + '" soeben archiviert?\n\nWenn ja, wird der Charakter aus der ATLAS-Liste entfernt.')) return;
    callAppsScript({ action: 'deleteChar', name: match.name }, { mode: 'no-cors' })
      .then(() => alert('"' + match.name + '" wurde aus der ATLAS-Liste entfernt.'))
      .catch(() => alert('Fehler beim Entfernen. Versuche es später erneut.'));
  }).catch(err => console.warn('[ATLAS] Archiv-Prüfung:', err));
}

// Author of the first post in the thread = the player of the character.
// The logged-in user can be someone else (e.g. an admin).
function detectThreadCreator(){
  const anchors = [...document.querySelectorAll('a[name^="msg"]')]
    .map(a => ({ el: a, num: parseInt((a.getAttribute('name') || '').replace('msg', ''), 10) }))
    .map(a => ({ el: a.el, num: isNaN(a.num) ? Infinity : a.num }))
    .sort((a, b) => a.num - b.num);
  if(!anchors.length) return null;
  const nameFrom = link => {
    const m = link && (link.getAttribute('href') || link.href || '').match(/u(\d+)_([A-Za-z0-9_]+)\.html/);
    return m ? m[2] : null;
  };
  const card = document.getElementById('post_' + anchors[0].num);
  if(card){
    const n = nameFrom(card.querySelector('a[href*="/u"][href*="_"]'));
    if(n) return n;
  }
  let node = anchors[0].el;
  for(let i = 0; i < 50 && node; i++){
    node = node.nextElementSibling || (node.parentElement && node.parentElement.nextElementSibling);
    if(!node) break;
    const n = nameFrom(node.querySelector && node.querySelector('a[href*="/u"][href*="_"]'));
    if(n) return n;
  }
  return null;
}

// --- 2. New character -------------------------------------------------------
function triggerCreatePrompt(opts){
  const force = !!(opts && opts.force);
  const charType = ACTIVE_CHAR_FORUMS[forumId(url)];
  if(!charType) return false;
  const m = url.match(/\/t(\d+)f\d+-([^.]+)\.html/);
  if(!m) return false;
  const tid = m[1];
  const nameSuggestion = m[2].replace(/-/g, ' ').trim();
  const dismissKey = 'atlas_create_dismissed_' + tid;
  if(force) sessionStorage.removeItem(dismissKey);
  else if(sessionStorage.getItem(dismissKey)) return false;

  loadAllCharacters().then(chars => {
    if(findByThreadId(chars, tid)) return;   // already in the sheet
    // First picture of the sheet as avatar suggestion (best effort)
    fetch(APPS_SCRIPT_URL + '?action=postPreview&url=' + encodeURIComponent(url) + '&firstPost=1')
      .then(r => r.json()).then(p => (p && p.image) || '').catch(() => '')
      .then(suggestedImage => askAndAdd(charType, nameSuggestion, suggestedImage, dismissKey));
  }).catch(err => console.warn('[ATLAS] Neuer Charakter:', err));
  return true;
}

function askAndAdd(charType, nameSuggestion, suggestedImage, dismissKey){
  const name = prompt(
    'Soll dieser Charakter ins ATLAS-Sheet eingetragen werden?\n\nTyp: ' + charType + '\n\nName (kann editiert werden):',
    nameSuggestion);
  sessionStorage.setItem(dismissKey, '1');
  if(!name || !name.trim()) return;
  let image = '';
  if(suggestedImage){
    image = prompt('Avatar-Bild für "' + name.trim() + '":\n\n(Vorschlag = erstes Bild im Bogen. Du kannst die URL anpassen oder leeren.)',
      suggestedImage) || '';
  }
  const params = { action: 'addChar', name: name.trim(), type: charType, threadUrl: url,
    player: threadCreator || username, okkult: 'Sim' };
  if(suggestedImage) params.image = image;
  callAppsScript(params, { mode: 'no-cors' })
    .then(() => alert('"' + name.trim() + '" wurde ins ATLAS-Sheet eingetragen.'))
    .catch(() => alert('Fehler beim Eintragen. Versuche es später erneut.'));
}

// --- 3. Editor panel --------------------------------------------------------
function buildEditorShell(){
  const btn = document.createElement('div');
  btn.id = 'atlas-edit-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.69.07-1.08s-.03-.73-.07-1.08l2.32-1.81c.21-.16.27-.45.13-.68l-2.2-3.81c-.13-.23-.42-.31-.65-.23l-2.74 1.1c-.57-.44-1.18-.8-1.85-1.09l-.41-2.92A.5.5 0 0 0 14 3h-4c-.25 0-.46.18-.5.43l-.41 2.92C8.45 6.64 7.84 7 7.27 7.44L4.53 6.34c-.23-.09-.52 0-.65.23L1.68 10.38c-.14.23-.08.52.13.68l2.32 1.81C4.09 13.27 4.06 13.62 4.06 14s.03.73.07 1.08L1.81 16.89c-.21.16-.27.45-.13.68l2.2 3.81c.13.23.42.31.65.23l2.74-1.1c.57.44 1.18.8 1.85 1.09l.41 2.92c.04.25.25.43.5.43h4c.25 0 .46-.18.5-.43l.41-2.92c.67-.29 1.28-.65 1.85-1.09l2.74 1.1c.23.09.52 0 .65-.23l2.2-3.81c.14-.23.08-.52-.13-.68l-2.32-1.81z"/></svg><span>ATLAS</span>';
  btn.addEventListener('click', () => overlay.classList.contains('open') ? closeEditor() : openEditor());
  document.body.appendChild(btn);

  overlay = document.createElement('div');
  overlay.id = 'atlas-edit-overlay';
  overlay.innerHTML = '<div id="atlas-edit-panel"></div>';
  overlay.addEventListener('click', e => { if(e.target === overlay) closeEditor(); });
  document.body.appendChild(overlay);
}

function openEditor(){
  overlay.classList.add('open');
  if(!CHARS.length) loadChars(buildPanel);
  else buildPanel(CHARS);
}
function closeEditor(){ overlay.classList.remove('open'); }

function loadChars(cb, retriesLeft = 1){
  const panel = document.getElementById('atlas-edit-panel');
  panel.innerHTML = '<div class="atlas-edit-loading">&#9203; Lade…</div>';
  loadAllCharacters().then(all => {
    CHARS = adminMode ? all : all.filter(c => (c.player || '').toLowerCase() === username.toLowerCase());
    // Outside the promise chain, so an error in cb does not look like a load error
    setTimeout(() => cb(CHARS), 0);
  }).catch(() => {
    if(retriesLeft > 0) setTimeout(() => loadChars(cb, retriesLeft - 1), 300);
    else panel.innerHTML = '<div class="atlas-edit-error">Fehler beim Laden.</div>';
  });
}

function setAdminIcon(on){
  const icon = document.getElementById('atlas-admin-icon');
  if(!icon) return;
  icon.classList.toggle('admin-active', on);
  icon.title = on ? 'Admin aktiv' : 'Admin';
}

function buildPanel(chars){
  const panel = document.getElementById('atlas-edit-panel');
  let html = `
    <div class="atlas-edit-head">
      <div>
        <div class="atlas-popup-kicker">PROJEKT ATLAS</div>
        <div class="atlas-edit-title">Charakter bearbeiten</div>
      </div>
      <div class="atlas-edit-head-actions">
        <span id="atlas-admin-icon" title="${adminMode ? 'Admin aktiv' : 'Admin'}" class="${adminMode ? 'admin-active' : ''}" onclick="window._atlasAdminClick()">&#128273;</span>
        <button type="button" class="atlas-edit-close" onclick="document.getElementById('atlas-edit-overlay').classList.remove('open')">&#10005;</button>
      </div>
    </div>
    <div class="atlas-feature-badge"><span></span> Ein Projekt ATLAS Feature</div>
    <div class="atlas-edit-intro">Wähle einen Charakter und bearbeite seine Daten direkt im Sheet.</div>`;

  if(!chars.length){
    panel.innerHTML = html + '<div class="atlas-edit-empty">Keine Charaktere gefunden.</div>';
    return;
  }

  html += `
    <div class="atlas-edit-field">
      <label>SUCHE</label>
      <input id="atlas-char-search" type="text" placeholder="Name tippen…" autocomplete="off" oninput="window._atlasSearchChars(this.value)">
      <div id="atlas-search-results"></div>
    </div>
    <div class="atlas-edit-field">
      <label>CHARAKTER</label>
      <select id="atlas-char-select" onchange="window._atlasCharSelectChange(this.value)">
        <option value="">— auswählen —</option>
        ${chars.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} (${escapeHtml(c.type)})</option>`).join('')}
      </select>
    </div>
    <div id="atlas-edit-fields" style="display:none">
      <img id="atlas-portrait-preview" class="atlas-portrait-preview" src="" onerror="this.style.display='none'">
      <div class="atlas-edit-field"><label>NAME</label><input id="edit-name" type="text"></div>
      <div class="atlas-edit-field"><label>ALTER</label><input id="edit-age" type="text"></div>
      <div class="atlas-edit-field"><label>BERUF</label><input id="edit-job" type="text"></div>
      <div class="atlas-edit-field"><label>HEIMATORT (HOME)</label><input id="edit-home" type="text"></div>
      <div class="atlas-edit-field"><label>PORTRAIT URL</label><input id="edit-portrait" type="text" oninput="document.getElementById('atlas-portrait-preview').src=this.value"></div>
      <div class="atlas-edit-field"><label>OKKULT-TYP</label>
        <select id="edit-okkult">${OCCULT_TYPES.map(o => `<option value="${o}">${o}</option>`).join('')}</select>
      </div>
      <div class="atlas-edit-field"><label>GESCHLECHT</label>
        <select id="edit-gender"><option value="">— auswählen —</option>${GENDERS.map(g => `<option value="${g}">${g}</option>`).join('')}</select>
      </div>
      <button type="button" class="atlas-save-btn" onclick="window._atlasEditSave()">Speichern</button>
      <div id="atlas-edit-msg"></div>
    </div>`;
  panel.innerHTML = html;

  if(sessionStorage.getItem('atlas_editor_admin') === '1') adminMode = true;

  // Coming back from navigating to another character's sheet: reopen it
  const reopen = sessionStorage.getItem('atlas_editor_reopen');
  if(reopen){
    sessionStorage.removeItem('atlas_editor_reopen');
    loadChars(list => {
      buildPanel(list);
      setTimeout(() => {
        overlay.classList.add('open');
        const sel = document.getElementById('atlas-char-select');
        if(sel){ sel.value = reopen; selectChar(reopen); }
        if(adminMode) setAdminIcon(true);
      }, 100);
    });
  }

  // Preselect the character whose sheet this is (by thread slug)
  const slug = ((url.match(/\/t\d+f\d+-([^.]+)\.html/) || [])[1] || '').toLowerCase();
  if(slug){
    const matched = chars.find(c => {
      const nameSlug = c.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      return slug.includes(nameSlug.split('-')[0]);
    });
    if(matched){
      document.getElementById('atlas-char-select').value = matched.name;
      selectChar(matched.name);
    }
  }
}

// Same address, ignoring http/https and "#…"
function sameUrl(a, b){
  if(!a || !b) return false;
  const strip = u => String(u).replace(/^https?:/, '').replace(/#.*$/, '');
  return strip(a) === strip(b);
}

// Shows a character in the editor, or navigates to its sheet (and reopens the
// editor there). Sheets outside the character forums are edited in place,
// because the editor does not exist there.
function showOrNavigate(char){
  if(!char) return;
  const inPlace = !char.threadUrl
    || sameUrl(char.threadUrl, location.href)
    || !CHAR_FORUMS.includes((char.threadUrl.match(/f(\d+)/) || [])[1]);
  if(inPlace){
    document.getElementById('atlas-char-select').value = char.name;
    selectChar(char.name);
    return;
  }
  sessionStorage.setItem('atlas_editor_reopen', char.name);
  sessionStorage.setItem('atlas_editor_admin', adminMode ? '1' : '');
  location.href = char.threadUrl;
}

function selectChar(name){
  const fields = document.getElementById('atlas-edit-fields');
  if(!name){ fields.style.display = 'none'; return; }
  activeChar = CHARS.find(c => c.name === name);
  if(!activeChar) return;
  fields.style.display = 'block';
  const set = (id, v) => { document.getElementById(id).value = v || ''; };
  set('edit-name', activeChar.name);
  set('edit-age', activeChar.age);
  set('edit-job', activeChar.job);
  set('edit-home', activeChar.home);
  set('edit-portrait', activeChar.portraitUrl);
  document.getElementById('edit-okkult').value = activeChar.okkult || 'Sim';
  if(!document.getElementById('edit-okkult').value) document.getElementById('edit-okkult').value = 'Sim';
  document.getElementById('edit-gender').value = (activeChar.gender || '').trim();
  const preview = document.getElementById('atlas-portrait-preview');
  preview.src = activeChar.portraitUrl || '';
  preview.style.display = activeChar.portraitUrl ? 'block' : 'none';
  const msg = document.getElementById('atlas-edit-msg');
  msg.textContent = '';

  // No portrait yet: suggest the first picture of the character sheet
  if(!activeChar.portraitUrl && activeChar.threadUrl){
    fetch(APPS_SCRIPT_URL + '?action=postPreview&url=' + encodeURIComponent(activeChar.threadUrl) + '&firstPost=1')
      .then(r => r.json())
      .then(p => {
        const input = document.getElementById('edit-portrait');
        if(!p || !p.image || !input || input.value) return;   // the user typed something meanwhile
        input.value = p.image;
        preview.src = p.image;
        preview.style.display = 'block';
        msg.textContent = 'Vorschlag aus Bogen eingefügt — anpassbar';
        msg.style.color = 'rgba(74,170,106,0.7)';
      })
      .catch(() => {});
  }
}

function showAdminLogin(){
  const ov = document.createElement('div');
  ov.id = 'atlas-admin-login-overlay';
  ov.innerHTML = `<div class="atlas-admin-login">
    <div class="atlas-admin-login-title">Admin-Passwort</div>
    <input type="password" id="atlas-admin-login-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
    <div class="atlas-admin-login-buttons">
      <button type="button" id="atlas-admin-login-ok">OK</button>
      <button type="button" id="atlas-admin-login-cancel">Abbrechen</button>
    </div></div>`;
  document.body.appendChild(ov);
  const input = document.getElementById('atlas-admin-login-input');
  setTimeout(() => input.focus(), 50);
  const submit = () => {
    // trim + lowercase: mobile keyboards like to capitalize or autocorrect
    if((input.value || '').trim().toLowerCase() === ADMIN_PASSWORD){
      ov.remove();
      adminMode = true;
      sessionStorage.setItem('atlas_editor_admin', '1');
      setAdminIcon(true);
      CHARS = [];
      loadChars(buildPanel);
    } else {
      input.classList.add('wrong');
      input.value = '';
      input.placeholder = 'Falsches Passwort';
      input.focus();
    }
  };
  document.getElementById('atlas-admin-login-ok').onclick = submit;
  document.getElementById('atlas-admin-login-cancel').onclick = () => ov.remove();
  input.addEventListener('keydown', e => { if(e.key === 'Enter') submit(); else if(e.key === 'Escape') ov.remove(); });
}

// Functions called from the panel's inline handlers
function exposeHandlers(){
  window._atlasSearchChars = function(query){
    const results = document.getElementById('atlas-search-results');
    if(!results) return;
    const q = query.trim().toLowerCase();
    if(!q){ results.classList.remove('open'); results.innerHTML = ''; return; }
    const matches = CHARS.filter(c => c.name.toLowerCase().includes(q));
    results.innerHTML = matches.length
      ? matches.map((c, i) => `<div class="atlas-search-result" data-i="${i}">${escapeHtml(c.name)}<span class="atlas-search-result-type">(${escapeHtml(c.type || '')})</span></div>`).join('')
      : '<div class="atlas-search-empty">Keine Treffer</div>';
    results.querySelectorAll('.atlas-search-result').forEach(el =>
      el.addEventListener('click', () => showOrNavigate(matches[+el.dataset.i])));
    results.classList.add('open');
  };

  window._atlasCharSelectChange = function(name){
    if(!name){ document.getElementById('atlas-edit-fields').style.display = 'none'; return; }
    showOrNavigate(CHARS.find(c => c.name === name));
  };

  window._atlasEditSelectChar = selectChar;

  window._atlasAdminClick = function(){
    adminClicks++;
    clearTimeout(adminClickTimer);
    adminClickTimer = setTimeout(() => { adminClicks = 0; }, 5000);
    if(adminClicks < 5) return;
    adminClicks = 0;
    if(adminMode){
      adminMode = false;
      sessionStorage.removeItem('atlas_editor_admin');
      setAdminIcon(false);
      CHARS = [];
      loadChars(buildPanel);
    } else {
      showAdminLogin();
    }
  };

  window._atlasEditNav = function(dir){
    if(!activeChar) return;
    showOrNavigate(CHARS[CHARS.findIndex(c => c.name === activeChar.name) + dir]);
  };

  window._atlasEditSave = function(){
    if(!activeChar) return;
    const msg = document.getElementById('atlas-edit-msg');
    msg.textContent = 'Speichern…';
    msg.style.color = 'rgba(255,255,255,0.4)';
    const val = id => document.getElementById(id).value.trim();
    const updated = {
      name: val('edit-name'), age: val('edit-age'), job: val('edit-job'), home: val('edit-home'),
      portraitUrl: val('edit-portrait'), okkult: val('edit-okkult'), gender: val('edit-gender'),
    };
    callAppsScript({ action: 'updateChar', originalName: activeChar.name, ...updated, player: username }, { mode: 'no-cors' })
      .then(() => {
        msg.textContent = 'Gespeichert!';
        msg.style.color = '#4aaa6a';
        const oldName = activeChar.name;
        Object.assign(activeChar, updated);
        const opt = [...document.getElementById('atlas-char-select').options].find(o => o.value === oldName);
        if(opt){ opt.value = activeChar.name; opt.text = activeChar.name + ' (' + (activeChar.type || '') + ')'; }
      })
      .catch(() => {
        msg.textContent = 'Fehler beim Speichern.';
        msg.style.color = '#ff6b6b';
      });
  };
}
