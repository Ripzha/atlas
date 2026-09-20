/* PROJECT ATLAS - Event pill and event panel, shared by the forum and the map.

   Shows the running RPG event as a pill; a click opens a panel with the
   AI-generated summary, one tab per active character (Apps Script action
   "events").

   Both sides read the same data — only where the pill hangs and how it behaves
   differs, so each side passes that in. Everything else lives here once: fetch,
   markup, panel, tabs. A fix reaches both sides.

   createEventPill({
     anchors:     selectors of the container the pill lives in, first match wins
     pages:       paths the pill may appear on; null means every page
     draggable:   true lets the user drag the pill, position per browser
     mobileStyle: properties set on the pill on phones, or null to leave it to CSS
     hintText:    the spoiler warning below the pill
   })
*/

import { callAppsScript } from '../backend.js?v=202609201830';
import { escapeHtml } from '../html.js?v=202609201830';

const PILL_POS_KEY = 'atlas_event_pill_pos';
const PHONE_WIDTH = 768;
const DEFAULT_HINT = '\u26A0\uFE0F Zusammenfassung enthält Spoiler';
const DEFAULT_ICON = '&#128220;';

export function createEventPill(config){
  const cfg = Object.assign({
    anchors: [],
    pages: null,
    draggable: false,
    mobileStyle: null,
    hintText: DEFAULT_HINT
  }, config || {});

  if(window.__atlasEventInit) return;
  window.__atlasEventInit = true;

  if(cfg.pages){
    const path = (location.pathname || '/').replace(/\/$/, '') || '/';
    if(!cfg.pages.includes(path)) return;   // elsewhere it would only cover content
  }

  callAppsScript({ action: 'events' })
    .then(r => r.json())
    .then(data => {
      const events = ((data && data.events) || [])
        .filter(e => e.summaries && e.summaries.all && e.summaries.all.trim());
      if(events.length) renderPill(events[0], cfg);
    })
    .catch(e => console.warn('[ATLAS] Events konnten nicht geladen werden:', e));
}

/* Which container the pill hangs in. A canvas cannot hold children, so for the
   particles canvas in the forum header we take its parent. */
function findAnchor(anchors){
  for(const selector of anchors){
    const el = document.querySelector(selector.trim());
    if(!el) continue;
    return el.tagName === 'CANVAS' && el.parentNode ? el.parentNode : el;
  }
  return null;
}

function renderPill(evt, cfg){
  const pill = document.createElement('div');
  pill.id = 'atlasEventPill';
  pill.innerHTML = '<span class="atlas-pill-icon">' + (evt.icon || DEFAULT_ICON) + '</span>'
    + '<div class="atlas-pill-text"><div class="atlas-pill-label">Laufendes Event</div>'
    + '<div class="atlas-pill-name">' + escapeHtml(evt.name) + '</div></div>';

  const hint = document.createElement('div');
  hint.id = 'atlasEventPillHint';
  hint.textContent = cfg.hintText;

  const anchor = findAnchor(cfg.anchors);
  const isPhone = window.innerWidth <= PHONE_WIDTH || window.__atlasForceMobile === true;

  if(isPhone){
    document.body.append(pill, hint);
    if(cfg.mobileStyle){
      for(const [prop, value] of Object.entries(cfg.mobileStyle)) pill.style.setProperty(prop, value, 'important');
    }
  } else if(anchor){
    if(getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
    anchor.append(pill, hint);
  } else {
    pill.classList.add('atlas-fixed');
    hint.classList.add('atlas-fixed');
    document.body.append(pill, hint);
  }

  if(cfg.draggable) makeDraggable(pill);

  pill.addEventListener('click', () => {
    if(pill.__dragged) return;   // the click right after a drag is not a click
    openPanel(evt);
  });
}

/* === Dragging ============================================================
   The pill can be dragged anywhere, for instance away from something it
   covers. The position is stored per browser as a fraction of the window size
   and wins over the default positions in the CSS. */

function placePill(pill, left, top){
  const w = pill.offsetWidth, h = pill.offsetHeight;
  left = Math.max(4, Math.min(window.innerWidth - w - 4, left));
  top = Math.max(4, Math.min(window.innerHeight - h - 4, top));
  // Fixed to the window: move it out of the header anchor first
  if(pill.parentNode !== document.body) document.body.appendChild(pill);
  const set = (prop, value) => pill.style.setProperty(prop, value, 'important');
  set('position', 'fixed');
  set('left', left + 'px');
  set('top', top + 'px');
  set('right', 'auto');
  set('bottom', 'auto');
  set('transform', 'none');
  set('margin', '0');
  // Inside <body> the pill needs its own layer: above the page layout
  // (#topnav 100, mobile bar 200, views up to 300), below the admin panel (400)
  // and overlays. With the default 50 it vanished behind the layout.
  set('z-index', '350');
}

function restorePosition(pill){
  try {
    const saved = JSON.parse(localStorage.getItem(PILL_POS_KEY) || 'null');
    if(saved && typeof saved.x === 'number' && typeof saved.y === 'number'){
      placePill(pill, saved.x * window.innerWidth, saved.y * window.innerHeight);
    }
  } catch(e) {}
}

function makeDraggable(pill){
  pill.style.setProperty('touch-action', 'none', 'important');
  pill.style.cursor = 'grab';
  let start = null, moved = false;

  pill.addEventListener('pointerdown', e => {
    const r = pill.getBoundingClientRect();
    start = { x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
    moved = false;
    // Capture right away, so fast movements that leave the pill still arrive
    try { pill.setPointerCapture(e.pointerId); } catch(_) {}
  });

  pill.addEventListener('pointermove', e => {
    if(!start) return;
    if(!moved && Math.abs(e.clientX - start.x) < 5 && Math.abs(e.clientY - start.y) < 5) return;   // still a click
    if(!moved){
      moved = true;
      pill.style.cursor = 'grabbing';
      placePill(pill, e.clientX - start.dx, e.clientY - start.dy);
      // Moving the pill into <body> can drop the capture: take it again
      try { pill.setPointerCapture(start.id); } catch(_) {}
    }
    placePill(pill, e.clientX - start.dx, e.clientY - start.dy);
  });

  function endDrag(){
    if(!start) return;
    if(moved){
      // Swallow the click the browser fires right after a drag (same task);
      // reset afterwards so the next real click opens the panel.
      pill.__dragged = true;
      setTimeout(() => { pill.__dragged = false; }, 0);
      pill.style.cursor = 'grab';
      const r = pill.getBoundingClientRect();
      try {
        localStorage.setItem(PILL_POS_KEY, JSON.stringify({ x: r.left / window.innerWidth, y: r.top / window.innerHeight }));
      } catch(_) {}
    }
    start = null;
  }

  pill.addEventListener('pointerup', endDrag);
  pill.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => restorePosition(pill));
  restorePosition(pill);
}

/* === Panel =============================================================== */

function openPanel(evt){
  let backdrop = document.getElementById('atlasEventBackdrop');
  if(!backdrop){
    backdrop = document.createElement('div');
    backdrop.id = 'atlasEventBackdrop';
    backdrop.addEventListener('click', closePanel);
    document.body.appendChild(backdrop);
  }
  document.getElementById('atlasEventPanel')?.remove();
  const panel = buildPanel(evt);
  document.body.appendChild(panel);
  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    panel.classList.add('open');
    // Hide the pill via a CSS class with !important (overrides mobile visibility)
    document.getElementById('atlasEventPill')?.classList.add('atlas-pill-hidden');
  });
}

