/* PROJECT ATLAS - "Zuletzt gesehen" sidebar.
   Characters active in the last 14 days, grouped by forum post (merged cards
   with unfolding tokens), plus the hover preview of the latest post. */

import { IMG_THUMB, imageUrl } from '../../core/images.js?v=202609182324';
import { SCRIPT_URL } from '../../config.js?v=202609182324';
import { WORLD_COLORS } from '../../data/worlds.js?v=202609182324';
import { syncMobileActivitySheet } from '../../ui/mobile-sheets.js?v=202609182324';
import { CHARS } from '../characters/character-view.js?v=202609182324';
import { _hasInteracted, _isVisible } from '../../core/boot.js?v=202609182324';

export function updateSidebarActivity(){
  var el=document.getElementById('sidebar-activity');
  if(!el||!CHARS.length)return;
  // Sort by lastSeenDate DESC (newest first)
  // Only characters with a date within the last 14 days
  var now=new Date();
  var FOURTEEN_DAYS = 14*24*60*60*1000;
  function parseDate(d){
    if(!d) return null;
    // First the regular d.m.yyyy format (from the tracker)
    var parts=d.split('.');
    if(parts.length>=3 && parts[0].length<=2 && parts[1].length<=2){
      var dt=new Date(parseInt(parts[2]),parseInt(parts[1])-1,parseInt(parts[0]));
      if(!isNaN(dt.getTime())) return dt;
    }
    // Fallback: JS date string ("Tue Apr 21 2026...") or ISO ("2026-04-21")
    // — Sheets sometimes converts date strings automatically
    var fallback = new Date(d);
    if(!isNaN(fallback.getTime())) return fallback;
    return null;
  }
  var active=CHARS.filter(function(c){
    if(!c.lastSeenName||!c.lastSeenUrl) return false;
    var dt = parseDate(c.lastSeenDate);
    if(!dt) return false; // no date = excluded (otherwise they hide the really active ones)
    return (now-dt)<=FOURTEEN_DAYS;
  });
  // Sort by date: newest first
  active.sort(function(a,b){
    var da = parseDate(a.lastSeenDate);
    var db = parseDate(b.lastSeenDate);
    return db - da;
  });
  // Deduplicate by name, keep first (= newest)
  var seen=new Set();
  var unique=active.filter(function(c){if(seen.has(c.n))return false;seen.add(c.n);return true;});

  // Group by lastSeenUrl — characters in the same forum post = one group
  function _buildGroups(charList){
    var groups = [];
    var groupIdx = {};
    charList.forEach(function(c){
      var key = c.lastSeenUrl || ('_solo_'+c.n);
      if(groupIdx[key] === undefined){
        groupIdx[key] = groups.length;
        groups.push({url: c.lastSeenUrl, world: c.lastSeenName, chars: [c]});
      } else {
        groups[groupIdx[key]].chars.push(c);
      }
    });
    return groups;
  }
  var groups = _buildGroups(unique).slice(0, 6);

  // Fill up to 6 groups with undated characters (sheet order) if there is room
  if(groups.length < 6){
    var usedChars = new Set();
    groups.forEach(function(g){ g.chars.forEach(function(c){ usedChars.add(c.n); }); });
    var filler = CHARS.filter(function(c){
      if(usedChars.has(c.n)) return false;
      return c.lastSeenName && c.lastSeenUrl;
    });
    var fseen = new Set();
    var uniqueFiller = filler.filter(function(c){
      if(fseen.has(c.n)) return false;
      fseen.add(c.n);
      return true;
    });
    var fillerGroups = _buildGroups(uniqueFiller);
    groups = groups.concat(fillerGroups.slice(0, 6 - groups.length));
  }

  function _portraitHtml(c, color){
    var nameShort = c.n.split(' ')[0];
    return c.img
      ? '<img src="'+imageUrl(c.img,IMG_THUMB)+'" loading="lazy" decoding="async" style="width:26px;height:26px;border-radius:50%;object-fit:cover;object-position:50% 30%;flex-shrink:0;border:1.5px solid '+color+';box-shadow:0 0 4px '+color+'88">'
      : '<div style="width:26px;height:26px;border-radius:50%;background:'+color+';display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:600;flex-shrink:0;box-shadow:0 0 4px '+color+'88">'+nameShort.charAt(0)+'</div>';
  }

  el.innerHTML = groups.map(function(g){
    var color = WORLD_COLORS[g.world] || '#4a6a7a';
    if(g.chars.length === 1){
      // Single card
      var c = g.chars[0];
      var nameShort = c.n.split(' ')[0];
      var player = c.p?'<span style="color:rgba(255,255,255,0.35);font-weight:400;margin-left:4px">&middot; '+c.p+'</span>':'';
      return '<div class="activity-item" style="cursor:pointer" data-url="'+c.lastSeenUrl+'">'
        + _portraitHtml(c, color)
        + '<div style="min-width:0;flex:1"><div class="activity-name">'+nameShort+player+'</div><div class="activity-world">'+g.world+'</div></div>'
        + '</div>';
    }
    // Merged card: compact with a merge icon — tokens unfold vertically to the left on hover
    var tokensHtml = g.chars.map(function(c, i){
      var nm = c.n.split(' ')[0];
      return '<div class="merged-token" style="--mt-idx:'+i+'">'
        + _portraitHtml(c, color)
        + '<div class="merged-token-name">'+nm+'</div>'
        + '</div>';
    }).join('');
    var countLabel = g.chars.length + ' Charaktere';
    return '<div class="activity-item activity-merged" style="cursor:pointer" data-url="'+g.chars[0].lastSeenUrl+'" data-merged="1">'
      + '<div class="merged-icon" title="'+g.chars.length+' Charaktere im selben Beitrag" style="border-color:'+color+'">'
      +   '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      +     '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 19c0-3 2.5-5 5-5s5 2 5 5"/><path d="M11 19c0-3 2.5-5 5-5s5 2 5 5"/>'
      +   '</svg>'
      + '</div>'
      + '<div style="min-width:0;flex:1"><div class="activity-name">'+countLabel+'</div><div class="activity-world">'+g.world+'</div></div>'
      + '<div class="merged-tokens" style="--mt-count:'+g.chars.length+'">'+tokensHtml+'</div>'
      + '</div>';
  }).join('');
  el.querySelectorAll('[data-url]').forEach(function(item){
    item.addEventListener('click',function(){window.open(this.getAttribute('data-url'),'_blank');});
    attachActivityPreview(item);
  });
  // Merged tokens as a popup in body — avoids overflow:hidden clipping
  el.querySelectorAll('.activity-merged').forEach(function(item){
    var tokensSrc = item.querySelector('.merged-tokens');
    if(!tokensSrc) return;
    var popupHtml = tokensSrc.innerHTML;
    var tokenCount = tokensSrc.querySelectorAll('.merged-token').length;
    tokensSrc.remove();
    var popup = null;
    function showTokens(){
      if(popup) return;
      popup = document.createElement('div');
      popup.className = 'merged-tokens-popup';
      popup.innerHTML = popupHtml;
      popup.querySelectorAll('.merged-token').forEach(function(t, i){
        t.style.setProperty('--mt-idx', i);
      });
      document.body.appendChild(popup);
      var rect = item.getBoundingClientRect();
      // The preview bubble is 280px wide and sits at rect.left - 280 - 12.
      // Tokens sit BETWEEN the sidebar (rect.left) and the preview.
      // Sidebar edge: rect.left, preview edge: rect.left - 12. Column ~290px wide.
      // The tokens go into a column right next to the card.
      var anchorX = rect.left - 8; // 8px left of the card
      var anchorY = rect.top + rect.height/2;
      requestAnimationFrame(function(){
        var tokens = popup.querySelectorAll('.merged-token');
        var count = tokens.length;
        // Vertical half circle: tokens stacked vertically, slightly bulging to the left
        // Vertical spread based on token height + spacing
        var spacing = 38; // vertical spacing in px
        var totalHeight = (count - 1) * spacing;
        var startY = anchorY - totalHeight/2;
        // Bulge: middle tokens furthest left, top/bottom closer to the card
        var bulgeMax = 20; // how far the middle tokens stick out to the left
        tokens.forEach(function(t, i){
          var tw = t.offsetWidth;
          var th = t.offsetHeight;
          // Normalized position index: 0 = top, 1 = bottom
          var pos = count > 1 ? i / (count - 1) : 0.5;
          // sin(pi * pos) = 0 at the ends, 1 in the middle → smooth bulge
          var bulge = Math.sin(Math.PI * pos) * bulgeMax;
          var tx = anchorX - tw - bulge;
          var ty = startY + spacing * i - th/2;
          // Viewport-Clamping
          tx = Math.max(8, Math.min(window.innerWidth - tw - 8, tx));
          ty = Math.max(8, Math.min(window.innerHeight - th - 8, ty));
          t.style.setProperty('--mt-x', tx + 'px');
          t.style.setProperty('--mt-y', ty + 'px');
        });
        requestAnimationFrame(function(){
          if(popup) popup.classList.add('visible');
        });
      });
    }
    function hideTokens(){
      if(!popup) return;
      var p = popup;
      popup = null;
      p.classList.remove('visible');
      setTimeout(function(){ if(p.parentNode) p.remove(); }, 350);
    }
    item.addEventListener('mouseenter', showTokens);
    item.addEventListener('mouseleave', hideTokens);
  });
  if(typeof syncMobileActivitySheet === 'function') syncMobileActivitySheet();
}

