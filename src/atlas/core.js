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
function renameLot(wname,origName,custIdx){
  const current = custIdx!=null ? customLots[wname][custIdx].name : (renamedLots[wname]?.[origName]||origName);
  const neu=prompt('Neuer Name:',current);
  if(!neu||neu===current)return;
  if(custIdx!=null){
    customLots[wname][custIdx].name=neu;saveLots();
  } else {
    if(!renamedLots[wname])renamedLots[wname]={};
    renamedLots[wname][origName]=neu;saveRenamed();
  }
  if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();
}
function hideHardLot(wname,lotName){
  if(!hiddenLots[wname])hiddenLots[wname]=[];
  if(!hiddenLots[wname].includes(lotName))hiddenLots[wname].push(lotName);
  saveHidden();if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();
}
function restoreHardLot(wname,lotName){
  if(!hiddenLots[wname])return;
  hiddenLots[wname]=hiddenLots[wname].filter(n=>n!==lotName);
  saveHidden();if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();
}
function startPosForLot(wname,idx){
  if(!currentWorld||currentWorld.name!==wname){alert('Zuerst die Welt "'+wname+'" betreten.');return;}
  posMode=true;document.getElementById('world-container').style.cursor='crosshair';document.getElementById('calib-mode-bar').style.display='block';
  posModeCallback=(x,y)=>{customLots[wname][idx].x=x;customLots[wname][idx].y=y;saveLots();renderLots(currentWorld);renderAdminContent();};
}

function getThreadIdFromUrl(url){
  if(!url) return null;
  var m = url.match(/\/t(\d+)f/);
  return m ? m[1] : null;
}



function updateAllTokens(){
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
    var inner = chars.map(function(c,i){
      var name=c.n||'';
      var inner2=c.img?'<img class="dot-char-token" src="'+c.img+'" alt="'+name+'" loading="lazy" decoding="async">':'<div class="dot-char-token-ph">'+name.charAt(0)+'</div>';
      var hidden=i>=5?'dot-char-token-hidden':'';
      return '<div class="dot-char-token-wrap '+hidden+'">'+inner2+'<div class="dot-char-token-name">'+name+'</div></div>';
    }).join('')+(chars.length>5?'<div class="dot-char-token-wrap dot-char-token-extra"><div class="dot-char-token-ph">+'+(chars.length-5)+'</div></div>':'');
    el.innerHTML = inner;
  });
  // Update world dots
  document.querySelectorAll('.dot-char-tokens[data-world-name]').forEach(function(el){
    var worldName = el.getAttribute('data-world-name');
    var chars = getCharsAtWorld(worldName);
    var inner = chars.map(function(c,i){
      var name=c.n||'';
      var inner2=c.img?'<img class="dot-char-token" src="'+c.img+'" alt="'+name+'" loading="lazy" decoding="async">':'<div class="dot-char-token-ph">'+name.charAt(0)+'</div>';
      var hidden=i>=5?'dot-char-token-hidden':'';
      return '<div class="dot-char-token-wrap '+hidden+'">'+inner2+'<div class="dot-char-token-name">'+name+'</div></div>';
    }).join('')+(chars.length>5?'<div class="dot-char-token-wrap dot-char-token-extra"><div class="dot-char-token-ph">+'+(chars.length-5)+'</div></div>':'');
    el.innerHTML = inner;
  });
  // Update cluster dots (Wohnkomplex etc.) — aggregiert über alle Lot-URLs der Gruppe
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
    var inner = chars.map(function(c,i){
      var name=c.n||'';
      var inner2=c.img?'<img class="dot-char-token" src="'+c.img+'" alt="'+name+'" loading="lazy" decoding="async">':'<div class="dot-char-token-ph">'+name.charAt(0)+'</div>';
      var hidden=i>=5?'dot-char-token-hidden':'';
      return '<div class="dot-char-token-wrap '+hidden+'">'+inner2+'<div class="dot-char-token-name">'+name+'</div></div>';
    }).join('')+(chars.length>5?'<div class="dot-char-token-wrap dot-char-token-extra"><div class="dot-char-token-ph">+'+(chars.length-5)+'</div></div>':'');
    el.innerHTML = inner;
  });
  // Update cluster-item char-indicators (kleine Avatare am rechten Rand jedes Popup-Items)
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
        ? '<img src="'+c.img+'" title="'+name+'" loading="lazy" decoding="async" style="width:18px;height:18px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(74,170,106,0.8);margin-left:-4px;box-shadow:0 0 4px rgba(74,170,106,0.5)">'
        : '<div title="'+name+'" style="width:18px;height:18px;border-radius:50%;background:rgba(74,170,106,0.3);border:1.5px solid rgba(74,170,106,0.6);display:flex;align-items:center;justify-content:center;font-size:9px;color:#4aaa6a;margin-left:-4px">'+(c.n.charAt(0)||'?')+'</div>';
    }).join('');
    if(chars.length>3) html += '<span style="font-size:9px;color:#4aaa6a;margin-left:4px;font-weight:500">+'+(chars.length-3)+'</span>';
    el.innerHTML = html;
  });
  // Update Andere-Welten-Pfeil Tokens
  if(typeof updateOtherworldArrowTokens === 'function') updateOtherworldArrowTokens();
}

