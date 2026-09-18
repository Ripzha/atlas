/* PROJECT ATLAS - Event pill (forum).
   On the forum start page and the portal, shows the running RPG event as a
   pill in the forum header. A click opens a panel with the AI-generated
   summary, one tab per active character (Apps Script action "events").

   Desktop: the pill sits in the header, inside the parent of the particles
   canvas (#particleoverlay). Phones: attached to <body>, top right.
   ATLAS has its own copy in src/atlas/features/events/event-pill.js; the two
   are to be merged later. */

import { callAppsScript } from '../shared/backend.js?v=202609182310';
import { escapeHtml } from './page.js?v=202609182310';

const ANCHOR_SELECTOR = '#particleoverlay';
const PAGES = ['/', '/index.php', '/portal.php'];

let events = [];

export function initEventPill(){
  if(window.__atlasEventInit) return;
  window.__atlasEventInit = true;
  const path = (location.pathname || '/').replace(/\/$/, '') || '/';
  if(!PAGES.includes(path)) return;    // elsewhere it would only cover content
  callAppsScript({ action: 'events' })
    .then(r => r.json())
    .then(data => {
      events = ((data && data.events) || []).filter(e => e.summaries && e.summaries.all && e.summaries.all.trim());
      if(events.length) renderPill(events[0]);
    })
    .catch(e => console.warn('[ATLAS] Events konnten nicht geladen werden:', e));
}

function renderPill(evt){
  const pill = document.createElement('div');
  pill.id = 'atlasEventPill';
  pill.innerHTML = '<span class="atlas-pill-icon">' + (evt.icon || '&#128220;') + '</span>'
    + '<div class="atlas-pill-text"><div class="atlas-pill-label">Laufendes Event</div>'
    + '<div class="atlas-pill-name">' + escapeHtml(evt.name) + '</div></div>';
  const hint = document.createElement('div');
  hint.id = 'atlasEventPillHint';
  hint.textContent = '⚠️ Zusammenfassung enthält Spoiler';

  let anchor = document.querySelector(ANCHOR_SELECTOR);
  if(anchor && anchor.tagName === 'CANVAS') anchor = anchor.parentNode;   // a canvas cannot hold children
  if(window.innerWidth <= 768){
    document.body.append(pill, hint);
  } else if(anchor){
    if(getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
    anchor.append(pill, hint);
  } else {
    pill.classList.add('atlas-fixed');
    hint.classList.add('atlas-fixed');
    document.body.append(pill, hint);
  }
  pill.addEventListener('click', () => openPanel(evt));
}

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
      + '<div class="atlas-panel-title"><span class="atlas-icon">' + (evt.icon || '&#128220;') + '</span><span>' + escapeHtml(evt.name) + '</span></div>'
    + '</div><button class="atlas-panel-close" type="button" aria-label="Schliessen">&#10005;</button></div>'
    + (evt.description ? '<div class="atlas-panel-desc">' + escapeHtml(evt.description) + '</div>' : '')
    + '<div class="atlas-panel-meta"><a href="' + escapeHtml(evt.startUrl) + '" target="_blank" rel="noopener">&#8594; Zum Eventstart</a>'
      + (evt.postCount ? '<span>· ' + evt.postCount + ' Posts</span>' : '') + '</div>'
    + '<div class="atlas-disclaimer">⚠️ KI-generiert. Kann halluzinieren. Bei Unsicherheit zum Originalpost springen.</div></div>'
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
