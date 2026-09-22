/* PROJECT ATLAS - Occult lore view ("Okkult-Lore").

   A full-screen view like "Andere Welten". Two levels, so the lore never
   shows up as a wall of text:
   1. Overview: the wheel of beings (families.js) and the library. Picking a
      being shows its short description and its topics as tiles.
   2. Topic: only the cards of the chosen topic. A side list switches to
      another topic, "Alle Themen" shows the whole chapter, and the filter
      shows only cards with a marking (Regel, Gesichert, Offen …).

   3. Search: the field in the header searches the whole lore while typing
      (lore-search.js). A hit opens exactly its card, which lights up.

   "← Zurück" goes one level up: from a topic to the overview, from the
   overview back to the map — like "Zurück" everywhere else in ATLAS. A card
   opened from the search goes back to the results.

   The header with the search field is built once and stays; only the page
   below it is redrawn, so typing never loses the cursor.
   Opened from the menu (#nav-lore, and #nav-lore-mob in the phone sheet) or
   by the address: ".../atlas/#lore" opens ATLAS directly on the lore, like
   "#chars-…" does for the character view. The hash follows the view, so a
   refresh keeps it and the address can be shared. */

import { escapeHtml } from '../../../shared/html.js?v=202609221410';
import { closeSheet } from '../../ui/mobile-sheets.js?v=202609221410';
import { WHEEL, LIBRARY, chapterInfo, iconSvg, isWheelChapter } from './families.js?v=202609221410';
import { TEXT, MARKS } from './texts.js?v=202609221410';
import { loadLore, chapterModel } from './lore-data.js?v=202609221410';
import { buildIndex, compileQuery, search, snippet } from './lore-search.js?v=202609221410';

var ALL = 'all';
var view = { chapter: WHEEL[0].chapter, topic: null, filter: 'alle',
             query: '', searching: false, before: null, fromSearch: false, focus: null };
var MIN_QUERY = 2;
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

function crumbs(model){
  var html = '<span class="lore-crumb-root">' + escapeHtml(TEXT.title) + '</span>';
  if (view.searching) {
    html += '<span class="lore-crumb-sep">/</span><span>' + escapeHtml(TEXT.searchCrumb) + '</span>';
  } else if (view.topic && model) {
    var info = chapterInfo(view.chapter);
    html += '<span class="lore-crumb-sep">/</span><span>' + escapeHtml(info ? info.name : model.title) + '</span>';
  }
  return html;
}

function shell(){
  return '<header class="lore-header">'
    + '<button type="button" class="view-back" data-action="back">' + escapeHtml(TEXT.back) + '</button>'
    + '<div class="lore-crumbs"></div>'
    + '<div class="lore-search" role="search">'
    +   '<input type="search" class="lore-search-input" placeholder="' + escapeHtml(TEXT.searchPlaceholder) + '"'
    +   ' aria-label="' + escapeHtml(TEXT.searchLabel) + '" autocomplete="off" spellcheck="false" enterkeyhint="search">'
    + '</div>'
    + '</header>'
    + '<div class="lore-page"></div>';
}

