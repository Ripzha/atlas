/* PROJECT ATLAS - Core logic (legacy, German comments). Being split into
   features in stage 3. Configuration and data now live in src/atlas/config.js
   and src/atlas/data/. */

// ═══════════════════════════════════════════
// RELOAD PERSISTENCE

// ═══════════════════════════════════════════
// LOAD-PRIORISIERUNG nach Einstiegsseite
// ═══════════════════════════════════════════
// Detection läuft VOR load damit andere Funktionen es lesen können
var ENTRY_MODE = (function(){
  try {
    if(location.hash && location.hash.match(/^#chars/)) return 'chars';
    if(sessionStorage.getItem('atlas_world')) return 'world';
  } catch(e){}
  return 'continent'; // Default
})();
// Nach load: erste N Bilder im jeweiligen Bereich kriegen fetchpriority=high
// um schneller initial gerendert zu werden. Browser lädt sie parallel zur lazy-Logik.
// Mobile-aware: Sidebars sind unter 768px display:none → die priorisieren wir nicht,
// stattdessen die Char-Tokens auf den Welt-Dots (die sieht man).
function _prioritizeInitialImages(){
  try {
    var isMobile = window.matchMedia('(max-width:768px)').matches;
    var sel, limit;
    if(ENTRY_MODE === 'chars'){
      sel = '.char-portrait';
      limit = isMobile ? 8 : 12;
    } else if(ENTRY_MODE === 'world'){
      // Auf Mobile sind .cluster-hover ausgeblendet — nur lot-tooltip-bilder
      sel = isMobile ? '.lot-tooltip img' : '.lot-tooltip img, .cluster-item-preview';
      limit = isMobile ? 6 : 12;
    } else {
      // continent Default
      if(isMobile){
        // Sidebars sind display:none, .hover-card auch — die Tokens auf den Dots aber sichtbar
        sel = '.dot-char-token';
        limit = 12;
      } else {
        sel = '#sidebar-activity img, #sidebar-forum img, #sidebar-newchars img';
        limit = 8;
      }
    }
    var imgs = document.querySelectorAll(sel);
    for(var i = 0; i < Math.min(imgs.length, limit); i++){
      imgs[i].setAttribute('fetchpriority', 'high');
      imgs[i].removeAttribute('loading');
    }
  } catch(e){}
}

window.addEventListener('load',function(){
  updateSidebarStats();
  // Sheet-Lots schon beim Load fetchen damit die Hover-Vorschaubilder auf der
  // Kontinentkarte das Sheet-Bild haben (nicht erst beim ersten Welt-Betreten)
  fetchSheetLots(function(){
    // Alle Hover-Bilder updaten, falls Sheet ein Welt-Bild überschreibt
    document.querySelectorAll('.world-dot').forEach(function(dot){
      var wname=dot.dataset.worldKey;
      var sheetImg=(sheetWorldMeta[wname]||{}).img;
      if(!sheetImg)return;
      var img=dot.querySelector('.hover-img');
      if(img){
        img.src=sheetImg;
        img.style.display='block';
      } else {
        // Wenn es vorher kein Bild gab (weil w.img leer): einfügen
        var card=dot.querySelector('.hover-card > div');
        if(card){
          var newImg=document.createElement('img');
          newImg.className='hover-img';
          newImg.src=sheetImg;
          newImg.onerror=function(){this.style.display='none';};
          card.insertBefore(newImg,card.firstChild);
        }
      }
    });
  });
  try{
    var saved=sessionStorage.getItem('atlas_world');
    var savedBuilding=sessionStorage.getItem('atlas_building');
    var savedView=sessionStorage.getItem('atlas_view'); // 'chars' | 'otherworlds' | null
    if(saved){
      var w=worlds.find(function(x){return x.name===saved;});
      if(!w)w=otherworlds.find(function(x){return x.name===saved;});
      if(w)setTimeout(function(){
        enterWorld(w);
        // Nach enterWorld (welches fetchSheetLots triggert) auch Building restaurieren
        if(savedBuilding){
          setTimeout(function(){
            // Finde Building-Lots in der aktuellen Welt
            var lots=(worldLots[w.name]||[]).filter(function(l){return l.building===savedBuilding;});
            if(lots.length && typeof enterBuilding==='function') enterBuilding(savedBuilding,lots);
          },600);
        }
      },100);
    }
    // View-State restaurieren (Char-Container, Other-Worlds-Container)
    // Hash-basierter Restore für Char-Container
    var hash = location.hash;
    var charMatch = hash.match(/^#chars-(.+)$/);
    if(charMatch && typeof openCharView === 'function'){
      setTimeout(function(){ openCharView(charMatch[1]); }, 150);
    } else if(savedView === 'chars' && typeof openCharView === 'function'){
      setTimeout(function(){ openCharView('haupt'); }, 150);
    } else if(savedView === 'otherworlds' && typeof openOtherWorld === 'function'){
      setTimeout(function(){ openOtherWorld(); }, 150);
    }
  }catch(e){}
});
// ═══════════════════════════════════════════
// STATE & STORAGE
// ═══════════════════════════════════════════
let adminMode=false,logoClicks=0,logoTimer=null;
let currentWorld=null;
let calibMapMode=false,calibWorldMode=false;
let calibMapData=[],calibWorldData=[],calibMapIdx=0;
let posMode=false,posModeCallback=null,pendingPos=null;
let customLots=JSON.parse(localStorage.getItem('sw_custom_lots')||'{}');
let hiddenLots=JSON.parse(localStorage.getItem('sw_hidden_lots')||'{}');
let renamedLots=JSON.parse(localStorage.getItem('sw_renamed_lots')||'{}');
let adminWorldFilter=worlds[0].name,adminTab='lots';
function saveLots(){localStorage.setItem('sw_custom_lots',JSON.stringify(customLots))}
function saveHidden(){localStorage.setItem('sw_hidden_lots',JSON.stringify(hiddenLots))}
function saveRenamed(){localStorage.setItem('sw_renamed_lots',JSON.stringify(renamedLots))}


// Sheet-Daten für Lots (aus Google Sheets)
var sheetLots = {}; // {worldName: {nr: {name, threadUrl, imgUrl}}}
var sheetWorldMeta = {}; // {worldName: {rent: '...'}} — Zeilen ohne nr
var sheetLotsLoaded = false;

function fetchSheetLots(cb){
  if(sheetLotsLoaded){ if(cb) cb(); return; }
  fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRRllRkwaCacdM0WZZT0cVQflhxJ9Fw5mgId-v615_kE2GdKdbwHMUYCG03HC8gUXfg7lucTs1Mqhg1/pub?output=csv&gid=306313316&single=true')
    .then(r=>r.text())
    .then(csv=>{
      const rows = csv.split('\n');
      const headers = rows[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase());
      const wIdx = headers.indexOf('welt');
      const nIdx = headers.indexOf('nr.');
      const nameIdx = headers.indexOf('name');
      const urlIdx = headers.indexOf('thread url');
      const imgIdx = headers.indexOf('bild url');
      const groupIdx = headers.indexOf('dot-gruppe');
      const rentIdx = headers.indexOf('mietinfo');
      const catIdx = headers.indexOf('category');
      const hasAtlasIdx = headers.indexOf('has_atlas');
      const extUrlIdx = headers.indexOf('external_url');
      sheetLots = {};
      sheetWorldMeta = {};
      rows.slice(1).filter(r=>r.trim()).forEach(r=>{
        const cols = r.split(',');
        const get = i => i<0 ? '' : (cols[i]||'').replace(/"/g,'').trim();
        const world = get(wIdx);
        const nr = get(nIdx);
        if(!world) return;
        // Welt-Meta-Zeile: nur welt gesetzt, kein nr — enthält z.B. Mietinfo + Bild
        if(!nr){
          if(!sheetWorldMeta[world]) sheetWorldMeta[world] = {};
          const rent = get(rentIdx);
          const img = get(imgIdx);
          const cat = get(catIdx);
          const hasAtlasStr = get(hasAtlasIdx).toUpperCase();
          const extUrl = get(extUrlIdx);
          if(rent) sheetWorldMeta[world].rent = rent;
          if(img) sheetWorldMeta[world].img = img;
          if(cat) sheetWorldMeta[world].category = cat;
          // hasAtlas: FALSE (englisch) oder FALSCH (Schweiz/DE-Sheet) = externe Welt;
          // alles andere (TRUE/WAHR/leer) = RPG-Welt mit ATLAS-Karte
          sheetWorldMeta[world].hasAtlas = !(hasAtlasStr === 'FALSE' || hasAtlasStr === 'FALSCH');
          if(extUrl) sheetWorldMeta[world].externalUrl = extUrl;
          return;
        }
        if(!sheetLots[world]) sheetLots[world] = {};
        const dotGroup = get(groupIdx).replace(/\.0$/, '');
        // Handle # placeholder: strip # and mark as placeholder
        const isPlaceholder = nr.endsWith('#');
        const cleanNr = isPlaceholder ? nr.slice(0,-1).trim() : nr;
        const entry = {
          name: get(nameIdx),
          threadUrl: get(urlIdx),
          imgUrl: get(imgIdx),
          dotGroup: dotGroup,
          isPlaceholder: isPlaceholder,
        };
        if(dotGroup){
          const key = dotGroup+'|'+cleanNr;
          if(!sheetLots[world][key]) sheetLots[world][key] = [];
          sheetLots[world][key].push(entry);
          if(!sheetLots[world][cleanNr]) sheetLots[world][cleanNr] = entry;
        } else {
          if(!sheetLots[world][cleanNr]) sheetLots[world][cleanNr] = entry;
          else if(!Array.isArray(sheetLots[world][cleanNr])) sheetLots[world][cleanNr] = [sheetLots[world][cleanNr], entry];
          else sheetLots[world][cleanNr].push(entry);
        }
      });
      sheetLotsLoaded = true;
      // Portal-Tokens jetzt updaten — sheetWorldMeta ist jetzt befüllt,
      // dadurch werden Toronto/Kanada/etc-Chars (hasAtlas=false) sichtbar
      if(typeof updateOtherworldPortalTokens === 'function') updateOtherworldPortalTokens();
      if(cb) cb();
    })
    .catch(()=>{ sheetLotsLoaded = true; if(cb) cb(); });
}

function applySheetData(lot, wname){
  const worldSheet = sheetLots[wname] || {};
  const nr = lot.nr || (lot.name && lot.name.match(/^Nr\./) ? lot.name.split(' - ')[0].trim() : null);
  if(!nr) return lot;
  let sd = null;
  if(lot.building){
    sd = worldSheet[lot.building+'|'+nr] || worldSheet[nr] || null;
    // If match is placeholder-only, look for ZZ/ZY suffix variant with thread in same group
    const needsBetterMatch = !sd || (Array.isArray(sd) ? sd.every(e=>!e.threadUrl) : !sd.threadUrl);
    if(needsBetterMatch){
      // Search for "{building}|{nr}[letter-suffix]" entries
      const suffixKey = Object.keys(worldSheet).find(key=>{
        if(!key.startsWith(lot.building+'|'+nr)) return false;
        if(key === lot.building+'|'+nr) return false;
        const rest = key.slice((lot.building+'|'+nr).length);
        if(!/^[A-Za-z]{2,}$/.test(rest)) return false;
        const e = worldSheet[key];
        const entry = Array.isArray(e) ? e.find(x=>x.threadUrl) : (e&&e.threadUrl?e:null);
        return !!entry;
      });
      if(suffixKey) sd = worldSheet[suffixKey];
    }
  } else {
    sd = worldSheet[nr];
  }
  if(!sd) return lot;
  // If sd is an array (multiple entries same nr), take first with url, else first
  if(Array.isArray(sd)) sd = sd.find(e=>e.threadUrl) || sd[0];
  if(!sd) return lot;
  const merged = {...lot};
  if(sd.threadUrl) merged.url = sd.threadUrl;
  if(sd.imgUrl) merged.img = sd.imgUrl;
  if(sd.name && sd.name.trim() !== nr.trim()) merged.name = sd.name;
  if(sd.threadUrl) merged.active = true;
  return merged;
}

function getLots(wname){
  const hidden=hiddenLots[wname]||[];
  const renamed=renamedLots[wname]||{};
  const worldSheet=sheetLots[wname]||{};
  const hard=[];
  (worldLots[wname]||[]).filter(l=>!hidden.includes(l.name)).forEach(l=>{
    const base={...l,name:renamed[l.name]||l.name,_origName:l.name,_src:'hard'};
    const merged=sheetLotsLoaded?applySheetData(base,wname):base;
    // Skip overview-only lots (imgUrl but no threadUrl) - invisible anchors (except building dots)
    if(merged.img && !merged.url && !l.building) return;
    // Check if this nr has other lots in its dot-group (non-placeholder)
    let shouldSkipHardPush=false;
    if(sheetLotsLoaded && l.nr && !l.building){
      const nrNum=l.nr.replace(/^Nr\.\s*/,'').trim();
      const hasOtherLots=Object.keys(worldSheet).some(key=>{
        const e=worldSheet[key];
        if(!e||Array.isArray(e)) return false;
        if(e.isPlaceholder) return false;
        if(e.dotGroup!==nrNum) return false;
        return true;
      });
      const sd=worldSheet[l.nr];
      // Skip hardcode push when placeholder matched AND other real lots exist in group
      // BUT still generate extra lots below
      shouldSkipHardPush=sd&&!Array.isArray(sd)&&sd.isPlaceholder&&hasOtherLots;
      // If skipping: check if there's a Wohnkomplex-anchor (non-placeholder same nr) in the array-key
      if(shouldSkipHardPush){
        const arrKey=nrNum+'|'+l.nr;
        const arr=worldSheet[arrKey];
        if(Array.isArray(arr)){
          const anchor=arr.find(e=>!e.isPlaceholder);
          if(anchor){
            // Use anchor data for the hardcode dot
            merged.name=anchor.name||merged.name;
            if(anchor.threadUrl) merged.url=anchor.threadUrl;
            if(anchor.imgUrl) merged.img=anchor.imgUrl;
            if(anchor.threadUrl) merged.active=true;
            shouldSkipHardPush=false; // push the hardcode with anchor data
          }
        }
      }
    }
    if(!shouldSkipHardPush) hard.push(merged);
    // Generate extra lots from sheet entries with matching dot-group (not for building dots)
    if(sheetLotsLoaded && l.nr && !l.building){
      const nrNum=l.nr.replace(/^Nr\.\s*/,'').trim(); // "Nr. 11" -> "11"
      const extraLots=[];
      Object.keys(worldSheet).forEach(key=>{
        const entry=worldSheet[key];
        if(Array.isArray(entry)) return;
        if(!entry.dotGroup || entry.dotGroup!==nrNum) return;
        const entryNr=(key.includes('|')?key.split('|')[1]:key);
        if(entryNr===l.nr) return;
        extraLots.push({
          ...l,
          nr:entryNr,
          name:entry.name||entryNr,
          url:entry.threadUrl||l.url||'',
          img:entry.imgUrl||'',
          active:!!entry.threadUrl,
          _src:'sheet'
        });
      });
      // Sort by suffix: single letters (A,B,C) alphabetically, then double letters (ZZ,ZY)
      extraLots.sort((a,b)=>{
        const getSuffix=nr=>nr.replace(/^Nr\.\s*\d+/,'').trim();
        const sa=getSuffix(a.nr), sb=getSuffix(b.nr);
        const isDouble=s=>s.length>=2&&/^[A-Za-z]+$/.test(s);
        if(isDouble(sa)&&!isDouble(sb)) return 1;
        if(!isDouble(sa)&&isDouble(sb)) return -1;
        return sa.localeCompare(sb);
      });
      // Filter out overview-only lots (imgUrl but no threadUrl) - invisible anchors
      extraLots.filter(e=>e.url||!e.img).forEach(e=>hard.push(e));
    }
  });
  const cust=(customLots[wname]||[]).map(l=>({...l,_src:'custom'}));
  const all=[...hard,...cust];
  return all.length?all:[{name:'Forum öffnen',x:50,y:50,url:worlds.find(w=>w.name===wname)?.url||BASE,active:false}];
}
function parseLotLabel(lot){
  const name=lot.name||'';
  if(lot.nr){
    // Double+ letter suffix ONLY after digits ("Nr. 5ZZ", "Nr. 23ZY") - hide suffix
    const sufMatch=lot.nr.match(/^(.*?\d+)[A-Za-z]{2,}$/);
    if(sufMatch){
      return{num:sufMatch[1],sub:(name&&name!==lot.nr?name:'')};
    }
    // Everything else: show full nr (includes single-letter "Nr. A", words, word chains)
    return{num:lot.nr,sub:(name&&name!==lot.nr?name:'')};
  }
  const m=name.match(/^(Nr\.\s*\d+[A-Za-z]?)\s*[-–]\s*(.+)$/);
  if(m)return{num:m[1],sub:m[2].trim()};
  const n=name.match(/^(Nr\.\s*\d+[A-Za-z]?)$/);
  if(n)return{num:n[1],sub:''};
  return{num:name,sub:''};
}
// Für Building-Cluster-Dots: Nr-Range aus Sheet berechnen
// Beispiel: building="Culpepper-Apartments" mit Nr. 1, 2, 3, 4 im Sheet → "Nr. 1-4"
function getBuildingNrRange(buildingName, wname){
  if(!sheetLotsLoaded) return '';
  const worldSheet = sheetLots[wname] || {};
  const nrs = new Set();
  Object.keys(worldSheet).forEach(key=>{
    if(!key.startsWith(buildingName+'|')) return;
    let entry = worldSheet[key];
    // Dot-Group keys are always arrays - take first entry
    if(Array.isArray(entry)) entry = entry[0];
    if(!entry || entry.dotGroup !== buildingName) return;
    // Extract number from "Nr. 1", "Nr. 5ZZ" etc.
    const m = key.split('|')[1].match(/^Nr\.\s*(\d+)/);
    if(m) nrs.add(parseInt(m[1]));
  });
  if(nrs.size === 0) return '';
  const sorted = [...nrs].sort((a,b)=>a-b);
  if(sorted.length === 1) return 'Nr. '+sorted[0];
  // Check if sequence is continuous
  const min = sorted[0], max = sorted[sorted.length-1];
  const isContinuous = (max - min + 1) === sorted.length;
  if(isContinuous) return 'Nr. '+min+'-'+max;
  return 'Nr. '+sorted.join(',');
}
function groupLots(lots){
  const groups=[],used=new Set();
  lots.forEach((lot,i)=>{
    if(used.has(i))return;
    const g=[lot];used.add(i);
    lots.forEach((o,j)=>{if(i===j||used.has(j))return;if(lot.x===o.x&&lot.y===o.y){g.push(o);used.add(j);}});
    groups.push({x:lot.x,y:lot.y,lots:g});
  });
  return groups;
}

// ═══════════════════════════════════════════
// WELT-DOTS
// ═══════════════════════════════════════════
const mapC=document.getElementById('map-container');
const mapIA=document.getElementById('map-image-area');

// Size map-image-area to match actual image aspect ratio
(function(){
  const mapImg=document.querySelector('#map-bg img');
  function sizeMapArea(){
    const iw=mapImg.naturalWidth||1,ih=mapImg.naturalHeight||1;
    if(!iw||!ih)return;
    const cw=mapC.clientWidth,ch=mapC.clientHeight;
    const scale=Math.min(cw/iw,ch/ih);
    mapIA.style.width=Math.round(iw*scale)+'px';
    mapIA.style.height=Math.round(ih*scale)+'px';
  }
  if(mapImg.complete&&mapImg.naturalWidth>0)sizeMapArea();
  else mapImg.addEventListener('load',sizeMapArea);
  window.addEventListener('resize',sizeMapArea);
})();
worlds.forEach(w=>{
  const el=document.createElement('div');
  el.className='world-dot';
  el.dataset.worldKey=w.name;
  el.style.cssText=`left:${w.x}%;top:${w.y}%`;
  el.innerHTML=`<div class="dot-pulse" style="width:34px;height:34px;border-color:${w.color}"></div><div class="dot-inner" style="width:11px;height:11px;background:${w.color};box-shadow:0 0 5px ${w.color}"></div><div class="dot-label">${w.name}</div><div class="dot-char-tokens" data-world-name="${w.name}"></div><div class="hover-card" style="border:1px solid ${w.color}88;box-shadow:0 6px 28px ${w.color}44"><div style="position:relative">${w.img?`<img class="hover-img" src="${w.img}" loading="lazy" decoding="async" onerror="this.style.display='none'">`:''}<div class="hover-gradient"></div><div class="hover-name">${w.name}</div></div><div class="hover-footer"><span class="hover-type">${w.type}</span><span class="hover-action" style="color:${w.color}">Öffnen →</span></div></div>`;
  el.addEventListener('click',e=>{
    e.stopPropagation();
    if(calibMapMode)return;
    // Navi-Modus: Klick füllt Dropdown statt Welt zu betreten
    if(window.naviDotClick && naviDotClick(w.name)) return;
    // Auf Mobile: erster Klick = Vorschau (Tokens + Focus), zweiter Klick = Welt betreten
    if(window.matchMedia('(pointer:coarse)').matches){
      if(el.classList.contains('show-tokens')){
        // zweiter Klick → rein
        enterWorld(w);
      } else {
        // erster Klick → Vorschau zeigen + Welt fokussieren
        mapIA.querySelectorAll('.world-dot.show-tokens').forEach(d=>{if(d!==el)d.classList.remove('show-tokens');});
        el.classList.add('show-tokens');
        // Welt fokussieren (andere Dots dimmen)
        mapIA.classList.add('focus-mode');
        mapIA.querySelectorAll('.world-dot').forEach(d=>{
          if(d.dataset.worldKey===w.name) d.classList.add('focused');
          else d.classList.remove('focused');
        });
      }
    } else {
      enterWorld(w);
    }
  });
  // Mobile: hover-card selbst klickbar machen damit Tap auf den Card-Bereich
  // (mit "Öffnen →"-Text) auch die Welt betritt. Vorher: pointer-events:none
  // ließ Klicks durch — die landeten aber selten auf dem dot, sondern auf
  // Hintergrund-Elementen. Card-direkt-Click ist robuster.
  var hc = el.querySelector('.hover-card');
  if(hc){
    hc.addEventListener('click', function(ev){
      if(!window.matchMedia('(pointer:coarse)').matches) return;
      ev.stopPropagation();
      enterWorld(w);
    });
  }
  mapIA.appendChild(el);
});
// Klick irgendwo anders (ausser auf einem world-dot) schliesst die Token-Vorschau
if(window.matchMedia('(pointer:coarse)').matches){
  document.addEventListener('click',function(e){
    if(!e.target.closest('.world-dot') && !e.target.closest('#world-search-box')){
      mapIA.querySelectorAll('.world-dot.show-tokens').forEach(d=>d.classList.remove('show-tokens'));
      // Fokus auch clearen
      mapIA.classList.remove('focus-mode');
      mapIA.querySelectorAll('.world-dot.focused').forEach(d=>d.classList.remove('focused'));
    }
    if(!e.target.closest('.lot-dot') && !e.target.closest('#mobile-dot-bar')){
      document.querySelectorAll('.lot-dot.show-tokens').forEach(d=>d.classList.remove('show-tokens'));
    }
    if(!e.target.closest('.cluster-item')){
      document.querySelectorAll('.cluster-item.preview-active').forEach(i=>i.classList.remove('preview-active'));
    }
  });
}
// Update tokens after worlds are rendered
setTimeout(updateAllTokens, 500);

// ═══════════════════════════════════════════
// WELTEN-SUCHE (Overlay)
// ═══════════════════════════════════════════
(function(){
  const searchInput=document.getElementById('world-search-input');
  const searchClear=document.getElementById('world-search-clear');
  const dropdown=document.getElementById('world-search-dropdown');
  const MAX_RECENTS=5;

  function loadFavs(){try{return JSON.parse(localStorage.getItem('atlas_favs')||'[]');}catch(e){return [];}}
  function saveFavs(f){try{localStorage.setItem('atlas_favs',JSON.stringify(f));}catch(e){}}
  function loadRecents(){try{return JSON.parse(localStorage.getItem('atlas_recents')||'[]');}catch(e){return [];}}
  function saveRecents(r){try{localStorage.setItem('atlas_recents',JSON.stringify(r));}catch(e){}}

  // Record recent when entering world
  const _origEnter=enterWorld;
  window.enterWorld=function(w){
    if(w&&w.name){
      let r=loadRecents().filter(n=>n!==w.name);
      r.unshift(w.name);
      saveRecents(r.slice(0,MAX_RECENTS));
    }
    return _origEnter(w);
  };

  function toggleFav(name){
    let f=loadFavs();
    const i=f.indexOf(name);
    if(i>=0) f.splice(i,1); else f.push(name);
    saveFavs(f);
    renderDropdown(searchInput.value);
  }

  function focusWorld(name){
    mapIA.classList.add('focus-mode');
    mapIA.querySelectorAll('.world-dot').forEach(d=>{
      if(d.dataset.worldKey===name) d.classList.add('focused');
      else d.classList.remove('focused');
    });
  }
  function clearFocus(){
    mapIA.classList.remove('focus-mode');
    mapIA.querySelectorAll('.world-dot.focused').forEach(d=>d.classList.remove('focused'));
  }
  // Klick irgendwo (nicht auf Suche/Dot) beendet Fokus
  document.addEventListener('click',e=>{
    if(e.target.closest('#world-search-box')) return;
    if(e.target.closest('.world-dot.focused')) return;
    clearFocus();
  });

  function mkItem(w, isFav){
    const fav=loadFavs().includes(w.name);
    const item=document.createElement('div');
    item.className='ws-item';
    item.dataset.worldName=w.name;
    item.innerHTML=`<div class="ws-item-dot" style="background:${w.color}"></div><div class="ws-item-name">${w.name}</div><div class="ws-item-type">${w.type||''}</div><div class="ws-fav${fav?' active':''}" title="${fav?'Favorit entfernen':'Als Favorit'}">${fav?'★':'☆'}</div>`;
    item.querySelector('.ws-fav').addEventListener('click',e=>{e.stopPropagation();toggleFav(w.name);});
    item.addEventListener('click',()=>{
      dropdown.classList.remove('open');
      focusWorld(w.name);
    });
    return item;
  }

  function renderDropdown(q){
    dropdown.innerHTML='';
    const query=(q||'').trim().toLowerCase();
    const favs=loadFavs();
    const recents=loadRecents();

    function matchWorlds(list){
      return list.map(name=>worlds.find(w=>w.name===name)).filter(Boolean)
        .filter(w=>!query||w.name.toLowerCase().includes(query)||(w.type||'').toLowerCase().includes(query));
    }

    let hasContent=false;

    // Favoriten
    if(!query || matchWorlds(favs).length){
      const favWorlds=matchWorlds(favs);
      if(favWorlds.length){
        const sec=document.createElement('div');sec.className='ws-section';
        const h=document.createElement('div');h.className='ws-header';h.textContent='★ Favoriten';
        sec.appendChild(h);
        favWorlds.forEach(w=>sec.appendChild(mkItem(w,true)));
        dropdown.appendChild(sec);hasContent=true;
      }
    }

    // Recents
    const recentFiltered=matchWorlds(recents.filter(n=>!favs.includes(n)));
    if(recentFiltered.length){
      const sec=document.createElement('div');sec.className='ws-section';
      const h=document.createElement('div');h.className='ws-header';h.textContent='🕐 Zuletzt besucht';
      sec.appendChild(h);
      recentFiltered.forEach(w=>sec.appendChild(mkItem(w)));
      dropdown.appendChild(sec);hasContent=true;
    }

    // Alle Welten (ohne die in Favs/Recents — bei leerem Query)
    const excludeSet=new Set([...favs,...(query?[]:recents)]);
    const rest=[...worlds].filter(w=>!excludeSet.has(w.name))
      .filter(w=>!query||w.name.toLowerCase().includes(query)||(w.type||'').toLowerCase().includes(query))
      .sort((a,b)=>a.name.localeCompare(b.name,'de'));
    if(rest.length){
      const sec=document.createElement('div');sec.className='ws-section';
      const h=document.createElement('div');h.className='ws-header';h.textContent=query?'🔎 Ergebnisse':'🌍 Alle Welten';
      sec.appendChild(h);
      rest.forEach(w=>sec.appendChild(mkItem(w)));
      dropdown.appendChild(sec);hasContent=true;
    }

    if(!hasContent){
      const em=document.createElement('div');em.className='ws-empty';em.textContent='Keine Welt gefunden.';
      dropdown.appendChild(em);
    }
  }

  searchInput.addEventListener('focus',()=>{
    renderDropdown(searchInput.value);
    dropdown.classList.add('open');
  });
  searchInput.addEventListener('input',()=>{
    renderDropdown(searchInput.value);
    dropdown.classList.add('open');
    searchClear.classList.toggle('show',!!searchInput.value);
  });
  searchClear.addEventListener('click',()=>{
    searchInput.value='';searchClear.classList.remove('show');
    renderDropdown('');searchInput.focus();
  });
  document.addEventListener('click',e=>{
    if(!e.target.closest('#world-search-box')) dropdown.classList.remove('open');
  });
  // Escape schliesst Dropdown und Fokus
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){dropdown.classList.remove('open');clearFocus();searchInput.blur();}
    if(e.key==='Enter' && dropdown.classList.contains('open')){
      const first=dropdown.querySelector('.ws-item');
      if(first) first.click();
    }
  });
})();

mapC.addEventListener('click',e=>{
  if(!calibMapMode)return;
  if(e.target.closest('.calib-panel')||e.target.closest('.calib-btn'))return;
  const r=mapIA.getBoundingClientRect();
  const x=+((e.clientX-r.left)/r.width*100).toFixed(1);
  const y=+((e.clientY-r.top)/r.height*100).toFixed(1);
  const w=worlds[calibMapIdx];
  if(!w){alert('Alle kalibriert!');return;}
  calibMapData.push({name:w.name,x,y});calibMapIdx++;
  updateCalibLog('map');
  document.getElementById('calib-next').textContent=worlds[calibMapIdx]?.name||'✓ Fertig';
},true);

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function enterWorld(w){
  try{sessionStorage.setItem('atlas_world',w.name);}catch(e){}
  currentWorld=w;
  mapC.classList.remove('active');
  const wc=document.getElementById('world-container');
  wc.classList.add('active');
  sizeWorldImageArea();
  document.getElementById('world-name-display').textContent=w.name;
  document.getElementById('world-type-display').textContent=w.type;
  // Rent-Info aus Sheet-Meta (Zeile mit welt=... aber ohne nr)
  (function(){
    var box=document.getElementById('world-rent-info');
    if(!box)return;
    var rent=(sheetWorldMeta[w.name]||{}).rent;
    if(rent){
      box.innerHTML='<div class="rent-label">💰 Mietpreise</div>'+rent.replace(/\|/g,'<br>');
      box.classList.add('visible');
    } else {
      box.classList.remove('visible');
      box.innerHTML='';
    }
  })();
  const _grad=`<div style="position:absolute;inset:0;background:linear-gradient(135deg,${w.color}33,#0a1420)"></div>`;
  // Welt-Bild: Sheet-Meta hat Vorrang vor hardcoded w.img
  function setWorldBg(){
    var sheetImg=(sheetWorldMeta[w.name]||{}).img;
    var imgUrl=sheetImg||w.img;
    document.getElementById('world-bg').innerHTML=imgUrl
      ?`<img src="${imgUrl}" alt="${w.name}" decoding="async" style="width:100%;height:100%;object-fit:cover;filter:brightness(0.65) saturate(0.9);display:block" onerror="this.parentElement.innerHTML='${_grad.replace(/'/g,"\\'")}'">`
      :_grad;
  }
  setWorldBg();
  document.getElementById('world-subtitle').textContent='/ '+w.name;
  document.getElementById('btn-back').style.display='inline-block';
  document.getElementById('mob-back').style.display='flex';
  calibWorldData=[];updateCalibLog('world');
  var _cl0=getLots(w.name)[0];document.getElementById('calib-world-next').textContent=(_cl0?.nr||_cl0?.name||'—');
  document.getElementById('calib-world-count').textContent='0';
  exitBuilding();
  // Loading-Screen nur beim ERSTEN Welt-Eintritt der Session (wenn Sheet-Lots noch nicht geladen)
  var _showLoader = (typeof sheetLotsLoaded !== 'undefined' && !sheetLotsLoaded && typeof window.showAtlasLoading === 'function');
  if(_showLoader) window.showAtlasLoading('Welt wird geladen…');
  fetchSheetLots(()=>{
    // Nach Sheet-Fetch: Bild + Rent nochmal setzen falls Sheet-Daten erst jetzt geladen
    setWorldBg();
    var box=document.getElementById('world-rent-info');
    if(box){
      var rent=(sheetWorldMeta[w.name]||{}).rent;
      if(rent){box.innerHTML='<div class="rent-label">💰 Mietpreise</div>'+rent.replace(/\|/g,'<br>');box.classList.add('visible');}
      else {box.classList.remove('visible');box.innerHTML='';}
    }
    renderLots(w); if(adminMode)renderAdminContent(); setTimeout(updateAllTokens,100); setTimeout(repositionTooltips,200);
    if(_showLoader && typeof window.hideAtlasLoading === 'function') window.hideAtlasLoading();
  });
}

function goBack(){
  const bc=document.getElementById('building-container');
  if(bc&&bc.style.display!=='none'){exitBuilding();return;}
  document.getElementById('world-container').classList.remove('active');
  mapC.classList.add('active');
  document.getElementById('world-subtitle').textContent='';
  document.getElementById('btn-back').style.display='none';
  document.getElementById('mob-back').style.display='none';
  calibWorldMode=false;
  document.getElementById('calib-world-panel').style.display='none';
  document.getElementById('world-container').style.cursor='default';
  // Zoom der Welt-Ansicht zurücksetzen damit beim nächsten Betreten nicht reingezoomt
  if(window._worldZoom && window._worldZoom.reset) window._worldZoom.reset();
  // Reset view states auf der Kontinentkarte
  mapIA.querySelectorAll('.world-dot.show-tokens').forEach(d=>d.classList.remove('show-tokens'));
  mapIA.classList.remove('focus-mode');
  mapIA.querySelectorAll('.world-dot.focused').forEach(d=>d.classList.remove('focused'));
  try{sessionStorage.removeItem('atlas_world');sessionStorage.removeItem('atlas_building');}catch(e){}
  currentWorld=null;
}

// ═══════════════════════════════════════════
// LOTS RENDERN
// ═══════════════════════════════════════════
function renderLots(w){
  const wc=document.getElementById('world-container');
  const wia=document.getElementById('world-image-area');
  wc.querySelectorAll('.lot-dot,.cluster-dot').forEach(d=>d.remove());
  const bar=document.getElementById('world-lots-bar');
  bar.innerHTML='';
  const lots=getLots(w.name);
  if(!worldLots[w.name]&&!(customLots[w.name]||[]).length){
    const h=document.createElement('div');
    h.style.cssText='font-size:10px;color:rgba(255,200,100,0.7);padding:4px 8px;background:rgba(255,150,0,0.1);border-radius:5px;border:0.5px solid rgba(255,150,0,0.2);white-space:nowrap;flex-shrink:0';
    h.textContent='⚠ Noch kalibrieren';bar.appendChild(h);
  }
  groupLots(lots).forEach(group=>{
    if(group.lots.length===1 && !group.lots[0].building){
      const lot=group.lots[0];
      const ld=document.createElement('div');
      ld.className='lot-dot'+(lot.active?' isactive':'')+(lot.outdoor?' isoutdoor':'');
      ld.style.cssText=`left:${lot.x}%;top:${lot.y}%`;
      const _tb=`border:0.5px solid ${lot.outdoor?'rgba(80,190,170,0.8)':lot.active?'#4aaa6a':'rgba(255,255,255,0.2)'}`;
      const _lbl=parseLotLabel(lot);
      const _nameHtml=_lbl.sub
        ?`<div style="font-size:9px;letter-spacing:1px;color:rgba(255,255,255,0.4);margin-bottom:1px">${_lbl.num}</div><div style="font-weight:600;margin-bottom:2px">${_lbl.sub}</div>`
        :`<div style="font-weight:500;margin-bottom:2px">${_lbl.num}</div>`;
      const _ti=_nameHtml+`<div style="font-size:10px;color:${lot.info?'rgba(200,160,80,0.9)':lot.outdoor?'rgba(80,190,170,0.9)':lot.active?'#4aaa6a':'rgba(255,255,255,0.4)'}">${lot.info?'◆ Orientierungspunkt':lot.outdoor?'🌿 Öffentlicher Bereich':lot.active?'● Aktiv':'↗ Thread öffnen'}</div>`;
      const _dotBg=lot.info?'rgba(200,160,80,0.9)':lot.outdoor?'rgba(80,190,170,0.75)':lot.active?'#4aaa6a':'rgba(255,255,255,0.5)';
      const _dotShadow=lot.info?'0 0 8px rgba(200,160,80,0.7)':lot.outdoor?'0 0 8px rgba(80,190,170,0.6)':lot.active?'0 0 10px #4aaa6a':'none';
      const _tt=lot.img
        ?`<div class="lot-tooltip" style="${_tb};padding:0;overflow:hidden;min-width:160px"><img src="${lot.img}" loading="lazy" decoding="async" style="width:100%;height:90px;object-fit:cover;display:block"><div style="padding:7px 10px">${_ti}</div></div>`
        :`<div class="lot-tooltip" style="${_tb};padding:6px 10px">${_ti}</div>`;
      ld.innerHTML=(lot.info?`<div class="lot-inner" style="width:11px;height:11px;background:${_dotBg};box-shadow:${_dotShadow};transform:rotate(45deg);border-radius:2px"></div>`:`<div class="lot-pulse"></div><div class="lot-inner" style="width:12px;height:12px;background:${_dotBg};box-shadow:${_dotShadow}"></div>`)+`<div class="lot-label">${(()=>{const p=parseLotLabel(lot);return p.sub?`${p.num}<span class="lot-sublabel">${p.sub}</span>`:p.num;})()}</div><div class="dot-char-tokens" data-lot-url="${lot.url||''}"></div>${_tt}`;
      if(!lot.info){ld.addEventListener('click',e=>{
        e.stopPropagation();
        if(calibWorldMode||posMode)return;
        if(!lot.url)return; // Komplex-Anker o.ä. ohne URL: kein about:blank-Klick
        // Touch-Devices (egal welche Bildschirmgrösse): Tap-Preview-Tap-Enter Pattern
        if(window.matchMedia('(pointer:coarse)').matches){
          // Erster Klick: Tokens zeigen + mobile-bar
          // Zweiter Klick auf selben Lot: direkt zum Thread
          if(ld.classList.contains('show-tokens')){
            window.open(lot.url,'_blank');
            return;
          }
          wia.querySelectorAll('.lot-dot.show-tokens').forEach(d=>{if(d!==ld)d.classList.remove('show-tokens');});
          ld.classList.add('show-tokens');
          const lbl=parseLotLabel(lot);
          showMobileDotBar(lbl.num,lbl.sub||lbl.num,lot.url);
        } else {
          window.open(lot.url,'_blank');
        }
      });}
      wia.appendChild(ld);
    } else {
      const buildings=[...new Set(group.lots.filter(l=>l.building).map(l=>l.building))];
      const isBuilding=buildings.length===1;
      const hasActive=group.lots.some(l=>l.active);
      const color=isBuilding?'rgba(100,160,255,0.6)':(hasActive?'#ffaa44':'rgba(255,165,0,0.6)');
      const cd=document.createElement('div');
      cd.className='cluster-dot'+(isBuilding?' building-dot':'');
      cd.style.cssText=`left:${group.x}%;top:${group.y}%`;
      const lblParts=isBuilding?(()=>{const base=buildings[0].split('-')[0].trim();const range=getBuildingNrRange(buildings[0],currentWorld?.name);return{main:range||base,sub:range?base:''};})():(()=>{
        // Non-Building Cluster: find main nr (without letter suffix) = Wohnkomplex-anchor
        // Fallback: use parseLotLabel on first lot to strip ZZ/ZY suffix → "Nr. 6ZZ" → "Nr. 6"
        const mainLot=group.lots.find(l=>l.nr&&/^Nr\.\s*\d+$/.test(l.nr))||group.lots[0];
        const baseNum=parseLotLabel(mainLot).num;
        return{main:baseNum,sub:''};
      })();
      const lbl=lblParts.sub?`${lblParts.main}<span class="lot-sublabel">${lblParts.sub}</span>`:lblParts.main;
      const lblPlain=lblParts.sub?`${lblParts.main} · ${lblParts.sub}`:lblParts.main;
      const itemsHtml=group.lots.map(l=>`<div class="cluster-item" data-url="${l.url}">${l.img?`<img class="cluster-item-preview" src="${l.img}" loading="lazy" decoding="async">`:''}<div class="cluster-pip" style="background:${l.active?'#4aaa6a':'rgba(255,255,255,0.4)'}"></div>${parseLotLabel(l).num}${parseLotLabel(l).sub?` <span style="color:rgba(255,255,255,0.45);font-size:10px">– ${parseLotLabel(l).sub}</span>`:''}<div class="cluster-item-chars" data-lot-url="${l.url||''}"></div></div>`).join('');
      // Alle Lot-URLs der Gruppe als Pipe-String — updateAllTokens zieht daraus die Char-Aggregation
      const clusterUrls=group.lots.map(l=>l.url||'').filter(Boolean).join('|');
      const lotsWithImg=group.lots.filter(l=>l.img);
      // Wohnkomplex-Anker-Bild: wenn kein Lot ein eigenes Bild hat, schaue im
      // Sheet nach einem Anker (Zeile mit gleicher dotGroup, ohne threadUrl, mit imgUrl)
      let anchorImg=null;
      if(!isBuilding && !lotsWithImg.length && currentWorld){
        const ws=sheetLots[currentWorld.name]||{};
        // Finde Hauptnummer der Gruppe (z.B. "11" aus "Nr. 11A", "Nr. 11B")
        const mainLot=group.lots.find(l=>l.nr&&/^Nr\.\s*\d+$/.test(l.nr))||group.lots[0];
        const mainNum=mainLot&&mainLot.nr?mainLot.nr.replace(/^Nr\.\s*/,'').trim():'';
        if(mainNum){
          // Suche im Sheet alle Einträge mit passender dotGroup und imgUrl
          for(const k in ws){
            const e=ws[k];
            if(Array.isArray(e)) continue;
            if(e&&e.dotGroup===mainNum&&e.imgUrl){
              anchorImg=e.imgUrl;
              break;
            }
          }
        }
      }
      const buildingImg=isBuilding?group.lots.find(l=>l.img)?.img:null;
      const clusterHoverHtml=isBuilding&&buildingImg
        ?`<div class="cluster-hover" style="border:1px solid ${color}88;box-shadow:0 6px 28px ${color}44;min-width:180px"><img src="${buildingImg}" loading="lazy" decoding="async" style="width:100%;height:110px;object-fit:cover;display:block"><div class="hover-footer"><span class="hover-type">${lblPlain}</span><span class="hover-action" style="color:${color}">Betreten →</span></div></div>`
        :(!isBuilding&&lotsWithImg.length>0)?`<div class="cluster-hover" style="border:1px solid ${color}88;box-shadow:0 6px 28px ${color}44"><div style="display:flex;gap:1px">${lotsWithImg.map(l=>`<div style="position:relative;flex:1;min-width:0"><img src="${l.img}" loading="lazy" decoding="async" style="width:100%;height:75px;object-fit:cover;display:block"><div style="position:absolute;bottom:3px;left:5px;font-size:8px;font-weight:600;text-shadow:0 1px 3px #000;color:#fff">${parseLotLabel(l).num}</div></div>`).join('')}</div><div class="hover-footer"><span class="hover-type">${group.lots.length} Orte</span><span class="hover-action" style="color:${color}">Klicken →</span></div></div>`
        :(!isBuilding&&anchorImg)?`<div class="cluster-hover" style="border:1px solid ${color}88;box-shadow:0 6px 28px ${color}44;min-width:180px"><img src="${anchorImg}" loading="lazy" decoding="async" style="width:100%;height:110px;object-fit:cover;display:block"><div class="hover-footer"><span class="hover-type">${group.lots.length} Orte</span><span class="hover-action" style="color:${color}">Klicken →</span></div></div>`:'';
      cd.innerHTML=`<div class="cluster-inner" style="color:${color};border-color:${color};box-shadow:0 0 8px ${color}44">${isBuilding?'🏢':group.lots.length}</div><div class="cluster-label">${lbl}</div><div class="dot-char-tokens" data-cluster-urls="${clusterUrls}"></div>${clusterHoverHtml}${isBuilding?'':` <div class="cluster-popup"><div style="font-size:10px;color:rgba(255,165,0,0.7);margin-bottom:6px;padding:0 4px">📦 ${group.lots.length} Orte</div>${itemsHtml}</div>`}`;
      // Cluster-Items: Zwei-Klick-Verhalten auf Mobile, direkt Öffnen auf Desktop
      cd.querySelectorAll('.cluster-item').forEach(item=>{
        item.addEventListener('click',e=>{
          e.stopPropagation();
          const url=item.getAttribute('data-url');
          if(!url)return;
          if(window.matchMedia('(pointer:coarse)').matches){
            if(item.classList.contains('preview-active')){
              window.open(url,'_blank');
              return;
            }
            cd.querySelectorAll('.cluster-item.preview-active').forEach(i=>{if(i!==item)i.classList.remove('preview-active');});
            item.classList.add('preview-active');
          } else {
            window.open(url,'_blank');
          }
        });
      });
      cd.addEventListener('click',e=>{
        e.stopPropagation();if(calibWorldMode||posMode)return;
        if(isBuilding){enterBuilding(buildings[0],group.lots);return;}
        wc.querySelectorAll('.cluster-dot.open').forEach(c=>{if(c!==cd)c.classList.remove('open');});
        cd.classList.toggle('open');
      });
      wia.appendChild(cd);
    }
    group.lots.forEach(lot=>{
      // Skip Lots ohne Namen (sonst zeigt die Pill "undefined")
      if(!lot.name) return;
      const pill=document.createElement('div');
      pill.className='lot-pill';
      pill.style.cssText=`background:${lot.active?'rgba(74,170,106,0.15)':'rgba(255,255,255,0.05)'};border-color:${lot.active?'#4aaa6a55':'rgba(255,255,255,0.1)'};color:${lot.active?'#4aaa6a':'rgba(255,255,255,0.5)'}`;
      pill.innerHTML=`<div class="lot-pip" style="background:${lot.active?'#4aaa6a':'rgba(255,255,255,0.3)'}"></div>${lot.name}`;
      pill.addEventListener('click',()=>{if(lot.url)window.open(lot.url,'_blank');});
      bar.appendChild(pill);
    });
  });
}

// ═══════════════════════════════════════════
// WORLD-CONTAINER CLICK
// ═══════════════════════════════════════════
function sizeWorldImageArea(){
  const wia=document.getElementById('world-image-area');
  if(!wia)return;
  const cw=worldC.clientWidth,ch=worldC.clientHeight;
  const scale=Math.min(cw/1920,ch/1200);
  wia.style.width=(1920*scale)+'px';
  wia.style.height=(1200*scale)+'px';
}
window.addEventListener('resize',sizeWorldImageArea);

const worldC=document.getElementById('world-container');
worldC.addEventListener('click',e=>{
  if(!e.target.closest('.cluster-dot'))worldC.querySelectorAll('.cluster-dot.open').forEach(c=>c.classList.remove('open'));
  if(posMode){
    if(e.target.closest('#world-lots-bar')||e.target.closest('.calib-panel')||e.target.closest('.calib-btn'))return;
    const wia=document.getElementById('world-image-area');
    const r=wia.getBoundingClientRect();
    const x=+((e.clientX-r.left)/r.width*100).toFixed(1);
    const y=+((e.clientY-r.top)/r.height*100).toFixed(1);
    if(posModeCallback)posModeCallback(x,y);cancelPosMode();return;
  }
  if(!calibWorldMode)return;
  if(e.target.closest('.lot-dot')||e.target.closest('.cluster-dot')||e.target.closest('.calib-panel')||e.target.closest('.calib-btn')||e.target.closest('#world-lots-bar'))return;
  const wia2=document.getElementById('world-image-area');
  const r=wia2.getBoundingClientRect();
  const x=+((e.clientX-r.left)/r.width*100).toFixed(1);
  const y=+((e.clientY-r.top)/r.height*100).toFixed(1);
  const allLots=getLots(currentWorld?.name||'');
  const idx=calibWorldData.length;
  calibWorldData.push({name:allLots[idx]?.name||'Ort '+idx,x,y});
  updateCalibLog('world');
  var _cln=allLots[idx+1];document.getElementById('calib-world-next').textContent=(_cln?.nr||_cln?.name||'✅ Fertig! Jetzt kopieren');
  document.getElementById('calib-world-count').textContent=calibWorldData.length;
});

// ═══════════════════════════════════════════
// LEGENDE
// ═══════════════════════════════════════════
function closeAtlas(){
  localStorage.setItem('atlas_open','0');
  // Im iframe-Embed (Xobor): Parent benachrichtigen, der schliesst den ATLAS-Frame.
  // Standalone (direkter Aufruf): einfach zum Forum navigieren.
  if(window.parent && window.parent !== window){
    window.parent.postMessage({action:'atlas-close'},'*');
  } else {
    window.location.href = 'https://www.simsforumrpg.de/';
  }
}
function toggleLegend(btn){btn.nextElementSibling.classList.toggle('open');}
document.addEventListener('click',e=>{document.querySelectorAll('.legend-box.open').forEach(b=>{if(!b.previousElementSibling.contains(e.target)&&!b.contains(e.target))b.classList.remove('open');});});
// ═══ Bot-Schutz / Quota-Sparmodus ════════════════════════════════
// User-Interaktion zählt (Maus, Scroll, Touch, Keyboard).
// Apps-Script-Calls die vermeidbar sind, warten bis User wirklich da ist.
var _hasInteracted = false;
function _markInteracted(){ _hasInteracted = true; }
['mousemove','scroll','keydown','touchstart','click'].forEach(function(ev){
  window.addEventListener(ev, _markInteracted, {once:true, passive:true});
});

// Tab-Visibility: nur wenn Tab im Vordergrund, periodische Updates laufen
function _isVisible(){ return document.visibilityState !== 'hidden'; }

// Wrapper für setInterval der pausiert wenn Tab versteckt
function _smartInterval(fn, ms){
  return setInterval(function(){
    if(!_isVisible()) return;
    fn();
  }, ms);
}
// ══════════════════════════════════════════════════════════════════

// Immer beim Laden: Chars + Stats holen (für Tokens + Sidebar)

// ═══════════════════════════════════════════
// LOAD-PRIORISIERUNG nach Einstiegsseite
// ═══════════════════════════════════════════
// Detection läuft VOR load damit andere Funktionen es lesen können
var ENTRY_MODE = (function(){
  try {
    if(location.hash && location.hash.match(/^#chars/)) return 'chars';
    if(sessionStorage.getItem('atlas_world')) return 'world';
  } catch(e){}
  return 'continent'; // Default
})();
// Nach load: erste N Bilder im jeweiligen Bereich kriegen fetchpriority=high
// um schneller initial gerendert zu werden. Browser lädt sie parallel zur lazy-Logik.
// Mobile-aware: Sidebars sind unter 768px display:none → die priorisieren wir nicht,
// stattdessen die Char-Tokens auf den Welt-Dots (die sieht man).
function _prioritizeInitialImages(){
  try {
    var isMobile = window.matchMedia('(max-width:768px)').matches;
    var sel, limit;
    if(ENTRY_MODE === 'chars'){
      sel = '.char-portrait';
      limit = isMobile ? 8 : 12;
    } else if(ENTRY_MODE === 'world'){
      // Auf Mobile sind .cluster-hover ausgeblendet — nur lot-tooltip-bilder
      sel = isMobile ? '.lot-tooltip img' : '.lot-tooltip img, .cluster-item-preview';
      limit = isMobile ? 6 : 12;
    } else {
      // continent Default
      if(isMobile){
        // Sidebars sind display:none, .hover-card auch — die Tokens auf den Dots aber sichtbar
        sel = '.dot-char-token';
        limit = 12;
      } else {
        sel = '#sidebar-activity img, #sidebar-forum img, #sidebar-newchars img';
        limit = 8;
      }
    }
    var imgs = document.querySelectorAll(sel);
    for(var i = 0; i < Math.min(imgs.length, limit); i++){
      imgs[i].setAttribute('fetchpriority', 'high');
      imgs[i].removeAttribute('loading');
    }
  } catch(e){}
}

window.addEventListener('load',function(){
  // Atlas-Loading-Screen beim Initial-Load — verstecken sobald Chars-Fetch UND Lots-Fetch fertig sind
  var _initLoaderActive = false;
  var _initPending = 2; // Chars + Lots
  if(typeof window.showAtlasLoading === 'function'){
    _initLoaderActive = true;
    window.showAtlasLoading('ATLAS wird geladen…');
  }
  function _initStepDone(){
    _initPending--;
    if(_initLoaderActive && _initPending <= 0){
      _initLoaderActive = false;
      if(typeof window.hideAtlasLoading === 'function') window.hideAtlasLoading();
    }
  }
  // Safety-Timeout: nach 6s Loader spätestens weg (falls Netz tot ist)
  setTimeout(function(){
    if(_initLoaderActive){
      _initLoaderActive = false;
      if(typeof window.hideAtlasLoading === 'function') window.hideAtlasLoading();
    }
  }, 6000);

  updateSidebarStats();
  fetchCharsFromScript().then(_initStepDone, _initStepDone);
  updateSidebarForum();
  repositionTooltips();
  fetchSheetLots(_initStepDone);
  // Periodische Updates pausieren wenn Tab versteckt
  _smartInterval(updateSidebarForum, 5*60*1000);
  _smartInterval(updateSidebarStats, 2*60*1000);
  if(location.hash.match(/^#chars-/)){
    openCharView(location.hash.replace('#chars-',''));
  }
  // Bilder für Einstiegsseite priorisieren — nach DOM-Aufbau
  setTimeout(_prioritizeInitialImages, 100);
  setTimeout(_prioritizeInitialImages, 800); // 2. Pass falls Sidebars später rendern
});
