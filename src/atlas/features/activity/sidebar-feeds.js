/* PROJECT ATLAS - Sidebar feeds.
   Forum statistics and online users, the three newest characters, and forum
   activity outside the RPG worlds. Data comes from the Apps Script
   (SCRIPT_URL); the last known data is shown immediately from the cache. */

import { IMG_THUMB, imageUrl } from '../../core/images.js?v=202609181741';
import { readCache, writeCache } from '../../core/cache.js?v=202609181741';
import { SCRIPT_URL } from '../../config.js?v=202609181741';
import { syncMobileActivitySheet } from '../../ui/mobile-sheets.js?v=202609181741';
import { CHARS } from '../characters/character-view.js?v=202609181741';

let statsShown=false;

export function updateSidebarStats(){
  // First call: show the last known stats immediately, then fetch live ones
  if(!statsShown){
    var cached=readCache('stats');
    if(cached) renderStats(cached);
  }
  fetch(SCRIPT_URL+'?action=stats')
    .then(function(r){return r.json();})
    .then(function(d){
      if(!d.posts&&!d.topics) return;
      writeCache('stats', d);
      renderStats(d);
    }).catch(function(){});
}

// Renders forum stats and online users.
function renderStats(d){
  statsShown=true;
  var stats=document.getElementById('sidebar-stats');
  if(!stats) return;
  stats.innerHTML=
    '<div class="stat-row"><span class="stat-key">Posts</span><span>'+(d.posts||'–')+'</span></div>'+
    '<div class="stat-row"><span class="stat-key">Themen</span><span>'+(d.topics||'–')+'</span></div>'+
    '<div class="stat-row"><span class="stat-key">Mitglieder</span><span>'+(d.members||'–')+'</span></div>';
  // Update online users
  if(d.online&&d.online.length){
    var onlineEl=document.getElementById('sidebar-online');
    if(onlineEl) onlineEl.innerHTML=d.online.map(function(u){
      return '<div class="online-item"><div style="width:6px;height:6px;border-radius:50%;background:#4aaa6a"></div>'+u+'</div>';
    }).join('');
  }
}

// Top 3 newest characters — sorted by forum thread ID (highest = newest,
// because Xobor counts up monotonically and edits do not change the ID)
export function updateSidebarNewChars(){
  var el=document.getElementById('sidebar-newchars');
  if(!el) return;
  if(!CHARS.length){
    el.innerHTML='<div class="activity-preview-loading" style="padding:6px 4px;font-size:10px"><span class="mini-compass" aria-hidden="true"></span>Lade&hellip;</div>';
    return;
  }
  var TYPE_LABELS={
    'haupt':'Hauptcharakter',
    'neben':'Nebencharakter',
    'randfigur':'Randfigur',
    'passant':'Passant'
  };
  function threadIdFromUrl(u){
    var m=(u||'').match(/\/t(\d+)f/);
    return m?parseInt(m[1]):0;
  }
  var withId=CHARS.filter(function(c){return c.u && threadIdFromUrl(c.u)>0;}).slice();
  withId.sort(function(a,b){return threadIdFromUrl(b.u)-threadIdFromUrl(a.u);});
  var top=withId.slice(0,3);
  if(!top.length){
    el.innerHTML='<div style="font-size:10px;color:rgba(255,255,255,0.2)">Keine Daten</div>';
    return;
  }
  el.innerHTML=top.map(function(c){
    var nameShort=c.n.length>22?c.n.substr(0,20)+'…':c.n;
    var typeLabel=TYPE_LABELS[c.type]||c.type||'';
    var portrait=c.img
      ?'<img src="'+imageUrl(c.img,IMG_THUMB)+'" loading="lazy" decoding="async" style="width:26px;height:26px;border-radius:50%;object-fit:cover;object-position:50% 30%;flex-shrink:0;border:0.5px solid rgba(255,255,255,0.15)">'
      :'<div style="width:26px;height:26px;border-radius:50%;background:rgba(74,170,106,0.25);display:flex;align-items:center;justify-content:center;font-size:12px;color:#4aaa6a;flex-shrink:0;border:0.5px solid rgba(74,170,106,0.4)">'+(c.n.charAt(0)||'?')+'</div>';
    return '<div class="activity-item" style="cursor:pointer" data-url="'+c.u+'" title="'+c.n+(c.p?' (gespielt von '+c.p+')':'')+'">'
      +portrait
      +'<div style="min-width:0;flex:1"><div class="activity-name">'+nameShort+'</div><div class="activity-world">'+typeLabel+'</div></div>'
      +'</div>';
  }).join('');
  el.querySelectorAll('[data-url]').forEach(function(item){
    item.addEventListener('click',function(){window.open(this.getAttribute('data-url'),'_blank');});
  });
  if(typeof syncMobileActivitySheet === 'function') syncMobileActivitySheet();
}

