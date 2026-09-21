/* PROJECT ATLAS - Lot assignment (forum).
   In a world forum, right after a new thread was created (one post, written
   just now), a popup offers to assign the thread to a lot ("Grundstück") of
   that world. The choice is written to the lots tab of the sheet (Apps Script
   updateLot), which ATLAS reads.

   Other situations handled here:
   - First post edited: offers to take the first picture of the post as the
     lot's preview picture.
   - Outer-worlds forum ("Orte ausserhalb von Simswelt"): a new thread is a
     new world; offers to add it to ATLAS with a picture from the post.

   Lot numbers in the sheet: "Nr. 4#" is an empty placeholder, "Nr. 4A"/"4B"
   are units of an apartment complex on dot 4, "Nr. 4ZZ"/"4ZY" are further
   single lots sharing dot 4. An assignment on a dot that already has rows
   NEVER overwrites those rows: it is always written as a new row with the
   next free ZZ/ZY/… suffix (a chosen unit "Nr. 7B" is saved as "Nr. 7BZZ"),
   so the curated unit and anchor rows in the sheet stay untouched. The functions called from the popup's inline
   handlers are attached to window (window._alot…). */

import { LOTS_CSV_URL, callAppsScript } from '../shared/backend.js?v=202609211339';
import { fetchCsvObjects } from '../shared/csv.js?v=202609211339';
import { worldFromUrl, OUTER_WORLDS_FORUM } from './worlds.js?v=202609211339';
import { forumId, threadId, postNumbersOnPage, hasFreshPostTime, firstPostImages, cleanPageUrl, escapeHtml } from './page.js?v=202609211339';
import { worldLots } from '../atlas/data/world-lots.js?v=202609211339';

const EDIT_FLAG_MAX_AGE = 5 * 60 * 1000;
const FRESH_THREAD = /vor einer Minute|gerade eben|vor \d+ Minuten/i;
const SINGLE_LOT_SUFFIXES = ['ZZ', 'ZY', 'ZX', 'ZW', 'ZV', 'ZU', 'ZT', 'ZS', 'ZR', 'ZQ'];

let skipKey = '';
let state = {};