// Hover preview (shows the first sentences of the latest post)
var _activityPreviewCache = {};
var _activityPreviewEl = null;
var _activityPreviewTimer = null;
var _activityPrefetchIdx = 0;

function attachActivityPreview(item){
  var url = item.getAttribute('data-url');
  if(!url) return;
  if(window.matchMedia('(pointer:coarse)').matches) return; // no hover on touch

  // Prefetch only when a real user is present (not a bot/scraper):
  // - at least one interaction
  // - tab in the foreground
  // - at least 2s on the page
  if(_activityPreviewCache[url] === undefined){
    var idx = _activityPrefetchIdx++;
    setTimeout(function(){
      if(!_hasInteracted || !_isVisible()) return;
      prefetchActivityPreview(url);
    }, 2000 + idx * 120);
  }

  item.addEventListener('mouseenter', function(){
    clearTimeout(_activityPreviewTimer);
    _activityPreviewTimer = setTimeout(function(){
      showActivityPreview(item, url);
    }, 180);
  });
  item.addEventListener('mouseleave', function(){
    clearTimeout(_activityPreviewTimer);
    hideActivityPreview();
  });
}

function prefetchActivityPreview(url){
  if(_activityPreviewCache[url] !== undefined) return;
  fetch(SCRIPT_URL+'?action=postPreview&url='+encodeURIComponent(url))
    .then(function(r){return r.json();})
    .then(function(data){ _activityPreviewCache[url] = data; })
    .catch(function(){ _activityPreviewCache[url] = null; });
}

