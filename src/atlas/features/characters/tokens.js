/* PROJECT ATLAS - Character tokens.
   Small portraits on world dots, lot dots and clusters showing where
   characters were last seen (matched by forum thread ID). */

import { IMG_THUMB, imageUrl } from '../../core/images.js?v=202609221539';
import { updateOtherworldArrowTokens } from '../otherworlds/portal.js?v=202609221539';
import { CHARS } from './character-view.js?v=202609221539';

function getThreadIdFromUrl(url){
  if(!url) return null;
  var m = url.match(/\/t(\d+)f/);
  return m ? m[1] : null;
}

/* At most this many tokens are shown stacked; the rest are hidden until the
   dot is expanded, and a "+N" token stands in for them. */
const TOKEN_MAX = 5;

/* Markup of one character token. data-char carries the name, so a click on
   the token can find the character (see token-menu.js). */
function tokenHtml(c, i){
  var name = c.n||'';
  var face = c.img
    ? '<img class="dot-char-token" src="'+imageUrl(c.img,IMG_THUMB)+'" alt="'+name+'" loading="lazy" decoding="async">'
    : '<div class="dot-char-token-ph">'+name.charAt(0)+'</div>';
  var hidden = i>=TOKEN_MAX ? 'dot-char-token-hidden' : '';
  var key = name.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return '<div class="dot-char-token-wrap '+hidden+'" data-char="'+key+'">'+face+'<div class="dot-char-token-name">'+name+'</div></div>';
}

/* Tokens for a list of characters, plus the "+N" token if there are more. */
function tokensHtml(chars){
  return chars.map(tokenHtml).join('')
    + (chars.length>TOKEN_MAX ? '<div class="dot-char-token-wrap dot-char-token-extra"><div class="dot-char-token-ph">+'+(chars.length-TOKEN_MAX)+'</div></div>' : '');
}

export function updateAllTokens(){
  if(!CHARS.length){ setTimeout(updateAllTokens, 1000); return; }
  // Update lot dots
  document.querySelectorAll('.dot-char-tokens[data-lot-url]').forEach(function(el){
    var lotUrl = el.getAttribute('data-lot-url');
    if(!lotUrl) return;
    var lotThreadId = getThreadIdFromUrl(lotUrl);
    var chars = CHARS.filter(function(c){
      if(!c.lastSeenUrl) return false;
      return lotThreadId && getThreadIdFromUrl(c.lastSeenUrl) === lotThreadId;
    });
    // Update innerHTML only, keep the container with its data attribute
    el.innerHTML = tokensHtml(chars);
  });
  // Update world dots
  document.querySelectorAll('.dot-char-tokens[data-world-name]').forEach(function(el){
    var worldName = el.getAttribute('data-world-name');
    var chars = getCharsAtWorld(worldName);
    el.innerHTML = tokensHtml(chars);
  });
  // Update cluster dots (apartment complexes etc.) — aggregated over all lot URLs of the group
  document.querySelectorAll('.dot-char-tokens[data-cluster-urls]').forEach(function(el){
    var urls = (el.getAttribute('data-cluster-urls')||'').split('|').filter(Boolean);
    if(!urls.length){ el.innerHTML=''; return; }
    var threadIds = {};
    urls.forEach(function(u){ var id=getThreadIdFromUrl(u); if(id) threadIds[id]=true; });
    var seen = {};
    var chars = [];
    CHARS.forEach(function(c){
      if(!c.lastSeenUrl) return;
      var cid = getThreadIdFromUrl(c.lastSeenUrl);
      if(!cid || !threadIds[cid]) return;
      if(seen[c.n]) return;
      seen[c.n] = true;
      chars.push(c);
    });
    el.innerHTML = tokensHtml(chars);
  });
  // Update cluster item character indicators (small avatars at the right edge of each popup item)
  document.querySelectorAll('.cluster-item-chars[data-lot-url]').forEach(function(el){
    var lotUrl = el.getAttribute('data-lot-url');
    if(!lotUrl){ el.innerHTML=''; return; }
    var tid = getThreadIdFromUrl(lotUrl);
    var chars = CHARS.filter(function(c){
      return c.lastSeenUrl && tid && getThreadIdFromUrl(c.lastSeenUrl) === tid;
    });
    if(!chars.length){ el.innerHTML=''; return; }
    var html = chars.slice(0,3).map(function(c){
      var name=(c.n||'').replace(/"/g,'&quot;');
      return c.img
        ? '<img src="'+imageUrl(c.img,IMG_THUMB)+'" title="'+name+'" loading="lazy" decoding="async" style="width:18px;height:18px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(74,170,106,0.8);margin-left:-4px;box-shadow:0 0 4px rgba(74,170,106,0.5)">'
        : '<div title="'+name+'" style="width:18px;height:18px;border-radius:50%;background:rgba(74,170,106,0.3);border:1.5px solid rgba(74,170,106,0.6);display:flex;align-items:center;justify-content:center;font-size:9px;color:#4aaa6a;margin-left:-4px">'+(c.n.charAt(0)||'?')+'</div>';
    }).join('');
    if(chars.length>3) html += '<span style="font-size:9px;color:#4aaa6a;margin-left:4px;font-weight:500">+'+(chars.length-3)+'</span>';
    el.innerHTML = html;
  });
  // Update "Andere Welten" portal tokens
  if(typeof updateOtherworldArrowTokens === 'function') updateOtherworldArrowTokens();
}

export function buildCharTokensHtml(chars){
  if(!chars||!chars.length) return '';
  return '<div class="dot-char-tokens">' + tokensHtml(chars) + '</div>';
}

export { getThreadIdFromUrl };

export function getCharsAtWorld(worldName){
  if(!worldName) return [];
  return CHARS.filter(function(c){
    // Only show characters with lastSeenName AND lastSeenUrl —
    // if the URL was removed, the token disappears
    return c.lastSeenName && c.lastSeenUrl && c.lastSeenName.toLowerCase()===worldName.toLowerCase();
  });
}
