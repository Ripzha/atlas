/* PROJECT ATLAS - Occult lore: search.

   Every card (and every topic or chapter introduction) becomes one search
   entry that knows its place in the lore: chapter › topic › card. A query
   matches an entry when every word of the query occurs in it — in the text,
   the card title, the topic title or a sub-heading.

   Matching is forgiving:
   - upper and lower case do not matter
   - a word also matches longer words: "vampir" finds "Vampire", "Vampirblut"
   - singular finds the plural with umlaut: "werwolf" finds "Werwölfe"
   - umlauts can be typed out: "werwoelfe" finds "Werwölfe", "strasse" finds
     "Straße", and the other way round */

import { chapterModel } from './lore-data.js?v=202609221359';

var index = null;
var indexedLore = null;

function blockText(b){
  if (b.art === 'liste') return (b.punkte || []).join(' ');
  return b.text || '';
}

/* One entry per card and per introduction, in the order of `chapters`. */
export function buildIndex(lore, chapters){
  if (index && indexedLore === lore) return index;
  index = [];
  chapters.forEach(function(c){
    var model = chapterModel(lore, c.chapter);
    if (!model) return;
    if (model.intro.length) {
      index.push({ chapter: c.chapter, chapterName: c.name, topic: null, topicTitle: null,
                   card: null, cardTitle: model.title, blocks: model.intro });
    }
    model.topics.forEach(function(t){
      if (t.intro.length) {
        index.push({ chapter: c.chapter, chapterName: c.name, topic: t.id, topicTitle: t.title,
                     card: null, cardTitle: t.title, blocks: t.intro });
      }
      t.cards.forEach(function(card){
        index.push({ chapter: c.chapter, chapterName: c.name, topic: t.id, topicTitle: t.title,
                     card: card.id, cardTitle: card.title, blocks: card.blocks });
      });
    });
  });
  indexedLore = lore;
  return index;
}

/* Regular expression source for one query word that also accepts the other
   spelling of umlauts and ß. */
function termPattern(term){
  var out = '';
  var s = term.toLowerCase();
  for (var i = 0; i < s.length; i++) {
    var two = s.substr(i, 2);
    if (two === 'ae') { out += '(?:ae|ä)'; i++; continue; }
    if (two === 'oe') { out += '(?:oe|ö)'; i++; continue; }
    if (two === 'ue') { out += '(?:ue|ü)'; i++; continue; }
    if (two === 'ss') { out += '(?:ss|ß)'; i++; continue; }
    var ch = s.charAt(i);
    // A plain vowel also finds its umlaut: "werwolf" finds "Werwölfe", "zahn" finds "Zähne"
    if (ch === 'a') out += '(?:a|ä)';
    else if (ch === 'o') out += '(?:o|ö)';
    else if (ch === 'u') out += '(?:u|ü)';
    else if (ch === 'ä') out += '(?:ä|ae)';
    else if (ch === 'ö') out += '(?:ö|oe)';
    else if (ch === 'ü') out += '(?:ü|ue)';
    else if (ch === 'ß') out += '(?:ß|ss)';
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return out;
}

export function compileQuery(query){
  var terms = String(query || '').trim().split(/\s+/).filter(function(t){ return t.length > 0; });
  return {
    terms: terms,
    each: terms.map(function(t){ return new RegExp(termPattern(t), 'i'); }),
    // for marking every occurrence in a text
    any: terms.length ? new RegExp('(' + terms.map(termPattern).join('|') + ')', 'gi') : null
  };
}

function entryText(e){
  return [e.cardTitle, e.topicTitle || '', e.chapterName].concat(e.blocks.map(blockText)).join('\n');
}

/* All entries that contain every word of the query. */
export function search(entries, compiled){
  if (!compiled.terms.length) return [];
  return entries.filter(function(e){
    var text = entryText(e);
    return compiled.each.every(function(re){ return re.test(text); });
  });
}

/* A short piece of text around the first match, for the result list. Plain
   text: the caller escapes it before marking the words. */
export function snippet(entry, compiled, radius){
  var r = radius || 90;
  var texts = entry.blocks.map(blockText);
  for (var i = 0; i < texts.length; i++) {
    for (var j = 0; j < compiled.each.length; j++) {
      var m = compiled.each[j].exec(texts[i]);
      if (m) {
        var start = Math.max(0, m.index - r), end = Math.min(texts[i].length, m.index + m[0].length + r);
        return (start > 0 ? '… ' : '') + texts[i].slice(start, end).trim() + (end < texts[i].length ? ' …' : '');
      }
    }
  }
  // The match is only in a title: show the start of the text instead
  var first = texts[0] || '';
  return first.length > 2 * r ? first.slice(0, 2 * r).trim() + ' …' : first;
}
