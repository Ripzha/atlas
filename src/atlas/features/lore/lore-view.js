/* PROJECT ATLAS - Occult lore view ("Okkult-Lore").

   A full-screen view like "Andere Welten". Two levels, so the lore never
   shows up as a wall of text:
   1. Overview: the wheel of beings (families.js) and the library. Picking a
      being shows its short description and its topics as tiles.
   2. Topic: only the cards of the chosen topic. A side list switches to
      another topic, "Alle Themen" shows the whole chapter, and the filter
      shows only cards with a marking (Regel, Gesichert, Offen …).

   "← Zurück" goes one level up: from a topic to the overview, from the
   overview back to the map — like "Zurück" everywhere else in ATLAS.
   Opened from the menu (#nav-lore, and #nav-lore-mob in the phone sheet). */

import { escapeHtml } from '../../../shared/html.js?v=202609221331';
import { closeSheet } from '../../ui/mobile-sheets.js?v=202609221331';
import { WHEEL, LIBRARY, chapterInfo, iconSvg, isWheelChapter } from './families.js?v=202609221331';
import { TEXT, MARKS } from './texts.js?v=202609221331';
import { loadLore, chapterModel } from './lore-data.js?v=202609221331';

var ALL = 'all';
var view = { chapter: WHEEL[0].chapter, topic: null, filter: 'alle' };
var lore = null;

function root(){ return document.getElementById('lore-container'); }

/* The colour of a being in three strengths, as CSS variables. Written as
   8-digit hex instead of color-mix(), which older Safari does not know. */
function colorVars(c){
  return '--c:' + c + ';--c-soft:' + c + '66;--c-faint:' + c + '24';
}

/* The display serif for headings is only loaded when the lore is opened,
   so the map itself loads nothing extra. Georgia stands in until then. */
var fontRequested = false;
function ensureFont(){
  if (fontRequested) return;
  fontRequested = true;
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap';
  document.head.appendChild(link);
}

