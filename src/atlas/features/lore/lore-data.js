/* PROJECT ATLAS - Occult lore: loading and shaping the data.

   The lore lives in src/atlas/data/lore/lore.json, generated from the Word
   document by tools/lore/import-lore.py (see docs/LORE.md). It is only fetched
   when the lore view is opened for the first time, so the map does not get
   slower to start.

   A chapter is split into topics (the "## 6.3" sections). Each topic holds
   cards: one card per point ("### 6.3.1"). A topic without points becomes a
   single card of its own, so every chapter reads the same way. */

var LORE_URL = new URL('../../data/lore/lore.json?v=202609221509', import.meta.url).href;
var loading = null;

export function loadLore(){
  if (!loading) {
    loading = fetch(LORE_URL).then(function(r){
      if (!r.ok) throw new Error('lore.json ' + r.status);
      return r.json();
    }).catch(function(e){
      loading = null;          // allow a retry on the next open
      throw e;
    });
  }
  return loading;
}

function textOf(block){
  if (block.art === 'liste') return (block.punkte || []).join(' ');
  return block.text || '';
}

/* First one or two sentences, for the short description under a name. */
function shortLead(text, max){
  var limit = max || 190;
  // No lookbehind in this regex: older Safari (before 16.4) cannot parse it,
  // and a parse error here would stop the whole map from loading.
  var sentences = String(text).match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [String(text)];
  sentences = sentences.map(function(x){ return x.trim(); }).filter(Boolean);
  var out = '';
  for (var i = 0; i < sentences.length; i++) {
    if (out && (out + ' ' + sentences[i]).length > limit) break;
    out = out ? out + ' ' + sentences[i] : sentences[i];
  }
  return out;
}

/* The chapter's own introduction if it has one, else the first plain text. */
function findLead(chapter){
  var pools = [chapter.intro];
  chapter.abschnitte.forEach(function(a){
    pools.push(a.intro);
    a.punkte.forEach(function(p){ pools.push(p.bloecke); });
  });
  for (var i = 0; i < pools.length; i++) {
    for (var j = 0; j < pools[i].length; j++) {
      var b = pools[i][j];
      if (b.art === 'text' && b.text) return shortLead(b.text);
    }
  }
  return '';
}

function toTopic(section){
  var hasPoints = section.punkte.length > 0;
  var cards = hasPoints
    ? section.punkte.map(function(p){ return { id: p.id, nr: p.nr, title: p.titel, blocks: p.bloecke }; })
    : [{ id: section.id, nr: section.nr, title: section.titel, blocks: section.intro }];
  return {
    id: section.id,
    nr: section.nr,
    title: section.titel,
    intro: hasPoints ? section.intro : [],
    cards: cards
  };
}

export function chapterModel(lore, nr){
  var chapter = null;
  for (var i = 0; i < lore.kapitel.length; i++) if (lore.kapitel[i].nr === nr) chapter = lore.kapitel[i];
  if (!chapter) return null;
  var topics = chapter.abschnitte.map(toTopic);
  return {
    nr: chapter.nr,
    title: chapter.titel,
    // The chapter's own introduction is shown in full; without one, the first
    // sentences of its text stand in as a short description.
    intro: chapter.intro,
    lead: chapter.intro.length ? '' : findLead(chapter),
    topics: topics,
    cardCount: topics.reduce(function(n, t){ return n + t.cards.length; }, 0)
  };
}

export { textOf };