function showActivityPreview(item, url){
  hideActivityPreview();
  var rect = item.getBoundingClientRect();
  var div = document.createElement('div');
  div.className = 'activity-preview';
  document.body.appendChild(div);
  _activityPreviewEl = div;

  function position(){
    var w = 280;
    // Move the preview bubble further left so merged token popups
    // (~150px wide, right next to the sidebar) have room.
    var gap = item.classList.contains('activity-merged') ? 160 : 12;
    var left = rect.left - w - gap;
    var side = 'left';
    if(left < 8){
      left = rect.right + 12;
      side = 'right';
    }
    var top = rect.top + rect.height/2 - 30;
    if(top < 8) top = 8;
    if(top + 100 > window.innerHeight) top = window.innerHeight - 110;
    div.style.left = left + 'px';
    div.style.top = top + 'px';
    div.classList.remove('left','right');
    div.classList.add(side);
  }

  if(_activityPreviewCache[url] !== undefined){
    var data = _activityPreviewCache[url];
    if(!data || !data.text){ hideActivityPreview(); return; }
    div.innerHTML = '';
    var txt = document.createElement('div');
    txt.textContent = data.text;
    div.appendChild(txt);
    var hint = document.createElement('div');
    hint.style.cssText = 'margin-top:6px;font-style:normal;font-size:9px;color:rgba(74,170,106,0.75);letter-spacing:0.5px;text-transform:uppercase';
    hint.textContent = '→ Klicken & weiterlesen';
    div.appendChild(hint);
    position();
    return;
  }

  div.innerHTML = '<span class="activity-preview-loading"><span class="mini-compass" aria-hidden="true"></span>Lade Vorschau…</span>';
  position();

  fetch(SCRIPT_URL+'?action=postPreview&url='+encodeURIComponent(url))
    .then(function(r){return r.json();})
    .then(function(data){
      _activityPreviewCache[url] = data;
      if(_activityPreviewEl !== div) return;
      if(!data || !data.text){ hideActivityPreview(); return; }
      div.innerHTML = '';
      var txt = document.createElement('div');
      txt.textContent = data.text;
      div.appendChild(txt);
      var hint = document.createElement('div');
      hint.style.cssText = 'margin-top:6px;font-style:normal;font-size:9px;color:rgba(74,170,106,0.75);letter-spacing:0.5px;text-transform:uppercase';
      hint.textContent = '→ Klicken & weiterlesen';
      div.appendChild(hint);
      position();
    })
    .catch(function(){
      _activityPreviewCache[url] = null;
      if(_activityPreviewEl === div) hideActivityPreview();
    });
}

function hideActivityPreview(){
  if(_activityPreviewEl){
    _activityPreviewEl.remove();
    _activityPreviewEl = null;
  }
}
