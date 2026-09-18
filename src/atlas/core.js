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