/* Builds the header once; returns the page element below it. */
function ensureShell(el){
  if (!el.querySelector('.lore-header')) {
    el.innerHTML = shell();
    var input = el.querySelector('.lore-search-input');
    input.addEventListener('input', function(){ onQuery(input.value); });
    input.addEventListener('keydown', function(e){
      if (e.key === 'Escape') { input.value = ''; onQuery(''); }
    });
  }
  return el.querySelector('.lore-page');
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
    +   (model.intro.length ? '<div class="lore-intro" data-focus="chapter-intro">' + model.intro.map(blockHtml).join('') + '</div>'
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
  return '<article class="lore-card" data-focus="' + escapeHtml(card.id) + '">'
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
      ? '<div class="lore-topic-intro" data-focus="intro-' + t.id + '">' + t.intro.map(blockHtml).join('') + '</div>' : '';
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

/* ---------- level 3: search results ---------- */

var loadFailed = false;

function searchChapters(){
  return WHEEL.map(function(f){ return { chapter: f.chapter, name: f.name }; })
    .concat(LIBRARY.map(function(l){ return { chapter: l.chapter, name: l.name }; }));
}

/* Escapes text and wraps every occurrence of the query words in <mark>. */
function marked(text, compiled){
  var plain = String(text || '').replace(/\*\*?/g, '');
  if (!compiled.any) return escapeHtml(plain);
  return plain.split(compiled.any).map(function(part, i){
    return i % 2 ? '<mark>' + escapeHtml(part) + '</mark>' : escapeHtml(part);
  }).join('');
}

function hitFocus(e){
  if (e.card) return e.card;
  return e.topic ? 'intro-' + e.topic : 'chapter-intro';
}

function resultsView(){
  var compiled = compileQuery(view.query);
  var hits = search(buildIndex(lore, searchChapters()), compiled);

  // Filter chips: markings that occur in the hits, with the number of hits
  var counts = {};
  hits.forEach(function(e){
    var seen = {};
    e.blocks.forEach(function(b){ if (!seen[b.art]) { seen[b.art] = 1; counts[b.art] = (counts[b.art] || 0) + 1; } });
  });
  var filters = [{ key: 'alle', label: TEXT.filterAll }].concat(
    MARKS.filter(function(m){ return counts[m.key]; })
         .map(function(m){ return { key: m.key, label: m.plural + ' ' + counts[m.key], color: m.color }; }));
  if (!filters.some(function(f){ return f.key === view.filter; })) view.filter = 'alle';
  if (view.filter !== 'alle') {
    hits = hits.filter(function(e){ return e.blocks.some(function(b){ return b.art === view.filter; }); });
  }

  var chapterCount = {};
  hits.forEach(function(e){ chapterCount[e.chapter] = 1; });
  var summary = hits.length
    ? TEXT.hits(hits.length, Object.keys(chapterCount).length)
    : TEXT.noHits(view.query.trim());

  var filterHtml = filters.length > 1
    ? '<div class="lore-filters" role="group" aria-label="Filter">' + filters.map(function(f){
        var on = f.key === view.filter;
        return '<button type="button" class="lore-filter' + (on ? ' is-active' : '') + '" data-action="filter" data-filter="' + f.key + '"'
          + (f.color ? ' style="--m:' + f.color + '"' : '') + ' aria-pressed="' + on + '">' + escapeHtml(f.label) + '</button>';
      }).join('') + '</div>'
    : '';

  // Group by chapter, in the order of the wheel and the library
  var groups = [], byChapter = {};
  hits.forEach(function(e){
    if (!byChapter[e.chapter]) { byChapter[e.chapter] = { chapter: e.chapter, name: e.chapterName, hits: [] }; groups.push(byChapter[e.chapter]); }
    byChapter[e.chapter].hits.push(e);
  });
  var body = groups.map(function(g){
    var info = chapterInfo(g.chapter);
    return '<section class="lore-hit-group" style="' + colorVars(info.color) + '">'
      + '<h3 class="lore-hit-group-title"><span class="lore-hit-group-icon">' + iconSvg(info.icon, 20) + '</span>'
      + escapeHtml(g.name) + '<span class="lore-muted">' + g.hits.length + '</span></h3>'
      + '<div class="lore-hits">' + g.hits.map(function(e){
          var path = e.topicTitle && e.topicTitle !== e.cardTitle ? e.topicTitle : '';
          var badges = MARKS.filter(function(m){ return e.blocks.some(function(b){ return b.art === m.key; }); })
            .map(function(m){ return '<span class="lore-mark" style="--m:' + m.color + '">' + escapeHtml(m.label) + '</span>'; }).join('');
          return '<button type="button" class="lore-hit" data-action="hit" data-chapter="' + g.chapter + '"'
            + ' data-topic="' + (e.topic || '') + '" data-focus="' + escapeHtml(hitFocus(e)) + '">'
            + (path ? '<span class="lore-hit-path">' + marked(path, compiled) + '</span>' : '')
            + '<span class="lore-hit-title">' + marked(e.cardTitle, compiled) + '</span>'
            + '<span class="lore-hit-text">' + marked(snippet(e, compiled), compiled) + '</span>'
            + (badges ? '<span class="lore-hit-marks">' + badges + '</span>' : '')
            + '</button>';
        }).join('') + '</div>'
      + '</section>';
  }).join('');

  return '<div class="lore-results" aria-live="polite">'
    + '<p class="lore-results-summary">' + escapeHtml(summary) + '</p>'
    + (hits.length ? '' : '<p class="lore-note">' + escapeHtml(TEXT.noHitsHint) + '</p>')
    + filterHtml + body
    + '</div>';
}

/* After opening a hit: bring its card into view, let it light up and mark
   the query words in it. Works on the DOM, so no text is re-parsed. */
function focusHit(page){
  var target = page.querySelector('[data-focus="' + view.focus.replace(/"/g, '') + '"]');
  if (!target) return;
  var compiled = compileQuery(view.query);
  if (compiled.any) {
    var walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(node){
      var parts = node.nodeValue.split(compiled.any);
      if (parts.length < 2) return;
      var frag = document.createDocumentFragment();
      parts.forEach(function(part, i){
        if (!part) return;
        if (i % 2) { var m = document.createElement('mark'); m.textContent = part; frag.appendChild(m); }
        else frag.appendChild(document.createTextNode(part));
      });
      node.parentNode.replaceChild(frag, node);
    });
  }
  target.classList.add('is-hit');
  // Align the start of the card below the sticky header (scroll-margin in lore.css);
  // centring would push the start of a tall card out of view
  target.scrollIntoView({ block: 'start' });
  setTimeout(function(){ target.classList.remove('is-hit'); }, 2600);
}

function leaveSearch(){
  view.searching = false;
  view.fromSearch = false;
  if (view.before) { view.chapter = view.before.chapter; view.topic = view.before.topic; view.filter = view.before.filter; }
  view.before = null;
}

function onQuery(value){
  view.query = value;
  if (value.trim().length >= MIN_QUERY) {
    if (!view.searching && !view.fromSearch) {
      view.before = { chapter: view.chapter, topic: view.topic, filter: view.filter };
    }
    if (!view.searching) view.filter = 'alle';
    view.searching = true;
    view.fromSearch = false;
    render();
    root().scrollTop = 0;
  } else if (view.searching || view.fromSearch) {
    leaveSearch();
    render();
  }
}

/* ---------- rendering and events ---------- */

function render(){
  var el = root();
  if (!el) return;
  var page = ensureShell(el);
  var model = lore ? chapterModel(lore, view.chapter) : null;
  el.querySelector('.lore-crumbs').innerHTML = crumbs(model);
  if (!lore) {
    page.innerHTML = '<p class="lore-note">' + escapeHtml(loadFailed ? TEXT.loadError : TEXT.loading) + '</p>';
    return;
  }
  page.innerHTML = view.searching ? resultsView() : (view.topic ? topicView() : overview());
  if (view.focus) { focusHit(page); view.focus = null; }
}

var LORE_HASH = '#lore';

export function openLoreView(){
  var el = root();
  if (!el) return;
  el.classList.add('open');
  if (location.hash !== LORE_HASH) location.hash = LORE_HASH.slice(1);
  ensureFont();
  render();
  if (!lore) {
    loadFailed = false;
    loadLore().then(function(data){ lore = data; render(); })
      .catch(function(){ loadFailed = true; render(); });
  }
}

export function closeLoreView(){
  var el = root();
  if (el) el.classList.remove('open');
  if (location.hash === LORE_HASH) location.hash = '';
}

function onClick(e){
  var t = e.target.closest('[data-action]');
  if (!t || !root().contains(t)) return;
  var action = t.getAttribute('data-action');
  if (action === 'back') {
    if (view.searching) {
      // leave the search: empty the field and return to where the search started
      root().querySelector('.lore-search-input').value = '';
      view.query = '';
      leaveSearch();
    } else if (view.fromSearch) {
      // a card opened from the results goes back to the results
      view.searching = true; view.fromSearch = false; view.filter = 'alle';
    } else if (view.topic) { view.topic = null; view.filter = 'alle'; }
    else { closeLoreView(); return; }
  } else if (action === 'hit') {
    view.chapter = t.getAttribute('data-chapter');
    view.topic = t.getAttribute('data-topic') || null;
    view.filter = 'alle';
    view.searching = false;
    view.fromSearch = true;
    view.focus = t.getAttribute('data-focus');
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
  if (action !== 'filter' && action !== 'hit') root().scrollTop = 0;
}

function bind(){
  var el = root();
  if (el) el.addEventListener('click', onClick);
  var nav = document.getElementById('nav-lore');
  if (nav) nav.addEventListener('click', function(e){ e.preventDefault(); openLoreView(); });
  var navMob = document.getElementById('nav-lore-mob');
  if (navMob) navMob.addEventListener('click', function(e){ e.preventDefault(); closeSheet(); openLoreView(); });

  // Address: "#lore" opens the lore, going back to an address without it closes it
  if (location.hash === LORE_HASH) openLoreView();
  window.addEventListener('hashchange', function(){
    var open = root() && root().classList.contains('open');
    if (location.hash === LORE_HASH && !open) openLoreView();
    else if (location.hash !== LORE_HASH && open) closeLoreView();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
else bind();