export function initLotAssignment(){
  const url = location.href;
  const path = location.pathname;

  // Edit page: remember the edited post (the address of msg.php has no f<nr>)
  if(/\/msg\.php/i.test(path) || url.includes('msg.php')){
    const thread = (url.match(/[?&]Thread=(\d+)/i) || [])[1];
    const msg    = (url.match(/[?&]msg=(\d+)/i) || [])[1];
    if(thread && msg){
      try { sessionStorage.setItem('atlas_lot_edited_' + thread + '_' + msg, Date.now().toString()); } catch(_){}
    }
    return;
  }

  const fid = forumId(url);
  const world = worldFromUrl(url);
  if(!fid || !world) return;

  // Only on page 1 of a thread (…-2.html is page 2)
  const pageMatch = path.match(/-(\d+)\.html$/);
  const isPage1 = !pageMatch || pageMatch[1] === '1';
  const tid = threadId(url) || '0';
  const hashMsgId = (url.match(/#msg(\d+)/) || [])[1];

  const editMode = isFirstPostJustEdited(tid, hashMsgId, isPage1);
  if(!editMode){
    if(!isPage1) return;
    if(postNumbersOnPage().length > 1) return;     // thread already has answers
    if(!hasFreshPostTime(FRESH_THREAD)) return;
  }

  skipKey = editMode ? 'atlas_lot_edit_' + tid + '_' + hashMsgId : 'atlas_lot_assign_' + tid;
  // Closed once in this session: do not ask again (the edit popup always asks)
  if(!editMode && sessionStorage.getItem(skipKey)) return;
  if(editMode) sessionStorage.removeItem(skipKey);

  const title = threadTitle(url, world);
  const postUrl = cleanPageUrl(url);

  fetchCsvObjects(LOTS_CSV_URL).then(rows => {
    const lots = rows.map(r => ({
      world: r['welt'], nr: r['nr.'], name: r['name'], threadUrl: r['thread url'],
      imgUrl: r['bild url'], dotGroup: r['dot-gruppe'],
    }));
    const worldImage = (lots.find(l => l.world === world && !l.nr) || {}).imgUrl || '';

    if(fid === OUTER_WORLDS_FORUM){
      const exists = lots.some(l => l.world === world && !l.nr);
      if(exists && !editMode){ sessionStorage.setItem(skipKey, '1'); return; }
      buildWorldMetaPopup(world, postUrl, exists);
      return;
    }

    const worldLots = lots.filter(l => l.world === world && l.nr);
    if(editMode){
      const norm = u => (u || '').split('#')[0].split('?')[0].replace(/-\d+\.html$/, '.html').replace(/^https?:\/\//, '//');
      const myLot = worldLots.find(l => norm(l.threadUrl) === norm(postUrl));
      const images = firstPostImages();
      if(!myLot || !images.length){ sessionStorage.setItem(skipKey, '1'); return; }
      buildEditPopup(world, myLot, images, postUrl);
    } else {
      buildAssignPopup(world, worldLots, title, postUrl, worldImage);
    }
  }).catch(() => {});
}

// The user just saved an edit of post 1 of this thread (marker from msg.php).
function isFirstPostJustEdited(tid, hashMsgId, isPage1){
  if(!hashMsgId || tid === '0') return false;
  const key = 'atlas_lot_edited_' + tid + '_' + hashMsgId;
  const flag = sessionStorage.getItem(key);
  if(!flag) return false;
  sessionStorage.removeItem(key);
  if(Date.now() - parseInt(flag, 10) >= EDIT_FLAG_MAX_AGE || !isPage1) return false;
  return postNumberOf(hashMsgId) === 1;
}

// Number shown in the post header ("#1 vor 2 Minuten").
function postNumberOf(msgId){
  const card = document.getElementById('post_' + msgId);
  if(!card) return null;
  for(const el of card.querySelectorAll('.card-header span, .card-header strong, .card-header a, span.float-right, span.nobreak')){
    const m = el.textContent.trim().match(/^#(\d+)/);
    if(m) return parseInt(m[1], 10);
  }
  const m = card.textContent.match(/#(\d+)\s+(?:vor|am)/);
  return m ? parseInt(m[1], 10) : null;
}

// Thread title from the address slug, without the world name in front
// ("San Sequoia Haus X" -> "Haus X"); the page headline as fallback.
function threadTitle(url, world){
  const slug = (url.match(/\/t\d+f\d+-([^.]+)\.html/) || [])[1];
  let title = slug ? slug.replace(/-/g, ' ').trim() : '';
  if(title.toLowerCase().startsWith(world.toLowerCase())) title = title.slice(world.length).trim();
  return title
    || document.querySelector('.thread-title')?.textContent?.trim()
    || document.querySelector('.topic-title')?.textContent?.trim()
    || document.querySelector('h2')?.textContent?.trim()
    || '';
}

function overlayWith(html){
  const overlay = document.createElement('div');
  overlay.id = 'atlas-lot-overlay';
  overlay.innerHTML = `<div id="atlas-lot-panel">${html}</div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function closeAndSkip(overlay){ sessionStorage.setItem(skipKey, '1'); overlay.remove(); }

function saved(msg, text, overlay, delay){
  msg.style.color = '#4aaa6a';
  msg.textContent = text;
  sessionStorage.setItem(skipKey, '1');
  setTimeout(() => overlay.remove(), delay);
}

const FEATURE_BADGE = '<div class="atlas-feature-badge"><span></span> Ein Projekt ATLAS Feature</div>';

function header(title, sub, withMinimize){
  return `<div class="alot-head">
      <div>
        <div class="atlas-popup-kicker">PROJEKT ATLAS</div>
        <div class="alot-title">${title}</div>
        <div class="alot-sub">${sub}</div>
      </div>
      <div class="alot-head-actions">
        ${withMinimize ? '<button type="button" id="alot-minimize" title="Minimieren">&#8212;</button>' : ''}
        <button type="button" id="alot-close" aria-label="Schliessen">&#10005;</button>
      </div>
    </div>`;
}

// --- Outer worlds: add a world to ATLAS -------------------------------------
function buildWorldMetaPopup(world, postUrl, isUpdate){
  const images = firstPostImages();
  const overlay = overlayWith(`
    ${header(isUpdate ? 'Welt-Bild ändern' : 'Neue Welt anlegen', '&#127758; ' + escapeHtml(world))}
    ${FEATURE_BADGE}
    <div class="alot-intro">${isUpdate
      ? `Du bearbeitest den ersten Post von <strong>${escapeHtml(world)}</strong>. Möchtest du das ATLAS-Welt-Bild aktualisieren?`
      : `Du hast einen neuen Thread in <strong>Orte ausserhalb von Simswelt</strong> angelegt. Soll <strong>${escapeHtml(world)}</strong> als eigene Welt im ATLAS erscheinen?`}</div>
    <div id="alot-content"></div>
    <button type="button" class="alot-save" id="alot-save" disabled>${isUpdate ? 'Bild aktualisieren' : 'Welt anlegen'}</button>
    <div id="alot-msg"></div>`);
  document.getElementById('alot-close').onclick = () => closeAndSkip(overlay);

  const content = document.getElementById('alot-content');
  const saveBtn = document.getElementById('alot-save');
  let chosen = '';
  if(images.length){
    content.innerHTML = '<div class="alot-label">Welt-Bild wählen (Klick):</div>'
      + '<div class="alot-thumbs">' + images.map(src => `<img src="${escapeHtml(src)}" class="alot-meta-thumb">`).join('') + '</div>'
      + '<div class="alot-note">Du kannst das Bild später im Sheet ändern.</div>';
    content.querySelectorAll('.alot-meta-thumb').forEach(thumb => thumb.addEventListener('click', () => {
      content.querySelectorAll('.alot-meta-thumb').forEach(t => t.classList.toggle('selected', t === thumb));
      chosen = thumb.src;
      saveBtn.disabled = false;
    }));
  } else {
    content.innerHTML = '<div class="alot-box">Kein Bild im ersten Post gefunden. Die Welt wird ohne Bild angelegt — du kannst es später im Sheet ergänzen.</div>';
    saveBtn.disabled = false;
  }

  saveBtn.onclick = () => {
    const msg = document.getElementById('alot-msg');
    saveBtn.disabled = true;
    msg.style.color = 'rgba(255,255,255,0.5)';
    msg.textContent = 'Speichere…';
    callAppsScript({ action: 'updateLot', mode: 'worldMeta', world, imgUrl: chosen, threadUrl: postUrl }, { mode: 'no-cors' })
      .then(() => saved(msg, isUpdate ? '✓ Bild aktualisiert!' : '✓ Welt angelegt!', overlay, 1200))
      .catch(err => {
        msg.style.color = '#e05555';
        msg.textContent = 'Fehler: ' + err.message;
        saveBtn.disabled = false;
      });
  };
}

// --- First post edited: update the lot's preview picture -------------------
function buildEditPopup(world, lot, images, postUrl){
  const hasOld = !!lot.imgUrl;
  const newImg = images[0];
  const overlay = overlayWith(`
    ${header(hasOld ? 'Vorschaubild aktualisieren?' : 'Vorschaubild ergänzen?',
      '&#128205; ' + escapeHtml(world + ' ' + lot.nr + (lot.name ? ' — ' + lot.name : '')))}
    <div class="alot-intro">${hasOld
      ? 'Du hast den ersten Post bearbeitet. ATLAS hat ein neues Bild gefunden — soll es das aktuelle Vorschaubild ersetzen?'
      : 'Du hast den ersten Post bearbeitet. ATLAS hat ein Bild gefunden — als Vorschaubild fürs Grundstück übernehmen?'}</div>
    ${hasOld ? `<div class="alot-label">Aktuell im ATLAS:</div><img src="${escapeHtml(lot.imgUrl)}" loading="lazy" class="alot-preview old">` : ''}
    <div class="alot-label">${hasOld ? 'Neu' : 'Vorschlag'}:</div>
    <img src="${escapeHtml(newImg)}" loading="lazy" class="alot-preview">
    <div class="alot-label">Andere URL einfügen <span class="alot-dim">(optional, überschreibt Vorschlag)</span></div>
    <input class="alot-input" id="alot-edit-manual-url" type="text" placeholder="https://files.homepagemodules.de/...">
    <button type="button" class="alot-save" id="alot-save-edit">Ja, ${hasOld ? 'ersetzen' : 'übernehmen'}</button>
    <button type="button" class="alot-save alot-secondary" id="alot-skip-edit">Nicht jetzt</button>
    <div id="alot-msg"></div>`);
  document.getElementById('alot-close').onclick = () => closeAndSkip(overlay);
  document.getElementById('alot-skip-edit').onclick = () => closeAndSkip(overlay);
  document.getElementById('alot-save-edit').onclick = () => {
    const finalUrl = document.getElementById('alot-edit-manual-url').value.trim() || newImg;
    if(!finalUrl) return;
    const msg = document.getElementById('alot-msg');
    msg.style.color = 'rgba(255,255,255,0.4)';
    msg.textContent = 'Speichern…';
    callAppsScript({ action: 'updateLot', world: lot.world, nr: lot.nr, name: lot.name || '',
      threadUrl: lot.threadUrl || postUrl, imgUrl: finalUrl }, { mode: 'no-cors' })
      .then(() => saved(msg, '✓ Vorschaubild aktualisiert', overlay, 1500))
      .catch(() => { msg.style.color = '#ff6b6b'; msg.textContent = 'Fehler beim Speichern.'; });
  };
}

// --- New thread: assign it to a lot -----------------------------------------
function buildAssignPopup(world, lots, title, postUrl, worldImage){
  // Popup width is at most 520 px: request a smaller copy of the world image
  const img = worldImage ? worldImage.replace(/\/resize\/\d+x\d+\//, '/resize/1040x9999/') : '';
  const overlay = overlayWith(`
    ${header('Grundstück zuweisen', '&#128205; ' + escapeHtml(world), true)}
    ${FEATURE_BADGE}
    <div class="alot-intro">Neuer Thread: <strong>${escapeHtml(title || 'Unbekannt')}</strong></div>
    ${img ? `<div class="alot-map alot-minimize-hide" id="alot-map"><img class="alot-world-img" src="${escapeHtml(img)}" alt="${escapeHtml(world)}"></div>` : ''}
    <div id="alot-content" class="alot-minimize-hide"></div>
    <button type="button" class="alot-save alot-minimize-hide" id="alot-save" disabled>Zuweisen</button>
    <div id="alot-msg" class="alot-minimize-hide"></div>`);
  document.getElementById('alot-close').onclick = () => closeAndSkip(overlay);
  document.getElementById('alot-minimize').onclick = function(){
    const minimized = document.getElementById('atlas-lot-panel').classList.toggle('minimized');
    overlay.classList.toggle('minimized', minimized);
    this.innerHTML = minimized ? '&#9650;' : '&#8212;';
    this.title = minimized ? 'Wiederherstellen' : 'Minimieren';
  };
  document.getElementById('alot-save').onclick = () => save(world, postUrl, title, lots);
  exposeHandlers(lots);
  renderDotChoice(lots, world);
}

// Coordinates of a dot group, from the hard-coded lot data. The coordinates
// carry either a plain lot number ("Nr. 4") or a name ("Strassen",
// "Alto-Apartments"). The sheet side may be a bare group ("4"), a full lot
// number ("Nr. 4") or a row of that dot ("Nr. 4#", "Nr. 4A", "Nr. 4BZZ"): tried
// as written first, then reduced to its leading number. "Nr. " is ignored on
// both sides, as ATLAS does.
const bareNr = n => String(n == null ? '' : n).replace(/^Nr\.\s*/, '').trim();
const baseNr = n => { const m = bareNr(n).match(/^\d+/); return m ? m[0] : bareNr(n); };

function dotCoords(world, group, nr){
  const bare = bareNr, base = baseNr;
  const list = (worldLots[world] || []).filter(l => typeof l.x === 'number' && typeof l.y === 'number');
  for(const key of [bare(group), base(group), base(nr)]){
    if(!key) continue;
    const hit = list.find(l => bare(l.nr) === key);
    if(hit) return hit;
  }
  return null;
}

// Numbered dots on the world picture, one per button below. A dot is drawn only
// where calibrated coordinates exist; the buttons stay the complete list.
function renderDotMap(world, groups){
  const map = document.getElementById('alot-map');
  if(!map) return;
  map.querySelectorAll('.alot-dot').forEach(d => d.remove());
  [...groups.keys()].forEach(g => {
    const pos = dotCoords(world, g, groups.get(g)[0].nr);
    if(!pos) return;
    const occupied = groups.get(g).some(l => l.threadUrl);
    const nr = groups.get(g)[0].nr;
    const name = (groups.get(g).find(l => l.name) || {}).name || '';
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'alot-dot' + (occupied ? ' occupied' : '');
    dot.dataset.group = g;
    dot.style.left = pos.x + '%';
    dot.style.top = pos.y + '%';
    dot.textContent = baseNr(g);   // "Nr. 6#" -> "6", "Strassen" stays
    dot.title = name || String(nr);
    dot.onclick = () => window._alotPickNr(nr, g);
    map.appendChild(dot);
  });
}

function renderDotChoice(lots, world){
  state = { nr: null, dotGroup: null, dotLots: [], existing: null, isComplex: null, isNewOnDot: null };
  document.getElementById('alot-save').disabled = true;
  // Map keeps the sheet order (a plain object would sort number-like keys first)
  const groups = new Map();
  lots.forEach(l => { const g = l.dotGroup || l.nr; if(!groups.has(g)) groups.set(g, []); groups.get(g).push(l); });
  const buttons = [...groups.keys()].map(g => {
    const occupied = groups.get(g).some(l => l.threadUrl);
    const nr = groups.get(g)[0].nr;
    return `<button type="button" class="alot-btn${occupied ? ' occupied' : ''}" data-group="${escapeHtml(g)}" onclick="window._alotPickNr(${attr(nr)},${attr(g)})"${occupied ? ' title="Bereits belegt – neues Grundstück möglich"' : ''}>${escapeHtml(g)}</button>`;
  }).join('');
  document.getElementById('alot-content').innerHTML =
    '<div class="alot-hint">&#9679; Gelb = Dot bereits belegt, aber neues Grundstück möglich</div>'
    + '<div class="alot-label">Dot-Nummer wählen:</div>'
    + '<div class="alot-grid">' + buttons + '</div>'
    + '<div id="alot-step2"></div>';
  renderDotMap(world, groups);
}

// A JS string literal safe for an inline onclick attribute
function attr(s){ return escapeHtml(JSON.stringify(String(s == null ? '' : s))); }

const imgField = (label) => `<div class="alot-label">${label} <span class="alot-dim">(optional)</span></div>
  <input class="alot-input" id="alot-img" type="text" placeholder="https://files.homepagemodules.de/...">`;

function exposeHandlers(allLots){
  const isSingleLotSuffix = n => /\d+Z[A-Z]$/.test(n);

  window._alotPickNr = function(nr, group){
    document.querySelectorAll('.alot-btn').forEach(b => b.classList.toggle('selected', b.dataset.group === group));
    document.querySelectorAll('.alot-dot').forEach(d => d.classList.toggle('selected', d.dataset.group === group));
    state.nr = nr;
    state.dotGroup = group;
    const grpLots = allLots.filter(l => (l.dotGroup || l.nr) === group);
    const units = [...new Set(grpLots.map(l => l.nr).filter(n => !isSingleLotSuffix(n)))];
    const occupied = grpLots.filter(l => l.threadUrl);
    state.dotLots = grpLots;
    if(units.length > 1) renderPickUnit(units, grpLots);          // complex: anchor + units A, B, …
    else if(occupied.length) renderOccupied(occupied);            // anchor + single lots (ZZ, ZY, …)
    else renderNewType();                                          // fresh dot
  };

  window._alotPickUnit = function(unitNr){
    document.querySelectorAll('#alot-step2 .alot-btn').forEach(b => b.classList.toggle('selected', b.textContent.trim() === unitNr));
    state.nr = unitNr;
    const lot = state.dotLots.find(l => l.nr === unitNr);
    document.getElementById('alot-unit-detail').innerHTML = (lot && lot.threadUrl)
      ? `<div class="alot-warn">&#9888; Bereits vergeben: ${escapeHtml(lot.name || unitNr)}</div>
         <div class="alot-label">Einheit anhängen (A, B … – für neue Untereinheit):</div>
         <input class="alot-input" id="alot-unit" type="text" maxlength="5" placeholder="A">` + imgField('Bild-URL')
      : imgField('Bild-URL');
    document.getElementById('alot-save').disabled = false;
  };

  window._alotSetOccupiedChoice = function(choice){
    document.getElementById('alot-extend-btn').classList.toggle('selected', choice === 'extend');
    document.getElementById('alot-newlot-btn').classList.toggle('selected', choice === 'new');
    state.isNewOnDot = choice === 'new';
    if(choice === 'extend'){
      document.getElementById('alot-occupied-detail').innerHTML =
        '<div class="alot-label">Welches Grundstück erweitern?</div>'
        + state.occupied.map(l => `<div class="alot-existing-item" onclick="window._alotPickExisting(this,${attr(l.nr)},${attr(l.name || l.nr)})"><strong>${escapeHtml(l.nr)}</strong>${l.name ? ' – ' + escapeHtml(l.name) : ''}</div>`).join('')
        + '<div id="alot-extend-fields"></div>';
    } else {
      renderNewLotFields('alot-occupied-detail');
    }
  };

  window._alotPickExisting = function(el, nr, name){
    document.querySelectorAll('.alot-existing-item').forEach(e => e.classList.toggle('selected', e === el));
    state.existing = { nr, name };
    document.getElementById('alot-extend-fields').innerHTML =
      '<div class="alot-label">Einheit anhängen <span class="alot-dim">(A, B, 21, 22 … – für neue Untereinheit)</span></div>'
      + '<input class="alot-input" id="alot-unit" type="text" maxlength="5" placeholder="z.B. A oder 21">'
      + imgField('Bild-URL dieser Einheit');
    document.getElementById('alot-save').disabled = false;
  };

  window._alotSetType = function(type){
    state.isComplex = type === 'complex';
    document.getElementById('alot-single-btn')?.classList.toggle('selected', type === 'single');
    document.getElementById('alot-complex-btn')?.classList.toggle('selected', type === 'complex');
    if(type === 'single'){
      document.getElementById('alot-type-fields').innerHTML = imgField('Bild-URL');
    } else {
      const isNewComplex = allLots.filter(l => (l.dotGroup || l.nr) === state.dotGroup).length <= 1;
      document.getElementById('alot-type-fields').innerHTML =
        '<div class="alot-label">Einheit <span class="alot-dim">(A, B, 21, 22 …)</span></div>'
        + '<input class="alot-input" id="alot-unit" type="text" maxlength="5" placeholder="z.B. A">'
        + imgField('Bild-URL dieser Einheit')
        + (isNewComplex ? '<div class="alot-label">Übersichts-Bild des Komplexes <span class="alot-dim">(optional)</span></div><input class="alot-input" id="alot-overview-img" type="text" placeholder="https://files.homepagemodules.de/...">' : '');
    }
    document.getElementById('alot-save').disabled = false;
  };

  function hasComplex(group){
    return allLots.some(l => (l.dotGroup || l.nr) === group && /Nr\.\s*\d+[A-Za-z]$/.test(l.nr));
  }

  function renderPickUnit(units, grpLots){
    document.getElementById('alot-save').disabled = true;
    document.getElementById('alot-step2').innerHTML = `<div class="alot-section">
      <div class="alot-label">Welche Einheit in diesem Gebäude?</div>
      <div class="alot-grid">${units.map(u => {
        const lot = grpLots.find(l => l.nr === u);
        const taken = lot && lot.threadUrl;
        return `<button type="button" class="alot-btn${taken ? ' occupied' : ''}" onclick="window._alotPickUnit(${attr(u)})" title="${escapeHtml(taken ? (lot.name + ' – bereits vergeben') : 'Frei')}">${escapeHtml(u)}</button>`;
      }).join('')}</div>
      <div id="alot-unit-detail"></div></div>`;
  }

  function renderOccupied(occupied){
    document.getElementById('alot-save').disabled = true;
    state.occupied = occupied;
    document.getElementById('alot-step2').innerHTML = `<div class="alot-section">
      <div class="alot-label">Dieser Dot ist bereits belegt. Was möchtest du tun?</div>
      <div class="alot-row">
        <button type="button" class="alot-choice" id="alot-extend-btn" onclick="window._alotSetOccupiedChoice('extend')">Bestehendes erweitern</button>
        <button type="button" class="alot-choice" id="alot-newlot-btn" onclick="window._alotSetOccupiedChoice('new')">Neues Grundstück</button>
      </div>
      <div id="alot-occupied-detail"></div></div>`;
  }

  function renderNewLotFields(containerId){
    const complexExists = hasComplex(state.dotGroup || state.nr);
    document.getElementById(containerId).innerHTML = `
      <div class="alot-label">Art des Grundstücks:</div>
      <div class="alot-row">
        <button type="button" class="alot-choice" id="alot-single-btn" onclick="window._alotSetType('single')">Einzelhaus / Einzellot</button>
        ${complexExists
          ? '<button type="button" class="alot-choice" disabled title="Komplex bereits vorhanden">Wohnkomplex mit Einheiten</button>'
          : `<button type="button" class="alot-choice" id="alot-complex-btn" onclick="window._alotSetType('complex')">Wohnkomplex mit Einheiten</button>`}
      </div>
      <div id="alot-type-fields"></div>`;
  }

  function renderNewType(){
    document.getElementById('alot-save').disabled = true;
    document.getElementById('alot-step2').innerHTML = '<div class="alot-section" id="alot-newtype-wrap"></div>';
    renderNewLotFields('alot-newtype-wrap');
  }
}

// Works out the lot number to write and saves it (and a complex anchor if needed).
function save(world, postUrl, title, allLots){
  const msg = document.getElementById('alot-msg');
  msg.style.color = 'rgba(255,255,255,0.4)';
  msg.textContent = 'Speichern…';
  const unit = (document.getElementById('alot-unit')?.value || '').trim().toUpperCase();
  const img = (document.getElementById('alot-img')?.value || '').trim();
  const overviewImg = (document.getElementById('alot-overview-img')?.value || '').trim();
  const base = nr => nr.replace(/#$/, '');   // "Nr. 4#" is a placeholder: "Nr. 4" + "A", not "Nr. 4#A"

  let nr = state.nr;
  if(state.isNewOnDot === false && state.existing){
    nr = base(state.existing.nr) + unit;                      // extend an existing lot
  } else if(state.isComplex && unit){
    nr = base(state.nr) + unit;                               // unit of a NEW complex
  } else if(!state.isComplex && state.isNewOnDot !== false){
    // Anything else on a dot that already has rows — including a chosen unit
    // of an existing complex — becomes a NEW row: next free ZZ/ZY/… suffix on
    // the chosen nr ("Nr. 7B" → "Nr. 7BZZ"). The unit/anchor rows stay as
    // they are; ATLAS resolves the suffix back to the dot.
    const dotLots = allLots.filter(l => (l.dotGroup || l.nr) === (state.dotGroup || state.nr) || l.nr === state.nr);
    const used = dotLots.map(l => l.nr);
    const free = SINGLE_LOT_SUFFIXES.find(s => !used.includes(base(state.nr) + s));
    if(free && dotLots.length) nr = base(state.nr) + free;
  }

  const saves = [{ action: 'updateLot', world, nr, name: title, threadUrl: postUrl, imgUrl: img }];
  if(state.isComplex && unit){
    // New complex: an anchor row with only the overview picture (no thread,
    // no name) marks the dot as a complex on the map.
    const anchorNr = base(state.nr);
    if(!allLots.some(l => l.nr === anchorNr && !l.threadUrl)){
      saves.push({ action: 'updateLot', world, nr: anchorNr, name: '', threadUrl: '', imgUrl: overviewImg });
    }
  }

  saves.reduce((p, params) => p.then(() => callAppsScript(params, { mode: 'no-cors' })), Promise.resolve())
    .then(() => {
      msg.style.color = '#4aaa6a';
      msg.textContent = '✓ Grundstück zugewiesen!';
      document.getElementById('alot-save').disabled = true;
      sessionStorage.setItem(skipKey, '1');
      setTimeout(() => document.getElementById('atlas-lot-overlay')?.remove(), 2000);
    })
    .catch(() => { msg.style.color = '#ff6b6b'; msg.textContent = 'Fehler beim Speichern.'; });
}
