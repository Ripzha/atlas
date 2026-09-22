/* PROJECT ATLAS - Occult lore: links from names to the topic explaining them.

   resolveTerms() finds the target of every entry in terms.js once per loaded
   lore. linkTerms() turns the first mention of each name in a card into a
   link; a name is never linked inside its own topic. bindTermTips() shows the
   target's first sentence while the mouse rests on a link (devices with a
   mouse only; on touch a tap simply opens the target). */

import { escapeHtml } from '../../../shared/html.js?v=202609221541';
import { chapterModel } from './lore-data.js?v=202609221541';
import { TERMS } from './terms.js?v=202609221541';

var resolvedFor = null;
var byForm = {};
var pattern = null;

// Letters that belong to a word, so "Goblin" is not found inside "Goblinabstammung"
var WORD = 'A-Za-zÄÖÜäöüßÀ-ÿ0-9';

function reEscape(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function startsWith(title, prefix){
  return String(title).toLowerCase().indexOf(String(prefix).toLowerCase()) === 0;
}

/* First sentence or two of a target, for the hint window. */
function firstText(blocks){
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    var t = b.art === 'liste' ? (b.punkte || []).join(', ') : (b.art === 'zwischentitel' ? '' : b.text);
    if (!t) continue;
    t = String(t).replace(/\*\*?/g, '');
    var parts = t.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [t];
    var out = '';
    for (var j = 0; j < parts.length; j++) {
      if (out && (out + parts[j]).length > 220) break;
      out += parts[j];
    }
    return out.trim();
  }
  return '';
}

export function resolveTerms(lore){
  if (resolvedFor === lore) return;
  byForm = {};
  var forms = [];
  TERMS.forEach(function(entry){
    var model = chapterModel(lore, entry.chapter);
    if (!model) return;
    var topic = null;
    for (var i = 0; i < model.topics.length; i++) {
      if (startsWith(model.topics[i].title, entry.topic)) { topic = model.topics[i]; break; }
    }
    if (!topic) return;
    var target = { chapter: entry.chapter, topic: topic.id };
    if (entry.card) {
      var card = null;
      for (var c = 0; c < topic.cards.length; c++) {
        if (startsWith(topic.cards[c].title, entry.card)) { card = topic.cards[c]; break; }
      }
      if (!card) return;
      target.focus = card.id; target.title = card.title; target.tip = firstText(card.blocks);
    } else if (topic.intro.length) {
      target.focus = 'intro-' + topic.id; target.title = topic.title; target.tip = firstText(topic.intro);
    } else {
      target.focus = topic.cards[0].id; target.title = topic.title; target.tip = firstText(topic.cards[0].blocks);
    }
    entry.forms.forEach(function(f){
      var key = escapeHtml(f);          // matched against already escaped text
      if (!byForm[key]) { byForm[key] = target; forms.push(key); }
    });
  });
  forms.sort(function(a, b){ return b.length - a.length; });   // longest first: "Rat des Gleichgewichts" before "Rat"
  // The character before a name is captured instead of using a lookbehind,
  // which older Safari versions cannot parse.
  pattern = forms.length
    ? new RegExp('(^|[^' + WORD + '])(' + forms.map(reEscape).join('|') + ')(?![' + WORD + '])', 'g')
    : null;
  resolvedFor = lore;
}

/* Links names in escaped HTML. ctx: { self: id of the topic being shown,
   seen: {} } — shared by all blocks of one card, so each target is linked
   only once per card. */
export function linkTerms(html, ctx){
  if (!pattern || !ctx) return html;
  return html.replace(pattern, function(m, before, form){
    var t = byForm[form];
    if (!t || t.topic === ctx.self || ctx.seen[t.focus]) return m;
    ctx.seen[t.focus] = true;
    return before + '<span class="lore-term" role="link" tabindex="0" data-action="term"'
      + ' data-chapter="' + t.chapter + '" data-topic="' + t.topic + '" data-focus="' + escapeHtml(t.focus) + '"'
      + ' data-tip-title="' + escapeHtml(t.title) + '" data-tip="' + escapeHtml(t.tip) + '">' + form + '</span>';
  });
}

/* Hint window with the target's first sentence, for devices with a mouse. */
export function bindTermTips(root){
  if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;
  var tip = document.createElement('div');
  tip.className = 'lore-tip';
  tip.setAttribute('role', 'tooltip');
  // On the body, not inside the lore view: the view rewrites its own content when it is first opened
  document.body.appendChild(tip);
  function hide(){ tip.classList.remove('is-open'); }
  root.addEventListener('mouseover', function(e){
    var term = e.target.closest && e.target.closest('.lore-term');
    if (!term) return;
    tip.innerHTML = '';
    var h = document.createElement('strong'); h.textContent = term.getAttribute('data-tip-title');
    var p = document.createElement('span'); p.textContent = term.getAttribute('data-tip');
    tip.appendChild(h); tip.appendChild(p);
    tip.classList.add('is-open');
    var r = term.getBoundingClientRect();
    var w = tip.offsetWidth, hgt = tip.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var top = r.bottom + 8;
    if (top + hgt > window.innerHeight - 8) top = r.top - hgt - 8;   // no room below: show above
    tip.style.left = left + 'px';
    tip.style.top = Math.max(8, top) + 'px';
  });
  root.addEventListener('mouseout', function(e){
    var term = e.target.closest && e.target.closest('.lore-term');
    if (term && !term.contains(e.relatedTarget)) hide();
  });
  root.addEventListener('scroll', hide, true);
  root.addEventListener('click', hide);
}