/* Lore text may carry **bold** and *italic*; everything else is escaped. */
function inline(text){
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function markOf(key){
  for (var i = 0; i < MARKS.length; i++) if (MARKS[i].key === key) return MARKS[i];
  return null;
}

/* ---------- header ---------- */

function header(model){
  var crumbs = '<span class="lore-crumb-root">' + escapeHtml(TEXT.title) + '</span>';
  if (view.topic && model) {
    var info = chapterInfo(view.chapter);
    crumbs += '<span class="lore-crumb-sep">/</span><span>' + escapeHtml(info ? info.name : model.title) + '</span>';
  }
  return '<header class="lore-header">'
    + '<button type="button" class="view-back" data-action="back">' + escapeHtml(TEXT.back) + '</button>'
    + '<div class="lore-crumbs">' + crumbs + '</div>'
    + '</header>';
}

/* ---------- level 1: overview ---------- */

function wheel(active){
  var n = WHEEL.length;
  var sigils = WHEEL.map(function(f, i){
    var a = -Math.PI / 2 + i * 2 * Math.PI / n;
    var x = (50 + 39 * Math.cos(a)).toFixed(2);
    var y = (50 + 39 * Math.sin(a)).toFixed(2);
    var on = f.chapter === view.chapter;
    return '<button type="button" class="lore-sigil' + (on ? ' is-active' : '') + '" data-action="chapter" data-chapter="' + f.chapter + '"'
      + ' style="--x:' + x + '%;--y:' + y + '%;' + colorVars(f.color) + '" aria-pressed="' + on + '" aria-label="' + escapeHtml(f.name) + ' ansehen">'
      + '<span class="lore-sigil-icon">' + iconSvg(f.icon, 26) + '</span>'
      + '<span class="lore-sigil-name">' + escapeHtml(f.name) + '</span></button>';
  }).join('');
  // The moon only ever shows a being. With a library chapter chosen it stays
  // neutral, so the library never looks like part of the wheel.
  var moon = active
    ? '<div class="lore-moon" style="' + colorVars(active.color) + '">'
      + '<span class="lore-moon-icon">' + iconSvg(active.icon, 42) + '</span>'
      + '<span class="lore-moon-name">' + escapeHtml(active.name) + '</span>'
      + '<span class="lore-moon-count">' + escapeHtml(active.countText) + '</span>'
      + '</div>'
    : '<div class="lore-moon is-neutral"><span class="lore-moon-hint">' + escapeHtml(TEXT.pickBeing) + '</span></div>';
  return '<div class="lore-wheel">'
    + '<div class="lore-orbit" aria-hidden="true"></div>'
    + moon
    + sigils
    + '</div>';
}

/* On phones the wheel becomes a row of chips (lore.css decides which shows). */
function chips(){
  return '<div class="lore-chips" role="group" aria-label="' + escapeHtml(TEXT.heading) + '">'
    + WHEEL.map(function(f){
      var on = f.chapter === view.chapter;
      return '<button type="button" class="lore-chip' + (on ? ' is-active' : '') + '" data-action="chapter" data-chapter="' + f.chapter + '"'
        + ' style="' + colorVars(f.color) + '" aria-pressed="' + on + '">'
        + '<span class="lore-chip-icon">' + iconSvg(f.icon, 18) + '</span>' + escapeHtml(f.name) + '</button>';
    }).join('')
    + '</div>';
}

function library(){
  return '<div class="lore-library">'
    + '<div class="lore-kicker">' + escapeHtml(TEXT.library) + '</div>'
    + '<div class="lore-library-hint">' + escapeHtml(TEXT.libraryHint) + '</div>'
    + '<div class="lore-library-list">'
    + LIBRARY.map(function(l){
      var on = l.chapter === view.chapter;
      return '<button type="button" class="lore-book' + (on ? ' is-active' : '') + '" data-action="chapter" data-chapter="' + l.chapter + '" aria-pressed="' + on + '">'
        + escapeHtml(l.name) + '</button>';
    }).join('')
    + '</div></div>';
}

function overview(){
  var info = chapterInfo(view.chapter);
  var model = chapterModel(lore, view.chapter);
  if (!info || !model) return '<p class="lore-note">' + escapeHtml(TEXT.loadError) + '</p>';
  var active = { name: info.name, icon: info.icon, color: info.color,
                 countText: TEXT.cards(model.cardCount) + ' · ' + TEXT.topicsCount(model.topics.length) };
  var tiles = model.topics.map(function(t){
    return '<button type="button" class="lore-tile" data-action="topic" data-topic="' + t.id + '">'
      + '<span class="lore-tile-title">' + inline(t.title) + '</span>'
      + '<span class="lore-tile-count">' + escapeHtml(TEXT.cards(t.cards.length)) + ' →</span></button>';
  }).join('');
  return '<div class="lore-overview">'
    + '<section class="lore-pick" aria-label="' + escapeHtml(TEXT.heading) + '">'
    +   '<div class="lore-kicker">' + escapeHtml(TEXT.kicker) + '</div>'
    +   '<h1 class="lore-h1">' + escapeHtml(TEXT.heading) + '</h1>'
    +   wheel(isWheelChapter(view.chapter) ? active : null) + chips() + library()
    + '</section>'
    + '<section class="lore-detail" style="' + colorVars(info.color) + '" aria-live="polite">'
    +   '<div class="lore-detail-head">'
    +     '<span class="lore-badge-icon">' + iconSvg(info.icon, 32) + '</span>'
    +     '<div>' + (model.title !== info.name ? '<div class="lore-kicker">' + inline(model.title) + '</div>' : '')
    +     '<h2 class="lore-h2">' + escapeHtml(info.name) + '</h2></div>'
    +   '</div>'
    +   (model.intro.length ? '<div class="lore-intro">' + model.intro.map(blockHtml).join('') + '</div>'
         : (model.lead ? '<p class="lore-lead">' + inline(model.lead) + '</p>' : ''))
    +   '<div class="lore-row"><span class="lore-kicker">' + escapeHtml(TEXT.topics) + '</span>'
    +   '<span class="lore-muted">' + escapeHtml(active.countText) + '</span></div>'
    +   '<div class="lore-tiles">' + tiles + '</div>'
    + '</section>'
    + '</div>';
}

/* ---------- level 2: topic ---------- */

function blockHtml(b){
  if (b.art === 'zwischentitel') {
    return '<h4 class="lore-subhead' + (view.filter !== 'alle' ? ' is-dim' : '') + '">' + inline(b.text) + '</h4>';
  }
  if (b.art === 'liste') {
    var dimList = view.filter !== 'alle' ? ' is-dim' : '';
    return '<ul class="lore-list' + dimList + '">' + (b.punkte || []).map(function(x){ return '<li>' + inline(x) + '</li>'; }).join('') + '</ul>';
  }
  var m = markOf(b.art);
  var dim = (view.filter !== 'alle' && b.art !== view.filter) ? ' is-dim' : '';
  return '<div class="lore-block' + dim + '">'
    + (m ? '<span class="lore-mark" style="--m:' + m.color + '">' + escapeHtml(m.label) + '</span>' : '')
    + '<p>' + inline(b.text) + '</p></div>';
}

function cardVisible(card){
  if (view.filter === 'alle') return true;
  return card.blocks.some(function(b){ return b.art === view.filter; });
}

function cardHtml(card){
  return '<article class="lore-card">'
    + '<div class="lore-card-head"><span class="lore-card-nr">' + escapeHtml(card.nr) + '</span>'
    + '<h3 class="lore-card-title">' + inline(card.title) + '</h3></div>'
    + card.blocks.map(blockHtml).join('')
    + '</article>';
}

function topicView(){
  var info = chapterInfo(view.chapter);
  var model = chapterModel(lore, view.chapter);
  if (!info || !model) return '<p class="lore-note">' + escapeHtml(TEXT.loadError) + '</p>';
  var showAll = view.topic === ALL;
  var shown = showAll ? model.topics : model.topics.filter(function(t){ return t.id === view.topic; });
  if (!shown.length) { view.topic = null; return overview(); }

  // Filter chips: only markings that occur in what is shown, with their count
  var counts = {};
  shown.forEach(function(t){
    t.intro.concat.apply(t.intro, t.cards.map(function(c){ return c.blocks; })).forEach(function(b){
      counts[b.art] = (counts[b.art] || 0) + 1;
    });
  });
  var filters = [{ key: 'alle', label: TEXT.filterAll }].concat(
    MARKS.filter(function(m){ return counts[m.key]; })
         .map(function(m){ return { key: m.key, label: m.plural + ' ' + counts[m.key], color: m.color }; }));
  if (!filters.some(function(f){ return f.key === view.filter; })) view.filter = 'alle';
  var filterHtml = filters.length > 1
    ? '<div class="lore-filters" role="group" aria-label="Filter">' + filters.map(function(f){
        var on = f.key === view.filter;
        return '<button type="button" class="lore-filter' + (on ? ' is-active' : '') + '" data-action="filter" data-filter="' + f.key + '"'
          + (f.color ? ' style="--m:' + f.color + '"' : '') + ' aria-pressed="' + on + '">' + escapeHtml(f.label) + '</button>';
      }).join('') + '</div>'
    : '';

  var body = shown.map(function(t){
    var cards = t.cards.filter(cardVisible);
    var lead = t.intro.length && view.filter === 'alle'
      ? '<div class="lore-topic-intro">' + t.intro.map(blockHtml).join('') + '</div>' : '';
    if (!cards.length && showAll) return '';
    return (showAll ? '<h3 class="lore-group-title">' + inline(t.title) + '</h3>' : '')
      + lead
      + (cards.length ? '<div class="lore-cards">' + cards.map(cardHtml).join('') + '</div>'
                      : '<p class="lore-note">' + escapeHtml(TEXT.noCards) + '</p>');
  }).join('');
  if (!body) body = '<p class="lore-note">' + escapeHtml(TEXT.noCards) + '</p>';

  var nav = '<nav class="lore-topic-nav" aria-label="' + escapeHtml(TEXT.topics) + '">'
    + '<button type="button" class="lore-topic-link' + (showAll ? ' is-active' : '') + '" data-action="topic" data-topic="' + ALL + '">' + escapeHtml(TEXT.allTopics) + '</button>'
    + model.topics.map(function(t){
      var on = t.id === view.topic;
      return '<button type="button" class="lore-topic-link' + (on ? ' is-active' : '') + '" data-action="topic" data-topic="' + t.id + '" aria-current="' + (on ? 'true' : 'false') + '">'
        + inline(t.title) + '</button>';
    }).join('')
    + '</nav>';

  var pager = '';
  if (!showAll) {
    var idx = model.topics.findIndex(function(t){ return t.id === view.topic; });
    var prev = model.topics[idx - 1], next = model.topics[idx + 1];
    pager = '<div class="lore-pager">'
      + (prev ? '<button type="button" class="lore-pager-btn" data-action="topic" data-topic="' + prev.id + '">' + escapeHtml(TEXT.previous) + '</button>' : '<span></span>')
      + (next ? '<button type="button" class="lore-pager-btn" data-action="topic" data-topic="' + next.id + '">' + escapeHtml(TEXT.next) + '</button>' : '<span></span>')
      + '</div>';
  }

  var title = showAll ? TEXT.allTopics : shown[0].title;
  return '<div class="lore-topic" style="' + colorVars(info.color) + '">'
    + '<div class="lore-detail-head">'
    +   '<span class="lore-badge-icon">' + iconSvg(info.icon, 32) + '</span>'
    +   '<div><div class="lore-kicker">' + escapeHtml(info.name) + '</div>'
    +   '<h2 class="lore-h2">' + inline(title) + '</h2></div>'
    + '</div>'
    + '<div class="lore-topic-body">' + nav
    +   '<div class="lore-topic-main">' + filterHtml + body + pager + '</div>'
    + '</div>'
    + '</div>';
}

/* ---------- rendering and events ---------- */

function render(){
  var el = root();
  if (!el) return;
  if (!lore) {
    el.innerHTML = header(null) + '<p class="lore-note">' + escapeHtml(TEXT.loading) + '</p>';
    return;
  }
  var model = chapterModel(lore, view.chapter);
  el.innerHTML = header(model) + '<div class="lore-page">' + (view.topic ? topicView() : overview()) + '</div>';
}

export function openLoreView(){
  var el = root();
  if (!el) return;
  el.classList.add('open');
  ensureFont();
  render();
  if (!lore) {
    loadLore().then(function(data){ lore = data; render(); })
      .catch(function(){
        el.innerHTML = header(null) + '<p class="lore-note">' + escapeHtml(TEXT.loadError) + '</p>';
      });
  }
}

export function closeLoreView(){
  var el = root();
  if (el) el.classList.remove('open');
}

function onClick(e){
  var t = e.target.closest('[data-action]');
  if (!t || !root().contains(t)) return;
  var action = t.getAttribute('data-action');
  if (action === 'back') {
    if (view.topic) { view.topic = null; view.filter = 'alle'; }
    else { closeLoreView(); return; }
  } else if (action === 'chapter') {
    view.chapter = t.getAttribute('data-chapter'); view.topic = null; view.filter = 'alle';
  } else if (action === 'topic') {
    view.topic = t.getAttribute('data-topic'); view.filter = 'alle';
  } else if (action === 'filter') {
    view.filter = t.getAttribute('data-filter');
  } else {
    return;
  }
  render();
  if (action !== 'filter') root().scrollTop = 0;
}

function bind(){
  var el = root();
  if (el) el.addEventListener('click', onClick);
  var nav = document.getElementById('nav-lore');
  if (nav) nav.addEventListener('click', function(e){ e.preventDefault(); openLoreView(); });
  var navMob = document.getElementById('nav-lore-mob');
  if (navMob) navMob.addEventListener('click', function(e){ e.preventDefault(); closeSheet(); openLoreView(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
else bind();