function updateSidebarActivity(){
  var el=document.getElementById('sidebar-activity');
  if(!el||!CHARS.length)return;
  // Sortierung nach lastSeenDate DESC (neueste zuerst)
  // Nur Chars mit Datum innerhalb der letzten 14 Tage
  var now=new Date();
  var FOURTEEN_DAYS = 14*24*60*60*1000;
  function parseDate(d){
    if(!d) return null;
    // Erst normales d.m.yyyy (vom Tracker)
    var parts=d.split('.');
    if(parts.length>=3 && parts[0].length<=2 && parts[1].length<=2){
      var dt=new Date(parseInt(parts[2]),parseInt(parts[1])-1,parseInt(parts[0]));
      if(!isNaN(dt.getTime())) return dt;
    }
    // Fallback: JS Date-String ("Tue Apr 21 2026...") oder ISO ("2026-04-21")
    // — Sheets konvertiert manchmal Datum-Strings automatisch
    var fallback = new Date(d);
    if(!isNaN(fallback.getTime())) return fallback;
    return null;
  }
  var active=CHARS.filter(function(c){
    if(!c.lastSeenName||!c.lastSeenUrl) return false;
    var dt = parseDate(c.lastSeenDate);
    if(!dt) return false; // ohne Datum = raus (sonst verdecken sie echte Aktive)
    return (now-dt)<=FOURTEEN_DAYS;
  });
  // Nach Datum sortieren: neueste zuerst
  active.sort(function(a,b){
    var da = parseDate(a.lastSeenDate);
    var db = parseDate(b.lastSeenDate);
    return db - da;
  });
  // Deduplicate by name, keep first (= neuester)
  var seen=new Set();
  var unique=active.filter(function(c){if(seen.has(c.n))return false;seen.add(c.n);return true;});

  // Erste Gruppierung nach lastSeenUrl — Chars im selben Forum-Post = eine Gruppe
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

  // Auffüllen bis 6 Gruppen mit Chars ohne Datum (Sheet-Reihenfolge) falls Platz
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
      ? '<img src="'+c.img+'" loading="lazy" decoding="async" style="width:26px;height:26px;border-radius:50%;object-fit:cover;object-position:50% 30%;flex-shrink:0;border:1.5px solid '+color+';box-shadow:0 0 4px '+color+'88">'
      : '<div style="width:26px;height:26px;border-radius:50%;background:'+color+';display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:600;flex-shrink:0;box-shadow:0 0 4px '+color+'88">'+nameShort.charAt(0)+'</div>';
  }

  el.innerHTML = groups.map(function(g){
    var color = WORLD_COLORS[g.world] || '#4a6a7a';
    if(g.chars.length === 1){
      // Solo-Card wie bisher
      var c = g.chars[0];
      var nameShort = c.n.split(' ')[0];
      var player = c.p?'<span style="color:rgba(255,255,255,0.35);font-weight:400;margin-left:4px">&middot; '+c.p+'</span>':'';
      return '<div class="activity-item" style="cursor:pointer" data-url="'+c.lastSeenUrl+'">'
        + _portraitHtml(c, color)
        + '<div style="min-width:0;flex:1"><div class="activity-name">'+nameShort+player+'</div><div class="activity-world">'+g.world+'</div></div>'
        + '</div>';
    }
    // Merged-Card: kompakt mit Merge-Symbol — Tokens klappen beim Hover links vertikal auf
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
  // Merged Tokens als Popup ins body — verhindert overflow:hidden clipping
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
      // Vorschau-Bubble ist 280px breit und sitzt bei rect.left - 280 - 12.
      // Tokens sollen ZWISCHEN Sidebar (rect.left) und Vorschau sitzen.
      // Sidebar-Rand: rect.left, Vorschau-Rand: rect.left - 12. Spalte ~290px breit.
      // Wir setzen die Tokens auf eine Spalte direkt neben der Card.
      var anchorX = rect.left - 8; // 8px links der Card
      var anchorY = rect.top + rect.height/2;
      requestAnimationFrame(function(){
        var tokens = popup.querySelectorAll('.merged-token');
        var count = tokens.length;
        // Vertikaler Halbkreis: Tokens vertikal gestapelt, leicht nach links gewölbt
        // Vertikaler Spread basierend auf Token-Höhe + Spacing
        var spacing = 38; // px Abstand vertikal
        var totalHeight = (count - 1) * spacing;
        var startY = anchorY - totalHeight/2;
        // Wölbung: Tokens in der Mitte am weitesten links, oben/unten näher an der Card
        var bulgeMax = 20; // wie weit die mittleren Tokens nach links rausstehen
        tokens.forEach(function(t, i){
          var tw = t.offsetWidth;
          var th = t.offsetHeight;
          // Normalisierter Position-Index: 0 = oben, 1 = unten
          var pos = count > 1 ? i / (count - 1) : 0.5;
          // sin(pi * pos) = 0 an Enden, 1 in der Mitte → schöne Wölbung
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

// Hover-Preview-System (zeigt erste Sätze des letzten Posts)
var _activityPreviewCache = {};
var _activityPreviewEl = null;
var _activityPreviewTimer = null;
var _activityPrefetchIdx = 0;

function attachActivityPreview(item){
  var url = item.getAttribute('data-url');
  if(!url) return;
  if(window.matchMedia('(pointer:coarse)').matches) return; // kein Hover auf Touch

  // Prefetch nur wenn User echt da ist (nicht Bot/Scraper):
  // - Mindestens 1 Mal Interaktion
  // - Tab im Vordergrund
  // - 2s Mindest-Verweildauer auf der Seite
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
    // Vorschau-Bubble weiter nach links schieben damit gemergte Token-Popups
    // (~150px breit, sitzen direkt neben der Sidebar) Platz haben.
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

// ── Sidebar Nav-Tooltips ────────────────────────────────────
// Hover-Tooltip für Sidebar-Items mit data-tip Attribut.
// Stil identisch zu .activity-preview, aber ohne fetch/async.
var _navTipEl = null;
function showNavTip(item, text){
  hideNavTip();
  var rect = item.getBoundingClientRect();
  var div = document.createElement('div');
  div.className = 'activity-preview';
  div.textContent = text;
  document.body.appendChild(div);
  _navTipEl = div;
  // Echte Breite messen statt max-width annehmen — sonst rutscht der Tooltip
  // bei kurzen Texten unnötig weit weg vom Item
  var w = div.offsetWidth;
  var left = rect.right + 12;
  var side = 'right';
  if(left + w > window.innerWidth - 8){
    left = rect.left - w - 12;
    side = 'left';
  }
  var top = rect.top + rect.height/2 - div.offsetHeight/2;
  if(top < 8) top = 8;
  if(top + div.offsetHeight > window.innerHeight - 8) top = window.innerHeight - div.offsetHeight - 8;
  div.style.left = left + 'px';
  div.style.top = top + 'px';
  div.classList.add(side);
}
function hideNavTip(){
  if(_navTipEl){
    _navTipEl.remove();
    _navTipEl = null;
  }
}
document.addEventListener('mouseover', function(e){
  var t = e.target.closest('[data-tip]');
  if(t) showNavTip(t, t.getAttribute('data-tip'));
});
document.addEventListener('mouseout', function(e){
  var t = e.target.closest('[data-tip]');
  if(t) hideNavTip();
});

function updateSidebarStats(){
  // Fetch live forum stats from Apps Script
  fetch(SCRIPT_URL+'?action=stats')
    .then(function(r){return r.json();})
    .then(function(d){
      if(!d.posts&&!d.topics) return;
      var stats=document.getElementById('sidebar-stats');
      if(!stats) return;
      stats.innerHTML=
        '<div class="stat-row"><span class="stat-key">Posts</span><span>'+(d.posts||'–')+'</span></div>'+
        '<div class="stat-row"><span class="stat-key">Themen</span><span>'+(d.topics||'–')+'</span></div>'+
        '<div class="stat-row"><span class="stat-key">Mitglieder</span><span>'+(d.members||'–')+'</span></div>'+
'';
    // Update online users
    if(d.online&&d.online.length){
      var onlineEl=document.getElementById('sidebar-online');
      if(onlineEl) onlineEl.innerHTML=d.online.map(function(u){
        return '<div class="online-item"><div style="width:6px;height:6px;border-radius:50%;background:#4aaa6a"></div>'+u+'</div>';
      }).join('');
    }
    }).catch(function(){});
}

// Top 3 neueste Charaktere — sortiert nach Forum-Thread-ID (höchste = neueste,
// weil Xobor monoton hochzählt und Edits die ID nicht verändern)
function updateSidebarNewChars(){
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
      ?'<img src="'+c.img+'" loading="lazy" decoding="async" style="width:26px;height:26px;border-radius:50%;object-fit:cover;object-position:50% 30%;flex-shrink:0;border:0.5px solid rgba(255,255,255,0.15)">'
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

// Forum-Aktivität ausserhalb RPG-Welten (Galerie, Blog, OOC-Bereiche)
function updateSidebarForum(){
  var el=document.getElementById('sidebar-forum');
  if(!el) return;
  // Mini-Kompass beim ersten Laden zeigen (nicht bei Refresh — el hat dann schon Content)
  if(!el.innerHTML.trim() || el.dataset.sidebarLoading === '1'){
    el.dataset.sidebarLoading = '1';
    el.innerHTML='<div class="activity-preview-loading" style="padding:8px 4px"><span class="mini-compass" aria-hidden="true"></span>Lade…</div>';
  }
  fetch(SCRIPT_URL+'?action=forumActivity')
    .then(function(r){return r.json();})
    .then(function(events){
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
        // Hover-Tooltip: voller Titel + Action + User
        var tipParts = [];
        if(ev.user) tipParts.push(ev.user);
        if(ev.action) tipParts.push(ev.action);
        var tipLine1 = tipParts.join(' ');
        var tipText = (tipLine1 ? tipLine1 + (title ? ': ' : '') : '') + (title || '');
        var tipAttr = tipText ? ' data-tip="' + tipText.replace(/"/g,'&quot;') + '"' : '';
        // Avatar mit Type-Icon-Badge unten rechts
        var avatar=ev.avatar
          ?'<img src="'+ev.avatar+'" loading="lazy" decoding="async" style="width:26px;height:26px;border-radius:50%;object-fit:cover;display:block;border:0.5px solid rgba(255,255,255,0.15)">'
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
    })
    .catch(function(){
      el.dataset.sidebarLoading = '0';
      el.innerHTML='<div style="font-size:10px;color:rgba(255,80,80,0.4)">Fehler</div>';
    });
}

function buildCharTokensHtml(chars){
  if(!chars||!chars.length) return '';
  var MAX=5;
  var extra=chars.length>MAX?chars.length-MAX:0;
  // First MAX visible, rest hidden
  return '<div class="dot-char-tokens">' +
    chars.map(function(c,i){
      var name=c.n||'';
      var inner=c.img
        ?'<img class="dot-char-token" src="'+c.img+'" alt="'+name+'" loading="lazy" decoding="async">'
        :'<div class="dot-char-token-ph">'+name.charAt(0)+'</div>';
      // tokens beyond MAX are hidden when stacked, shown when expanded
      var hidden=i>=MAX?'dot-char-token-hidden':'';
      return '<div class="dot-char-token-wrap '+hidden+'">'+inner+'<div class="dot-char-token-name">'+name+'</div></div>';
    }).join('')+
    (extra>0?'<div class="dot-char-token-wrap dot-char-token-extra"><div class="dot-char-token-ph">+'+extra+'</div></div>':'')+
  '</div>';
}
function getCharsAtLot(lot){
  if(!lot||!lot.url) return [];
  var lotThreadId = getThreadIdFromUrl(lot.url);
  return CHARS.filter(function(c){
    if(!c.lastSeenUrl) return false;
    // Match by thread ID in URL
    if(lotThreadId){
      var charThreadId = getThreadIdFromUrl(c.lastSeenUrl);
      if(charThreadId === lotThreadId) return true;
    }
    return false;
  });
}

function getCharsAtWorld(worldName){
  if(!worldName) return [];
  return CHARS.filter(function(c){
    // Nur Chars mit lastSeenName UND lastSeenUrl zeigen —
    // wenn URL gelöscht wurde verschwindet der Token
    return c.lastSeenName && c.lastSeenUrl && c.lastSeenName.toLowerCase()===worldName.toLowerCase();
  });
}

// ═══ "Andere Welten"-Sterntor: Portal-Mini-Karte mit Partikeln, Drag + Tokens ═══
// Aussenwelt-Chars = Chars deren lastSeenName eine "hasAtlas=false"-Welt ist
// PLUS Sonderfall Bloodmoon Valley (hasAtlas=true, aber im Modal — siehe openOtherWorld)
function getCharsInOuterWorlds(){
  return CHARS.filter(function(c){
    if(!c.lastSeenName || !c.lastSeenUrl) return false;
    var meta = sheetWorldMeta[c.lastSeenName];
    if(!meta) return false;
    if(meta.hasAtlas === false) return true;
    // Sonderfall: Bloodmoon Valley wird auch im Modal gelistet
    if(c.lastSeenName === 'Bloodmoon Valley') return true;
    return false;
  });
}

function updateOtherworldPortalTokens(){
  var portal = document.getElementById('otherworld-portal');
  if(!portal) return;
  var tokensEl = portal.querySelector('.ow-portal-tokens');
  if(!tokensEl) return;
  var chars = getCharsInOuterWorlds();
  if(!chars.length){ tokensEl.innerHTML = ''; return; }
  var MAX = 4;
  // Alle Tokens rendern, alles über MAX bekommt .ow-portal-token-hidden
  // → wird bei Hover sichtbar (genauso wie bei den Welt-Dot-Tokens)
  var html = chars.map(function(c, i){
    var inner = c.img
      ? '<img class="ow-portal-token" src="' + c.img + '" alt="' + (c.n||'') + '" loading="lazy">'
      : '<div class="ow-portal-token-ph">' + ((c.n||'?').charAt(0)) + '</div>';
    var name = (c.n||'').replace(/"/g,'&quot;');
    var hiddenClass = i >= MAX ? ' ow-portal-token-hidden' : '';
    return '<div class="ow-portal-token-wrap' + hiddenClass + '">' +
      inner +
      '<div class="ow-portal-token-name">' + name + '</div>' +
      '</div>';
  }).join('');
  // +N-Count nur wenn mehr als MAX (verschwindet bei Hover, dann sieht man die hidden Tokens)
  var extra = chars.length - MAX;
  if(extra > 0){
    html += '<div class="ow-portal-token-wrap"><div class="ow-portal-count">+' + extra + '</div></div>';
  }
  tokensEl.innerHTML = html;
}
// Backward-compat: alter Name wird in updateAllTokens noch aufgerufen
function updateOtherworldArrowTokens(){ updateOtherworldPortalTokens(); }

// Partikel-Animation: kleine Lichtpunkte die ins Portal rein wirbeln
function startPortalParticles(canvas){
  if(!canvas || canvas._started) return;
  canvas._started = true;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var cx = W/2, cy = H/2;
  var maxR = 50;
  var particles = [];
  var COUNT = 18;

  function spawn(){
    var angle = Math.random() * Math.PI * 2;
    var radius = maxR + Math.random() * 14;
    return {
      angle: angle,
      radius: radius,
      maxRadius: radius,
      speed: 0.008 + Math.random() * 0.012,
      shrink: 0.18 + Math.random() * 0.22,
      size: 0.8 + Math.random() * 1.4,
      alpha: 0.55 + Math.random() * 0.4,
      hueShift: Math.random() * 0.4
    };
  }
  for(var i=0;i<COUNT;i++){
    var p = spawn();
    p.radius = Math.random() * maxR;
    particles.push(p);
  }

  function frame(){
    ctx.clearRect(0,0,W,H);
    for(var i=0;i<particles.length;i++){
      var p = particles[i];
      p.angle += p.speed;
      p.radius -= p.shrink;
      var x = cx + Math.cos(p.angle) * p.radius;
      var y = cy + Math.sin(p.angle) * p.radius;
      var fade = Math.max(0, p.radius / p.maxRadius);
      var alpha = p.alpha * fade;
      var size = p.size * (0.6 + 0.4 * fade);
      // Greener near center, lighter at edge
      var g = 170 + Math.floor(40 * (1 - fade));
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, ' + g + ', 138, ' + alpha.toFixed(3) + ')';
      ctx.shadowColor = 'rgba(74,170,106,0.6)';
      ctx.shadowBlur = 4;
      ctx.fill();
      if(p.radius < 4){
        particles[i] = spawn();
      }
    }
    canvas._raf = requestAnimationFrame(frame);
  }
  frame();
}

// Drag-Logik: Portal bleibt am Karten-Rand, snapt automatisch
function initOtherworldPortal(){
  var portal = document.getElementById('otherworld-portal');
  if(!portal) return;
  var container = document.getElementById('map-image-area');
  if(!container) return;

  // Partikel starten
  var canvas = portal.querySelector('.ow-portal-particles');
  if(canvas) startPortalParticles(canvas);

  // Gespeicherte Position laden (Migration vom alten Key)
  var saved = null;
  try {
    saved = JSON.parse(localStorage.getItem('sw_ow_portal_pos') || 'null');
    if(!saved) saved = JSON.parse(localStorage.getItem('sw_ow_arrow_pos') || 'null');
  } catch(_){}
  if(saved && saved.edge && typeof saved.pct === 'number'){
    applyPosition(saved.edge, saved.pct);
  } else {
    applyPosition('right', 50);
  }

  function applyPosition(edge, pct){
    portal.setAttribute('data-edge', edge);
    portal.style.left = portal.style.right = portal.style.top = portal.style.bottom = 'auto';
    portal.style.transform = '';
    var off = '14px'; // Abstand vom Rand
    if(edge === 'right'){
      portal.style.right = off;
      portal.style.top = pct + '%';
      portal.style.transform = 'translateY(-50%)';
    } else if(edge === 'left'){
      portal.style.left = off;
      portal.style.top = pct + '%';
      portal.style.transform = 'translateY(-50%)';
    } else if(edge === 'top'){
      portal.style.top = off;
      portal.style.left = pct + '%';
      portal.style.transform = 'translateX(-50%)';
    } else if(edge === 'bottom'){
      portal.style.bottom = off;
      portal.style.left = pct + '%';
      portal.style.transform = 'translateX(-50%)';
    }
  }

  var dragging = false;
  var startX = 0, startY = 0;
  var moved = false;

  function onPointerDown(e){
    dragging = true;
    moved = false;
    startX = e.clientX || 0;
    startY = e.clientY || 0;
    portal.classList.add('dragging');
    try { portal.setPointerCapture && portal.setPointerCapture(e.pointerId); } catch(_){}
    e.preventDefault();
  }

  function onPointerMove(e){
    if(!dragging) return;
    var x = e.clientX || 0;
    var y = e.clientY || 0;
    if(Math.abs(x - startX) > 4 || Math.abs(y - startY) > 4) moved = true;
    if(!moved) return;

    var r = container.getBoundingClientRect();
    var localX = Math.max(0, Math.min(r.width, x - r.left));
    var localY = Math.max(0, Math.min(r.height, y - r.top));

    var distLeft = localX, distRight = r.width - localX;
    var distTop = localY, distBottom = r.height - localY;
    var min = Math.min(distLeft, distRight, distTop, distBottom);
    var edge, pct;
    if(min === distLeft){ edge = 'left'; pct = (localY / r.height) * 100; }
    else if(min === distRight){ edge = 'right'; pct = (localY / r.height) * 100; }
    else if(min === distTop){ edge = 'top'; pct = (localX / r.width) * 100; }
    else { edge = 'bottom'; pct = (localX / r.width) * 100; }
    pct = Math.max(10, Math.min(90, pct));
    applyPosition(edge, pct);
  }

  function onPointerUp(e){
    if(!dragging) return;
    dragging = false;
    portal.classList.remove('dragging');
    try { portal.releasePointerCapture && portal.releasePointerCapture(e.pointerId); } catch(_){}

    if(moved){
      var edge = portal.getAttribute('data-edge') || 'right';
      var pct = 50;
      if(edge === 'right' || edge === 'left'){
        pct = parseFloat(portal.style.top) || 50;
      } else {
        pct = parseFloat(portal.style.left) || 50;
      }
      try { localStorage.setItem('sw_ow_portal_pos', JSON.stringify({edge:edge, pct:pct})); } catch(_){}
    } else {
      if(typeof openOtherWorld === 'function') openOtherWorld();
    }
  }

  portal.addEventListener('pointerdown', onPointerDown);
  portal.addEventListener('pointermove', onPointerMove);
  portal.addEventListener('pointerup', onPointerUp);
  portal.addEventListener('pointercancel', onPointerUp);

  portal.addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      if(typeof openOtherWorld === 'function') openOtherWorld();
    }
  });

  updateOtherworldPortalTokens();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initOtherworldPortal);
} else {
  initOtherworldPortal();
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

let buildingFloorIdx=0,currentBuildingKey=null;

function enterBuilding(buildingKey,lots){
  buildingFloorIdx=0;currentBuildingKey=buildingKey;
  const bc=document.getElementById('building-container');
  const data=BUILDINGS[buildingKey];
  bc.style.display='block';
  document.getElementById('building-name').textContent=buildingKey;
  try{sessionStorage.setItem('atlas_building',buildingKey);}catch(e){}
  // Rent-Info auch in Building-Ansicht zeigen (von aktueller Welt)
  (function(){
    var box=document.getElementById('building-rent-info');
    if(!box)return;
    var rent=currentWorld ? (sheetWorldMeta[currentWorld.name]||{}).rent : '';
    if(rent){
      box.innerHTML='<div class="rent-label">💰 Mietpreise</div>'+rent.replace(/\|/g,'<br>');
      box.classList.add('visible');
    } else {
      box.classList.remove('visible');
      box.innerHTML='';
    }
  })();
  const imgs=data?.imgs||[];
  const nav=document.getElementById('floor-nav');
  if(imgs.length>1){nav.style.display='flex';updateFloorNav(imgs);}
  else{nav.style.display='none';}
  renderBuildingBg(imgs);
  renderBuildingLots();
}
function renderBuildingLots(){
  const bc=document.getElementById('building-container');
  const data=BUILDINGS[currentBuildingKey];
  const dotParent=document.getElementById('building-bg-inner')||bc;
  dotParent.querySelectorAll('.apt-dot').forEach(d=>d.remove());
  const aptLots=data?.lots||[];
  const _bmWorld = Object.keys(worldLots).find(w => (worldLots[w]||[]).some(l => l.building === currentBuildingKey)) || 'Bloodmoon Valley';
  aptLots.forEach(apt=>{
    if(sheetLotsLoaded) apt = applySheetData({...apt, building: currentBuildingKey}, _bmWorld);
    // Floor filter: if lot has floors array, only show on matching floor
    if(apt.floors&&!apt.floors.includes(buildingFloorIdx))return;
    const d=document.createElement('div');
    const isFree=apt.free||!apt.url;
    d.className='apt-dot lot-dot'+(apt.active?' isactive':'');
    d.style.cssText=`left:${apt.x}%;top:${apt.y}%;`;
    // Nr/Name label
    const _lbl=parseLotLabel(apt);
    const _labelHtml=_lbl.sub
      ?`${_lbl.num}<span class="lot-sublabel">${_lbl.sub}</span>`
      :_lbl.num;
    const _dotBg=apt.outdoor?'rgba(80,190,170,0.9)':apt.active?'#4aaa6a':isFree?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.6)';
    const _shadow=apt.active?'0 0 10px #4aaa6a':apt.outdoor?'0 0 8px rgba(80,190,170,0.8)':'none';
    const _statusText=isFree?'○ Frei':apt.outdoor?'🌿 Öffentlicher Bereich':apt.active?'● Aktiv':'↗ Thread öffnen';
    const _statusColor=isFree?'rgba(255,255,255,0.3)':apt.outdoor?'rgba(80,190,170,0.9)':apt.active?'#4aaa6a':'rgba(255,255,255,0.4)';
    const _textInner=`<div style="font-size:9px;letter-spacing:1px;color:rgba(255,255,255,0.35);margin-bottom:1px">${_lbl.num}</div><div style="font-weight:600;margin-bottom:3px">${_lbl.sub||_lbl.num}</div><div style="font-size:10px;color:${_statusColor}">${_statusText}</div>`;
    const _tooltipInner=apt.img
      ?`<div style="padding:0;overflow:hidden;min-width:160px"><img src="${apt.img}" loading="lazy" decoding="async" style="width:100%;height:90px;object-fit:cover;display:block"><div style="padding:7px 10px">${_textInner}</div></div>`
      :`<div style="padding:6px 10px">${_textInner}</div>`;
    const _ttStyle=apt.img?'padding:0;overflow:hidden;min-width:160px;border:0.5px solid rgba(255,255,255,0.2)':'padding:6px 10px;border:0.5px solid rgba(255,255,255,0.2)';
    d.innerHTML=`<div class="lot-pulse"></div><div class="lot-inner" style="width:11px;height:11px;background:${_dotBg};box-shadow:${_shadow}"></div><div class="lot-label">${_labelHtml}</div><div class="lot-tooltip" style="${_ttStyle}">${_tooltipInner}</div>`;
    if(!isFree&&apt.url)d.addEventListener('click',e=>{e.stopPropagation();window.open(apt.url,'_blank');});
    dotParent.appendChild(d);
  });
}
function renderBuildingBg(imgs){
  const img=imgs[buildingFloorIdx]||'';
  const bg=document.getElementById('building-bg');
  // Use a persistent img tag inside inner so dots aren't wiped
  let bgImg=document.getElementById('building-bg-img');
  const innerEl=document.getElementById('building-bg-inner');
  if(!bgImg){bgImg=document.createElement('img');bgImg.id='building-bg-img';bgImg.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;filter:brightness(0.65);display:block;pointer-events:none;background:#040d14';innerEl.appendChild(bgImg);}
  function hideLoader(){
    if(typeof window.hideAtlasLoading === 'function') window.hideAtlasLoading();
  }
  if(img){
    // Vollbild-Loader nur wenn neues Bild (nicht bei gleichem src nochmal triggern)
    var needsLoader = (bgImg.src !== img);
    if(needsLoader && typeof window.showAtlasLoading === 'function'){
      window.showAtlasLoading('Karte wird geladen…');
    }
    bgImg.onload=hideLoader;
    bgImg.onerror=hideLoader;
    bgImg.src=img;
    bgImg.style.display='block';
    document.getElementById('building-no-img').style.display='none';
    // Falls Bild gecacht ist, complete=true → load-Event feuert nicht. Manuell hiden.
    if(bgImg.complete && bgImg.naturalWidth > 0) hideLoader();
  }
  else{
    bgImg.style.display='none';
    document.getElementById('building-no-img').style.display='block';
  }
}
function changeBuildingFloor(dir){
  const data=BUILDINGS[currentBuildingKey];
  const imgs=data?.imgs||[];
  buildingFloorIdx=Math.max(0,Math.min(imgs.length-1,buildingFloorIdx+dir));
  renderBuildingBg(imgs);updateFloorNav(imgs);renderBuildingLots();
}
function updateFloorNav(imgs){
  document.getElementById('floor-label').textContent=`${buildingFloorIdx+1} / ${imgs.length}`;
  document.getElementById('floor-up-btn').style.opacity=buildingFloorIdx>0?'1':'0.3';
  document.getElementById('floor-down-btn').style.opacity=buildingFloorIdx<imgs.length-1?'1':'0.3';
}
function exitBuilding(){const bc=document.getElementById('building-container');if(bc)bc.style.display='none';try{sessionStorage.removeItem('atlas_building');}catch(e){}}

function openOtherWorld(){
  // Daten aus sheetWorldMeta sammeln: Welten mit hasAtlas=FALSE → ins Modal
  // Plus: Bloodmoon Valley als Sonderfall (RPG-Welt MIT eigener ATLAS-Karte aber UND im Modal)
  var data = [];
  Object.keys(sheetWorldMeta).forEach(function(wname){
    var m = sheetWorldMeta[wname];
    if(m.hasAtlas === false){
      data.push({
        name: wname,
        type: m.category || 'Andere Welt',
        img: m.img || null,
        url: m.externalUrl || null
      });
    }
  });
  // Bloodmoon Valley: hardcoded in OTHERWORLDS_DATA war schon spezial — RPG-Welt im Modal
  // Wenn vorhanden, vorne anhängen
  var bm = sheetWorldMeta['Bloodmoon Valley'];
  if(bm && bm.hasAtlas !== false){
    data.unshift({
      name: 'Bloodmoon Valley',
      type: bm.category || 'Vampirwelt',
      img: bm.img || null,
      world: otherworlds[0]  // Welt-OBJEKT (nicht String) damit enterWorld() funktioniert
    });
  }
  // Fallback: wenn Sheet noch nicht geladen, hardcoded Liste verwenden
  if(!data.length){
    data = OTHERWORLDS_DATA;
  }

  var grid=document.getElementById('otherworld-grid');
  grid.innerHTML='';
  data.forEach(function(ow){
    var tile=document.createElement('div');
    tile.className='otherworld-tile'+((!ow.world&&!ow.url)?' empty':'');
    if(ow.img){
      var img=document.createElement('img');
      img.className='ow-img';img.src=ow.img;img.alt=ow.name;
      tile.appendChild(img);
    } else {
      var ph=document.createElement('div');
      ph.className='ow-img-ph';ph.textContent='🌑';
      tile.appendChild(ph);
    }
    var info=document.createElement('div');info.className='ow-info';
    var type=document.createElement('div');type.className='ow-type';type.textContent=ow.type;
    var name=document.createElement('div');name.className='ow-name';name.textContent=ow.name;
    info.appendChild(type);info.appendChild(name);
    tile.appendChild(info);
    // Tokens auf der Kachel anzeigen (Chars deren lastSeenName = diese Welt)
    var tileChars = getCharsAtWorld(ow.name);
    if(tileChars.length){
      var tokensWrap = document.createElement('div');
      tokensWrap.innerHTML = buildCharTokensHtml(tileChars);
      var inner = tokensWrap.firstChild;
      if(inner){
        inner.setAttribute('data-world-name', ow.name); // updateAllTokens kann's später refreshen
        tile.appendChild(inner);
      }
    }
    if(ow.world){
      tile.addEventListener('click',function(){
        closeOtherWorlds();
        enterWorld(ow.world);
      });
    } else if(ow.url){
      tile.addEventListener('click',function(){
        window.open(ow.url,'_blank');
      });
    }
    grid.appendChild(tile);
  });
  document.getElementById('otherworlds-container').classList.add('open');
  try{sessionStorage.setItem('atlas_view','otherworlds');}catch(e){}
}

function closeOtherWorlds(){
  document.getElementById('otherworlds-container').classList.remove('open');
  try{
    if(sessionStorage.getItem('atlas_view')==='otherworlds') sessionStorage.removeItem('atlas_view');
  }catch(e){}
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
// KALIBRIERUNG
// ═══════════════════════════════════════════
function toggleCalib(mode){
  if(mode==='map'){calibMapMode=!calibMapMode;document.getElementById('calib-map-panel').style.display=calibMapMode?'block':'none';mapC.style.cursor=calibMapMode?'crosshair':'default';if(calibMapMode)document.getElementById('calib-next').textContent=worlds[calibMapIdx]?.name||'—';}
  else{calibWorldMode=!calibWorldMode;document.getElementById('calib-world-panel').style.display=calibWorldMode?'block':'none';worldC.style.cursor=calibWorldMode?'crosshair':'default';if(calibWorldMode)document.getElementById('calib-world-next').textContent=getLots(currentWorld?.name||'')[calibWorldData.length]?.name||'—';}
}
function updateCalibLog(mode){const data=mode==='map'?calibMapData:calibWorldData;const log=document.getElementById(mode==='map'?'calib-map-log':'calib-world-log');log.innerHTML=data.length===0?'Noch keine Klicks...':data.map(d=>`<div style="color:#ffcc44">${d.name}</div><div style="color:#777">x:${d.x}, y:${d.y}</div>`).join('');log.scrollTop=log.scrollHeight;}
function copyCalib(mode){
  const data = mode==='map'?calibMapData:calibWorldData;
  console.log('[copyCalib]', mode, 'data:', data);
  if(!data || data.length === 0){
    alert('Noch nichts zum Kopieren — erst Orte anklicken.');
    return;
  }
  const txt = data.map(d=>`{name:"${d.name}",x:${d.x},y:${d.y}}`).join(',\n');
  console.log('[copyCalib] txt:', txt.substring(0,200));
  // Primär: Clipboard API
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt)
      .then(()=>{ console.log('[copyCalib] OK via clipboard API'); alert('✓ Kopiert!'); })
      .catch(err=>{
        console.warn('[copyCalib] clipboard API failed:', err);
        copyCalibFallback(txt);
      });
  } else {
    copyCalibFallback(txt);
  }
}
function copyCalibFallback(txt){
  try {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if(ok){ alert('✓ Kopiert!'); }
    else { alert('Kopieren fehlgeschlagen. Bitte manuell aus Console kopieren (F12) — Text wurde dort geloggt.'); console.log('[copyCalib] MANUAL COPY:\n'+txt); }
  } catch(e){
    console.error('[copyCalib] fallback error:', e);
    alert('Kopieren fehlgeschlagen: '+e.message+'\nText in Console (F12).');
    console.log('[copyCalib] MANUAL COPY:\n'+txt);
  }
}
function clearCalib(mode){if(mode==='map'){calibMapData=[];calibMapIdx=0;document.getElementById('calib-next').textContent=worlds[0]?.name||'—';}else{calibWorldData=[];var _clc=getLots(currentWorld?.name||'')[0];document.getElementById('calib-world-next').textContent=(_clc?.nr||_clc?.name||'—');document.getElementById('calib-world-count').textContent='0';}updateCalibLog(mode);}

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

// ═══════════════════════════════════════════
// ADMIN LOGIN
// ═══════════════════════════════════════════
document.getElementById('logo-icon').addEventListener('click',()=>{
  logoClicks++;clearTimeout(logoTimer);logoTimer=setTimeout(()=>logoClicks=0,5000);
  if(logoClicks>=5){
    logoClicks=0;
    if(adminMode){adminMode=false;closeAdmin();return;}
    // Eigenes Modal statt prompt() — manche Mobile-Browser (Samsung Internet,
    // iOS Safari mit Popup-Blocker) zeigen prompt() nicht zuverlässig an.
    showAdminLogin();
  }
});
function showAdminLogin(){
  const ov=document.createElement('div');
  ov.id='admin-login-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML='<div style="background:#0d1f2d;border:1px solid rgba(74,170,106,0.4);border-radius:10px;padding:20px;width:100%;max-width:300px"><div style="font-size:13px;font-weight:600;margin-bottom:12px;color:#fff">Admin-Passwort</div><input type="password" id="admin-login-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" style="width:100%;padding:10px;border-radius:6px;border:0.5px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:#fff;font-size:14px;box-sizing:border-box;margin-bottom:12px"><div style="display:flex;gap:8px"><button id="admin-login-ok" style="flex:1;padding:10px;border-radius:6px;border:none;background:#4aaa6a;color:#fff;font-size:13px;font-weight:600;cursor:pointer">OK</button><button id="admin-login-cancel" style="padding:10px 14px;border-radius:6px;border:0.5px solid rgba(255,255,255,0.2);background:transparent;color:#fff;font-size:13px;cursor:pointer">Abbrechen</button></div></div>';
  document.body.appendChild(ov);
  const input=document.getElementById('admin-login-input');
  setTimeout(()=>input.focus(),50);
  const submit=()=>{
    // Robust: trim + lowercase damit Auto-Korrektur/Capitalize von Mobile-Tastaturen
    // das Passwort nicht zerstören.
    const pw=(input.value||'').trim().toLowerCase();
    if(pw===ADMIN_PASS){
      ov.remove();
      adminMode=true;
      openAdmin();
    } else {
      input.style.borderColor='#e05555';
      input.value='';
      input.placeholder='Falsches Passwort';
      input.focus();
    }
  };
  document.getElementById('admin-login-ok').onclick=submit;
  document.getElementById('admin-login-cancel').onclick=()=>ov.remove();
  input.addEventListener('keydown',e=>{if(e.key==='Enter')submit();else if(e.key==='Escape')ov.remove();});
}
function openAdmin(){document.body.classList.add('admin-mode');document.getElementById('admin-panel').classList.add('open');document.getElementById('logo-icon').classList.add('admin-active');adminTab='assign';setAdminTab('assign');}
function closeAdmin(){document.body.classList.remove('admin-mode');document.getElementById('admin-panel').classList.remove('open');document.getElementById('logo-icon').classList.remove('admin-active');adminMode=false;}
function setAdminTab(t){adminTab=t;['assign','routen'].forEach(id=>document.getElementById('atab-'+id).classList.toggle('active',id===t));renderAdminContent();}
function renderAdminContent(){const c=document.getElementById('admin-content');if(adminTab==='assign')renderAssignTab(c);else if(adminTab==='routen')renderRoutenTab(c);}
function renderLotsTab(){
  const wname=adminWorldFilter;
  const hardLots=worldLots[wname]||[];
  const hidden=hiddenLots[wname]||[];
  const custLots=customLots[wname]||[];
  const worldOpts=worlds.map(w=>`<option value="${w.name}" ${w.name===wname?'selected':''}>${w.name}</option>`).join('');
  const hardHtml=hardLots.map(l=>{
    const isHidden=hidden.includes(l.name);
    const displayName=(renamedLots[wname]||{})[l.name]||l.name;
    const isRenamed=displayName!==l.name;
    return `<div class="lot-entry" style="opacity:${isHidden?0.4:1}"><div style="flex:1;min-width:0"><div class="lot-entry-name">${displayName}${isRenamed?` <span style="font-size:9px;color:rgba(255,200,0,0.6)">(war: ${l.name})</span>`:''}</div><div class="lot-entry-sub">x:${l.x} y:${l.y} <span class="badge badge-hard">Hard</span>${l.active?' <span class="badge badge-active">Aktiv</span>':''}</div></div><button class="a-btn a-btn-ghost" style="font-size:9px;padding:3px 7px" onclick="renameLot('${wname}','${l.name.replace(/'/g,"\\'")}',null)" title="Umbenennen">✏️</button>${isHidden?`<button class="a-btn a-btn-ghost" style="font-size:9px;padding:3px 7px" onclick="restoreHardLot('${wname}','${l.name.replace(/'/g,"\\'")}')">↩</button>`:`<button class="a-btn a-btn-danger" style="font-size:9px;padding:3px 7px" onclick="hideHardLot('${wname}','${l.name.replace(/'/g,"\\'")}')">✕</button>`}</div>`;
  }).join('');
  const custHtml=custLots.map((l,i)=>{
    const needsCalib=l._needsCalib||(l.x===50&&l.y===50);
    return `<div class="lot-entry" style="border-color:${needsCalib?'rgba(255,200,0,0.3)':'rgba(255,255,255,0.07)'}"><div style="flex:1;min-width:0"><div class="lot-entry-name">${l.name}</div><div class="lot-entry-sub">x:${l.x} y:${l.y} <span class="badge badge-custom">Custom</span>${needsCalib?' <span class="badge" style="background:rgba(255,200,0,0.15);color:#ffcc44">📍 pos fehlt</span>':''}</div></div><button class="a-btn a-btn-ghost" style="font-size:9px;padding:3px 7px" onclick="renameLot('${wname}',null,${i})" title="Umbenennen">✏️</button><button class="a-btn a-btn-pos" style="font-size:9px;padding:3px 7px" onclick="startPosForLot('${wname}',${i})" title="Position setzen">📍</button><button class="a-btn a-btn-ghost" style="font-size:9px;padding:3px 7px" onclick="toggleCustomActive('${wname}',${i})">${l.active?'Inaktiv':'Aktiv'}</button><button class="a-btn a-btn-danger" style="font-size:9px;padding:3px 7px" onclick="removeCustomLot('${wname}',${i})">✕</button></div>`;
  }).join('');
  return `<div class="a-form-row"><div class="a-label">Welt</div><select class="a-select" onchange="adminWorldFilter=this.value;renderAdminContent()">${worldOpts}</select></div><div style="font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:8px">${hardLots.length-hidden.length} sichtbar · ${hidden.length} versteckt · ${custLots.length} custom</div>${hardHtml}${custHtml}<div style="border-top:0.5px solid rgba(255,255,255,0.08);margin:14px 0 12px"></div><div style="font-size:11px;color:#ffcc44;font-weight:500;margin-bottom:10px">+ Ort hinzufügen</div><div class="a-form-row"><div class="a-label">Name</div><input class="a-input" id="a-new-name" placeholder="z.B. Nr. 5 - Meine Wohnung"></div><div class="a-form-row"><div class="a-label">Thread-URL <span style="color:rgba(255,255,255,0.3)">(optional — leer = Subforum)</span></div><input class="a-input" id="a-new-url" placeholder="https://www.simsforumrpg.de/t..."></div><div class="a-form-row" style="display:flex;gap:8px;align-items:center"><div style="flex:1"><div class="a-label">Position</div><div id="a-pos-display" style="font-size:10px;color:rgba(255,255,255,0.4)">${pendingPos?`x:${pendingPos.x}, y:${pendingPos.y} ✓`:'Noch nicht gesetzt'}</div></div><button class="a-btn a-btn-pos" onclick="startPosMode()" style="margin-top:14px">${currentWorld?'📍 Setzen':'Erst Welt betreten'}</button></div><div class="a-form-row" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="a-new-active"><label for="a-new-active" style="font-size:11px;color:rgba(255,255,255,0.6)">Als aktiv markieren</label></div><button class="a-btn a-btn-primary" style="width:100%;margin-top:4px" onclick="addCustomLot()">Ort hinzufügen</button>`;
}

var _assignLots = null;
var _assignWorld = null;

function renderAssignTab(c){
  if(!c) c = document.getElementById('admin-content');
  c.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.3)">⏳ Lade Lots...</div>';
  if(_assignLots){ buildAssignUI(c); return; }
  fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRRllRkwaCacdM0WZZT0cVQflhxJ9Fw5mgId-v615_kE2GdKdbwHMUYCG03HC8gUXfg7lucTs1Mqhg1/pub?output=csv&gid=306313316&single=true')
    .then(function(r){return r.text();})
    .then(function(csv){
      var rows = csv.split('\n');
      var headers = rows[0].split(',').map(function(h){return h.replace(/"/g,'').trim().toLowerCase();});
      var wIdx = headers.indexOf('welt');
      var nIdx = headers.indexOf('nr.');
      var nameIdx = headers.indexOf('name');
      var urlIdx = headers.indexOf('thread url');
      _assignLots = rows.slice(1).filter(function(r){return r.trim();}).map(function(r){
        var cols = r.split(',');
        var get = function(i){return (cols[i]||'').replace(/"/g,'').trim();};
        return {world:get(wIdx),nr:get(nIdx),name:get(nameIdx),threadUrl:get(urlIdx)};
      });
      buildAssignUI(c);
    })
    .catch(function(){ c.innerHTML = '<div style="color:#ff6b6b;padding:20px">Fehler beim Laden.</div>'; });
}

function buildAssignUI(c){
  var worlds = [];
  _assignLots.forEach(function(l){ if(l.world && worlds.indexOf(l.world)<0) worlds.push(l.world); });
  var selWorld = _assignWorld || worlds[0] || '';
  var unassigned = _assignLots.filter(function(l){return l.world===selWorld && l.nr && !l.threadUrl;});
  
  var worldOpts = worlds.map(function(w){
    return '<option value="'+w+'"'+(w===selWorld?' selected':'')+'>'+w+'</option>';
  }).join('');

  var grid = unassigned.length
    ? unassigned.map(function(l){
        return '<button class="a-btn" style="font-size:11px;padding:5px 8px" onclick="window._adminAssignSelect(\'' + l.nr.replace(/'/g,"\'") + '\')" data-nr="'+l.nr+'">'+l.nr+'</button>';
      }).join('')
    : '<div style="font-size:11px;color:rgba(255,255,255,0.3)">Alle vergeben ✓</div>';

  c.innerHTML = '<div style="margin-bottom:10px"><div class="a-label">Welt</div>'
    +'<select class="a-select" onchange="_assignWorld=this.value;buildAssignUI(document.getElementById(\'admin-content\'))">'+worldOpts+'</select></div>'
    +'<div style="font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:6px">Unvergeben ('+unassigned.length+'):</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">'+grid+'</div>'
    +'<div id="assign-form" style="display:none;border-top:0.5px solid rgba(255,255,255,0.08);padding-top:10px">'
    +'<div class="a-form-row"><div class="a-label">Ausgewählt: <span id="assign-nr-label" style="color:#4aaa6a"></span></div></div>'
    +'<div class="a-form-row"><div class="a-label">Art</div><div style="display:flex;gap:6px">'
    +'<button class="a-btn" id="assign-type-single" onclick="window._adminAssignType(\'single\')" style="flex:1;font-size:10px">Einzeln</button>'
    +'<button class="a-btn" id="assign-type-complex" onclick="window._adminAssignType(\'complex\')" style="flex:1;font-size:10px">Wohnkomplex</button>'
    +'</div></div>'
    +'<div id="assign-fields-single" style="display:none">'
    +'<div class="a-form-row"><div class="a-label">Thread-URL</div><input class="a-input" id="assign-url" placeholder="https://..."></div>'
    +'<div class="a-form-row"><div class="a-label">Bild-URL</div><input class="a-input" id="assign-img" placeholder="https://files.homepagemodules.de/..."></div>'
    +'<div class="a-form-row"><div class="a-label">Name</div><input class="a-input" id="assign-name" placeholder="z.B. Meine Wohnung"></div>'
    +'</div>'
    +'<div id="assign-fields-complex" style="display:none">'
    +'<div class="a-form-row"><div style="display:flex;gap:6px">'
    +'<button class="a-btn" id="assign-cx-existing" onclick="window._adminAssignCx(\'existing\')" style="flex:1;font-size:10px">Bestehend</button>'
    +'<button class="a-btn" id="assign-cx-new" onclick="window._adminAssignCx(\'new\')" style="flex:1;font-size:10px">Neu</button>'
    +'</div></div>'
    +'<div class="a-form-row"><div class="a-label">Einheit (A, B, 21...)</div><input class="a-input" id="assign-letter" maxlength="5" placeholder="A"></div>'
    +'<div class="a-form-row"><div class="a-label">Thread-URL Wohnung</div><input class="a-input" id="assign-url-unit" placeholder="https://..."></div>'
    +'<div class="a-form-row"><div class="a-label">Bild-URL Wohnung</div><input class="a-input" id="assign-img-unit" placeholder="https://files.homepagemodules.de/..."></div>'
    +'<div id="assign-cx-new-fields" style="display:none">'
    +'<div class="a-form-row"><div class="a-label">Übersichts-Bild-URL</div><input class="a-input" id="assign-img-overview" placeholder="https://files.homepagemodules.de/..."></div>'
    +'</div></div>'
    +'<button class="a-btn a-btn-primary" style="width:100%;margin-top:8px" onclick="window._adminAssignSave(\''+selWorld+'\')">Zuweisen</button>'
    +'<div id="assign-msg" style="font-size:11px;color:#4aaa6a;text-align:center;margin-top:6px;min-height:14px"></div>'
    +'</div>';
}

window._adminAssignSelect = function(nr){
  document.querySelectorAll('#admin-content .a-btn[data-nr]').forEach(function(b){
    b.style.background = b.getAttribute('data-nr')===nr ? 'rgba(74,170,106,0.3)' : '';
    b.style.borderColor = b.getAttribute('data-nr')===nr ? '#4aaa6a' : '';
  });
  window._adminAssignNr = nr;
  window._adminAssignTypeVal = null;
  window._adminAssignCxVal = null;
  document.getElementById('assign-nr-label').textContent = nr;
  document.getElementById('assign-form').style.display = 'block';
  document.getElementById('assign-msg').textContent = '';
};

window._adminAssignType = function(t){
  window._adminAssignTypeVal = t;
  document.getElementById('assign-type-single').style.background = t==='single'?'rgba(74,170,106,0.3)':'';
  document.getElementById('assign-type-complex').style.background = t==='complex'?'rgba(74,170,106,0.3)':'';
  document.getElementById('assign-fields-single').style.display = t==='single'?'block':'none';
  document.getElementById('assign-fields-complex').style.display = t==='complex'?'block':'none';
};

window._adminAssignCx = function(t){
  window._adminAssignCxVal = t;
  document.getElementById('assign-cx-existing').style.background = t==='existing'?'rgba(74,170,106,0.3)':'';
  document.getElementById('assign-cx-new').style.background = t==='new'?'rgba(74,170,106,0.3)':'';
  document.getElementById('assign-cx-new-fields').style.display = t==='new'?'block':'none';
};

window._adminAssignSave = function(world){
  var nr = window._adminAssignNr;
  var msg = document.getElementById('assign-msg');
  var t = window._adminAssignTypeVal;
  if(!nr||!t){ msg.style.color='#ff6b6b'; msg.textContent='Bitte Art wählen.'; return; }
  msg.style.color='rgba(255,255,255,0.4)'; msg.textContent='Speichern...';

  function doSave(saveNr, threadUrl, imgUrl, name){
    var params = new URLSearchParams({action:'updateLot',world:world,nr:saveNr,threadUrl:threadUrl||'',imgUrl:imgUrl||'',name:name||''});
    fetch('https://script.google.com/macros/s/AKfycbzJ_fMI1LBjmFAQDhjD1sr3hJtdUj4OOor_WiWX3asl_eX0FXDN1wr64cNON3odhHdX/exec?'+params.toString(),{mode:'no-cors'})
      .then(function(){
        msg.style.color='#4aaa6a'; msg.textContent='Zugewiesen!';
        var lot = _assignLots.find(function(l){return l.world===world&&l.nr===saveNr;});
        if(lot){ if(threadUrl) lot.threadUrl=threadUrl; }
        setTimeout(function(){ buildAssignUI(document.getElementById('admin-content')); }, 1200);
      }).catch(function(){ msg.style.color='#ff6b6b'; msg.textContent='Fehler.'; });
  }

  if(t==='single'){
    var url = (document.getElementById('assign-url').value||'').trim();
    var img = (document.getElementById('assign-img').value||'').trim();
    var name = (document.getElementById('assign-name').value||'').trim();
    if(!url){ msg.style.color='#ff6b6b'; msg.textContent='Thread-URL erforderlich.'; return; }
    doSave(nr, url, img, name);
  } else {
    var cx = window._adminAssignCxVal;
    if(!cx){ msg.style.color='#ff6b6b'; msg.textContent='Bestehend oder neu?'; return; }
    var letter = ((document.getElementById('assign-letter').value||'').trim()).toUpperCase();
    var unitNr = nr + (letter||'');
    var urlUnit = (document.getElementById('assign-url-unit').value||'').trim();
    var imgUnit = (document.getElementById('assign-img-unit').value||'').trim();
    if(!urlUnit){ msg.style.color='#ff6b6b'; msg.textContent='Thread-URL erforderlich.'; return; }
    doSave(unitNr, urlUnit, imgUnit, '');
    if(cx==='new'){
      var imgOv = (document.getElementById('assign-img-overview').value||'').trim();
      if(imgOv) doSave(nr, '', imgOv, '');
    }
  }
};

function renderCharsTab(c){
  if(!c) c=document.getElementById('admin-content');
  const CHARS_CSV='https://docs.google.com/spreadsheets/d/e/2PACX-1vRRllRkwaCacdM0WZZT0cVQflhxJ9Fw5mgId-v615_kE2GdKdbwHMUYCG03HC8gUXfg7lucTs1Mqhg1/pub?output=csv&gid=474514580&single=true';
  const SCRIPT='https://script.google.com/macros/s/AKfycbzJ_fMI1LBjmFAQDhjD1sr3hJtdUj4OOor_WiWX3asl_eX0FXDN1wr64cNON3odhHdX/exec';
  c.innerHTML='<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.3)">⏳ Lade Charaktere...</div>';

  function parseCSV(csv){
    const rows=csv.split('\n');
    const headers=rows[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase());
    const idx=k=>headers.indexOf(k);
    return rows.slice(1).filter(r=>r.trim()).map(r=>{
      const cols=r.split(',');
      const get=k=>(cols[idx(k)]||'').replace(/"/g,'').trim();
      return{name:get('name'),player:get('player'),type:get('type'),age:get('age'),job:get('job'),home:get('home'),portraitUrl:get('portraiturl'),threadUrl:get('threadurl'),okkult:get('okkult'),gender:get('gender')};
    }).filter(ch=>ch.name);
  }

  fetch(CHARS_CSV).then(r=>r.text()).then(csv=>{
    const allChars=parseCSV(csv);
    let filtered=allChars;
    let searchTerm='';
    let activeType='all';

    function render(){
      const q=searchTerm.toLowerCase();
      filtered=allChars.filter(ch=>{
        const matchType=activeType==='all'||ch.type.toLowerCase().includes(activeType);
        const matchSearch=!q||ch.name.toLowerCase().includes(q)||ch.player.toLowerCase().includes(q);
        return matchType&&matchSearch;
      });

      c.innerHTML=`
        <div style="margin-bottom:8px">
          <input id="ca-search" class="a-input" placeholder="Name oder Spieler suchen..." value="${searchTerm}" oninput="window._caSearch(this.value)">
        </div>
        <div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">
          ${['all','haupt','neben','randfigur','passant'].map(t=>`
            <button class="a-btn${activeType===t?' a-btn-primary':''}" style="font-size:10px;padding:3px 8px" onclick="window._caType('${t}')">${t==='all'?'Alle':t.charAt(0).toUpperCase()+t.slice(1)}</button>
          `).join('')}
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:8px">${filtered.length} Charaktere</div>
        <div id="ca-list">
          ${filtered.map((ch,i)=>`
            <div style="background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:6px;padding:8px 10px;margin-bottom:6px">
              <div style="display:flex;align-items:center;gap:8px">
                ${ch.portraitUrl?`<img src="${ch.portraitUrl}" loading="lazy" decoding="async" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">`:
                  '<div style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.06);flex-shrink:0"></div>'}
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:500;color:#ddeedd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ch.name}</div>
                  <div style="font-size:10px;color:rgba(255,255,255,0.35)">${ch.player} · ${ch.type}</div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                  <button class="a-btn" style="font-size:10px;padding:3px 7px;color:rgba(100,180,255,0.7);border-color:rgba(100,180,255,0.2)" onclick="window._caEdit(${i})">✎</button>
                  <button class="a-btn a-btn-danger" style="font-size:10px;padding:3px 7px" onclick="window._caDelete('${ch.name.replace(/'/g,"\\'")}')">✕</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>`;

      // Listeners neu setzen
      window._caSearch=function(v){searchTerm=v;render();};
      window._caType=function(t){activeType=t;render();};

      window._caEdit=function(idx){
        const ch=filtered[idx];
        if(!ch) return;
        const panel=document.createElement('div');
        panel.style.cssText='position:fixed;top:0;right:min(340px,100vw);width:min(320px,100vw);bottom:0;background:#060e1a;border-left:0.5px solid rgba(74,170,106,0.3);z-index:600;overflow-y:auto;padding:16px;box-shadow:-4px 0 20px rgba(0,0,0,0.7)';
        panel.innerHTML=`
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div style="font-size:13px;font-weight:600;color:#ddeedd">Charakter bearbeiten</div>
            <button onclick="this.closest('[style]').remove()" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:18px;cursor:pointer">✕</button>
          </div>
          ${['name','player','age','job','home','portraitUrl','threadUrl'].map(f=>`
            <div style="margin-bottom:10px">
              <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:3px;text-transform:uppercase">${f}</div>
              <input class="a-input" id="cae-${f}" value="${(ch[f]||'').replace(/"/g,'&quot;')}" style="width:100%;box-sizing:border-box">
            </div>
          `).join('')}
          <div style="margin-bottom:10px">
            <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:3px;text-transform:uppercase">Okkult-Typ</div>
            <select id="cae-okkult" class="a-select" style="width:100%">
              ${['Sim','Vampir','Werwolf','Magier','Geist','Fee','Meersim'].map(o=>`<option value="${o}"${ch.okkult===o?' selected':''}>${o}</option>`).join('')}
            </select>
          </div>
          <div style="margin-bottom:14px">
            <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:3px;text-transform:uppercase">Geschlecht</div>
            <select id="cae-gender" class="a-select" style="width:100%">
              <option value="">—</option>
              ${['männlich','weiblich','divers'].map(g=>`<option value="${g}"${ch.gender===g?' selected':''}>${g}</option>`).join('')}
            </select>
          </div>
          <button id="cae-save" class="a-btn a-btn-primary" style="width:100%" onclick="window._caSave('${ch.name.replace(/'/g,"\\'")}')">Speichern</button>
          <div id="cae-msg" style="font-size:11px;text-align:center;margin-top:8px;min-height:16px"></div>`;
        document.body.appendChild(panel);
      };

      window._caSave=function(origName){
        const msg=document.getElementById('cae-msg');
        msg.style.color='rgba(255,255,255,0.4)';msg.textContent='Speichern...';
        const get=id=>(document.getElementById('cae-'+id)||{value:''}).value.trim();
        const params=new URLSearchParams({
          action:'updateChar',originalName:origName,
          name:get('name'),player:get('player'),age:get('age'),job:get('job'),
          home:get('home'),portraitUrl:get('portraitUrl'),threadUrl:get('threadUrl'),
          okkult:get('okkult'),gender:get('gender')
        });
        fetch(SCRIPT+'?'+params.toString(),{mode:'no-cors'})
          .then(()=>{msg.style.color='#4aaa6a';msg.textContent='✓ Gespeichert';setTimeout(()=>{document.querySelectorAll('[style*="right:min(340px"]').forEach(e=>e.remove());renderCharsTab(c);},1200);})
          .catch(()=>{msg.style.color='#ff6b6b';msg.textContent='Fehler.';});
      };

      window._caDelete=function(name){
        if(!confirm(`"${name}" wirklich löschen?\n\nWenn der Charakterbogen-Thread noch existiert wird der Charakter beim nächsten Apps-Script-Lauf evtl. neu eingetragen.`))return;
        const params=new URLSearchParams({action:'deleteChar',name});
        fetch(SCRIPT+'?'+params.toString(),{mode:'no-cors'})
          .then(()=>{alert(`"${name}" gelöscht.`);renderCharsTab(c);})
          .catch(()=>alert('Fehler beim Löschen.'));
      };
    }

    render();
  }).catch(()=>{
    c.innerHTML='<div style="color:#ff6b6b;padding:20px;font-size:11px">Fehler beim Laden der Charaktere.</div>';
  });
}

function renderExportTab(){
  const combined={};
  [...Object.keys(worldLots),...Object.keys(customLots)].forEach(k=>{
    combined[k]=[
      ...(worldLots[k]||[]).filter(l=>!(hiddenLots[k]||[]).includes(l.name)),
      ...(customLots[k]||[]).map(l=>{const c={...l};delete c._src;delete c._needsCalib;return c;})
    ];
  });
  const code='const worldLots='+JSON.stringify(combined,null,2)+';';
  return `
    <div style="background:rgba(255,200,0,0.08);border:0.5px solid rgba(255,200,0,0.3);border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:11px;line-height:1.7">
      <div style="color:#ffcc44;font-weight:500;margin-bottom:4px">📋 So verwendest du den Export:</div>
      <div style="color:rgba(255,255,255,0.6)">1. Unten auf „Kopieren" klicken</div>
      <div style="color:rgba(255,255,255,0.6)">2. GitHub → <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px">index.html</code> öffnen → ✏️ Edit</div>
      <div style="color:rgba(255,255,255,0.6)">3. Im Code <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px">const worldLots=</code> suchen (Ctrl+F)</div>
      <div style="color:rgba(255,255,255,0.6)">4. Alles von <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px">const worldLots=</code> bis zum abschliessenden <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px">};</code> markieren und ersetzen</div>
      <div style="color:rgba(255,255,255,0.6)">5. Commit → fertig ✓</div>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);border-radius:6px;padding:10px;font-size:9px;font-family:monospace;color:#aaa;max-height:220px;overflow-y:auto;white-space:pre;line-height:1.5">${code.replace(/</g,'&lt;')}</div>
    <button class="a-btn a-btn-primary" style="width:100%;margin-top:10px" onclick="copyExport()">📋 worldLots kopieren</button>
    <div style="border-top:0.5px solid rgba(255,255,255,0.08);margin:14px 0 10px"></div>
    <button class="a-btn a-btn-danger" style="width:100%" onclick="clearAllCustom()">🗑 Alle Custom-Lots löschen</button>`;
}
function startPosMode(){if(!currentWorld){alert('Zuerst eine Welt betreten.');return;}posMode=true;worldC.style.cursor='crosshair';document.getElementById('calib-mode-bar').style.display='block';posModeCallback=(x,y)=>{pendingPos={x,y};const el=document.getElementById('a-pos-display');if(el)el.textContent=`x:${x}, y:${y} ✓`;};}
function cancelPosMode(){posMode=false;worldC.style.cursor='default';document.getElementById('calib-mode-bar').style.display='none';posModeCallback=null;}
function addCustomLot(){const name=document.getElementById('a-new-name')?.value?.trim();let url=document.getElementById('a-new-url')?.value?.trim();const active=document.getElementById('a-new-active')?.checked||false;if(!name){alert('Name eingeben.');return;}if(!url){url=worlds.find(w=>w.name===adminWorldFilter)?.url||BASE;}if(!pendingPos){alert('Position setzen.');return;}const wname=adminWorldFilter;if(!customLots[wname])customLots[wname]=[];customLots[wname].push({name,url,x:pendingPos.x,y:pendingPos.y,active});pendingPos=null;saveLots();if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();}
function removeCustomLot(wname,idx){if(!confirm(`"${customLots[wname][idx].name}" löschen?`))return;customLots[wname].splice(idx,1);if(!customLots[wname].length)delete customLots[wname];saveLots();if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();}
function toggleCustomActive(wname,idx){customLots[wname][idx].active=!customLots[wname][idx].active;saveLots();if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();}
function copyExport(){const combined={};[...Object.keys(worldLots),...Object.keys(customLots)].forEach(k=>{const renamed=renamedLots[k]||{};combined[k]=[...(worldLots[k]||[]).filter(l=>!(hiddenLots[k]||[]).includes(l.name)).map(l=>({...l,name:renamed[l.name]||l.name})),...(customLots[k]||[]).map(l=>{const c={...l};delete c._src;delete c._needsCalib;return c;})];});navigator.clipboard.writeText('const worldLots='+JSON.stringify(combined,null,2)+';').then(()=>alert('✓ Kopiert! Jetzt in GitHub einfügen.'));}
function clearAllCustom(){if(!confirm('Alle custom Lots löschen?'))return;customLots={};localStorage.removeItem('sw_custom_lots');if(currentWorld)renderLots(currentWorld);renderAdminContent();}

// ═══════════════════════════════════════════
// USER SUGGEST
// ═══════════════════════════════════════════


// ═══════════════════════════════════════════
// MOBILE SHEETS
// ═══════════════════════════════════════════
function openSheet(id){
  document.getElementById('sheet-overlay').classList.add('open');
  ['nav','activity'].forEach(s=>document.getElementById('sheet-'+s).classList.toggle('open',s===id));
  // Activity-Sheet: Inhalt + Click-Handler aus Desktop-Sidebar klonen.
  // syncMobileActivitySheet übernimmt das (greift nur wenn Sheet offen)
  if(id === 'activity' && typeof syncMobileActivitySheet === 'function'){
    syncMobileActivitySheet();
  }
}
function closeSheet(){document.getElementById('sheet-overlay').classList.remove('open');document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('open'));}

// Synct den Inhalt vom Desktop-Sidebar in das Mobile-Activity-Sheet wenn offen.
// Wird nach jedem updateSidebar* aufgerufen damit das Sheet live mitupdatet.
function syncMobileActivitySheet(){
  var sheet = document.getElementById('sheet-activity');
  if(!sheet || !sheet.classList.contains('open')) return;
  try {
    var pairs = [
      ['sidebar-activity', 'sidebar-activity-mob'],
      ['sidebar-newchars', 'sidebar-newchars-mob'],
      ['sidebar-forum',    'sidebar-forum-mob']
    ];
    pairs.forEach(function(p){
      var src = document.getElementById(p[0]);
      var dst = document.getElementById(p[1]);
      if(!src || !dst) return;
      dst.innerHTML = src.innerHTML;
      // Click-Handler nach innerHTML-Copy wieder dranhängen (innerHTML kopiert keine Listener).
      // Hover-Preview-Listener werden NICHT gesetzt — auf Touch nutzlos und macht Code unnötig schwer.
      // Auch data-tip Attribute entfernen — sind Desktop-Tooltips.
      dst.querySelectorAll('[data-url]').forEach(function(item){
        item.removeAttribute('data-tip');
        var url = item.getAttribute('data-url');
        if(!url) return;
        item.addEventListener('click', function(){ window.open(url, '_blank'); });
      });
    });
  } catch(_){}
}
let calibBuildingMode=false,calibBuildingData=[];

function getBuildingCalibLots(){
  const allLots=BUILDINGS[currentBuildingKey]?.lots||[];
  // Only lots visible on current floor (no floors prop = all floors)
  return allLots.filter(l=>!l.floors||l.floors.includes(buildingFloorIdx));
}
function toggleBuildingCalib(){
  calibBuildingMode=!calibBuildingMode;
  const panel=document.getElementById('calib-building-panel');
  const bc=document.getElementById('building-container');
  panel.style.display=calibBuildingMode?'block':'none';
  bc.style.cursor=calibBuildingMode?'crosshair':'default';
  if(calibBuildingMode){
    calibBuildingData=[];
    const lots=getBuildingCalibLots();
    const floorLabel=BUILDINGS[currentBuildingKey]?.imgs?.length>1?' (Ebene '+(buildingFloorIdx+1)+')':'';
    document.getElementById('calib-building-next').textContent=(lots[0]?.name||'—')+floorLabel;
    document.getElementById('calib-building-count').textContent='0 / '+lots.length;
    document.getElementById('calib-building-log').textContent='Noch keine Klicks...';
  }
}
function clearBuildingCalib(){
  calibBuildingData=[];
  const lots=getBuildingCalibLots();
  document.getElementById('calib-building-next').textContent=lots[0]?.name||'—';
  document.getElementById('calib-building-count').textContent='0 / '+lots.length;
  document.getElementById('calib-building-log').textContent='Noch keine Klicks...';
}
function copyBuildingCalib(){
  const txt=calibBuildingData.map(d=>`{name:"${d.name}",x:${d.x},y:${d.y}}`).join(',\n');
  navigator.clipboard.writeText(txt).then(()=>alert('✓ Kopiert!'));
}

document.addEventListener('DOMContentLoaded',function(){
  document.getElementById('building-container').addEventListener('click',function(e){
    if(!calibBuildingMode)return;
    if(e.target.closest('.calib-panel')||e.target.closest('.calib-btn')||e.target.closest('#floor-nav'))return;
    const bc=document.getElementById('building-bg-inner')||document.getElementById('building-container');
    const r=bc.getBoundingClientRect();
    const x=+((e.clientX-r.left)/r.width*100).toFixed(1);
    const y=+((e.clientY-r.top)/r.height*100).toFixed(1);
    const lots=getBuildingCalibLots();
    const idx=calibBuildingData.length;
    if(idx>=lots.length){alert('Alle '+lots.length+' Lots auf dieser Ebene gesetzt!');return;}
    calibBuildingData.push({name:lots[idx].name,x,y,floor:buildingFloorIdx});
    const log=document.getElementById('calib-building-log');
    log.innerHTML=calibBuildingData.map(d=>`<div style="color:#ffcc44">${d.name}</div><div style="color:#777">x:${d.x}, y:${d.y}</div>`).join('');
    log.scrollTop=log.scrollHeight;
    const floorLabel=BUILDINGS[currentBuildingKey]?.imgs?.length>1?' (Ebene '+(buildingFloorIdx+1)+')':'';
    document.getElementById('calib-building-next').textContent=(lots[idx+1]?.name||'✅ Fertig!')+floorLabel;
    document.getElementById('calib-building-count').textContent=calibBuildingData.length+' / '+lots.length;
  });
});
// ═══════════════════════════════════════════
// MOBILE PINCH-ZOOM + PAN
// ═══════════════════════════════════════════
function makePinchZoom(el,opts={}){
  let tx=0,ty=0,sc=1;
  let p1x=0,p1y=0;
  let nlx=0,nly=0,lx0=0,ly0=0,pd0=1,sc0=1;
  const maxSc=opts.maxScale||5,thresh=opts.labelThreshold||1.8;
  const wrap=el.parentElement;
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function apply(){
    el.style.transform=`translate(${tx}px,${ty}px) scale(${sc})`;
    el.classList.toggle('zoom-labels',sc>=thresh);
    // Tokens-Anzeige auf Touch-Devices: ab 50% Zoom (sc >= 1.5)
    el.classList.toggle('tokens-on-zoom',sc>=1.5);
  }
  function clampPan(){
    const ww=wrap.clientWidth,wh=wrap.clientHeight;
    const ew=el.offsetWidth,eh=el.offsetHeight;
    const sw=ew*sc,sh=eh*sc;
    // transform-origin: 50% 50% — Element wird von Mitte aus skaliert.
    // Bei tx=0, ty=0 ist Element flex-zentriert im Wrap.
    // Max-Pan: solang Element-Kante nicht in den Wrap reinrutscht.
    // Wenn sw > ww: max |tx| = (sw - ww) / 2
    // Wenn sw <= ww: tx muss 0 sein (sonst Lücken sichtbar)
    // Auf Touch + Zoom: vertikales Pan erlauben für 16:9-Karten auf Hochformat
    const isTouch = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
    const isZoomed = sc > 1.05;
    const allowExtraPan = isTouch && isZoomed;
    if(sw <= ww && !allowExtraPan){
      tx = 0;
    } else {
      const maxTx = Math.max((sw - ww) / 2, allowExtraPan ? sw / 4 : 0);
      tx = clamp(tx, -maxTx, maxTx);
    }
    if(sh <= wh && !allowExtraPan){
      ty = 0;
    } else {
      const maxTy = Math.max((sh - wh) / 2, allowExtraPan ? sh / 4 : 0);
      ty = clamp(ty, -maxTy, maxTy);
    }
  }
  function reset(){tx=0;ty=0;sc=1;apply();}
  wrap.addEventListener('touchstart',e=>{
    if(opts.guard&&opts.guard())return;
    // Touch auf dem "Andere Welten"-Portal soll Portal-Drag triggern, nicht Karten-Pan
    if(e.target.closest && e.target.closest('#otherworld-portal')) return;
    if(e.touches.length===1){
      p1x=e.touches[0].clientX-tx;
      p1y=e.touches[0].clientY-ty;
    }
    if(e.touches.length===2){
      const a=e.touches[0],b=e.touches[1];
      pd0=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)||1;
      sc0=sc;
      // Wrap-Center als Anker (passt zu transform-origin: 50% 50%)
      const wr=wrap.getBoundingClientRect();
      const wcx=wr.left+wr.width/2, wcy=wr.top+wr.height/2;
      const mx=(a.clientX+b.clientX)/2,my=(a.clientY+b.clientY)/2;
      // Element-lokale Koord des Fingerpunkts vor Skalierung (relativ zur Element-Mitte)
      // Element-Mitte im Screen ist (wcx + tx, wcy + ty)
      lx0=(mx-(wcx+tx))/sc0;
      ly0=(my-(wcy+ty))/sc0;
      // Wrap-Center als nlx/nly speichern für Move
      nlx=wcx; nly=wcy;
    }
  },{passive:true});
  wrap.addEventListener('touchmove',e=>{
    if(opts.guard&&opts.guard())return;
    if(e.target.closest && e.target.closest('#otherworld-portal')) return;
    if(e.touches.length===1&&sc>1.05){
      tx=e.touches[0].clientX-p1x;
      ty=e.touches[0].clientY-p1y;
      clampPan();apply();e.preventDefault();
    } else if(e.touches.length===1&&sc<=1.05){
      // scale=1: allow natural page scroll, do nothing
    }
    if(e.touches.length===2){
      const a=e.touches[0],b=e.touches[1];
      const pd=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)||1;
      sc=clamp(sc0*(pd/pd0),1,maxSc);
      const mx=(a.clientX+b.clientX)/2,my=(a.clientY+b.clientY)/2;
      // Fingerpunkt soll bei selben Element-Lokalkoord (lx0,ly0) bleiben
      // -> mx = nlx + tx + lx0*sc -> tx = mx - nlx - lx0*sc
      tx=mx-nlx-lx0*sc;
      ty=my-nly-ly0*sc;
      clampPan();apply();e.preventDefault();
    }
  },{passive:false});
  wrap.addEventListener('touchend',e=>{
    if(e.touches.length===0&&sc<1.05){reset();return;}
    if(e.touches.length===1){
      p1x=e.touches[0].clientX-tx;
      p1y=e.touches[0].clientY-ty;
    }
  },{passive:true});
  return {reset};
}
const _worldZoom=makePinchZoom(document.getElementById('world-image-area'),{
  guard:()=>calibWorldMode||posMode
});
const _mapZoom=makePinchZoom(document.getElementById('map-image-area'));
// Auf window exposen damit goBack() den Zoom resetten kann
window._worldZoom=_worldZoom;
window._mapZoom=_mapZoom;

// Mobile bottom bar
let _mobileDotUrl='';
function showMobileDotBar(nr,name,url){
  _mobileDotUrl=url;
  const bar=document.getElementById('mobile-dot-bar');
  document.getElementById('mobile-dot-nr').textContent=nr||name;
  document.getElementById('mobile-dot-name').textContent=(nr&&name!==nr)?name:'';
  bar.classList.add('visible');
}
function hideMobileDotBar(){document.getElementById('mobile-dot-bar').classList.remove('visible');_mobileDotUrl='';}
function mobileDotOpen(){if(_mobileDotUrl)window.open(_mobileDotUrl,'_blank');}

// Mobile: show bottom bar on tap, hide on tap elsewhere
document.addEventListener('touchstart',e=>{
  document.querySelectorAll('.tapped').forEach(el=>el.classList.remove('tapped'));
  if(e.target.closest('#mobile-dot-bar'))return;
  const dot=e.target.closest('.lot-dot,.cluster-dot,.world-dot');
  if(dot){dot.classList.add('tapped');}
  else{hideMobileDotBar();}
},{passive:true});

// ═══════════════════════════════════════════
// CHARAKTER-VIEW
// ═══════════════════════════════════════════
var SCRIPT_URL='https://script.google.com/macros/s/AKfycbzJ_fMI1LBjmFAQDhjD1sr3hJtdUj4OOor_WiWX3asl_eX0FXDN1wr64cNON3odhHdX/exec';
var CHARS=[
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

function openCharView(type){
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
  // Loading-Screen nur wenn Chars noch nicht geladen wurden (erstes Öffnen der Session)
  var _showLoader = (!charFetched && typeof window.showAtlasLoading === 'function');
  if(_showLoader) window.showAtlasLoading('Charaktere laden…');
  var p = fetchCharsFromScript();
  if(_showLoader && p && typeof p.finally === 'function'){
    p.finally(function(){
      if(typeof window.hideAtlasLoading === 'function') window.hideAtlasLoading();
    });
  } else if(_showLoader){
    // Fallback wenn fetchCharsFromScript synchron returnt
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

function closeCharView(){
  document.getElementById('char-container').classList.remove('open');
  location.hash='';
  try{sessionStorage.removeItem('atlas_view');}catch(e){}
}

function switchCharTab(type,btn){
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

function reloadChars(){
  charFetched=false;
  var grid=document.getElementById('char-grid');
  if(grid)grid.innerHTML='<div style="color:rgba(255,255,255,0.3);font-size:22px;padding:60px;grid-column:1/-1;text-align:center">⏳</div>';
  // Atlas Loading-Screen zeigen — User wartet aktiv auf Reload
  if(typeof window.showAtlasLoading === 'function') window.showAtlasLoading('Charaktere laden…');
  fetchCharsFromScript(null).finally(function(){
    if(typeof window.hideAtlasLoading === 'function') window.hideAtlasLoading();
  });
}

async function fetchCharsFromScript(){
  // Cache: sofort aus sessionStorage anzeigen
  try{
    var cached=sessionStorage.getItem('atlas_chars_cache');
    if(cached){
      var cachedData=JSON.parse(cached);
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
  // Im Hintergrund aktualisieren
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
      // Cache aktualisieren
      try{sessionStorage.setItem('atlas_chars_cache',JSON.stringify(fresh));}catch(e){}
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

function charSearchFilter(val){
  charSearchTerm=val.toLowerCase().trim();
  charRenderFiltered();
}

function toggleCharSort(){
  charSortAZ=!charSortAZ;
  var btn=document.getElementById('char-sort-btn');
  if(btn)btn.classList.toggle('active',charSortAZ);
  charRenderFiltered();
}

function charRenderFiltered(){
  // Wenn Suche aktiv: über alle Typen suchen
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

function togglePlayerFilter(btn){
  var p=btn.textContent;
  var idx=charPlayerFilter.indexOf(p);
  if(idx>-1){charPlayerFilter.splice(idx,1);btn.classList.remove('active');}
  else{charPlayerFilter.push(p);btn.classList.add('active');}
  updateResetBtn();
  charRenderFiltered();
}

var charAgeFilter=[];
var charGenderFilter=[];

function toggleGenderFilter(btn,val){
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

function toggleAgeFilter(){
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

function resetAllFilters(){
  charAgeFilter=[];
  charGenderFilter=[];
  charPlayerFilter=[];
  document.querySelectorAll('.char-gender-filter').forEach(function(b){b.classList.remove('active');});
  buildAgeFilter();
  buildPlayerFilter();
  updateResetBtn();
  charRenderFiltered();
}

function toggleAgeGroup(btn){
  var label=btn.getAttribute('data-label');
  var idx=charAgeFilter.indexOf(label);
  if(idx>-1){charAgeFilter.splice(idx,1);btn.classList.remove('active');}
  else{charAgeFilter.push(label);btn.classList.add('active');}
  updateResetBtn();
  charRenderFiltered();
}

function getAgeGroup(ageStr){
  var a=parseInt(ageStr);
  if(isNaN(a))return null;
  return a;
}

function makeCard(c){
  var card=document.createElement('div');
  card.className='char-card';
  card.setAttribute('data-url',c.u);
  card.onclick=function(){window.open(this.getAttribute('data-url'),'_blank');};
  var portrait=c.img
    ?'<img class="char-portrait" src="'+c.img+'" alt="'+c.n+'" loading="lazy" decoding="async">'
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
  // Hover card selbst bleibt offen wenn man drüber fährt
  hc.onmouseenter=function(){clearTimeout(_hoverTimeout);};
  hc.onmouseleave=function(){hideCharHover();};
}
function hideCharHover(){
  _hoverTimeout=setTimeout(function(){
    document.getElementById('char-hover-card').classList.remove('visible');
  },200);
}

// URL-Hash: Refresh behält die Ansicht
window.addEventListener('hashchange',function(){
  var h=location.hash;
  var m=h.match(/^#chars-(.+)$/);
  if(m)openCharView(m[1]);
  else if(!h&&document.getElementById('char-container').classList.contains('open'))closeCharView();
});
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



// Reposition tooltips that go off-screen
function repositionTooltips(){
  document.querySelectorAll('.lot-dot, .cluster-dot').forEach(function(dot){
    var tt = dot.querySelector('.lot-tooltip, .cluster-hover');
    if(!tt) return;
    dot.addEventListener('mouseenter', function(){
      // Reset first
      tt.style.bottom = '';
      tt.style.top = '';
      tt.style.transform = '';
      // Check after display
      requestAnimationFrame(function(){
        var r = tt.getBoundingClientRect();
        var dotR = dot.getBoundingClientRect();
        // Off top
        if(r.top < 60){
          tt.style.bottom = 'auto';
          tt.style.top = '18px';
          tt.style.transform = 'translateX(-50%)';
        }
        // Off right
        if(r.right > window.innerWidth - 10){
          tt.style.left = 'auto';
          tt.style.right = '0';
          tt.style.transform = 'none';
        }
        // Off left
        if(r.left < 10){
          tt.style.left = '0';
          tt.style.transform = 'none';
        }
      });
    });
    dot.addEventListener('mouseleave', function(){
      tt.style.bottom = '';
      tt.style.top = '';
      tt.style.transform = '';
      tt.style.left = '';
      tt.style.right = '';
    });
  });
}
setTimeout(repositionTooltips, 1000);

document.querySelectorAll('.sheet').forEach(sheet=>{
  let sy=0, startedOnHandle=false;
  sheet.addEventListener('touchstart', e=>{
    sy = e.touches[0].clientY;
    // Schliessen nur wenn Touch am Handle (Grip oben) startet.
    // Sonst: User scrollt im Sheet — kein Schliess-Trigger, sonst frisst es scroll-up gestures.
    startedOnHandle = !!e.target.closest('.sheet-handle');
  }, {passive:true});
  sheet.addEventListener('touchend', e=>{
    if(!startedOnHandle) return;
    const dy = e.changedTouches[0].clientY - sy;
    if(dy > 60) closeSheet();
  }, {passive:true});
});

// ═══════════════════════════════════════════════════════════════════════
//   ATLAS HIGHLIGHT (von Eve-Onboarding im Forum-Header gesteuert)
// ═══════════════════════════════════════════════════════════════════════
// Eve sitzt im Xobor-Header (anderer Origin), kann nicht direkt in unser DOM
// greifen. Sie schickt postMessage({action:'atlas-highlight', selector:'...'})
// und wir legen ein Overlay-Div über das Element. Wir machen das NICHT als
// Klasse aufs Element selbst weil sonst overflow:auto/hidden den Glow
// abschneiden würde (z.B. die scrollbare #left-Sidebar).
(function(){
  var style = document.createElement('style');
  style.textContent =
    '.atlas-highlight-overlay{' +
    '  position:fixed;' +
    '  pointer-events:none;' +
    '  z-index:99999;' +
    '  border-radius:8px;' +
    '  animation:atlasHighlightGlow 1.5s ease-in-out infinite;' +
    '}' +
    '@keyframes atlasHighlightGlow{' +
    '  0%,100%{' +
    '    box-shadow:0 0 0 0 rgba(74,170,106,0),0 0 0 rgba(74,170,106,0);' +
    '  }' +
    '  50%{' +
    '    box-shadow:0 0 0 2px rgba(74,170,106,0.85),0 0 32px 6px rgba(74,170,106,0.55);' +
    '  }' +
    '}';
  document.head.appendChild(style);

  var overlayEl = null;
  var trackedElement = null;
  var updateInterval = null;

  function clearHighlight() {
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
    trackedElement = null;
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  }

  function positionOverlay() {
    if (!overlayEl || !trackedElement) return;
    var rect = trackedElement.getBoundingClientRect();
    // Wenn Element nicht mehr sichtbar (rect zeros): Overlay verstecken
    if (rect.width === 0 && rect.height === 0) {
      overlayEl.style.display = 'none';
      return;
    }
    overlayEl.style.display = 'block';
    overlayEl.style.left = rect.left + 'px';
    overlayEl.style.top = rect.top + 'px';
    overlayEl.style.width = rect.width + 'px';
    overlayEl.style.height = rect.height + 'px';
  }

  function setHighlight(selector) {
    clearHighlight();
    if (!selector) return;
    try {
      var el = document.querySelector(selector);
      if (!el) return;
      trackedElement = el;
      overlayEl = document.createElement('div');
      overlayEl.className = 'atlas-highlight-overlay';
      document.body.appendChild(overlayEl);
      positionOverlay();
      // Position jeden Frame updaten — Element kann sich bewegen (Scrolling,
      // Resize, dynamische Inhalte) und wir wollen den Glow nachziehen.
      updateInterval = setInterval(positionOverlay, 60);
    } catch(e) {}
  }

  window.addEventListener('message', function(e){
    if (!e.data) return;
    // 'auth-status' — Forum-JS (atlas_header) teilt mit ob User Gast ist.
    // Wir zeigen Anmelden/Registrieren-Buttons nur für Gäste.
    if (e.data.action === 'auth-status') {
      var login = document.getElementById('btn-login');
      var reg = document.getElementById('btn-register');
      if (login) login.style.display = e.data.isGuest ? 'inline-block' : 'none';
      if (reg) reg.style.display = e.data.isGuest ? 'inline-block' : 'none';
      return;
    }
    // 'atlas-highlight' — Standard-Highlight per CSS-Selector
    if (e.data.action === 'atlas-highlight') {
      setHighlight(e.data.selector);
      return;
    }
    // 'open-charview' — Eve kann den Charakter-Tab öffnen damit der nächste
    // Step (Charakter erstellen) sichtbaren Kontext hat (besonders Mobile-relevant).
    if (e.data.action === 'open-charview') {
      try {
        if (typeof window.openCharView === 'function') {
          window.openCharView();
        }
        // Falls Mobile: bottom-sheet ggf. zumachen (das wurde durch openCharView nicht angefasst)
        if (typeof window.closeSheet === 'function') {
          window.closeSheet();
        }
      } catch(err) {}
      return;
    }
  });
  window.addEventListener('resize', positionOverlay);

  // Bei Klick auf Nav-Items/Dots Highlight automatisch clearen (sonst bleibt
  // z.B. der Charaktere-Tab gehighlighted und überdeckt die Char-Karten)
  document.addEventListener('click', function(e) {
    var navItem = e.target.closest('.nav-item, .world-dot, .lot-dot, #char-create-btn');
    if (navItem) {
      setTimeout(clearHighlight, 100);
    }
  });
})();


// Calib-Panels draggable machen (h4 ist der Header zum Greifen)
(function(){
  function makeDraggable(panel) {
    var header = panel.querySelector('h4');
    if (!header) return;
    var dragging = false, sx = 0, sy = 0, px = 0, py = 0;
    function onDown(e) {
      dragging = true;
      var t = e.touches ? e.touches[0] : e;
      sx = t.clientX; sy = t.clientY;
      var rect = panel.getBoundingClientRect();
      px = rect.left; py = rect.top;
      panel.style.left = px + 'px';
      panel.style.top = py + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var t = e.touches ? e.touches[0] : e;
      panel.style.left = (px + t.clientX - sx) + 'px';
      panel.style.top = (py + t.clientY - sy) + 'px';
    }
    function onUp(){ dragging = false; }
    header.addEventListener('mousedown', onDown);
    header.addEventListener('touchstart', onDown, {passive:false});
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, {passive:false});
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  }
  document.querySelectorAll('.calib-panel').forEach(makeDraggable);
})();

/* ── ROUTEN-ADMIN CSS ── */

// ═══════════════════════════════════════════
// NAVIGATIONSSYSTEM
// ═══════════════════════════════════════════
(function(){
  let naviMode=false; // 'from' | 'to' | false
  let naviTransport='car'; // 'walk' | 'car' | 'transit'

  const TRANSPORT={
    walk: {segMin:90, borderBonus:30, label:'zu Fuss'},
    car:  {segMin:25, borderBonus:10, label:'mit dem Auto'},
    transit:{segMin:15, borderBonus:5, label:'mit dem ÖV'}
  };

  window.setNaviMode=function(mode){
    naviTransport=mode;
    document.querySelectorAll('.np-mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    // Wenn schon eine Route berechnet wurde, neu rechnen
    if(document.getElementById('navi-result').style.display==='block') calcNavi();
  };

  // Dropdowns befüllen
  function initNaviSelects(){
    const selFrom=document.getElementById('navi-from');
    const selTo=document.getElementById('navi-to');
    worlds.forEach(w=>{
      const a=document.createElement('option');a.value=w.name;a.textContent=w.name;selFrom.appendChild(a);
      const b=document.createElement('option');b.value=w.name;b.textContent=w.name;selTo.appendChild(b);
    });
  }
  initNaviSelects();

  // Toggle Panel
  window.toggleNavi=function(){
    const panel=document.getElementById('navi-panel');
    const btn=document.getElementById('navi-btn');
    const open=panel.classList.toggle('open');
    btn.classList.toggle('active',open);
    if(!open) clearNaviRoute();
  };

  // Dot-Klick für Navi-Füllung (wird in worlds.forEach patch gerufen)
  window.naviDotClick=function(worldName){
    if(!document.getElementById('navi-panel').classList.contains('open')) return false;
    const from=document.getElementById('navi-from');
    const to=document.getElementById('navi-to');
    if(!from.value || (from.value && to.value)){
      from.value=worldName; to.value='';
    } else {
      to.value=worldName;
    }
    return true; // true = hat den Klick abgefangen
  };

  // Route berechnen
  window.calcNavi=function(){
    const fromName=document.getElementById('navi-from').value;
    const toName=document.getElementById('navi-to').value;
    if(!fromName||!toName){alert('Bitte Start und Ziel wählen.');return;}
    if(fromName===toName){alert('Start und Ziel sind identisch.');return;}
    const start=worlds.find(w=>w.name===fromName);
    const end=worlds.find(w=>w.name===toName);
    if(!start||!end) return;

    // Netz: localStorage (Editor) hat Vorrang, sonst eingebettete Routen
    const net=Object.keys(window.atlasCustomRoutes||{}).length>0
      ? window.atlasCustomRoutes
      : (window.ATLAS_ROUTES||{});

    // Graph aufbauen — NUR aus dem definierten Netz, kein Luftlinien-Fallback
    const graph={};
    worlds.forEach(w=>{graph[w.name]=[];});
    Object.values(net).filter(r=>r.from&&r.to&&r.from!==r.to).forEach(r=>{
      if(!graph[r.from]) graph[r.from]=[];
      const fW=worlds.find(w=>w.name===r.from);
      const tW=worlds.find(w=>w.name===r.to);
      if(!fW||!tW) return;
      let dist=0;
      const pts=[{x:fW.x,y:fW.y},...(r.points||[]),{x:tW.x,y:tW.y}];
      for(let i=0;i<pts.length-1;i++) dist+=Math.sqrt(Math.pow(pts[i].x-pts[i+1].x,2)+Math.pow(pts[i].y-pts[i+1].y,2));
      graph[r.from].push({to:r.to,dist,key:r.from+'|'+r.to+'|'+r.transport});
    });

    // Dijkstra
    const distMap={},prevMap={};
    worlds.forEach(w=>{distMap[w.name]=Infinity;});
    distMap[fromName]=0;
    const queue=new Set(worlds.map(w=>w.name));
    while(queue.size){
      let u=null;queue.forEach(n=>{if(u===null||distMap[n]<distMap[u])u=n;});
      if(distMap[u]===Infinity) break;
      queue.delete(u);
      (graph[u]||[]).forEach(e=>{
        const alt=distMap[u]+e.dist;
        if(alt<distMap[e.to]){distMap[e.to]=alt;prevMap[e.to]={node:u,key:e.key};}
      });
    }

    if(distMap[toName]===Infinity){
      document.getElementById('navi-result').style.display='block';
      document.getElementById('navi-time').innerHTML='<span style="color:rgba(255,80,80,0.8)">Keine Route im Netz</span>';
      document.getElementById('navi-route-list').innerHTML='<li style="font-size:10px;color:rgba(255,255,255,0.3)">Für diese Verbindung wurde noch keine Route eingezeichnet.</li>';
      document.getElementById('navi-calc-info').textContent='Route fehlt im Netz.';
      return;
    }

    // Pfad + verwendete Routen-Keys rekonstruieren
    const pathNames=[];const usedKeys=[];let cur=toName;
    while(cur){pathNames.unshift(cur);if(prevMap[cur]){usedKeys.unshift(prevMap[cur].key);cur=prevMap[cur].node;}else break;}

    // Segment-Typen + Wegpunkte sammeln
    let hasBoat=false,hasPlane=false;
    const allWaypoints=[];
    usedKeys.forEach((key,ki)=>{
      const r=net[key];if(!r) return;
      r.points.forEach(p=>{if(p.segType==='boat')hasBoat=true;if(p.segType==='plane')hasPlane=true;});
      const fW=worlds.find(w=>w.name===r.from);
      if(ki===0) allWaypoints.push({x:fW.x,y:fW.y,segType:'road'});
      (r.points||[]).forEach(p=>allWaypoints.push(p));
      const tW=worlds.find(w=>w.name===r.to);
      allWaypoints.push({x:tW.x,y:tW.y,segType:'road'});
    });

    // Reisezeit: echte Pfadlänge × Geschwindigkeitsfaktor pro Segment
    // Faktor = Minuten pro Karteneinheit (1 Einheit ≈ ca. 1km im Massstab)
    const SPEED={car:{road:2.8,boat:4,plane:0.8},transit:{road:3.5,boat:3.2,plane:0.8},walk:{road:14,boat:3.2,plane:0.8}};
    const sp=SPEED[naviTransport]||SPEED.car;
    let totalMins=0;
    for(let i=0;i<allWaypoints.length-1;i++){
      const segDist=Math.sqrt(Math.pow(allWaypoints[i].x-allWaypoints[i+1].x,2)+Math.pow(allWaypoints[i].y-allWaypoints[i+1].y,2));
      const st=allWaypoints[i+1].segType||'road';
      totalMins+=segDist*(sp[st]||sp.road);
    }
    totalMins=Math.max(1,Math.round(totalMins));
    const h=Math.floor(totalMins/60),m=totalMins%60;
    const timeStr=(h>0?h+'h ':'')+(m>0?m+' min':'');
    const modeLabels={car:'mit dem Auto',transit:'mit dem ÖV',walk:'zu Fuss'};

    document.getElementById('navi-time').innerHTML=timeStr+' <span>'+(modeLabels[naviTransport]||'')+'</span>';
    document.getElementById('navi-calc-info').textContent='Route folgt dem Strassennetz ('+(pathNames.length)+' Orte)'+(hasBoat?' · Boot-Abschnitt':hasPlane?' · Flug-Abschnitt':'');

    const list=document.getElementById('navi-route-list');
    list.innerHTML='';
    pathNames.forEach((name,i)=>{
      const li=document.createElement('li');
      const isEnd=(i===0||i===pathNames.length-1);
      if(isEnd) li.className='np-endpoint';
      li.innerHTML='<div class="np-dot-marker"></div>'+(i>0?'<span class="np-arrow">&#9658;</span> ':'')+name;
      if(!isEnd) li.style.paddingLeft='4px';
      list.appendChild(li);
    });
    if(hasBoat||hasPlane){
      const badge=document.createElement('li');
      badge.style.cssText='padding-top:6px;font-size:10px;color:'+(hasBoat?'#5a9fd4':'#b07add');
      badge.textContent=hasBoat?'~ Wasserüberquerung per Boot':'Flug-Abschnitt';
      list.appendChild(badge);
    }
    document.getElementById('navi-result').style.display='block';
    drawNaviRoute(pathNames.map(n=>worlds.find(w=>w.name===n)),allWaypoints);

    // Alternative ohne Flug anbieten falls Hauptroute einen Flug enthält
    const altDiv=document.getElementById('navi-alt');
    if(hasPlane){
      // Dijkstra ohne Flug-Kanten
      const graphNoPlane={};
      worlds.forEach(w=>{graphNoPlane[w.name]=[];});
      Object.values(net).filter(r=>r.from&&r.to&&r.from!==r.to).forEach(r=>{
        const hasPlaneEdge=r.points.some(p=>p.segType==='plane');
        if(hasPlaneEdge) return; // Flug-Routen überspringen
        if(!graphNoPlane[r.from]) graphNoPlane[r.from]=[];
        const fW=worlds.find(w=>w.name===r.from);
        const tW=worlds.find(w=>w.name===r.to);
        if(!fW||!tW) return;
        let dist=0;
        const pts=[{x:fW.x,y:fW.y},...(r.points||[]),{x:tW.x,y:tW.y}];
        for(let i=0;i<pts.length-1;i++) dist+=Math.sqrt(Math.pow(pts[i].x-pts[i+1].x,2)+Math.pow(pts[i].y-pts[i+1].y,2));
        graphNoPlane[r.from].push({to:r.to,dist,key:r.from+'|'+r.to+'|'+r.transport});
      });
      const distAlt={},prevAlt={};
      worlds.forEach(w=>{distAlt[w.name]=Infinity;});
      distAlt[fromName]=0;
      const qAlt=new Set(worlds.map(w=>w.name));
      while(qAlt.size){
        let u=null;qAlt.forEach(n=>{if(u===null||distAlt[n]<distAlt[u])u=n;});
        if(distAlt[u]===Infinity) break;
        qAlt.delete(u);
        (graphNoPlane[u]||[]).forEach(e=>{
          const alt=distAlt[u]+e.dist;
          if(alt<distAlt[e.to]){distAlt[e.to]=alt;prevAlt[e.to]={node:u,key:e.key};}
        });
      }
      if(distAlt[toName]===Infinity){
        altDiv.style.display='block';
        altDiv.innerHTML='<div style="font-size:10px;color:rgba(255,255,255,0.25)">✈ Kein Alternativweg ohne Flug verfügbar</div>';
      } else {
        // Alt-Pfad rekonstruieren
        const altNames=[];const altKeys=[];let cur2=toName;
        while(cur2){altNames.unshift(cur2);if(prevAlt[cur2]){altKeys.unshift(prevAlt[cur2].key);cur2=prevAlt[cur2].node;}else break;}
        let altBoat=false;
        const altWp=[];
        altKeys.forEach((key,ki)=>{
          const r=net[key];if(!r) return;
          r.points.forEach(p=>{if(p.segType==='boat')altBoat=true;});
          const fW=worlds.find(w=>w.name===r.from);
          if(ki===0) altWp.push({x:fW.x,y:fW.y,segType:'road'});
          (r.points||[]).forEach(p=>altWp.push(p));
          const tW=worlds.find(w=>w.name===r.to);
          altWp.push({x:tW.x,y:tW.y,segType:'road'});
        });
        let altMins=0;
        for(let i=0;i<altWp.length-1;i++){
          const segDist=Math.sqrt(Math.pow(altWp[i].x-altWp[i+1].x,2)+Math.pow(altWp[i].y-altWp[i+1].y,2));
          const st=altWp[i+1].segType||'road';
          altMins+=segDist*(sp[st]||sp.road);
        }
        altMins=Math.max(1,Math.round(altMins));
        const ah=Math.floor(altMins/60),am=altMins%60;
        const altTime=(ah>0?ah+'h ':'')+(am>0?am+' min':'');
        altDiv.style.display='block';
        altDiv.innerHTML=`
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-bottom:5px">✈ Alternativweg ohne Flug:</div>
          <button onclick="window._naviShowAlt()" style="background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.15);border-radius:6px;color:rgba(255,255,255,0.6);font-size:11px;padding:5px 10px;cursor:pointer;width:100%;text-align:left">
            ${altTime} · ${altNames.length} Orte${altBoat?' · Boot':''}
            <span style="float:right;opacity:0.4">anzeigen ▸</span>
          </button>`;
        window._naviShowAlt=function(){
          drawNaviRoute(altNames.map(n=>worlds.find(w=>w.name===n)),altWp);
          document.getElementById('navi-time').innerHTML=altTime+' <span>'+(modeLabels[naviTransport]||'')+'</span>';
          document.getElementById('navi-calc-info').textContent='Alternative ohne Flug ('+altNames.length+' Orte)'+(altBoat?' · Boot-Abschnitt':'');
          const list=document.getElementById('navi-route-list');
          list.innerHTML='';
          altNames.forEach((name,i)=>{
            const li=document.createElement('li');
            const isEnd=(i===0||i===altNames.length-1);
            if(isEnd) li.className='np-endpoint';
            li.innerHTML='<div class="np-dot-marker"></div>'+(i>0?'<span class="np-arrow">&#9658;</span> ':'')+name;
            if(!isEnd) li.style.paddingLeft='4px';
            list.appendChild(li);
          });
          altDiv.querySelector('button').textContent='✓ Alternativweg aktiv';
          altDiv.querySelector('button').style.color='rgba(74,170,106,0.8)';
          altDiv.querySelector('button').style.borderColor='rgba(74,170,106,0.3)';
          altDiv.querySelector('button').onclick=null;
        };
      }
    } else {
      altDiv.style.display='none';
    }
  };

  function clearNaviRoute(){
    const svg=document.getElementById('navi-route-svg');
    if(svg) svg.innerHTML='';
    document.getElementById('navi-result').style.display='none';
  }

  function drawNaviRoute(stops,allWaypoints){
    const svg=document.getElementById('navi-route-svg');
    svg.innerHTML='';

    // Wenn echte Wegpunkte vorhanden: entlang der Route zeichnen
    const pts=allWaypoints&&allWaypoints.length>0 ? allWaypoints : stops;

    // Farbe nach dominantem Segment-Typ
    const hasBoat=pts.some&&pts.some(p=>p.segType==='boat');
    const hasPlane=pts.some&&pts.some(p=>p.segType==='plane');

    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1];
      const ax='x' in a?a.x:a.x, ay='y' in a?a.y:a.y;
      const bx='x' in b?b.x:b.x, by='y' in b?b.y:b.y;
      const st=b.segType||'road';
      const lineColor=st==='boat'?'rgba(80,170,240,0.9)':st==='plane'?'rgba(200,140,255,0.9)':'rgba(255,230,100,0.95)';
      const dash=st==='boat'?'2 3':st==='plane'?'6 3':'3 2';

      const shadow=document.createElementNS('http://www.w3.org/2000/svg','line');
      shadow.setAttribute('x1',ax);shadow.setAttribute('y1',ay);
      shadow.setAttribute('x2',bx);shadow.setAttribute('y2',by);
      shadow.setAttribute('stroke','rgba(0,0,0,0.55)');shadow.setAttribute('stroke-width','2.8');
      shadow.setAttribute('stroke-linecap','round');shadow.setAttribute('vector-effect','non-scaling-stroke');
      svg.appendChild(shadow);

      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',ax);line.setAttribute('y1',ay);
      line.setAttribute('x2',bx);line.setAttribute('y2',by);
      line.setAttribute('stroke',lineColor);line.setAttribute('stroke-width','1.4');
      line.setAttribute('stroke-dasharray',dash);line.setAttribute('stroke-linecap','round');
      line.setAttribute('vector-effect','non-scaling-stroke');
      svg.appendChild(line);
    }

    // Welt-Dots hervorheben
    document.querySelectorAll('.world-dot').forEach(el=>{el.querySelector('.dot-inner').style.removeProperty('outline');});
    (stops||[]).forEach((w,i)=>{
      if(!w) return;
      const el=document.querySelector(`.world-dot[data-world-key="${w.name}"]`);
      if(!el) return;
      const inner=el.querySelector('.dot-inner');
      if(i===0||i===(stops.length-1)){inner.style.outline='2px solid rgba(255,230,100,1)';inner.style.outlineOffset='3px';}
      else{inner.style.outline='1.5px solid rgba(255,230,100,0.7)';inner.style.outlineOffset='2px';}
    });
  }

  // Panel schliessen wenn man von der Karte wegklickt
  document.addEventListener('click',function(e){
    if(!e.target.closest('#navi-panel')&&!e.target.closest('#navi-btn')){
      const panel=document.getElementById('navi-panel');
      if(panel.classList.contains('open')){
        panel.classList.remove('open');
        document.getElementById('navi-btn').classList.remove('active');
      }
    }
  });

})();


// ═══════════════════════════════════════════════════════
// ROUTEN-ADMIN
// ═══════════════════════════════════════════════════════
(function(){

// Storage
const STORAGE_KEY='atlas_custom_routes';
function loadRoutes(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch(e){return {};}}
function saveRoutes(r){localStorage.setItem(STORAGE_KEY,JSON.stringify(r));}

let customRoutes=loadRoutes();

// Routen-Tab rendern — baut das Panel in den admin-content div
window.renderRoutenTab=function(container){
  // Statt im engen Panel: eigenes Fullscreen-Overlay
  container.innerHTML='<div style="padding:20px 0;text-align:center;color:rgba(255,255,255,0.4);font-size:12px">Routen-Editor wird geöffnet...</div>';
  setTimeout(()=>openRoutenEditor(),50);
};

function openRoutenEditor(){
  let overlay=document.getElementById('routen-editor-overlay');
  if(overlay){overlay.style.display='flex';initRoutenAdmin(document.getElementById('routen-admin-root'));return;}
  overlay=document.createElement('div');
  overlay.id='routen-editor-overlay';
  overlay.style.cssText='position:fixed;inset:0;z-index:500;background:rgba(4,10,20,0.97);display:flex;flex-direction:column;overflow:hidden';
  overlay.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:0.5px solid rgba(255,200,0,0.2);flex-shrink:0">
      <span style="font-size:13px;color:#ffcc44;font-weight:500">🗺 Routen-Editor</span>
      <button onclick="closeRoutenEditor()" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:20px;padding:0 4px">✕</button>
    </div>
    <div id="routen-admin-root" style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;min-height:0"></div>`;
  document.body.appendChild(overlay);
  initRoutenAdmin(document.getElementById('routen-admin-root'));
}

window.closeRoutenEditor=function(){
  const o=document.getElementById('routen-editor-overlay');
  if(o) o.style.display='none';
};

function initRoutenAdmin(root){
  const SEG={
    road:{stroke:'rgba(255,220,80,0.92)',shadow:'rgba(0,0,0,0.55)',dash:'3 2'},
    boat:{stroke:'rgba(80,170,240,0.92)',shadow:'rgba(0,20,60,0.55)',dash:'2 4'},
    plane:{stroke:'rgba(200,140,255,0.92)',shadow:'rgba(20,0,60,0.55)',dash:'6 3'}
  };

  let transport='car', segType='road';
  let fromW=null, toW=null, points=[];

  root.innerHTML=`
  <style>
  #ra-wrap{display:flex;gap:14px;height:100%;min-height:0}
  #ra-left{flex:1;min-width:0;display:flex;flex-direction:column;gap:0}
  #ra-mapbox{position:relative;width:100%;flex:1;min-height:0;background:#1a2535;border-radius:7px;border:0.5px solid rgba(255,200,0,0.2);overflow:hidden;cursor:crosshair;user-select:none}
  #ra-mapsvg{width:100%;height:100%;display:block}
  #ra-right{width:240px;flex-shrink:0;overflow-y:auto;display:flex;flex-direction:column;gap:0}
  .ra-row{display:flex;gap:6px}
  .ra-label{font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;margin-top:10px}
  .ra-label:first-child{margin-top:0}
  .ra-tb{flex:1;padding:6px 3px;font-size:11px;border:0.5px solid rgba(255,255,255,0.1);border-radius:5px;background:transparent;color:rgba(255,255,255,0.4);cursor:pointer;font-family:inherit;transition:all 0.15s}
  .ra-tb.car.on{background:rgba(74,170,106,0.15);border-color:rgba(74,170,106,0.4);color:#4aaa6a}
  .ra-tb.walk.on{background:rgba(180,130,70,0.15);border-color:rgba(180,130,70,0.4);color:#c4935a}
  .ra-tb.transit.on{background:rgba(80,140,220,0.15);border-color:rgba(80,140,220,0.4);color:#7aacee}
  .ra-tb.road.on{background:rgba(255,220,80,0.1);border-color:rgba(255,220,80,0.35);color:#ffd84a}
  .ra-tb.boat.on{background:rgba(50,130,200,0.15);border-color:rgba(50,130,200,0.4);color:#5a9fd4}
  .ra-tb.plane.on{background:rgba(160,100,220,0.15);border-color:rgba(160,100,220,0.4);color:#b07add}
  .ra-sel{width:100%;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.12);border-radius:5px;color:#fff;font-size:11px;padding:6px 8px;cursor:pointer;outline:none;font-family:inherit;margin-bottom:5px}
  .ra-sel option{background:#0a1628}
  .ra-hint{font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5;padding:7px 8px;background:rgba(255,255,255,0.03);border-radius:5px}
  .ra-hint b{color:rgba(255,255,255,0.7)}
  .ra-btns{display:flex;gap:6px;margin-top:8px}
  .ra-btn{flex:1;padding:7px;font-size:11px;border:0.5px solid rgba(255,255,255,0.1);border-radius:5px;background:transparent;color:rgba(255,255,255,0.4);cursor:pointer;font-family:inherit;transition:all 0.15s}
  .ra-btn.ok{border-color:rgba(74,170,106,0.4);color:#4aaa6a}
  .ra-btn.del{border-color:rgba(255,80,80,0.4);color:#ff8080}
  .ra-status{font-size:11px;padding:4px 0;min-height:16px;color:rgba(255,255,255,0.35)}
  .ra-status.ok{color:#4aaa6a}
  .ra-status.warn{color:#f5a623}
  #ra-saved{list-style:none;font-size:10px;max-height:120px;overflow-y:auto;margin-top:4px}
  #ra-saved li{padding:4px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);display:flex;justify-content:space-between;align-items:center;gap:6px}
  #ra-saved li:last-child{border:none}
  #ra-saved li b{color:rgba(255,255,255,0.85);font-weight:500}
  .ra-del-btn{font-size:9px;color:rgba(255,80,80,0.5);cursor:pointer;padding:1px 5px;border:0.5px solid rgba(255,80,80,0.2);border-radius:3px;background:none;flex-shrink:0}
  #ra-missing{list-style:none;font-size:10px;max-height:140px;overflow-y:auto;margin-top:4px}
  #ra-missing li{padding:4px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:6px;cursor:pointer;color:rgba(255,255,255,0.35)}
  #ra-missing li:hover{color:rgba(255,255,255,0.7)}
  #ra-missing li:last-child{border:none}
  .ra-miss-dot{width:5px;height:5px;border-radius:50%;background:rgba(255,80,80,0.6);flex-shrink:0}
  .ra-load{font-size:9px;color:rgba(80,140,220,0.7);padding:1px 5px;border:0.5px solid rgba(80,140,220,0.3);border-radius:3px;white-space:nowrap;margin-left:auto}
  .ra-prog-bar{height:3px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:6px;overflow:hidden}
  .ra-prog-fill{height:100%;background:#4aaa6a;border-radius:2px;transition:width 0.3s}
  .ra-prog-lbl{font-size:10px;color:rgba(255,255,255,0.3);display:flex;justify-content:space-between;margin-bottom:3px}
  .ra-export-box{font-size:10px;color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.04);border-radius:5px;padding:8px;font-family:monospace;word-break:break-all;max-height:180px;overflow-y:auto;margin-top:6px}
  </style>
  <div id="ra-wrap">
    <div id="ra-left">
      <div id="ra-mapbox">
        <svg id="ra-mapsvg" viewBox="0 0 560 315" xmlns="http://www.w3.org/2000/svg" style="pointer-events:none">
          <rect width="560" height="315" fill="#1a2535"/>
          <g id="ra-ghost-g" style="pointer-events:none;opacity:0.35"></g>
          <g id="ra-dots-g" style="pointer-events:all"></g>
          <g id="ra-lines-g"></g>
          <g id="ra-wp-g" style="pointer-events:all"></g>
        </svg>
      </div>
    </div>
    <div id="ra-right">
    <div class="ra-label">Transportmodus</div>
    <div class="ra-row">
      <button class="ra-tb car on" id="ra-tm-car" onclick="raTM('car')">Auto</button>
      <button class="ra-tb walk" id="ra-tm-walk" onclick="raTM('walk')">Fuss</button>
      <button class="ra-tb transit" id="ra-tm-transit" onclick="raTM('transit')">ÖV</button>
    </div>
    <div class="ra-label">Abschnittstyp</div>
    <div class="ra-row">
      <button class="ra-tb road on" id="ra-st-road" onclick="raST('road')">Strasse</button>
      <button class="ra-tb boat" id="ra-st-boat" onclick="raST('boat')">Boot</button>
      <button class="ra-tb plane" id="ra-st-plane" onclick="raST('plane')">Flug</button>
    </div>
    <div class="ra-label">Route</div>
    <select class="ra-sel" id="ra-from"><option value="">Start...</option></select>
    <select class="ra-sel" id="ra-to"><option value="">Ziel...</option></select>
    <div class="ra-hint" id="ra-hint">Welt anklicken = <b>Start</b> setzen</div>
    <div class="ra-btns">
      <button class="ra-btn del" onclick="raClear()">Leeren</button>
      <button class="ra-btn ok" onclick="raSave()">Speichern</button>
    </div>
    <div class="ra-status" id="ra-status"></div>
    <div class="ra-label">Gespeicherte Routen</div>
    <ul id="ra-saved"></ul>
    <div class="ra-label">Netzanalyse</div>
    <div class="ra-btns">
      <button class="ra-btn ok" onclick="raAnalyzeNet()">Netz analysieren</button>
    </div>
    <div id="ra-analysis" style="display:none;margin-top:6px"></div>
    <div class="ra-label">Fehlende Welten</div>
    <div class="ra-prog-lbl"><span id="ra-prog-txt">0 von ${worlds.length}</span><span id="ra-prog-pct" style="color:rgba(255,255,255,0.7);font-weight:500">0%</span></div>
    <div class="ra-prog-bar"><div class="ra-prog-fill" id="ra-prog-fill" style="width:0%"></div></div>
    <ul id="ra-missing"></ul>
    <div class="ra-label">Export / Import</div>
    <div class="ra-btns">
      <button class="ra-btn ok" onclick="raCopyExport()">JSON kopieren</button>
      <button class="ra-btn ok" onclick="raImportPrompt()">JSON importieren</button>
    </div>
    <div class="ra-btns" style="margin-top:5px">
      <button class="ra-btn del" onclick="raClearAll()">Alle löschen</button>
    </div>
    <div class="ra-export-box" id="ra-export-box">Noch keine Routen gespeichert.</div>
    </div>
  </div>`;

  const SVG_W=560,SVG_H=315;
  const sx=v=>v/100*SVG_W, sy=v=>v/100*SVG_H;
  const rv=v=>Math.round(v*10)/10;

  const mapbox=document.getElementById('ra-mapbox');
  const dotsG=document.getElementById('ra-dots-g');
  const linesG=document.getElementById('ra-lines-g');
  const wpG=document.getElementById('ra-wp-g');
  const ghostG=document.getElementById('ra-ghost-g');

  // Ghost-Routen: alle bereits gespeicherten Routen für aktuellen Transportmodus hell einblenden
  function drawGhostRoutes(){
    ghostG.innerHTML='';
    const SEG_GHOST={
      road:'rgba(255,220,80,0.9)',
      boat:'rgba(80,170,240,0.9)',
      plane:'rgba(200,140,255,0.9)'
    };
    Object.values(customRoutes).filter(r=>r.transport===transport).forEach(r=>{
      // Punkte der Route: Start-Welt + Wegpunkte + End-Welt
      const startW=worlds.find(w=>w.name===r.from);
      const endW=worlds.find(w=>w.name===r.to);
      if(!startW||!endW) return;
      const allPts=[
        {x:sx(startW.x),y:sy(startW.y),segType:'road'},
        ...(r.points||[]).map(p=>({x:sx(p.x),y:sy(p.y),segType:p.segType||'road'})),
        {x:sx(endW.x),y:sy(endW.y),segType:'road'}
      ];
      // Segmente zeichnen
      for(let i=0;i<allPts.length-1;i++){
        const a=allPts[i],b=allPts[i+1];
        const st=b.segType||a.segType||'road';
        const col=SEG_GHOST[st]||SEG_GHOST.road;
        const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
        ln.setAttribute('x1',a.x);ln.setAttribute('y1',a.y);
        ln.setAttribute('x2',b.x);ln.setAttribute('y2',b.y);
        ln.setAttribute('stroke',col);ln.setAttribute('stroke-width','1.2');
        ln.setAttribute('stroke-dasharray','2 2');ln.setAttribute('stroke-linecap','round');
        ghostG.appendChild(ln);
      }
    });
  }

  // Welten-Dots aufbauen
  worlds.forEach(w=>{
    const selF=document.getElementById('ra-from');
    const selT=document.getElementById('ra-to');
    [selF,selT].forEach(s=>{const o=document.createElement('option');o.value=w.name;o.textContent=w.name;s.appendChild(o);});
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.style.cursor='pointer';
    g.addEventListener('click',e=>{e.stopPropagation();raWorldClick(w);});
    const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx',sx(w.x));c.setAttribute('cy',sy(w.y));c.setAttribute('r','5');
    c.setAttribute('fill','#3a6a5a');c.setAttribute('stroke','#7abf9a');c.setAttribute('stroke-width','1');
    c.id='ra-dot-'+w.name.replace(/[\s.]/g,'_');
    const t=document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',sx(w.x)+7);t.setAttribute('y',sy(w.y)+3);
    t.setAttribute('font-size','7');t.setAttribute('fill','#7ab4a0');
    t.textContent=w.name;
    g.appendChild(c);g.appendChild(t);dotsG.appendChild(g);
  });

  document.getElementById('ra-from').onchange=function(){const w=worlds.find(x=>x.name===this.value);if(w){fromW=w;raRedraw();}};
  document.getElementById('ra-to').onchange=function(){const w=worlds.find(x=>x.name===this.value);if(w){toW=w;raRedraw();}};

  // SVG-native Koordinatenumrechnung — funktioniert unabhängig von Layout, Padding, Zoom
  function getCoords(e){
    const svgEl=document.getElementById('ra-mapsvg');
    const pt=svgEl.createSVGPoint();
    pt.x=e.clientX; pt.y=e.clientY;
    const svgPt=pt.matrixTransform(svgEl.getScreenCTM().inverse());
    return{x:rv(svgPt.x/SVG_W*100), y:rv(svgPt.y/SVG_H*100)};
  }

  // Klick auf leere Karte = freier Wegpunkt
  mapbox.addEventListener('click',function(e){
    if(e.target.closest('g')) return;
    const{x,y}=getCoords(e);
    points.push({x,y,segType,isWorld:false});
    raRedraw();raStatus('Wegpunkt ('+segType+') gesetzt');
  });

  function raWorldClick(w){
    if(!fromW){
      fromW=w;document.getElementById('ra-from').value=w.name;
      raDotColor(w,'#f5a623');raStatus('Start: '+w.name);
    } else if(!toW&&w.name!==fromW.name){
      toW=w;document.getElementById('ra-to').value=w.name;
      raDotColor(w,'#4aaa6a');raStatus('Ziel: '+w.name);
    } else if(w.name!==fromW?.name&&w.name!==toW?.name){
      points.push({x:w.x,y:w.y,segType,isWorld:true,worldName:w.name});
      raDotColor(w,'rgba(200,200,200,0.45)');
      raStatus('Durchfahrt: '+w.name);
    }
    raRedraw();
  }

  function raDotColor(w,col){
    const c=document.getElementById('ra-dot-'+w.name.replace(/[\s.]/g,'_'));
    if(c) c.setAttribute('fill',col);
  }

  function catmullPath(pts){
    if(pts.length<2) return null;
    if(pts.length===2) return`M${rv(pts[0].x)} ${rv(pts[0].y)} L${rv(pts[1].x)} ${rv(pts[1].y)}`;
    let d=`M${rv(pts[0].x)} ${rv(pts[0].y)}`;
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[Math.max(i-1,0)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(i+2,pts.length-1)];
      const c1x=p1.x+(p2.x-p0.x)/6,c1y=p1.y+(p2.y-p0.y)/6;
      const c2x=p2.x-(p3.x-p1.x)/6,c2y=p2.y-(p3.y-p1.y)/6;
      d+=` C${rv(c1x)} ${rv(c1y)},${rv(c2x)} ${rv(c2y)},${rv(p2.x)} ${rv(p2.y)}`;
    }
    return d;
  }

  function raRedraw(){
    wpG.innerHTML='';linesG.innerHTML='';
    drawGhostRoutes();
    const all=[];
    if(fromW) all.push({x:fromW.x,y:fromW.y,segType:'road',isWorld:true,worldName:fromW.name});
    points.forEach(p=>all.push(p));
    if(toW) all.push({x:toW.x,y:toW.y,segType:'road',isWorld:true,worldName:toW.name});
    if(all.length<2){raUpdateHint();return;}

    // Segmente nach Type gruppieren und Bezier zeichnen
    const svgPts=all.map(p=>({x:sx(p.x),y:sy(p.y),segType:p.segType}));
    let i=0;
    while(i<svgPts.length-1){
      const ct=svgPts[i+1].segType||svgPts[i].segType||'road';
      const seg=[svgPts[i]];
      let j=i+1;
      while(j<svgPts.length&&(svgPts[j].segType||ct)===ct){seg.push(svgPts[j]);j++;}
      const path=catmullPath(seg);
      if(path){
        const sc=SEG[ct]||SEG.road;
        ['shadow','main'].forEach(layer=>{
          const el=document.createElementNS('http://www.w3.org/2000/svg','path');
          el.setAttribute('d',path);el.setAttribute('fill','none');
          if(layer==='shadow'){el.setAttribute('stroke',sc.shadow);el.setAttribute('stroke-width','3');el.setAttribute('stroke-linecap','round');el.setAttribute('stroke-linejoin','round');}
          else{el.setAttribute('stroke',sc.stroke);el.setAttribute('stroke-width','1.5');el.setAttribute('stroke-dasharray',sc.dash);el.setAttribute('stroke-linecap','round');el.setAttribute('stroke-linejoin','round');}
          linesG.appendChild(el);
        });
      }
      i=j-1;
    }

    // Wegpunkt-Dots
    points.forEach((wp,i)=>{
      const sc=SEG[wp.segType]||SEG.road;
      const cx=sx(wp.x),cy=sy(wp.y);
      const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r',wp.isWorld?'5':'3');
      c.setAttribute('fill',wp.isWorld?'rgba(200,200,200,0.35)':sc.stroke.replace('0.92','1'));
      c.setAttribute('stroke','rgba(0,0,0,0.4)');c.setAttribute('stroke-width','0.8');
      c.style.cursor='pointer';c.style.pointerEvents='all';
      c.addEventListener('click',e=>{e.stopPropagation();points.splice(i,1);raRedraw();raStatus('Entfernt');});
      wpG.appendChild(c);
      if(wp.worldName){
        const t=document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x',cx+6);t.setAttribute('y',cy-5);
        t.setAttribute('font-size','6.5');t.setAttribute('fill','rgba(200,200,200,0.45)');
        t.textContent='('+wp.worldName.split(' ')[0]+')';
        wpG.appendChild(t);
      }
    });
    raUpdateHint();
  }

  window.raTM=function(t){transport=t;['car','walk','transit'].forEach(x=>document.getElementById('ra-tm-'+x).className='ra-tb '+x+(t===x?' on':''));drawGhostRoutes();};
  window.raST=function(t){segType=t;['road','boat','plane'].forEach(x=>document.getElementById('ra-st-'+x).className='ra-tb '+x+(t===x?' on':''));};

  window.raClear=function(){
    fromW=null;toW=null;points=[];
    document.getElementById('ra-from').value='';document.getElementById('ra-to').value='';
    worlds.forEach(w=>raDotColor(w,'#3a6a5a'));
    raRedraw();raStatus('Geleert');
  };

  window.raSave=function(){
    if(!fromW||!toW){raStatus('Start und Ziel setzen','warn');return;}
    if(fromW.name===toW.name){raStatus('Start und Ziel sind identisch','warn');return;}

    // Ankerpunkte: Start + alle Durchfahrt-Welten + Ziel
    const anchors=[
      {worldName:fromW.name,x:fromW.x,y:fromW.y},
      ...points.filter(p=>p.isWorld).map(p=>({worldName:p.worldName,x:p.x,y:p.y})),
      {worldName:toW.name,x:toW.x,y:toW.y}
    ];

    // Wegpunkte zwischen zwei Ankern (nach Index in points[])
    function wpsBetween(aName,bName){
      const worldIdxs=points.map((p,i)=>p.isWorld?{worldName:p.worldName,i}:null).filter(Boolean);
      const idxA=aName===fromW.name?-1:(worldIdxs.find(w=>w.worldName===aName)?.i??-1);
      const idxB=bName===toW.name?points.length:(worldIdxs.find(w=>w.worldName===bName)?.i??points.length);
      return points.filter((p,i)=>!p.isWorld&&i>idxA&&i<idxB);
    }

    let cnt=0;
    for(let i=0;i<anchors.length-1;i++){
      const a=anchors[i],b=anchors[i+1];
      const wps=wpsBetween(a.worldName,b.worldName);
      const transits=points.filter(p=>{
        if(!p.isWorld) return false;
        const pi=points.indexOf(p);
        const aIdx=a.worldName===fromW.name?-1:points.findIndex(p2=>p2.isWorld&&p2.worldName===a.worldName);
        const bIdx=b.worldName===toW.name?points.length:points.findIndex(p2=>p2.isWorld&&p2.worldName===b.worldName);
        return pi>aIdx&&pi<bIdx;
      }).map(p=>p.worldName);

      // Vorwärts
      customRoutes[a.worldName+'|'+b.worldName+'|'+transport]={from:a.worldName,to:b.worldName,transport,points:wps,transits};
      // Rückwärts
      customRoutes[b.worldName+'|'+a.worldName+'|'+transport]={from:b.worldName,to:a.worldName,transport,points:[...wps].reverse(),transits:[...transits].reverse()};
      cnt+=2;
    }
    saveRoutes(customRoutes);
    // Globale Variable für Navi-System aktualisieren
    if(window.atlasCustomRoutes!==undefined) window.atlasCustomRoutes=customRoutes;
    raUpdateSavedList();raUpdateMissing();raUpdateExport();drawGhostRoutes();
    raStatus(cnt+' Routen gespeichert','ok');
  };

  function raUpdateSavedList(){
    const ul=document.getElementById('ra-saved');if(!ul)return;
    ul.innerHTML='';
    const keys=Object.keys(customRoutes);
    if(!keys.length){ul.innerHTML='<li style="color:rgba(255,255,255,0.25);padding:3px 0">Noch keine</li>';return;}
    keys.slice(-10).reverse().forEach(k=>{
      const r=customRoutes[k];
      const li=document.createElement('li');
      const hasBoat=r.points.some(p=>p.segType==='boat');
      const hasPlane=r.points.some(p=>p.segType==='plane');
      let txt='<b>'+r.from.split(' ')[0]+' → '+r.to.split(' ')[0]+'</b> <span>('+r.transport+')</span>';
      if(hasBoat) txt+=' <span style="color:#5a9fd4">Boot</span>';
      if(hasPlane) txt+=' <span style="color:#b07add">Flug</span>';
      li.innerHTML=txt;
      // Edit-Button
      const edit=document.createElement('button');
      edit.className='ra-del-btn';
      edit.textContent='✎';
      edit.style.cssText='color:rgba(100,180,255,0.6);border-color:rgba(100,180,255,0.25);margin-right:3px';
      edit.title='Route bearbeiten';
      edit.onclick=()=>loadRouteIntoEditor(k);
      // Löschen-Button
      const del=document.createElement('button');
      del.className='ra-del-btn';del.textContent='✕';
      del.onclick=()=>{delete customRoutes[k];saveRoutes(customRoutes);if(window.atlasCustomRoutes!==undefined)window.atlasCustomRoutes=customRoutes;raUpdateSavedList();raUpdateMissing();raUpdateExport();drawGhostRoutes();};
      li.appendChild(edit);li.appendChild(del);ul.appendChild(li);
    });
  }

  function loadRouteIntoEditor(key){
    const r=customRoutes[key];
    if(!r) return;
    // Transport setzen
    transport=r.transport||'car';
    ['car','walk','transit'].forEach(x=>document.getElementById('ra-tm-'+x).className='ra-tb '+x+(transport===x?' on':''));
    // Dropdowns setzen
    fromW=worlds.find(w=>w.name===r.from)||null;
    toW=worlds.find(w=>w.name===r.to)||null;
    if(document.getElementById('ra-from')) document.getElementById('ra-from').value=r.from;
    if(document.getElementById('ra-to')) document.getElementById('ra-to').value=r.to;
    // Dots hervorheben
    worlds.forEach(w=>raDotColor(w,'#3a6a5a'));
    if(fromW) raDotColor(fromW,'#f5a623');
    if(toW) raDotColor(toW,'#4aaa6a');
    // Waypoints laden
    points=r.points.map(p=>({...p}));
    // Durchfahrt-Dots hervorheben
    points.filter(p=>p.isWorld).forEach(p=>{
      const w=worlds.find(x=>x.name===p.worldName);
      if(w) raDotColor(w,'rgba(200,200,200,0.45)');
    });
    raRedraw();
    raStatus('Bearbeite: '+r.from+' → '+r.to,'ok');
    // Nach oben scrollen
    document.getElementById('ra-from')?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  const IGNORED_KEY='atlas_routes_ignored';
  let ignoredWorlds=new Set(JSON.parse(localStorage.getItem(IGNORED_KEY)||'[]'));

  function raUpdateMissing(){
    const covered=new Set();
    Object.values(customRoutes).forEach(r=>{
      covered.add(r.from);covered.add(r.to);
      r.transits?.forEach(t=>covered.add(t));
    });
    const missing=worlds.filter(w=>!covered.has(w.name)&&!ignoredWorlds.has(w.name));
    const ignored=worlds.filter(w=>!covered.has(w.name)&&ignoredWorlds.has(w.name));
    const total=worlds.filter(w=>!covered.has(w.name)).length;
    const pct=Math.round((worlds.length-worlds.filter(w=>!covered.has(w.name)).length)/worlds.length*100);
    const pt=document.getElementById('ra-prog-txt');
    const pp=document.getElementById('ra-prog-pct');
    const pf=document.getElementById('ra-prog-fill');
    if(pt) pt.textContent=(worlds.length-worlds.filter(w=>!covered.has(w.name)).length)+' von '+worlds.length+' Welten';
    if(pp) pp.textContent=pct+'%';
    if(pf) pf.style.width=pct+'%';
    const ul=document.getElementById('ra-missing');if(!ul)return;
    ul.innerHTML='';
    if(!missing.length&&!ignored.length){ul.innerHTML='<li style="color:#4aaa6a;padding:4px 0;font-size:10px">Alle Welten abgedeckt ✓</li>';return;}
    missing.forEach(w=>{
      const li=document.createElement('li');
      li.innerHTML='<div class="ra-miss-dot"></div><span style="flex:1">'+w.name+'</span><span class="ra-load" style="margin-right:4px">als Start</span><span class="ra-load" style="background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);cursor:pointer" onclick="raIgnoreWorld(\''+w.name.replace(/'/g,"\\'")+'\')" title="Aus Liste ausblenden">✕</span>';
      li.querySelector('.ra-load').addEventListener('click',()=>{
        raClear();fromW=w;document.getElementById('ra-from').value=w.name;
        raDotColor(w,'#f5a623');raStatus('Start: '+w.name);raUpdateHint();
      });
      ul.appendChild(li);
    });
    if(ignored.length){
      const div=document.createElement('li');
      div.style.cssText='color:rgba(255,255,255,0.2);font-size:9px;padding-top:6px;cursor:default;border:none;display:block';
      div.textContent='Ignoriert ('+ignored.length+'): '+ignored.map(w=>w.name).join(', ');
      const reset=document.createElement('span');
      reset.textContent=' · zurücksetzen';reset.style.cssText='color:rgba(80,140,220,0.5);cursor:pointer';
      reset.onclick=()=>{ignoredWorlds.clear();localStorage.setItem(IGNORED_KEY,'[]');raUpdateMissing();};
      div.appendChild(reset);ul.appendChild(div);
    }
  }

  window.raIgnoreWorld=function(name){
    ignoredWorlds.add(name);
    localStorage.setItem(IGNORED_KEY,JSON.stringify([...ignoredWorlds]));
    raUpdateMissing();
  };

  function raUpdateExport(){
    const box=document.getElementById('ra-export-box');if(!box)return;
    // Self-Routen rausfiltern (from === to)
    const clean=Object.fromEntries(Object.entries(customRoutes).filter(([k,r])=>r.from!==r.to));
    box.textContent=Object.keys(clean).length?JSON.stringify(clean,null,2):'Noch keine Routen.';
  }

  window.raAnalyzeNet=function(){
    const box=document.getElementById('ra-analysis');
    if(!box) return;
    box.style.display='block';
    box.innerHTML='<div style="font-size:10px;color:rgba(255,255,255,0.3)">Analysiere...</div>';

    // Graph aus customRoutes aufbauen — Knoten = Weltnamen, Kanten = gespeicherte Routen
    const graph={};
    worlds.forEach(w=>{graph[w.name]=[];});

    Object.values(customRoutes).filter(r=>r.from!==r.to).forEach(r=>{
      if(!graph[r.from]) graph[r.from]=[];
      // Kantengewicht = echte Pfadlänge in % der Kartengrösse
      const fromW=worlds.find(w=>w.name===r.from);
      const toW=worlds.find(w=>w.name===r.to);
      if(!fromW||!toW) return;
      let dist=0;
      const allPts=[{x:fromW.x,y:fromW.y},...(r.points||[]),{x:toW.x,y:toW.y}];
      for(let i=0;i<allPts.length-1;i++){
        const a=allPts[i],b=allPts[i+1];
        dist+=Math.sqrt(Math.pow(a.x-b.x,2)+Math.pow(a.y-b.y,2));
      }
      graph[r.from].push({to:r.to,dist,segTypes:[...(new Set(r.points.map(p=>p.segType||'road')))]});
    });

    // Dijkstra von einer Quelle
    function dijkstra(start){
      const dist={};const prev={};const visited=new Set();
      worlds.forEach(w=>{dist[w.name]=Infinity;});
      dist[start]=0;
      const queue=new Set(worlds.map(w=>w.name));
      while(queue.size){
        // Nächster unbesuchter mit kleinstem Abstand
        let u=null;
        queue.forEach(n=>{if(u===null||dist[n]<dist[u])u=n;});
        if(dist[u]===Infinity) break;
        queue.delete(u);
        (graph[u]||[]).forEach(edge=>{
          const alt=dist[u]+edge.dist;
          if(alt<dist[edge.to]){dist[edge.to]=alt;prev[edge.to]=u;}
        });
      }
      return{dist,prev};
    }

    // Luftlinie zwischen zwei Welten
    function airDist(a,b){
      return Math.sqrt(Math.pow(a.x-b.x,2)+Math.pow(a.y-b.y,2));
    }

    // Für alle Weltenpaare Umweg-Faktor berechnen
    const issues=[];
    const isolated=[];

    worlds.forEach(w=>{
      const {dist,prev}=dijkstra(w.name);
      worlds.forEach(t=>{
        if(t.name===w.name) return;
        if(dist[t.name]===Infinity){
          // Nur einmal pro Paar
          if(w.name<t.name) isolated.push(w.name+' ↔ '+t.name);
          return;
        }
        const ww=worlds.find(x=>x.name===w.name);
        const tw=worlds.find(x=>x.name===t.name);
        const air=airDist(ww,tw);
        if(air<3) return; // Sehr nah beieinander ignorieren
        const factor=dist[t.name]/Math.max(air,1);
        if(factor>2.8&&w.name<t.name){
          // Pfad rekonstruieren
          const path=[];let cur=t.name;
          while(cur){path.unshift(cur);cur=prev[cur];}
          issues.push({from:w.name,to:t.name,factor:Math.round(factor*10)/10,hops:path.length-1,path});
        }
      });
    });

    issues.sort((a,b)=>b.factor-a.factor);

    // Ergebnis anzeigen
    let html='<div style="font-size:10px;line-height:1.7">';

    if(isolated.length){
      html+='<div style="color:#ff8080;font-weight:500;margin-bottom:6px">⚠ Nicht verbunden ('+isolated.length+'):</div>';
      isolated.slice(0,5).forEach(p=>{
        html+='<div style="color:rgba(255,120,120,0.7);padding:2px 0;border-bottom:0.5px solid rgba(255,255,255,0.05)">'+p+'</div>';
      });
      if(isolated.length>5) html+='<div style="color:rgba(255,255,255,0.2)">...und '+(isolated.length-5)+' weitere</div>';
      html+='<div style="height:8px"></div>';
    } else {
      html+='<div style="color:#4aaa6a;margin-bottom:6px">✓ Alle Welten verbunden</div>';
    }

    if(issues.length){
      // Häufigste Zwischen-Welt in Umwegen = Hotspot
      const hotspot={};
      issues.forEach(issue=>issue.path.slice(1,-1).forEach(n=>{hotspot[n]=(hotspot[n]||0)+1;}));
      const topHotspot=Object.entries(hotspot).sort((a,b)=>b[1]-a[1])[0];

      html+='<div style="padding:5px 8px;background:rgba(245,166,35,0.08);border-radius:5px;margin-bottom:8px;font-size:10px">';
      html+='<span style="color:#f5a623;font-weight:500">Tipp:</span> ';
      if(topHotspot) html+='Viele Umwege führen über <b style="color:rgba(255,255,255,0.7)">'+topHotspot[0]+'</b> ('+topHotspot[1]+'×). ';
      html+='Direkte Routen von/zu dieser Welt würden am meisten bringen.</div>';

      html+='<div style="color:#f5a623;font-weight:500;margin-bottom:4px">Top Umwege — direkte Route empfohlen:</div>';
      issues.slice(0,8).forEach(issue=>{
        const saving=Math.round((1-1/issue.factor)*100);
        html+='<div style="padding:4px 0;border-bottom:0.5px solid rgba(255,255,255,0.05)">';
        html+='<div><span style="color:rgba(255,255,255,0.8);font-weight:500">'+issue.from.split(' ')[0]+' → '+issue.to.split(' ')[0]+'</span>';
        html+=' <span style="color:#f5a623">'+issue.factor+'× Umweg</span></div>';
        html+='<div style="color:rgba(255,255,255,0.25);font-size:9px">aktuell via: '+issue.path.slice(1,-1).map(n=>n.split(' ')[0]).join(' → ')+'</div>';
        html+='<div style="color:#4aaa6a;font-size:9px">→ Direkte Route würde ~'+saving+'% Zeit sparen</div>';
        html+='</div>';
      });
      if(issues.length>8) html+='<div style="color:rgba(255,255,255,0.2);margin-top:3px">...und '+(issues.length-8)+' weitere</div>';
    } else {
      html+='<div style="color:#4aaa6a">✓ Keine grossen Umwege gefunden</div>';
    }

    html+='</div>';
    box.innerHTML=html;
  };

  window.raCopyExport=function(){
    const clean=Object.fromEntries(Object.entries(customRoutes).filter(([k,r])=>r.from!==r.to));
    navigator.clipboard.writeText(JSON.stringify(clean,null,2));
    raStatus('JSON kopiert ✓','ok');
  };

  window.raImportPrompt=function(){
    const txt=prompt('JSON einfügen:');
    if(!txt) return;
    try{
      const parsed=JSON.parse(txt);
      // Selbst-Routen rausfiltern
      const clean=Object.fromEntries(Object.entries(parsed).filter(([k,r])=>r.from!==r.to));
      customRoutes=clean;
      saveRoutes(customRoutes);
      if(window.atlasCustomRoutes!==undefined) window.atlasCustomRoutes=customRoutes;
      raUpdateSavedList();raUpdateMissing();raUpdateExport();drawGhostRoutes();
      raStatus(Object.keys(clean).length+' Routen importiert','ok');
    }catch(e){raStatus('Ungültiges JSON','warn');}
  };

  window.raClearAll=function(){
    if(!confirm('Alle gespeicherten Routen löschen?')) return;
    customRoutes={};saveRoutes(customRoutes);
    if(window.atlasCustomRoutes!==undefined) window.atlasCustomRoutes=customRoutes;
    raUpdateSavedList();raUpdateMissing();raUpdateExport();drawGhostRoutes();
    raStatus('Alle Routen gelöscht','warn');
  };

  function raStatus(msg,type){
    const el=document.getElementById('ra-status');if(!el)return;
    el.textContent=msg;el.className='ra-status'+(type?' '+type:'');
  }
  function raUpdateHint(){
    const h=document.getElementById('ra-hint');if(!h)return;
    if(!fromW) h.innerHTML='Welt anklicken = <b>Start</b> setzen';
    else if(!toW) h.innerHTML='<b>'+fromW.name+'</b>. Zweite Welt = Ziel.';
    else h.innerHTML='Karte = freier Wegpunkt ('+segType+'). Welt = Durchfahrt. Punkt klicken = löschen.';
  }

  // Karte mit Weltbild befüllen (gleiche Map-URL wie Hauptkarte)
  const mapImg=document.querySelector('#map-bg img');
  if(mapImg){
    const bg=document.createElementNS('http://www.w3.org/2000/svg','image');
    bg.setAttribute('href',mapImg.src);
    bg.setAttribute('x','0');bg.setAttribute('y','0');
    bg.setAttribute('width','560');bg.setAttribute('height','315');
    bg.setAttribute('preserveAspectRatio','xMidYMid slice');
    document.getElementById('ra-mapsvg').insertBefore(bg,ghostG);
  }

  // Bestehende Routen laden
  raUpdateSavedList();raUpdateMissing();raUpdateExport();drawGhostRoutes();
}

// Globale Variable für Navi-System — wird beim Laden gesetzt
window.ATLAS_ROUTES={"Nordhaven|Henford-on-Bagley|car":{"from":"Nordhaven","to":"Henford-on-Bagley","transport":"car","points":[{"x":12.7,"y":26.7,"segType":"road"},{"x":13.2,"y":28,"segType":"boat"},{"x":14,"y":29.7,"segType":"road"},{"x":14.8,"y":30.5,"segType":"road"},{"x":15.9,"y":31.6,"segType":"road"},{"x":17,"y":31.7,"segType":"road"},{"x":17.9,"y":31.7,"segType":"road"},{"x":19.3,"y":31.6,"segType":"road"},{"x":20.2,"y":30.9,"segType":"road"},{"x":21.2,"y":30.4,"segType":"road"},{"x":22.2,"y":29.6,"segType":"road"},{"x":25.2,"y":26.9,"segType":"road"},{"x":26.1,"y":26.4,"segType":"road"},{"x":27.1,"y":25.6,"segType":"road"},{"x":28,"y":25.2,"segType":"road"},{"x":28.7,"y":25.3,"segType":"road"}],"transits":[]},"Henford-on-Bagley|Nordhaven|car":{"from":"Henford-on-Bagley","to":"Nordhaven","transport":"car","points":[{"x":28.7,"y":25.3,"segType":"road"},{"x":28,"y":25.2,"segType":"road"},{"x":27.1,"y":25.6,"segType":"road"},{"x":26.1,"y":26.4,"segType":"road"},{"x":25.2,"y":26.9,"segType":"road"},{"x":22.2,"y":29.6,"segType":"road"},{"x":21.2,"y":30.4,"segType":"road"},{"x":20.2,"y":30.9,"segType":"road"},{"x":19.3,"y":31.6,"segType":"road"},{"x":17.9,"y":31.7,"segType":"road"},{"x":17,"y":31.7,"segType":"road"},{"x":15.9,"y":31.6,"segType":"road"},{"x":14.8,"y":30.5,"segType":"road"},{"x":14,"y":29.7,"segType":"road"},{"x":13.2,"y":28,"segType":"boat"},{"x":12.7,"y":26.7,"segType":"road"}],"transits":[]},"Henford-on-Bagley|Britechester|car":{"from":"Henford-on-Bagley","to":"Britechester","transport":"car","points":[{"x":31.5,"y":30.8,"segType":"road"},{"x":32.5,"y":31.6,"segType":"road"},{"x":33.6,"y":31.9,"segType":"road"},{"x":34.5,"y":32.4,"segType":"road"},{"x":35.9,"y":32.9,"segType":"road"},{"x":36.9,"y":33.1,"segType":"road"},{"x":37.8,"y":33.9,"segType":"road"}],"transits":[]},"Britechester|Henford-on-Bagley|car":{"from":"Britechester","to":"Henford-on-Bagley","transport":"car","points":[{"x":37.8,"y":33.9,"segType":"road"},{"x":36.9,"y":33.1,"segType":"road"},{"x":35.9,"y":32.9,"segType":"road"},{"x":34.5,"y":32.4,"segType":"road"},{"x":33.6,"y":31.9,"segType":"road"},{"x":32.5,"y":31.6,"segType":"road"},{"x":31.5,"y":30.8,"segType":"road"}],"transits":[]},"Britechester|Ondarion|car":{"from":"Britechester","to":"Ondarion","transport":"car","points":[{"x":38.3,"y":39.5,"segType":"road"},{"x":38.8,"y":41.3,"segType":"road"},{"x":39.6,"y":42.8,"segType":"road"},{"x":40.2,"y":44.2,"segType":"road"},{"x":40.6,"y":46.6,"segType":"road"}],"transits":[]},"Ondarion|Britechester|car":{"from":"Ondarion","to":"Britechester","transport":"car","points":[{"x":40.6,"y":46.6,"segType":"road"},{"x":40.2,"y":44.2,"segType":"road"},{"x":39.6,"y":42.8,"segType":"road"},{"x":38.8,"y":41.3,"segType":"road"},{"x":38.3,"y":39.5,"segType":"road"}],"transits":[]},"Ondarion|Del Sol Valley|car":{"from":"Ondarion","to":"Del Sol Valley","transport":"car","points":[{"x":41.6,"y":51.3,"segType":"road"},{"x":42.2,"y":52.6,"segType":"road"},{"x":43,"y":54.5,"segType":"road"},{"x":43.7,"y":56.6,"segType":"road"},{"x":44.4,"y":60.3,"segType":"road"},{"x":35.6,"y":59.2,"segType":"road"},{"x":33.5,"y":60,"segType":"road"},{"x":32.1,"y":60,"segType":"road"},{"x":30.7,"y":60,"segType":"road"},{"x":29,"y":59.7,"segType":"road"},{"x":27.6,"y":59.7,"segType":"road"},{"x":26.1,"y":60.2,"segType":"road"},{"x":25.3,"y":61.3,"segType":"road"},{"x":24.2,"y":62.2,"segType":"road"},{"x":23,"y":62.9,"segType":"road"},{"x":21.6,"y":63.6,"segType":"road"},{"x":20.2,"y":63.7,"segType":"road"},{"x":19.1,"y":64,"segType":"road"},{"x":17.5,"y":64.9,"segType":"road"},{"x":16.5,"y":65.9,"segType":"road"},{"x":15.8,"y":67.2,"segType":"road"},{"x":16.1,"y":69.4,"segType":"road"},{"x":16.9,"y":70.7,"segType":"road"},{"x":17.5,"y":72.7,"segType":"road"}],"transits":[]},"Del Sol Valley|Ondarion|car":{"from":"Del Sol Valley","to":"Ondarion","transport":"car","points":[{"x":17.5,"y":72.7,"segType":"road"},{"x":16.9,"y":70.7,"segType":"road"},{"x":16.1,"y":69.4,"segType":"road"},{"x":15.8,"y":67.2,"segType":"road"},{"x":16.5,"y":65.9,"segType":"road"},{"x":17.5,"y":64.9,"segType":"road"},{"x":19.1,"y":64,"segType":"road"},{"x":20.2,"y":63.7,"segType":"road"},{"x":21.6,"y":63.6,"segType":"road"},{"x":23,"y":62.9,"segType":"road"},{"x":24.2,"y":62.2,"segType":"road"},{"x":25.3,"y":61.3,"segType":"road"},{"x":26.1,"y":60.2,"segType":"road"},{"x":27.6,"y":59.7,"segType":"road"},{"x":29,"y":59.7,"segType":"road"},{"x":30.7,"y":60,"segType":"road"},{"x":32.1,"y":60,"segType":"road"},{"x":33.5,"y":60,"segType":"road"},{"x":35.6,"y":59.2,"segType":"road"},{"x":44.4,"y":60.3,"segType":"road"},{"x":43.7,"y":56.6,"segType":"road"},{"x":43,"y":54.5,"segType":"road"},{"x":42.2,"y":52.6,"segType":"road"},{"x":41.6,"y":51.3,"segType":"road"}],"transits":[]},"Nordhaven|Gibbi Point|car":{"from":"Nordhaven","to":"Gibbi Point","transport":"car","points":[{"x":9,"y":25.6,"segType":"boat"},{"x":8.1,"y":27,"segType":"boat"},{"x":7.3,"y":29,"segType":"boat"},{"x":6.6,"y":31.9,"segType":"boat"},{"x":6.7,"y":35,"segType":"boat"},{"x":6.8,"y":37.2,"segType":"boat"},{"x":7.4,"y":40.2,"segType":"boat"},{"x":8.5,"y":42.9,"segType":"boat"},{"x":9.8,"y":44.6,"segType":"boat"},{"x":11.5,"y":44.7,"segType":"boat"},{"x":13.1,"y":43.9,"segType":"boat"},{"x":14,"y":42.6,"segType":"boat"},{"x":14.6,"y":40.7,"segType":"boat"}],"transits":[]},"Gibbi Point|Nordhaven|car":{"from":"Gibbi Point","to":"Nordhaven","transport":"car","points":[{"x":14.6,"y":40.7,"segType":"boat"},{"x":14,"y":42.6,"segType":"boat"},{"x":13.1,"y":43.9,"segType":"boat"},{"x":11.5,"y":44.7,"segType":"boat"},{"x":9.8,"y":44.6,"segType":"boat"},{"x":8.5,"y":42.9,"segType":"boat"},{"x":7.4,"y":40.2,"segType":"boat"},{"x":6.8,"y":37.2,"segType":"boat"},{"x":6.7,"y":35,"segType":"boat"},{"x":6.6,"y":31.9,"segType":"boat"},{"x":7.3,"y":29,"segType":"boat"},{"x":8.1,"y":27,"segType":"boat"},{"x":9,"y":25.6,"segType":"boat"}],"transits":[]},"Innisgreen|Sulani|car":{"from":"Innisgreen","to":"Sulani","transport":"car","points":[{"x":58.4,"y":69.4,"segType":"boat"},{"x":57,"y":69.8,"segType":"boat"},{"x":55.8,"y":70.1,"segType":"boat"},{"x":56.2,"y":71.6,"segType":"boat"},{"x":57.8,"y":72.8,"segType":"boat"},{"x":59.6,"y":73.1,"segType":"boat"},{"x":61.4,"y":74,"segType":"boat"},{"x":63,"y":75.3,"segType":"boat"},{"x":64.8,"y":77.2,"segType":"boat"},{"x":66.6,"y":81.2,"segType":"boat"},{"x":67.6,"y":83.6,"segType":"boat"},{"x":68.4,"y":86.8,"segType":"boat"}],"transits":[]},"Sulani|Innisgreen|car":{"from":"Sulani","to":"Innisgreen","transport":"car","points":[{"x":68.4,"y":86.8,"segType":"boat"},{"x":67.6,"y":83.6,"segType":"boat"},{"x":66.6,"y":81.2,"segType":"boat"},{"x":64.8,"y":77.2,"segType":"boat"},{"x":63,"y":75.3,"segType":"boat"},{"x":61.4,"y":74,"segType":"boat"},{"x":59.6,"y":73.1,"segType":"boat"},{"x":57.8,"y":72.8,"segType":"boat"},{"x":56.2,"y":71.6,"segType":"boat"},{"x":55.8,"y":70.1,"segType":"boat"},{"x":57,"y":69.8,"segType":"boat"},{"x":58.4,"y":69.4,"segType":"boat"}],"transits":[]},"San Myshuno|Selvadorada|car":{"from":"San Myshuno","to":"Selvadorada","transport":"car","points":[{"x":85.9,"y":60.7,"segType":"plane"}],"transits":[]},"Selvadorada|San Myshuno|car":{"from":"Selvadorada","to":"San Myshuno","transport":"car","points":[{"x":85.9,"y":60.7,"segType":"plane"}],"transits":[]},"Del Sol Valley|Selvadorada|car":{"from":"Del Sol Valley","to":"Selvadorada","transport":"car","points":[{"x":85.7,"y":62.5,"segType":"plane"}],"transits":[]},"Selvadorada|Del Sol Valley|car":{"from":"Selvadorada","to":"Del Sol Valley","transport":"car","points":[{"x":85.7,"y":62.5,"segType":"plane"}],"transits":[]},"Evergreen Harbor|Moonwood Mill|car":{"from":"Evergreen Harbor","to":"Moonwood Mill","transport":"car","points":[{"x":78.4,"y":13.6,"segType":"road"},{"x":77.5,"y":14.2,"segType":"road"},{"x":76.1,"y":14.8,"segType":"road"},{"x":74.8,"y":15.5,"segType":"road"},{"x":73.4,"y":15.3,"segType":"road"},{"x":72.6,"y":14.7,"segType":"road"},{"x":71,"y":14.6,"segType":"road"},{"x":70.1,"y":14.6,"segType":"road"},{"x":68.9,"y":14.7,"segType":"road"},{"x":67.9,"y":14.7,"segType":"road"},{"x":66.9,"y":14.7,"segType":"road"},{"x":61.8,"y":13.9,"segType":"road"},{"x":60.7,"y":14.1,"segType":"road"},{"x":59.6,"y":14.1,"segType":"road"},{"x":58.2,"y":14.3,"segType":"road"}],"transits":[]},"Moonwood Mill|Evergreen Harbor|car":{"from":"Moonwood Mill","to":"Evergreen Harbor","transport":"car","points":[{"x":58.2,"y":14.3,"segType":"road"},{"x":59.6,"y":14.1,"segType":"road"},{"x":60.7,"y":14.1,"segType":"road"},{"x":61.8,"y":13.9,"segType":"road"},{"x":66.9,"y":14.7,"segType":"road"},{"x":67.9,"y":14.7,"segType":"road"},{"x":68.9,"y":14.7,"segType":"road"},{"x":70.1,"y":14.6,"segType":"road"},{"x":71,"y":14.6,"segType":"road"},{"x":72.6,"y":14.7,"segType":"road"},{"x":73.4,"y":15.3,"segType":"road"},{"x":74.8,"y":15.5,"segType":"road"},{"x":76.1,"y":14.8,"segType":"road"},{"x":77.5,"y":14.2,"segType":"road"},{"x":78.4,"y":13.6,"segType":"road"}],"transits":[]},"Moonwood Mill|Glimmerbrook|car":{"from":"Moonwood Mill","to":"Glimmerbrook","transport":"car","points":[{"x":55.4,"y":17.1,"segType":"road"},{"x":54.6,"y":16.8,"segType":"road"},{"x":53.7,"y":16.2,"segType":"road"},{"x":52.5,"y":16,"segType":"road"},{"x":50.7,"y":15.9,"segType":"road"},{"x":49.4,"y":15.6,"segType":"road"}],"transits":["Glimmerbrook"]},"Glimmerbrook|Moonwood Mill|car":{"from":"Glimmerbrook","to":"Moonwood Mill","transport":"car","points":[{"x":49.4,"y":15.6,"segType":"road"},{"x":50.7,"y":15.9,"segType":"road"},{"x":52.5,"y":16,"segType":"road"},{"x":53.7,"y":16.2,"segType":"road"},{"x":54.6,"y":16.8,"segType":"road"},{"x":55.4,"y":17.1,"segType":"road"}],"transits":["Glimmerbrook"]},"San Sequoia|Del Sol Valley|car":{"from":"San Sequoia","to":"Del Sol Valley","transport":"car","points":[{"x":21.6,"y":51.7,"segType":"road"},{"x":22.1,"y":52.8,"segType":"road"},{"x":22.9,"y":54.4,"segType":"road"},{"x":23.8,"y":55.5,"segType":"road"},{"x":24.8,"y":56.1,"segType":"road"},{"x":26,"y":56.8,"segType":"road"},{"x":26.2,"y":58.5,"segType":"road"},{"x":26,"y":60,"segType":"road"},{"x":25.4,"y":61,"segType":"road"},{"x":24.1,"y":62.5,"segType":"road"},{"x":22.6,"y":63.2,"segType":"road"},{"x":21,"y":63.6,"segType":"road"},{"x":19.7,"y":63.6,"segType":"road"},{"x":18.3,"y":64.8,"segType":"road"},{"x":16.9,"y":65.8,"segType":"road"},{"x":15.7,"y":67.2,"segType":"road"},{"x":15.7,"y":69,"segType":"road"},{"x":16.5,"y":70.4,"segType":"road"},{"x":17.1,"y":72.1,"segType":"road"}],"transits":[]},"Del Sol Valley|San Sequoia|car":{"from":"Del Sol Valley","to":"San Sequoia","transport":"car","points":[{"x":17.1,"y":72.1,"segType":"road"},{"x":16.5,"y":70.4,"segType":"road"},{"x":15.7,"y":69,"segType":"road"},{"x":15.7,"y":67.2,"segType":"road"},{"x":16.9,"y":65.8,"segType":"road"},{"x":18.3,"y":64.8,"segType":"road"},{"x":19.7,"y":63.6,"segType":"road"},{"x":21,"y":63.6,"segType":"road"},{"x":22.6,"y":63.2,"segType":"road"},{"x":24.1,"y":62.5,"segType":"road"},{"x":25.4,"y":61,"segType":"road"},{"x":26,"y":60,"segType":"road"},{"x":26.2,"y":58.5,"segType":"road"},{"x":26,"y":56.8,"segType":"road"},{"x":24.8,"y":56.1,"segType":"road"},{"x":23.8,"y":55.5,"segType":"road"},{"x":22.9,"y":54.4,"segType":"road"},{"x":22.1,"y":52.8,"segType":"road"},{"x":21.6,"y":51.7,"segType":"road"}],"transits":[]},"San Sequoia|Oasis Springs|car":{"from":"San Sequoia","to":"Oasis Springs","transport":"car","points":[{"x":22.2,"y":52.4,"segType":"road"},{"x":22.7,"y":53.7,"segType":"road"},{"x":23.2,"y":54.8,"segType":"road"},{"x":24.3,"y":55.9,"segType":"road"},{"x":25.4,"y":56.3,"segType":"road"},{"x":26,"y":56.8,"segType":"road"},{"x":26.1,"y":58.3,"segType":"road"},{"x":25.8,"y":60,"segType":"road"},{"x":26.8,"y":60,"segType":"road"},{"x":28,"y":59.8,"segType":"road"},{"x":29,"y":59.7,"segType":"road"},{"x":30.2,"y":59.9,"segType":"road"},{"x":31.5,"y":60,"segType":"road"},{"x":32.6,"y":60,"segType":"road"},{"x":33.7,"y":60.3,"segType":"road"},{"x":34.7,"y":60.5,"segType":"road"},{"x":35.9,"y":60.6,"segType":"road"}],"transits":[]},"Oasis Springs|San Sequoia|car":{"from":"Oasis Springs","to":"San Sequoia","transport":"car","points":[{"x":35.9,"y":60.6,"segType":"road"},{"x":34.7,"y":60.5,"segType":"road"},{"x":33.7,"y":60.3,"segType":"road"},{"x":32.6,"y":60,"segType":"road"},{"x":31.5,"y":60,"segType":"road"},{"x":30.2,"y":59.9,"segType":"road"},{"x":29,"y":59.7,"segType":"road"},{"x":28,"y":59.8,"segType":"road"},{"x":26.8,"y":60,"segType":"road"},{"x":25.8,"y":60,"segType":"road"},{"x":26.1,"y":58.3,"segType":"road"},{"x":26,"y":56.8,"segType":"road"},{"x":25.4,"y":56.3,"segType":"road"},{"x":24.3,"y":55.9,"segType":"road"},{"x":23.2,"y":54.8,"segType":"road"},{"x":22.7,"y":53.7,"segType":"road"},{"x":22.2,"y":52.4,"segType":"road"}],"transits":[]},"Tartosa|Strangerville|car":{"from":"Tartosa","to":"Strangerville","transport":"car","points":[{"x":35.7,"y":84.9,"segType":"road"},{"x":36.7,"y":83.9,"segType":"road"},{"x":36.4,"y":82.2,"segType":"road"},{"x":35.8,"y":80.6,"segType":"road"},{"x":35,"y":79.3,"segType":"road"},{"x":34.1,"y":78.2,"segType":"road"},{"x":32.9,"y":77,"segType":"road"},{"x":31.9,"y":76.1,"segType":"road"},{"x":31.6,"y":73.8,"segType":"road"}],"transits":[]},"Strangerville|Tartosa|car":{"from":"Strangerville","to":"Tartosa","transport":"car","points":[{"x":31.6,"y":73.8,"segType":"road"},{"x":31.9,"y":76.1,"segType":"road"},{"x":32.9,"y":77,"segType":"road"},{"x":34.1,"y":78.2,"segType":"road"},{"x":35,"y":79.3,"segType":"road"},{"x":35.8,"y":80.6,"segType":"road"},{"x":36.4,"y":82.2,"segType":"road"},{"x":36.7,"y":83.9,"segType":"road"},{"x":35.7,"y":84.9,"segType":"road"}],"transits":[]},"Strangerville|Oasis Springs|car":{"from":"Strangerville","to":"Oasis Springs","transport":"car","points":[{"x":32.8,"y":69.2,"segType":"road"},{"x":33.9,"y":67.4,"segType":"road"},{"x":35.4,"y":65.8,"segType":"road"},{"x":36.6,"y":64.8,"segType":"road"},{"x":37.8,"y":62.6,"segType":"road"}],"transits":[]},"Oasis Springs|Strangerville|car":{"from":"Oasis Springs","to":"Strangerville","transport":"car","points":[{"x":37.8,"y":62.6,"segType":"road"},{"x":36.6,"y":64.8,"segType":"road"},{"x":35.4,"y":65.8,"segType":"road"},{"x":33.9,"y":67.4,"segType":"road"},{"x":32.8,"y":69.2,"segType":"road"}],"transits":[]},"Oasis Springs|Ondarion|car":{"from":"Oasis Springs","to":"Ondarion","transport":"car","points":[{"x":35.9,"y":60.2,"segType":"road"},{"x":34.3,"y":60.2,"segType":"road"},{"x":32.9,"y":60,"segType":"road"},{"x":31.2,"y":59.3,"segType":"road"},{"x":29.9,"y":59.4,"segType":"road"},{"x":31.6,"y":56.4,"segType":"road"},{"x":33.4,"y":54.7,"segType":"road"},{"x":35.3,"y":54,"segType":"road"},{"x":37.6,"y":53.2,"segType":"road"},{"x":38.9,"y":53,"segType":"road"},{"x":40.1,"y":51.9,"segType":"road"}],"transits":[]},"Ondarion|Oasis Springs|car":{"from":"Ondarion","to":"Oasis Springs","transport":"car","points":[{"x":40.1,"y":51.9,"segType":"road"},{"x":38.9,"y":53,"segType":"road"},{"x":37.6,"y":53.2,"segType":"road"},{"x":35.3,"y":54,"segType":"road"},{"x":33.4,"y":54.7,"segType":"road"},{"x":31.6,"y":56.4,"segType":"road"},{"x":29.9,"y":59.4,"segType":"road"},{"x":31.2,"y":59.3,"segType":"road"},{"x":32.9,"y":60,"segType":"road"},{"x":34.3,"y":60.2,"segType":"road"},{"x":35.9,"y":60.2,"segType":"road"}],"transits":[]},"Britechester|Newcrest|car":{"from":"Britechester","to":"Newcrest","transport":"car","points":[{"x":38,"y":33.9,"segType":"road"},{"x":38.9,"y":32.4,"segType":"road"}],"transits":[]},"Newcrest|Britechester|car":{"from":"Newcrest","to":"Britechester","transport":"car","points":[{"x":38.9,"y":32.4,"segType":"road"},{"x":38,"y":33.9,"segType":"road"}],"transits":[]},"Newcrest|Granite Falls|car":{"from":"Newcrest","to":"Granite Falls","transport":"car","points":[{"x":39.6,"y":24.4,"segType":"road"},{"x":38.7,"y":23.4,"segType":"road"},{"x":37.7,"y":22.8,"segType":"road"},{"x":37,"y":22.3,"segType":"road"},{"x":35.8,"y":21.8,"segType":"road"},{"x":38.5,"y":17.3,"segType":"road"},{"x":38.2,"y":15.5,"segType":"road"},{"x":37.8,"y":14,"segType":"road"},{"x":37.8,"y":12.5,"segType":"road"}],"transits":[]},"Granite Falls|Newcrest|car":{"from":"Granite Falls","to":"Newcrest","transport":"car","points":[{"x":37.8,"y":12.5,"segType":"road"},{"x":37.8,"y":14,"segType":"road"},{"x":38.2,"y":15.5,"segType":"road"},{"x":38.5,"y":17.3,"segType":"road"},{"x":35.8,"y":21.8,"segType":"road"},{"x":37,"y":22.3,"segType":"road"},{"x":37.7,"y":22.8,"segType":"road"},{"x":38.7,"y":23.4,"segType":"road"},{"x":39.6,"y":24.4,"segType":"road"}],"transits":[]},"Evergreen Harbor|Brindleton Bay|car":{"from":"Evergreen Harbor","to":"Brindleton Bay","transport":"car","points":[{"x":81.4,"y":15.5,"segType":"boat"},{"x":81.7,"y":17.1,"segType":"boat"},{"x":82.3,"y":19.5,"segType":"boat"},{"x":82.4,"y":22,"segType":"boat"},{"x":82.4,"y":24.4,"segType":"boat"},{"x":81.9,"y":26.6,"segType":"boat"},{"x":81.2,"y":29.2,"segType":"boat"},{"x":80.4,"y":32.2,"segType":"boat"},{"x":78.6,"y":34.5,"segType":"boat"}],"transits":[]},"Brindleton Bay|Evergreen Harbor|car":{"from":"Brindleton Bay","to":"Evergreen Harbor","transport":"car","points":[{"x":78.6,"y":34.5,"segType":"boat"},{"x":80.4,"y":32.2,"segType":"boat"},{"x":81.2,"y":29.2,"segType":"boat"},{"x":81.9,"y":26.6,"segType":"boat"},{"x":82.4,"y":24.4,"segType":"boat"},{"x":82.4,"y":22,"segType":"boat"},{"x":82.3,"y":19.5,"segType":"boat"},{"x":81.7,"y":17.1,"segType":"boat"},{"x":81.4,"y":15.5,"segType":"boat"}],"transits":[]},"Selvadorada|Tomarang|car":{"from":"Selvadorada","to":"Tomarang","transport":"car","points":[{"x":87.9,"y":63.7,"segType":"road"},{"x":89.2,"y":63.9,"segType":"road"},{"x":90.8,"y":64.2,"segType":"road"},{"x":91.8,"y":64.4,"segType":"road"},{"x":92.7,"y":65.1,"segType":"road"},{"x":92.8,"y":67.1,"segType":"road"},{"x":92.7,"y":68.8,"segType":"road"},{"x":92.6,"y":70.2,"segType":"road"},{"x":92.4,"y":71.8,"segType":"road"},{"x":92.4,"y":73.1,"segType":"road"},{"x":92.1,"y":74.7,"segType":"road"},{"x":91.6,"y":75.9,"segType":"road"},{"x":90.9,"y":76.6,"segType":"road"},{"x":89.6,"y":77.3,"segType":"road"},{"x":88.9,"y":77.7,"segType":"road"},{"x":87.5,"y":78.6,"segType":"road"}],"transits":[]},"Tomarang|Selvadorada|car":{"from":"Tomarang","to":"Selvadorada","transport":"car","points":[{"x":87.5,"y":78.6,"segType":"road"},{"x":88.9,"y":77.7,"segType":"road"},{"x":89.6,"y":77.3,"segType":"road"},{"x":90.9,"y":76.6,"segType":"road"},{"x":91.6,"y":75.9,"segType":"road"},{"x":92.1,"y":74.7,"segType":"road"},{"x":92.4,"y":73.1,"segType":"road"},{"x":92.4,"y":71.8,"segType":"road"},{"x":92.6,"y":70.2,"segType":"road"},{"x":92.7,"y":68.8,"segType":"road"},{"x":92.8,"y":67.1,"segType":"road"},{"x":92.7,"y":65.1,"segType":"road"},{"x":91.8,"y":64.4,"segType":"road"},{"x":90.8,"y":64.2,"segType":"road"},{"x":89.2,"y":63.9,"segType":"road"},{"x":87.9,"y":63.7,"segType":"road"}],"transits":[]},"Sulani|Tomarang|car":{"from":"Sulani","to":"Tomarang","transport":"car","points":[{"x":68.5,"y":87.1,"segType":"boat"},{"x":69,"y":85.8,"segType":"boat"},{"x":70,"y":85.1,"segType":"boat"},{"x":71.5,"y":84.8,"segType":"boat"},{"x":72.7,"y":84.7,"segType":"boat"},{"x":74.2,"y":84.7,"segType":"boat"},{"x":75.8,"y":84.6,"segType":"boat"},{"x":77.4,"y":84.6,"segType":"boat"},{"x":78.4,"y":84.1,"segType":"boat"},{"x":79.5,"y":83.5,"segType":"boat"}],"transits":[]},"Tomarang|Sulani|car":{"from":"Tomarang","to":"Sulani","transport":"car","points":[{"x":79.5,"y":83.5,"segType":"boat"},{"x":78.4,"y":84.1,"segType":"boat"},{"x":77.4,"y":84.6,"segType":"boat"},{"x":75.8,"y":84.6,"segType":"boat"},{"x":74.2,"y":84.7,"segType":"boat"},{"x":72.7,"y":84.7,"segType":"boat"},{"x":71.5,"y":84.8,"segType":"boat"},{"x":70,"y":85.1,"segType":"boat"},{"x":69,"y":85.8,"segType":"boat"},{"x":68.5,"y":87.1,"segType":"boat"}],"transits":[]},"Oasis Springs|Chestnut Ridge|car":{"from":"Oasis Springs","to":"Chestnut Ridge","transport":"car","points":[{"x":40.8,"y":60.3,"segType":"road"},{"x":42.1,"y":61.5,"segType":"road"},{"x":42.5,"y":63.9,"segType":"road"},{"x":42.4,"y":66.3,"segType":"road"}],"transits":[]},"Chestnut Ridge|Oasis Springs|car":{"from":"Chestnut Ridge","to":"Oasis Springs","transport":"car","points":[{"x":42.4,"y":66.3,"segType":"road"},{"x":42.5,"y":63.9,"segType":"road"},{"x":42.1,"y":61.5,"segType":"road"},{"x":40.8,"y":60.3,"segType":"road"}],"transits":[]},"Chestnut Ridge|Ciudad Enamorada|car":{"from":"Chestnut Ridge","to":"Ciudad Enamorada","transport":"car","points":[{"x":42.7,"y":71.6,"segType":"road"},{"x":43,"y":73,"segType":"road"},{"x":43.9,"y":74.2,"segType":"road"},{"x":45.1,"y":74.9,"segType":"road"},{"x":45.9,"y":75.5,"segType":"road"},{"x":46.5,"y":76.4,"segType":"road"},{"x":47,"y":77.5,"segType":"road"},{"x":48.2,"y":77.7,"segType":"road"},{"x":49.5,"y":78,"segType":"road"},{"x":50.8,"y":77.2,"segType":"road"},{"x":51.9,"y":76.8,"segType":"road"},{"x":53,"y":77,"segType":"road"},{"x":54.2,"y":76.9,"segType":"road"}],"transits":[]},"Ciudad Enamorada|Chestnut Ridge|car":{"from":"Ciudad Enamorada","to":"Chestnut Ridge","transport":"car","points":[{"x":54.2,"y":76.9,"segType":"road"},{"x":53,"y":77,"segType":"road"},{"x":51.9,"y":76.8,"segType":"road"},{"x":50.8,"y":77.2,"segType":"road"},{"x":49.5,"y":78,"segType":"road"},{"x":48.2,"y":77.7,"segType":"road"},{"x":47,"y":77.5,"segType":"road"},{"x":46.5,"y":76.4,"segType":"road"},{"x":45.9,"y":75.5,"segType":"road"},{"x":45.1,"y":74.9,"segType":"road"},{"x":43.9,"y":74.2,"segType":"road"},{"x":43,"y":73,"segType":"road"},{"x":42.7,"y":71.6,"segType":"road"}],"transits":[]},"Ciudad Enamorada|Sulani|car":{"from":"Ciudad Enamorada","to":"Sulani","transport":"car","points":[{"x":57.6,"y":82,"segType":"road"},{"x":57.8,"y":83.1,"segType":"road"},{"x":57.6,"y":84.5,"segType":"road"},{"x":57.5,"y":86.1,"segType":"road"},{"x":57.7,"y":87.8,"segType":"road"},{"x":58.4,"y":88.7,"segType":"road"},{"x":59,"y":89.7,"segType":"road"},{"x":60.3,"y":91.3,"segType":"road"},{"x":61.3,"y":92.9,"segType":"road"},{"x":62.6,"y":93.9,"segType":"road"},{"x":63.8,"y":94.6,"segType":"road"},{"x":65.3,"y":94.6,"segType":"road"},{"x":66.3,"y":92.5,"segType":"road"}],"transits":["Ciudad Enamorada"]},"Sulani|Ciudad Enamorada|car":{"from":"Sulani","to":"Ciudad Enamorada","transport":"car","points":[{"x":66.3,"y":92.5,"segType":"road"},{"x":65.3,"y":94.6,"segType":"road"},{"x":63.8,"y":94.6,"segType":"road"},{"x":62.6,"y":93.9,"segType":"road"},{"x":61.3,"y":92.9,"segType":"road"},{"x":60.3,"y":91.3,"segType":"road"},{"x":59,"y":89.7,"segType":"road"},{"x":58.4,"y":88.7,"segType":"road"},{"x":57.7,"y":87.8,"segType":"road"},{"x":57.5,"y":86.1,"segType":"road"},{"x":57.6,"y":84.5,"segType":"road"},{"x":57.8,"y":83.1,"segType":"road"},{"x":57.6,"y":82,"segType":"road"}],"transits":["Ciudad Enamorada"]},"Mt. Komorebi|Henford-on-Bagley|car":{"from":"Mt. Komorebi","to":"Henford-on-Bagley","transport":"car","points":[{"x":22.4,"y":17.1,"segType":"road"},{"x":22.2,"y":18.4,"segType":"road"},{"x":22.4,"y":19.7,"segType":"road"},{"x":23.2,"y":21,"segType":"road"},{"x":24,"y":21.7,"segType":"road"},{"x":25,"y":22.3,"segType":"road"},{"x":26.1,"y":22.4,"segType":"road"},{"x":27.2,"y":21.7,"segType":"road"},{"x":28.3,"y":21.7,"segType":"road"},{"x":29.3,"y":22.8,"segType":"road"},{"x":30,"y":23.8,"segType":"road"},{"x":30.4,"y":25.8,"segType":"road"}],"transits":[]},"Henford-on-Bagley|Mt. Komorebi|car":{"from":"Henford-on-Bagley","to":"Mt. Komorebi","transport":"car","points":[{"x":30.4,"y":25.8,"segType":"road"},{"x":30,"y":23.8,"segType":"road"},{"x":29.3,"y":22.8,"segType":"road"},{"x":28.3,"y":21.7,"segType":"road"},{"x":27.2,"y":21.7,"segType":"road"},{"x":26.1,"y":22.4,"segType":"road"},{"x":25,"y":22.3,"segType":"road"},{"x":24,"y":21.7,"segType":"road"},{"x":23.2,"y":21,"segType":"road"},{"x":22.4,"y":19.7,"segType":"road"},{"x":22.2,"y":18.4,"segType":"road"},{"x":22.4,"y":17.1,"segType":"road"}],"transits":[]},"Mt. Komorebi|Britechester|car":{"from":"Mt. Komorebi","to":"Britechester","transport":"car","points":[{"x":22.4,"y":17.1,"segType":"road"},{"x":22.2,"y":18.4,"segType":"road"},{"x":22.4,"y":19.7,"segType":"road"},{"x":23.2,"y":21,"segType":"road"},{"x":24,"y":21.7,"segType":"road"},{"x":25,"y":22.3,"segType":"road"},{"x":26.1,"y":22.4,"segType":"road"},{"x":27.2,"y":21.7,"segType":"road"},{"x":28.3,"y":21.7,"segType":"road"},{"x":29.3,"y":22.8,"segType":"road"},{"x":30,"y":23.8,"segType":"road"},{"x":30.4,"y":25.8,"segType":"road"},{"x":31.8,"y":31.2,"segType":"road"},{"x":33.3,"y":31.8,"segType":"road"},{"x":34.4,"y":32.2,"segType":"road"},{"x":35.9,"y":32.5,"segType":"road"},{"x":37.2,"y":33.1,"segType":"road"}],"transits":[]},"Britechester|Mt. Komorebi|car":{"from":"Britechester","to":"Mt. Komorebi","transport":"car","points":[{"x":37.2,"y":33.1,"segType":"road"},{"x":35.9,"y":32.5,"segType":"road"},{"x":34.4,"y":32.2,"segType":"road"},{"x":33.3,"y":31.8,"segType":"road"},{"x":31.8,"y":31.2,"segType":"road"},{"x":30.4,"y":25.8,"segType":"road"},{"x":30,"y":23.8,"segType":"road"},{"x":29.3,"y":22.8,"segType":"road"},{"x":28.3,"y":21.7,"segType":"road"},{"x":27.2,"y":21.7,"segType":"road"},{"x":26.1,"y":22.4,"segType":"road"},{"x":25,"y":22.3,"segType":"road"},{"x":24,"y":21.7,"segType":"road"},{"x":23.2,"y":21,"segType":"road"},{"x":22.4,"y":19.7,"segType":"road"},{"x":22.2,"y":18.4,"segType":"road"},{"x":22.4,"y":17.1,"segType":"road"}],"transits":[]},"Britechester|San Myshuno|car":{"from":"Britechester","to":"San Myshuno","transport":"car","points":[{"x":39.6,"y":38,"segType":"road"},{"x":40.8,"y":39,"segType":"road"},{"x":41.7,"y":40.2,"segType":"road"},{"x":42.8,"y":40.8,"segType":"road"},{"x":44.2,"y":40.3,"segType":"road"},{"x":45.4,"y":39.8,"segType":"road"},{"x":46.9,"y":39.1,"segType":"road"},{"x":48.3,"y":38.5,"segType":"road"},{"x":49.4,"y":38,"segType":"road"},{"x":52.5,"y":33.7,"segType":"road"},{"x":53.9,"y":32.6,"segType":"road"},{"x":55,"y":32.6,"segType":"road"},{"x":55.9,"y":33.4,"segType":"road"},{"x":57,"y":32.8,"segType":"road"},{"x":58.1,"y":30.9,"segType":"road"},{"x":58.9,"y":29.5,"segType":"road"},{"x":59.6,"y":28.3,"segType":"road"}],"transits":[]},"San Myshuno|Britechester|car":{"from":"San Myshuno","to":"Britechester","transport":"car","points":[{"x":59.6,"y":28.3,"segType":"road"},{"x":58.9,"y":29.5,"segType":"road"},{"x":58.1,"y":30.9,"segType":"road"},{"x":57,"y":32.8,"segType":"road"},{"x":55.9,"y":33.4,"segType":"road"},{"x":55,"y":32.6,"segType":"road"},{"x":53.9,"y":32.6,"segType":"road"},{"x":52.5,"y":33.7,"segType":"road"},{"x":49.4,"y":38,"segType":"road"},{"x":48.3,"y":38.5,"segType":"road"},{"x":46.9,"y":39.1,"segType":"road"},{"x":45.4,"y":39.8,"segType":"road"},{"x":44.2,"y":40.3,"segType":"road"},{"x":42.8,"y":40.8,"segType":"road"},{"x":41.7,"y":40.2,"segType":"road"},{"x":40.8,"y":39,"segType":"road"},{"x":39.6,"y":38,"segType":"road"}],"transits":[]},"San Myshuno|Willow Creek|car":{"from":"San Myshuno","to":"Willow Creek","transport":"car","points":[{"x":56.8,"y":23.6,"segType":"road"},{"x":55.7,"y":23.3,"segType":"road"},{"x":54.8,"y":23.1,"segType":"road"},{"x":54.1,"y":23.1,"segType":"road"},{"x":53.1,"y":23,"segType":"road"},{"x":52.2,"y":23.1,"segType":"road"}],"transits":[]},"Willow Creek|San Myshuno|car":{"from":"Willow Creek","to":"San Myshuno","transport":"car","points":[{"x":52.2,"y":23.1,"segType":"road"},{"x":53.1,"y":23,"segType":"road"},{"x":54.1,"y":23.1,"segType":"road"},{"x":54.8,"y":23.1,"segType":"road"},{"x":55.7,"y":23.3,"segType":"road"},{"x":56.8,"y":23.6,"segType":"road"}],"transits":[]},"Willow Creek|Moonwood Mill|car":{"from":"Willow Creek","to":"Moonwood Mill","transport":"car","points":[{"x":53.3,"y":20.4,"segType":"road"}],"transits":[]},"Moonwood Mill|Willow Creek|car":{"from":"Moonwood Mill","to":"Willow Creek","transport":"car","points":[{"x":53.3,"y":20.4,"segType":"road"}],"transits":[]},"Sulani|Brindleton Bay|car":{"from":"Sulani","to":"Brindleton Bay","transport":"car","points":[{"x":68.9,"y":86.8,"segType":"boat"},{"x":69.6,"y":84,"segType":"boat"},{"x":70,"y":81.2,"segType":"boat"},{"x":70.3,"y":78.8,"segType":"boat"},{"x":70.7,"y":75.6,"segType":"boat"},{"x":70.9,"y":72.9,"segType":"boat"},{"x":71.3,"y":68.7,"segType":"boat"},{"x":71.8,"y":65.8,"segType":"boat"},{"x":72.2,"y":63.2,"segType":"boat"},{"x":72.8,"y":60.4,"segType":"boat"},{"x":73.5,"y":59,"segType":"boat"},{"x":74.5,"y":55.8,"segType":"boat"},{"x":75.7,"y":52.6,"segType":"boat"},{"x":76.4,"y":49.9,"segType":"boat"},{"x":77.6,"y":46.6,"segType":"boat"},{"x":78.4,"y":43,"segType":"boat"},{"x":78.6,"y":41.3,"segType":"boat"},{"x":77.8,"y":39,"segType":"boat"}],"transits":[]},"Brindleton Bay|Sulani|car":{"from":"Brindleton Bay","to":"Sulani","transport":"car","points":[{"x":77.8,"y":39,"segType":"boat"},{"x":78.6,"y":41.3,"segType":"boat"},{"x":78.4,"y":43,"segType":"boat"},{"x":77.6,"y":46.6,"segType":"boat"},{"x":76.4,"y":49.9,"segType":"boat"},{"x":75.7,"y":52.6,"segType":"boat"},{"x":74.5,"y":55.8,"segType":"boat"},{"x":73.5,"y":59,"segType":"boat"},{"x":72.8,"y":60.4,"segType":"boat"},{"x":72.2,"y":63.2,"segType":"boat"},{"x":71.8,"y":65.8,"segType":"boat"},{"x":71.3,"y":68.7,"segType":"boat"},{"x":70.9,"y":72.9,"segType":"boat"},{"x":70.7,"y":75.6,"segType":"boat"},{"x":70.3,"y":78.8,"segType":"boat"},{"x":70,"y":81.2,"segType":"boat"},{"x":69.6,"y":84,"segType":"boat"},{"x":68.9,"y":86.8,"segType":"boat"}],"transits":[]},"Forgotten Hollow|Henford-on-Bagley|car":{"from":"Forgotten Hollow","to":"Henford-on-Bagley","transport":"car","points":[{"x":28.9,"y":21.1,"segType":"road"},{"x":29.2,"y":22.7,"segType":"road"},{"x":30.1,"y":24.5,"segType":"road"},{"x":30.5,"y":26.7,"segType":"road"}],"transits":[]},"Henford-on-Bagley|Forgotten Hollow|car":{"from":"Henford-on-Bagley","to":"Forgotten Hollow","transport":"car","points":[{"x":30.5,"y":26.7,"segType":"road"},{"x":30.1,"y":24.5,"segType":"road"},{"x":29.2,"y":22.7,"segType":"road"},{"x":28.9,"y":21.1,"segType":"road"}],"transits":[]},"Ravenwood|Moonwood Mill|car":{"from":"Ravenwood","to":"Moonwood Mill","transport":"car","points":[{"x":61.6,"y":13.9,"segType":"road"},{"x":60.4,"y":14,"segType":"road"},{"x":58.7,"y":14.1,"segType":"road"}],"transits":[]},"Moonwood Mill|Ravenwood|car":{"from":"Moonwood Mill","to":"Ravenwood","transport":"car","points":[{"x":58.7,"y":14.1,"segType":"road"},{"x":60.4,"y":14,"segType":"road"},{"x":61.6,"y":13.9,"segType":"road"}],"transits":[]},"Copperdale|Henford-on-Bagley|car":{"from":"Copperdale","to":"Henford-on-Bagley","transport":"car","points":[{"x":25.5,"y":26.6,"segType":"road"},{"x":26.6,"y":25.8,"segType":"road"},{"x":27.9,"y":25.2,"segType":"road"},{"x":29.1,"y":25.4,"segType":"road"}],"transits":[]},"Henford-on-Bagley|Copperdale|car":{"from":"Henford-on-Bagley","to":"Copperdale","transport":"car","points":[{"x":29.1,"y":25.4,"segType":"road"},{"x":27.9,"y":25.2,"segType":"road"},{"x":26.6,"y":25.8,"segType":"road"},{"x":25.5,"y":26.6,"segType":"road"}],"transits":[]},"Windenburg|Brindleton Bay|car":{"from":"Windenburg","to":"Brindleton Bay","transport":"car","points":[{"x":65.2,"y":43,"segType":"road"},{"x":66.9,"y":42.2,"segType":"road"},{"x":67.9,"y":40.9,"segType":"road"},{"x":69.2,"y":39.8,"segType":"road"},{"x":70,"y":38.7,"segType":"road"}],"transits":[]},"Brindleton Bay|Windenburg|car":{"from":"Brindleton Bay","to":"Windenburg","transport":"car","points":[{"x":70,"y":38.7,"segType":"road"},{"x":69.2,"y":39.8,"segType":"road"},{"x":67.9,"y":40.9,"segType":"road"},{"x":66.9,"y":42.2,"segType":"road"},{"x":65.2,"y":43,"segType":"road"}],"transits":[]},"Brindleton Bay|Magnolia Promenade|car":{"from":"Brindleton Bay","to":"Magnolia Promenade","transport":"car","points":[{"x":70.1,"y":34.2,"segType":"road"},{"x":69.1,"y":33.5,"segType":"road"},{"x":67.3,"y":33,"segType":"road"},{"x":65.5,"y":33,"segType":"road"},{"x":63.8,"y":32.5,"segType":"road"},{"x":62,"y":32.2,"segType":"road"},{"x":60.4,"y":31.9,"segType":"road"},{"x":58.6,"y":31.5,"segType":"road"},{"x":57.8,"y":31.5,"segType":"road"},{"x":56.8,"y":32.5,"segType":"road"},{"x":56.2,"y":33.2,"segType":"road"},{"x":55,"y":32.8,"segType":"road"},{"x":53.9,"y":32.8,"segType":"road"},{"x":52.8,"y":33.7,"segType":"road"}],"transits":[]},"Magnolia Promenade|Brindleton Bay|car":{"from":"Magnolia Promenade","to":"Brindleton Bay","transport":"car","points":[{"x":52.8,"y":33.7,"segType":"road"},{"x":53.9,"y":32.8,"segType":"road"},{"x":55,"y":32.8,"segType":"road"},{"x":56.2,"y":33.2,"segType":"road"},{"x":56.8,"y":32.5,"segType":"road"},{"x":57.8,"y":31.5,"segType":"road"},{"x":58.6,"y":31.5,"segType":"road"},{"x":60.4,"y":31.9,"segType":"road"},{"x":62,"y":32.2,"segType":"road"},{"x":63.8,"y":32.5,"segType":"road"},{"x":65.5,"y":33,"segType":"road"},{"x":67.3,"y":33,"segType":"road"},{"x":69.1,"y":33.5,"segType":"road"},{"x":70.1,"y":34.2,"segType":"road"}],"transits":[]},"San Sequoia|Britechester|car":{"from":"San Sequoia","to":"Britechester","transport":"car","points":[{"x":21.2,"y":46.9,"segType":"road"},{"x":21.8,"y":45,"segType":"road"},{"x":22.9,"y":43.5,"segType":"road"},{"x":24.6,"y":43,"segType":"road"},{"x":26.2,"y":42.6,"segType":"road"},{"x":27.6,"y":42.6,"segType":"road"},{"x":29.3,"y":42.3,"segType":"road"},{"x":31.3,"y":42.2,"segType":"road"},{"x":32.7,"y":41,"segType":"road"},{"x":34.2,"y":39.8,"segType":"road"},{"x":35.7,"y":38.3,"segType":"road"}],"transits":[]},"Britechester|San Sequoia|car":{"from":"Britechester","to":"San Sequoia","transport":"car","points":[{"x":35.7,"y":38.3,"segType":"road"},{"x":34.2,"y":39.8,"segType":"road"},{"x":32.7,"y":41,"segType":"road"},{"x":31.3,"y":42.2,"segType":"road"},{"x":29.3,"y":42.3,"segType":"road"},{"x":27.6,"y":42.6,"segType":"road"},{"x":26.2,"y":42.6,"segType":"road"},{"x":24.6,"y":43,"segType":"road"},{"x":22.9,"y":43.5,"segType":"road"},{"x":21.8,"y":45,"segType":"road"},{"x":21.2,"y":46.9,"segType":"road"}],"transits":[]},"Willow Creek|Newcrest|car":{"from":"Willow Creek","to":"Newcrest","transport":"car","points":[{"x":49.7,"y":22.5,"segType":"road"},{"x":48.1,"y":23.4,"segType":"road"},{"x":45.6,"y":24.7,"segType":"boat"},{"x":44.8,"y":25,"segType":"road"},{"x":42.8,"y":25.1,"segType":"road"}],"transits":[]},"Newcrest|Willow Creek|car":{"from":"Newcrest","to":"Willow Creek","transport":"car","points":[{"x":42.8,"y":25.1,"segType":"road"},{"x":44.8,"y":25,"segType":"road"},{"x":45.6,"y":24.7,"segType":"boat"},{"x":48.1,"y":23.4,"segType":"road"},{"x":49.7,"y":22.5,"segType":"road"}],"transits":[]},"San Sequoia|Gibbi Point|car":{"from":"San Sequoia","to":"Gibbi Point","transport":"car","points":[{"x":21.4,"y":46.7,"segType":"road"},{"x":21.8,"y":44.7,"segType":"road"},{"x":21.7,"y":42.6,"segType":"road"},{"x":21,"y":40.7,"segType":"road"},{"x":19.5,"y":39.7,"segType":"road"}],"transits":[]},"Gibbi Point|San Sequoia|car":{"from":"Gibbi Point","to":"San Sequoia","transport":"car","points":[{"x":19.5,"y":39.7,"segType":"road"},{"x":21,"y":40.7,"segType":"road"},{"x":21.7,"y":42.6,"segType":"road"},{"x":21.8,"y":44.7,"segType":"road"},{"x":21.4,"y":46.7,"segType":"road"}],"transits":[]},"Windenburg|Ondarion|car":{"from":"Windenburg","to":"Ondarion","transport":"car","points":[{"x":62.9,"y":44,"segType":"road"},{"x":61.6,"y":43.9,"segType":"road"},{"x":60.2,"y":44.3,"segType":"road"},{"x":59.2,"y":45,"segType":"road"},{"x":58.1,"y":46.1,"segType":"road"},{"x":56.5,"y":46.9,"segType":"road"},{"x":54.7,"y":46.9,"segType":"road"},{"x":52.8,"y":47.3,"segType":"road"},{"x":50.7,"y":47,"segType":"road"},{"x":49.3,"y":46.5,"segType":"road"},{"x":47.3,"y":45.4,"segType":"road"},{"x":45.6,"y":44.7,"segType":"road"},{"x":44.4,"y":44.7,"segType":"road"},{"x":43.2,"y":45.6,"segType":"road"},{"x":42.2,"y":46.3,"segType":"road"}],"transits":[]},"Ondarion|Windenburg|car":{"from":"Ondarion","to":"Windenburg","transport":"car","points":[{"x":42.2,"y":46.3,"segType":"road"},{"x":43.2,"y":45.6,"segType":"road"},{"x":44.4,"y":44.7,"segType":"road"},{"x":45.6,"y":44.7,"segType":"road"},{"x":47.3,"y":45.4,"segType":"road"},{"x":49.3,"y":46.5,"segType":"road"},{"x":50.7,"y":47,"segType":"road"},{"x":52.8,"y":47.3,"segType":"road"},{"x":54.7,"y":46.9,"segType":"road"},{"x":56.5,"y":46.9,"segType":"road"},{"x":58.1,"y":46.1,"segType":"road"},{"x":59.2,"y":45,"segType":"road"},{"x":60.2,"y":44.3,"segType":"road"},{"x":61.6,"y":43.9,"segType":"road"},{"x":62.9,"y":44,"segType":"road"}],"transits":[]},"Strangerville|Chestnut Ridge|car":{"from":"Strangerville","to":"Chestnut Ridge","transport":"car","points":[{"x":32.9,"y":69.1,"segType":"road"},{"x":34.1,"y":67.2,"segType":"road"},{"x":35.5,"y":66.1,"segType":"road"},{"x":38,"y":65.9,"segType":"road"},{"x":40.1,"y":66.1,"segType":"road"}],"transits":[]},"Chestnut Ridge|Strangerville|car":{"from":"Chestnut Ridge","to":"Strangerville","transport":"car","points":[{"x":40.1,"y":66.1,"segType":"road"},{"x":38,"y":65.9,"segType":"road"},{"x":35.5,"y":66.1,"segType":"road"},{"x":34.1,"y":67.2,"segType":"road"},{"x":32.9,"y":69.1,"segType":"road"}],"transits":[]},"Chestnut Ridge|Innisgreen|car":{"from":"Chestnut Ridge","to":"Innisgreen","transport":"car","points":[{"x":42.9,"y":67.4,"segType":"road"},{"x":44,"y":66.9,"segType":"road"},{"x":45.5,"y":65.6,"segType":"road"},{"x":46.7,"y":65.3,"segType":"road"},{"x":48.5,"y":64.8,"segType":"road"},{"x":50.2,"y":64.3,"segType":"road"},{"x":52.3,"y":64,"segType":"road"},{"x":55,"y":63.5,"segType":"road"},{"x":56.4,"y":63.3,"segType":"road"},{"x":57.6,"y":63.3,"segType":"road"},{"x":59,"y":63.9,"segType":"road"}],"transits":[]},"Innisgreen|Chestnut Ridge|car":{"from":"Innisgreen","to":"Chestnut Ridge","transport":"car","points":[{"x":59,"y":63.9,"segType":"road"},{"x":57.6,"y":63.3,"segType":"road"},{"x":56.4,"y":63.3,"segType":"road"},{"x":55,"y":63.5,"segType":"road"},{"x":52.3,"y":64,"segType":"road"},{"x":50.2,"y":64.3,"segType":"road"},{"x":48.5,"y":64.8,"segType":"road"},{"x":46.7,"y":65.3,"segType":"road"},{"x":45.5,"y":65.6,"segType":"road"},{"x":44,"y":66.9,"segType":"road"},{"x":42.9,"y":67.4,"segType":"road"}],"transits":[]},"Windenburg|Sulani|car":{"from":"Windenburg","to":"Sulani","transport":"car","points":[{"x":65.1,"y":50.6,"segType":"boat"},{"x":65.5,"y":54,"segType":"boat"},{"x":66.2,"y":57.9,"segType":"boat"},{"x":66.5,"y":61.1,"segType":"boat"},{"x":67.2,"y":64.4,"segType":"boat"},{"x":67.4,"y":67.8,"segType":"boat"},{"x":67.4,"y":70.5,"segType":"boat"},{"x":67.9,"y":74.6,"segType":"boat"},{"x":68.6,"y":79.9,"segType":"boat"},{"x":68.2,"y":84.4,"segType":"boat"}],"transits":[]},"Sulani|Windenburg|car":{"from":"Sulani","to":"Windenburg","transport":"car","points":[{"x":68.2,"y":84.4,"segType":"boat"},{"x":68.6,"y":79.9,"segType":"boat"},{"x":67.9,"y":74.6,"segType":"boat"},{"x":67.4,"y":70.5,"segType":"boat"},{"x":67.4,"y":67.8,"segType":"boat"},{"x":67.2,"y":64.4,"segType":"boat"},{"x":66.5,"y":61.1,"segType":"boat"},{"x":66.2,"y":57.9,"segType":"boat"},{"x":65.5,"y":54,"segType":"boat"},{"x":65.1,"y":50.6,"segType":"boat"}],"transits":[]},"Windenburg|Tomarang|car":{"from":"Windenburg","to":"Tomarang","transport":"car","points":[{"x":65,"y":50.6,"segType":"boat"},{"x":65.6,"y":53.9,"segType":"boat"},{"x":66.4,"y":58.7,"segType":"boat"},{"x":66.7,"y":62.3,"segType":"boat"},{"x":67.2,"y":66.5,"segType":"boat"},{"x":68.3,"y":72.1,"segType":"boat"},{"x":70.3,"y":76.7,"segType":"boat"},{"x":71.9,"y":78.9,"segType":"boat"},{"x":74.6,"y":81.3,"segType":"boat"},{"x":76.8,"y":82.3,"segType":"boat"},{"x":79.3,"y":83.8,"segType":"boat"}],"transits":[]},"Tomarang|Windenburg|car":{"from":"Tomarang","to":"Windenburg","transport":"car","points":[{"x":79.3,"y":83.8,"segType":"boat"},{"x":76.8,"y":82.3,"segType":"boat"},{"x":74.6,"y":81.3,"segType":"boat"},{"x":71.9,"y":78.9,"segType":"boat"},{"x":70.3,"y":76.7,"segType":"boat"},{"x":68.3,"y":72.1,"segType":"boat"},{"x":67.2,"y":66.5,"segType":"boat"},{"x":66.7,"y":62.3,"segType":"boat"},{"x":66.4,"y":58.7,"segType":"boat"},{"x":65.6,"y":53.9,"segType":"boat"},{"x":65,"y":50.6,"segType":"boat"}],"transits":[]},"Brindleton Bay|San Myshuno|car":{"from":"Brindleton Bay","to":"San Myshuno","transport":"car","points":[{"x":69.9,"y":33.8,"segType":"road"},{"x":68.7,"y":33.5,"segType":"road"},{"x":66.8,"y":33,"segType":"road"},{"x":65.4,"y":33,"segType":"road"},{"x":63.2,"y":32.4,"segType":"road"},{"x":61.4,"y":32.2,"segType":"road"},{"x":59.2,"y":31.7,"segType":"road"},{"x":58,"y":31.5,"segType":"road"},{"x":59.5,"y":28.6,"segType":"road"}],"transits":[]},"San Myshuno|Brindleton Bay|car":{"from":"San Myshuno","to":"Brindleton Bay","transport":"car","points":[{"x":59.5,"y":28.6,"segType":"road"},{"x":58,"y":31.5,"segType":"road"},{"x":59.2,"y":31.7,"segType":"road"},{"x":61.4,"y":32.2,"segType":"road"},{"x":63.2,"y":32.4,"segType":"road"},{"x":65.4,"y":33,"segType":"road"},{"x":66.8,"y":33,"segType":"road"},{"x":68.7,"y":33.5,"segType":"road"},{"x":69.9,"y":33.8,"segType":"road"}],"transits":[]},"Copperdale|Gibbi Point|car":{"from":"Copperdale","to":"Gibbi Point","transport":"car","points":[{"x":21.9,"y":29.8,"segType":"road"},{"x":19.9,"y":31.1,"segType":"road"},{"x":17.8,"y":32.1,"segType":"road"},{"x":16.6,"y":34.2,"segType":"road"}],"transits":[]},"Gibbi Point|Copperdale|car":{"from":"Gibbi Point","to":"Copperdale","transport":"car","points":[{"x":16.6,"y":34.2,"segType":"road"},{"x":17.8,"y":32.1,"segType":"road"},{"x":19.9,"y":31.1,"segType":"road"},{"x":21.9,"y":29.8,"segType":"road"}],"transits":[]},"Del Sol Valley|San Myshuno|car":{"from":"Del Sol Valley","to":"San Myshuno","transport":"car","points":[{"x":57.1,"y":26,"segType":"plane"}],"transits":[]},"San Myshuno|Del Sol Valley|car":{"from":"San Myshuno","to":"Del Sol Valley","transport":"car","points":[{"x":57.1,"y":26,"segType":"plane"}],"transits":[]}};
window.atlasCustomRoutes=loadRoutes();

})();