function closePanel(){
  document.getElementById('atlasEventPanel')?.classList.remove('open');
  document.getElementById('atlasEventBackdrop')?.classList.remove('open');
  document.getElementById('atlasEventPill')?.classList.remove('atlas-pill-hidden');
}

function buildPanel(evt){
  const s = evt.summaries || { all: '', byChar: {}, activeChars: [] };
  const chars = s.activeChars || [];
  const tabs = [{ id: 'all', label: 'Übersicht', text: s.all || 'Noch keine Zusammenfassung verfügbar. Wird beim nächsten Update generiert.' }]
    .concat(chars.map(c => ({ id: c, label: c, text: (s.byChar && s.byChar[c]) || '—' })));

  const panel = document.createElement('div');
  panel.id = 'atlasEventPanel';
  panel.innerHTML =
    '<div class="atlas-panel-head"><div class="atlas-panel-head-row"><div>'
      + '<div class="atlas-panel-tag">Laufendes Event</div>'
      + '<div class="atlas-panel-title"><span class="atlas-icon">' + (evt.icon || DEFAULT_ICON) + '</span><span>' + escapeHtml(evt.name) + '</span></div>'
    + '</div><button class="atlas-panel-close" type="button" aria-label="Schliessen">&#10005;</button></div>'
    + (evt.description ? '<div class="atlas-panel-desc">' + escapeHtml(evt.description) + '</div>' : '')
    + '<div class="atlas-panel-meta"><a href="' + escapeHtml(evt.startUrl) + '" target="_blank" rel="noopener">&#8594; Zum Eventstart</a>'
      + (evt.postCount ? '<span>· ' + evt.postCount + ' Posts</span>' : '') + '</div>'
    + '<div class="atlas-disclaimer">\u26A0\uFE0F KI-generiert. Kann halluzinieren. Bei Unsicherheit zum Originalpost springen.</div></div>'
    + '<div class="atlas-tabs">' + tabs.map((t, i) => '<button type="button" class="atlas-tab' + (i ? '' : ' active') + '" data-i="' + i + '">' + escapeHtml(t.label) + '</button>').join('') + '</div>'
    + tabs.map((t, i) => '<div class="atlas-tab-content' + (i ? '' : ' active') + '" data-i="' + i + '">' + escapeHtml(t.text) + '</div>').join('')
    + '<div class="atlas-panel-foot"><a class="atlas-last-post" href="' + escapeHtml(evt.lastPostUrl || evt.startUrl) + '" target="_blank" rel="noopener">&#8594; Zum letzten Post</a>'
      + (evt.lastUpdated ? '<span class="atlas-updated">Aktualisiert: ' + escapeHtml(evt.lastUpdated) + '</span>' : '') + '</div>';

  panel.querySelector('.atlas-panel-close').addEventListener('click', closePanel);
  panel.querySelectorAll('.atlas-tab').forEach(tab => tab.addEventListener('click', () => {
    panel.querySelectorAll('.atlas-tab, .atlas-tab-content').forEach(el => el.classList.toggle('active', el.dataset.i === tab.dataset.i));
  }));
  return panel;
}