// Forum activity outside the RPG worlds (gallery, blog, OOC areas)
export function updateSidebarForum(){
  var el=document.getElementById('sidebar-forum');
  if(!el) return;
  // First call (empty or still the loading placeholder from the markup): show
  // the last known activity immediately if there is any, otherwise the mini
  // compass. Later calls (refresh) keep the current content.
  if(!el.innerHTML.trim() || el.dataset.sidebarLoading === '1' || el.querySelector('.activity-preview-loading')){
    var cached=readCache('forum');
    if(cached){
      renderForumEvents(el, cached);
    } else {
      el.dataset.sidebarLoading = '1';
      el.innerHTML='<div class="activity-preview-loading" style="padding:8px 4px"><span class="mini-compass" aria-hidden="true"></span>Lade…</div>';
    }
  }
  fetch(SCRIPT_URL+'?action=forumActivity')
    .then(function(r){return r.json();})
    .then(function(events){
      if(Array.isArray(events)) writeCache('forum', events);
      renderForumEvents(el, events);
    })
    .catch(function(){
      // Keep what is shown (e.g. cached activity); only replace the loader
      if(el.dataset.sidebarLoading !== '1') return;
      el.dataset.sidebarLoading = '0';
      el.innerHTML='<div style="font-size:10px;color:rgba(255,80,80,0.4)">Fehler</div>';
    });
}

// Renders the forum activity list.
function renderForumEvents(el, events){
  el.dataset.sidebarLoading = '0';
  if(!Array.isArray(events)||!events.length){
    el.innerHTML='<div style="font-size:10px;color:rgba(255,255,255,0.2)">Keine Aktivität</div>';
    return;
  }
  var now=Math.floor(Date.now()/1000);
  function relTime(ts){
    var s=now-ts;
    if(s<60) return 'jetzt';
    if(s<3600) return Math.floor(s/60)+' Min';
    if(s<86400) return Math.floor(s/3600)+' Std';
    if(s<7*86400) return Math.floor(s/86400)+' d';
    var d=new Date(ts*1000);
    return d.getDate()+'.'+(d.getMonth()+1)+'.';
  }
  function typeIcon(t){
    if(t==='forum_topic') return '💬';
    if(t==='forum_message') return '↩';
    if(t==='gallery_picture') return '🖼';
    if(t==='blog_entry') return '📝';
    if(t==='blog_comment') return '💭';
    if(t==='user_profile') return '👋';
    if(t==='usergbook_message') return '📖';
    if(t==='rating') return '⭐';
    return '·';
  }
  el.innerHTML=events.slice(0,6).map(function(ev){
    var title=(ev.title||'');
    var titleShort = title.length>28 ? title.substr(0,26)+'…' : title;
    var user=ev.user||'Jemand';
    if(user.length>22) user=user.substr(0,20)+'…';
    // Hover tooltip: full title + action + user
    var tipParts = [];
    if(ev.user) tipParts.push(ev.user);
    if(ev.action) tipParts.push(ev.action);
    var tipLine1 = tipParts.join(' ');
    var tipText = (tipLine1 ? tipLine1 + (title ? ': ' : '') : '') + (title || '');
    var tipAttr = tipText ? ' data-tip="' + tipText.replace(/"/g,'&quot;') + '"' : '';
    // Avatar with a type icon badge at the bottom right
    var avatar=ev.avatar
      ?'<img src="'+imageUrl(ev.avatar,IMG_THUMB)+'" loading="lazy" decoding="async" style="width:26px;height:26px;border-radius:50%;object-fit:cover;display:block;border:0.5px solid rgba(255,255,255,0.15)">'
      :'<div style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:13px;color:rgba(255,255,255,0.5)">'+(user.charAt(0)||'?')+'</div>';
    var badge='<div style="position:absolute;bottom:-2px;right:-2px;width:13px;height:13px;border-radius:50%;background:#0a1420;display:flex;align-items:center;justify-content:center;font-size:9px;border:1px solid rgba(255,255,255,0.1)">'+typeIcon(ev.type)+'</div>';
    return '<div class="activity-item" style="cursor:pointer" data-url="'+ev.url+'"'+tipAttr+'>'
      +'<div style="position:relative;flex-shrink:0">'+avatar+badge+'</div>'
      +'<div style="min-width:0;flex:1">'
      +'<div class="activity-name" style="font-size:10px">'+user+'</div>'
      +'<div class="activity-world" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(ev.action||'')+(titleShort?' &middot; '+titleShort:'')+'</div>'
      +'<div style="font-size:9px;color:rgba(255,255,255,0.25);margin-top:1px">vor '+relTime(ev.ts)+'</div>'
      +'</div></div>';
  }).join('');
  el.querySelectorAll('[data-url]').forEach(function(item){
    var url = item.getAttribute('data-url');
    item.addEventListener('click',function(){window.open(url,'_blank');});
  });
  if(typeof syncMobileActivitySheet === 'function') syncMobileActivitySheet();
}
