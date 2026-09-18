/* PROJECT ATLAS - Character view.
   Grid of all characters with tabs, search, filters (player, gender, age), A–Z
   sorting and hover card. Loads characters from the Apps Script and caches
   them in localStorage (core/cache.js). CHARS starts with a small fallback list. */

import { IMG_CARD, imageUrl } from '../../core/images.js?v=202609181741';
import { readCache, writeCache } from '../../core/cache.js?v=202609181741';
import { SCRIPT_URL } from '../../config.js?v=202609181741';
import { updateAllTokens } from './tokens.js?v=202609181741';
import { updateSidebarActivity } from '../activity/last-seen.js?v=202609181741';
import { updateSidebarNewChars } from '../activity/sidebar-feeds.js?v=202609181741';

export var CHARS=[
  {n:"Sullivan 'Blaze' Blaisdell",p:"Ripzha",type:"haupt",u:"https://www.simsforumrpg.de/t78f51849-Sullivan-Blaze-Blaisdell.html",h:"Newcrest",img:"",age:"18",job:""},
  {n:"Artjom Komarow",p:"Ripzha",type:"haupt",u:"https://www.simsforumrpg.de/t266f51849-Artjom-Komarow.html",h:"Willow Creek",img:"",age:"18",job:""},
  {n:"Vaas Del Toro",p:"Ripzha",type:"haupt",u:"https://www.simsforumrpg.de/t654f51849-Vaas-Del-Toro.html",h:"",img:"",age:"21",job:""},
  {n:"David Janko",p:"RivaBabylon",type:"haupt",u:"https://www.simsforumrpg.de/t583f51849-David-Janko.html",h:"Britechester",img:"",age:"",job:""},
  {n:"Viola Nebeljäger",p:"Murloc",type:"haupt",u:"https://www.simsforumrpg.de/t86f51849-Viola-Nebeljaeger.html",h:"Ravenwood",img:"",age:"",job:""},
  {n:"Bea Greentail",p:"Murloc",type:"haupt",u:"https://www.simsforumrpg.de/t117f51849-Bea-Greentail.html",h:"",img:"",age:"",job:""},
  {n:"Ellie Hawk",p:"Murloc",type:"haupt",u:"https://www.simsforumrpg.de/t87f51849-Ellie-Hawk.html",h:"",img:"",age:"",job:""},
  {n:"Gerda Karlotta Simmer",p:"S.Bin.",type:"haupt",u:"https://www.simsforumrpg.de/t647f51849-Gerda-Karlotta-Simmer.html",h:"",img:"",age:"",job:""},
  {n:"Jack Elliot",p:"S.Bin.",type:"haupt",u:"https://www.simsforumrpg.de/t682f51849-Jack.html",h:"Del Sol Valley",img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f51850t682p6595n6_FCvJRagV.png",age:"20",job:"Studentin"}
];
var charActiveType='haupt';
var charPlayerFilter=[];
var charSortAZ=false;
var charFetched=false;
var charSearchTerm='';

export function openCharView(type){
  charActiveType=type||'haupt';
  location.hash='chars-'+charActiveType;
  try{sessionStorage.setItem('atlas_view','chars');}catch(e){}
  document.getElementById('char-container').classList.add('open');
  document.querySelectorAll('.char-tab').forEach(function(t){
    var map={'haupt':'Haupt','neben':'Nebencharaktere','randfigur':'Randfiguren','passant':'Passanten'};
    t.classList.toggle('active',t.textContent.indexOf(map[charActiveType]||charActiveType)>-1);
  });
  charPlayerFilter=[];
  charGenderFilter=[];
  charAgeFilter=[];
  var grid=document.getElementById('char-grid');
  var sub=document.getElementById('char-subtitle');
  if(grid)grid.innerHTML='<div style="color:rgba(255,255,255,0.3);font-size:22px;padding:60px;grid-column:1/-1;text-align:center">⏳</div>';
  if(sub)sub.textContent='Lade...';
  // Loading screen only if characters are not loaded yet (first open in the session)
  var _showLoader = (!charFetched && typeof window.showAtlasLoading === 'function');
  if(_showLoader) window.showAtlasLoading('Charaktere laden…');
  var p = fetchCharsFromScript();
  if(_showLoader && p && typeof p.finally === 'function'){
    p.finally(function(){
      if(typeof window.hideAtlasLoading === 'function') window.hideAtlasLoading();
    });
  } else if(_showLoader){
    // Fallback if fetchCharsFromScript returns synchronously
    setTimeout(function(){
      if(typeof window.hideAtlasLoading === 'function') window.hideAtlasLoading();
    }, 100);
  }
}

function fitCharGrid(){
  var header=document.getElementById('char-header');
  var grid=document.getElementById('char-grid');
  if(!header||!grid)return;
  if(!grid.clientWidth||!header.offsetHeight){
    requestAnimationFrame(fitCharGrid);return;
  }
  var isMobile=window.innerWidth<=768||window.__atlasForceMobile===true;
  var gap=isMobile?6:8;
  var padding=isMobile?16:20;
  var availW=grid.clientWidth-padding;
  var maxCols=isMobile?3:6;
  var cols=Math.min(maxCols,Math.max(2,Math.floor((availW+gap)/(120+gap))));
  var colW=Math.floor((availW-(cols-1)*gap)/cols);
  // Sync CSS columns with JS calculation
  grid.style.gridTemplateColumns='repeat('+cols+',1fr)';
  if(colW>0)grid.style.gridAutoRows=colW+'px';
}

export function closeCharView(){
  document.getElementById('char-container').classList.remove('open');
  location.hash='';
  try{sessionStorage.removeItem('atlas_view');}catch(e){}
}

export function switchCharTab(type,btn){
  charSearchTerm='';
  var si=document.getElementById('char-search');
  if(si)si.value='';
  charActiveType=type;
  location.hash='chars-'+type;
  document.querySelectorAll('.char-tab').forEach(function(t){t.classList.remove('active');});
  if(btn)btn.classList.add('active');
  charPlayerFilter=[];
  charRenderFiltered();
  buildPlayerFilter();
}

export function reloadChars(){
  charFetched=false;
  var grid=document.getElementById('char-grid');
  if(grid)grid.innerHTML='<div style="color:rgba(255,255,255,0.3);font-size:22px;padding:60px;grid-column:1/-1;text-align:center">⏳</div>';
  // Show the ATLAS loading screen — the user is actively waiting for the reload
  if(typeof window.showAtlasLoading === 'function') window.showAtlasLoading('Charaktere laden…');
  fetchCharsFromScript(null).finally(function(){
    if(typeof window.hideAtlasLoading === 'function') window.hideAtlasLoading();
  });
}

export async function fetchCharsFromScript(){
  // Cache: show the last known characters immediately (localStorage, survives
  // closing the tab), then refresh in the background
  try{
    var cachedData=readCache('chars');
    if(cachedData){
      if(cachedData.length>0){
        CHARS.length=0;
        cachedData.forEach(function(c){CHARS.push(c);});
        charFetched=true;
        var _co=document.getElementById('char-container');
        if(_co&&_co.classList.contains('open')){charRenderFiltered();buildPlayerFilter();}
        updateAllTokens();
        updateSidebarActivity();
        updateSidebarNewChars();
      }
    }
  }catch(e){}
  // Refresh in the background
  try{
    var r=await fetch(SCRIPT_URL);
    if(!r.ok)throw new Error('HTTP '+r.status);
    var data=await r.json();
    if(!Array.isArray(data)||!data.length)throw new Error('leer');
    // Mapping
    var fresh=data.filter(function(c){return c.name;}).map(function(c){
      var t=(c.type||'').toLowerCase();
      if(t.indexOf('neben')>-1)t='neben';
      else if(t.indexOf('randfigur')>-1||t.indexOf('rand')>-1)t='randfigur';
      else if(t.indexOf('passant')>-1)t='passant';
      else if(t.indexOf('statist')>-1)t='randfigur';
      else t='haupt';
      return{n:c.name||'',p:(c.player||'').trim(),type:t,u:c.threadUrl||'',h:c.home||'',img:c.portraitUrl||'',age:c.age||'',job:c.job||'',okkult:c.Okkult||c.okkult||'',gender:c.gender||c.Geschlecht||'',lastSeenName:c.lastSeenName||'',lastSeenUrl:c.lastSeenUrl||'',lastSeenDate:c.lastSeenDate||'',ts:c.Timestamp||c.timestamp||''};
    });
    if(fresh.length>0){
      CHARS.length=0;
      fresh.forEach(function(c){CHARS.push(c);});
      charFetched=true;
      // Update cache
      writeCache('chars',fresh);
    }
  }catch(e){}
  // Only render char grid if view is open
  if(document.getElementById('char-container')&&document.getElementById('char-container').classList.contains('open')){
    charRenderFiltered();
    buildPlayerFilter();
  }
  updateAllTokens();
  updateSidebarActivity();
  updateSidebarNewChars();
  // Rebuild age filter if open
  if(document.getElementById('char-age-bar')&&document.getElementById('char-age-bar').classList.contains('open'))buildAgeFilter();
}

export function charSearchFilter(val){
  charSearchTerm=val.toLowerCase().trim();
  charRenderFiltered();
}

export function toggleCharSort(){
  charSortAZ=!charSortAZ;
  var btn=document.getElementById('char-sort-btn');
  if(btn)btn.classList.toggle('active',charSortAZ);
  charRenderFiltered();
}

function charRenderFiltered(){
  // If a search is active: search across all types
  var list;
  if(charSearchTerm){
    list=CHARS.filter(function(c){
      return (c.n||'').toLowerCase().includes(charSearchTerm);
    });
  } else {
    list=CHARS.filter(function(c){return c.type===charActiveType;});
  }
  if(charPlayerFilter.length>0)list=list.filter(function(c){return charPlayerFilter.some(function(f){return f.toLowerCase()===(c.p||"").trim().toLowerCase();});});
  if(charGenderFilter.length>0){
    list=list.filter(function(c){
      var g=(c.gender||'').toLowerCase();
      return charGenderFilter.some(function(v){
        if(v==='m')return g==='m'||g==='männlich'||g==='male';
        if(v==='f')return g==='f'||g==='weiblich'||g==='female';
        if(v==='d')return g==='d'||g==='divers'||g==='diverse'||g==='non-binary'||g==='nb';
        return true;
      });
    });
  }
  if(charAgeFilter.length>0){
    list=list.filter(function(c){
      var a=parseInt(c.age);
      if(isNaN(a))return false;
      return charAgeFilter.some(function(label){
        var grp=AGE_GROUPS.find(function(g){return g.label===label;});
        return grp&&a>=grp.min&&a<=grp.max;
      });
    });
  }
  if(charSortAZ)list=list.slice().sort(function(a,b){return a.n.localeCompare(b.n,'de');});
  charRender(list);
}

function buildPlayerFilter(){
  var list=CHARS.filter(function(c){return c.type===charActiveType;});
  var seen={};
  var players=[];
  list.forEach(function(c){
    if(!c.p)return;
    var key=c.p.trim().toLowerCase();
    if(!seen[key]){seen[key]=c.p.trim();players.push(c.p.trim());}
  });
  players.sort();
  var bar=document.getElementById('char-filter-bar');
  if(!bar)return;
  var btns='';
  players.forEach(function(p){
    var active=charPlayerFilter.some(function(f){return f.toLowerCase()===p.toLowerCase()})?' active':'';
    btns+='<button class="char-filter'+active+'" onclick="togglePlayerFilter(this)">'+p+'</button>';
  });
  bar.innerHTML=btns;
}

export function togglePlayerFilter(btn){
  var p=btn.textContent;
  var idx=charPlayerFilter.indexOf(p);
  if(idx>-1){charPlayerFilter.splice(idx,1);btn.classList.remove('active');}
  else{charPlayerFilter.push(p);btn.classList.add('active');}
  updateResetBtn();
  charRenderFiltered();
}

var charAgeFilter=[];
var charGenderFilter=[];

export function toggleGenderFilter(btn,val){
  var idx=charGenderFilter.indexOf(val);
  if(idx>-1){charGenderFilter.splice(idx,1);btn.classList.remove('active');}
  else{charGenderFilter.push(val);btn.classList.add('active');}
  updateResetBtn();
  charRenderFiltered();
}
var AGE_GROUPS=[
  {label:'Neugeborenes',range:'0-28 Tage',min:0,max:0},
  {label:'Säugling',range:'1-12 Monate',min:0,max:1},
  {label:'Kleinkind',range:'2-3 Jahre',min:2,max:3},
  {label:'Kind',range:'4-12 Jahre',min:4,max:12},
  {label:'Teenager',range:'13-19 Jahre',min:13,max:19},
  {label:'Junger Erwachsener',range:'20-44 Jahre',min:20,max:44},
  {label:'Erwachsener',range:'45-69 Jahre',min:45,max:69},
  {label:'Senior',range:'ab 70 Jahre',min:70,max:99999}
];

export function toggleAgeFilter(){
  var bar=document.getElementById('char-age-bar');
  var btn=document.getElementById('char-age-toggle');
  var isOpen=bar.classList.contains('open');
  if(isOpen){
    bar.classList.remove('open');
    btn.classList.remove('active');
  } else {
    bar.classList.add('open');
    btn.classList.add('active');
    buildAgeFilter();
  }
}

function buildAgeFilter(){
  var bar=document.getElementById('char-age-bar');
  if(!bar)return;
  // Start with tab filter
  var base=CHARS.filter(function(c){return c.type===charActiveType;});
  // Apply player filter
  if(charPlayerFilter.length>0)base=base.filter(function(c){return charPlayerFilter.some(function(f){return f.toLowerCase()===(c.p||'').trim().toLowerCase();});});
  // Apply gender filter
  if(charGenderFilter.length>0)base=base.filter(function(c){
    var g=(c.gender||'').toLowerCase();
    return charGenderFilter.some(function(v){
      if(v==='m')return g==='m'||g==='männlich'||g==='male';
      if(v==='f')return g==='f'||g==='weiblich'||g==='female';
      if(v==='d')return g==='d'||g==='divers'||g==='diverse'||g==='non-binary'||g==='nb';
      return true;
    });
  });
  // Only show age groups with at least 1 match in this filtered base
  bar.innerHTML=AGE_GROUPS.filter(function(g){
    return base.some(function(c){
      var a=parseInt(c.age);
      return !isNaN(a)&&a>=g.min&&a<=g.max;
    });
  }).map(function(g){
    var active=charAgeFilter.indexOf(g.label)>-1?' active':'';
    var rangeStr=g.range?'<span style="opacity:0.55;margin-left:4px;font-size:9px">'+g.range+'</span>':'';
    return '<button class="char-age-filter'+active+'" data-label="'+g.label+'" data-min="'+g.min+'" data-max="'+g.max+'" onclick="toggleAgeGroup(this)">'+g.label+rangeStr+'</button>';
  }).join('');
}

function updateResetBtn(){
  var hasFilter=charAgeFilter.length>0||charGenderFilter.length>0||charPlayerFilter.length>0;
  var btn=document.getElementById('char-reset-btn');
  if(btn)btn.classList.toggle('visible',hasFilter);
}

export function resetAllFilters(){
  charAgeFilter=[];
  charGenderFilter=[];
  charPlayerFilter=[];
  document.querySelectorAll('.char-gender-filter').forEach(function(b){b.classList.remove('active');});
  buildAgeFilter();
  buildPlayerFilter();
  updateResetBtn();
  charRenderFiltered();
}

export function toggleAgeGroup(btn){
  var label=btn.getAttribute('data-label');
  var idx=charAgeFilter.indexOf(label);
  if(idx>-1){charAgeFilter.splice(idx,1);btn.classList.remove('active');}
  else{charAgeFilter.push(label);btn.classList.add('active');}
  updateResetBtn();
  charRenderFiltered();
}


function makeCard(c){
  var card=document.createElement('div');
  card.className='char-card';
  card.setAttribute('data-url',c.u);
  card.onclick=function(){window.open(this.getAttribute('data-url'),'_blank');};
  var portrait=c.img
    ?'<img class="char-portrait" src="'+imageUrl(c.img,IMG_CARD)+'" alt="'+c.n+'" loading="lazy" decoding="async">'
    :'<div class="char-portrait-ph">&#128100;</div>';
  card.innerHTML='<div class="char-portrait-wrap">'+portrait
    +'<div class="char-name-overlay"><span class="char-name-overlay-name">'+c.n+'</span>'
    +'</div></div>';
  card.addEventListener('mouseenter',function(e){showCharHover(c,e.currentTarget);});
  card.addEventListener('mouseleave',hideCharHover);
  return card;
}

function charRender(list){
  var grid=document.getElementById('char-grid');
  var sub=document.getElementById('char-subtitle');
  if(!grid||!sub)return;
  sub.textContent=list.length+' Charaktere';
  grid.innerHTML='';
  if(!list.length){
    grid.innerHTML='<div style="color:rgba(255,255,255,0.3);font-size:12px;padding:40px;text-align:center">Keine Charaktere gefunden.</div>';
    return;
  }
  grid.classList.toggle('az-mode',charSortAZ);
  if(charSortAZ){
    // Group by first letter, render as sections
    var groups={};
    var order=[];
    list.forEach(function(c){
      var fl=(c.n||'?')[0].toUpperCase();
      if(!groups[fl]){groups[fl]=[];order.push(fl);}
      groups[fl].push(c);
    });
    order.forEach(function(letter){
      var section=document.createElement('div');
      section.className='char-letter-section';
      var heading=document.createElement('div');
      heading.className='char-letter-divider';
      heading.textContent=letter;
      section.appendChild(heading);
      var subgrid=document.createElement('div');
      subgrid.className='char-subgrid';
      groups[letter].forEach(function(c){subgrid.appendChild(makeCard(c));});
      section.appendChild(subgrid);
      grid.appendChild(section);
    });
  } else {
    list.forEach(function(c){grid.appendChild(makeCard(c));});
  }
}

var _hoverTimeout=null;
function showCharHover(c,card){
  clearTimeout(_hoverTimeout);
  var hc=document.getElementById('char-hover-card');
  document.getElementById('chc-name').textContent=c.n;
  document.getElementById('chc-player').textContent='gespielt von '+c.p;
  var details=[];
  if(c.age)details.push('🎂 '+c.age+' Jahre');
  if(c.job)details.push('💼 '+c.job);
  if(c.okkult)details.push('✨ '+c.okkult);
  if(c.h)details.push('🏠 '+c.h);
  document.getElementById('chc-details').innerHTML=details.join('<br>')||'<span style="color:rgba(255,255,255,0.2)">Keine Infos</span>';
  var ls=document.getElementById('chc-lastseen');
  if(c.lastSeenName&&c.lastSeenUrl){
    ls.innerHTML='📍 Zuletzt in: <a href="'+c.lastSeenUrl+'" target="_blank" style="color:#4aaa6a;text-decoration:none;cursor:pointer">'+c.lastSeenName+'</a>';
  } else if(c.lastSeenName){
    ls.textContent='📍 Zuletzt in: '+c.lastSeenName;
  } else {ls.textContent='';}
  document.getElementById('chc-link').textContent='Charakterbogen öffnen →';
  var rect=card.getBoundingClientRect();
  var hcw=200,pad=8;
  var left=rect.right+pad;
  if(left+hcw>window.innerWidth)left=rect.left-hcw-pad;
  var top=rect.top;
  if(top+180>window.innerHeight)top=window.innerHeight-190;
  hc.style.left=left+'px';hc.style.top=top+'px';
  hc.classList.add('visible');
  // The hover card itself stays open while hovered
  hc.onmouseenter=function(){clearTimeout(_hoverTimeout);};
  hc.onmouseleave=function(){hideCharHover();};
}
function hideCharHover(){
  _hoverTimeout=setTimeout(function(){
    document.getElementById('char-hover-card').classList.remove('visible');
  },200);
}

// URL hash: a refresh keeps the view
window.addEventListener('hashchange',function(){
  var h=location.hash;
  var m=h.match(/^#chars-(.+)$/);
  if(m)openCharView(m[1]);
  else if(!h&&document.getElementById('char-container').classList.contains('open'))closeCharView();
});
