/* PROJECT ATLAS - Sheet data access.
   Loads the lots tab of the Google Sheet (CSV) into sheetLots/sheetWorldMeta
   and merges it with the hardcoded coordinates (getLots). The sheet is the
   source of truth for names, links and images. */

import { emit } from './events.js?v=202609182255';
import { readCache, writeCache } from './cache.js?v=202609182255';
import { BASE } from '../config.js?v=202609182255';
import { worlds } from '../data/worlds.js?v=202609182255';
import { worldLots } from '../data/world-lots.js?v=202609182255';
import { customLots, hiddenLots, renamedLots } from './state.js?v=202609182255';
import { updateOtherworldPortalTokens } from '../features/otherworlds/portal.js?v=202609182255';

// Sheet data for lots (from Google Sheets)
export var sheetLots = {}; // {worldName: {nr: {name, threadUrl, imgUrl}}}
export var sheetWorldMeta = {}; // {worldName: {rent: '...'}} — rows without nr
export var sheetLotsLoaded = false;

const SHEET_LOTS_CSV_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vRRllRkwaCacdM0WZZT0cVQflhxJ9Fw5mgId-v615_kE2GdKdbwHMUYCG03HC8gUXfg7lucTs1Mqhg1/pub?output=csv&gid=306313316&single=true';

// Parses the lots CSV into sheetLots / sheetWorldMeta.
function applyLotsCsv(csv){
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
    // World meta row: only welt set, no nr — contains e.g. rent info + image
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
      // hasAtlas: FALSE (English) or FALSCH (Swiss/German sheet) = external world;
      // anything else (TRUE/WAHR/empty) = RPG world with an ATLAS map
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
  // Update portal tokens now — sheetWorldMeta is filled,
  // so characters in Toronto/Kanada/etc. (hasAtlas=false) become visible
  if(typeof updateOtherworldPortalTokens === 'function') updateOtherworldPortalTokens();
}

let sheetRefreshStarted=false;

// Loads the sheet lots once. With cached data the callback runs immediately
// and fresh data is fetched in the background; only the first visit waits for
// the network.
export function fetchSheetLots(cb){
  if(sheetLotsLoaded){ if(cb) cb(); return; }
  var cached=readCache('sheet-lots');
  if(cached){
    applyLotsCsv(cached);
    if(cb) cb();
    refreshSheetLots(cached);
    return;
  }
  fetch(SHEET_LOTS_CSV_URL)
    .then(r=>r.text())
    .then(csv=>{
      applyLotsCsv(csv);
      if(isLotsCsv(csv)) writeCache('sheet-lots',csv);
      if(cb) cb();
    })
    .catch(()=>{ sheetLotsLoaded = true; if(cb) cb(); });
}

// Background refresh after starting from the cache. If the data changed, the
// event 'sheet-lots-updated' tells the open views to re-render.
function refreshSheetLots(cachedCsv){
  if(sheetRefreshStarted) return;
  sheetRefreshStarted=true;
  fetch(SHEET_LOTS_CSV_URL)
    .then(r=>r.text())
    .then(csv=>{
      if(!isLotsCsv(csv) || csv===cachedCsv) return;
      writeCache('sheet-lots',csv);
      applyLotsCsv(csv);
      emit('sheet-lots-updated');
    })
    .catch(function(){});
}

// Only real lots data is cached (not an error page).
function isLotsCsv(csv){
  return typeof csv==='string' && /(^|,)"?welt"?(,|$)/i.test(csv.split('\n')[0]);
}

export function applySheetData(lot, wname){
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

export function getLots(wname){
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
      // If skipping: check if there's an apartment complex anchor (non-placeholder same nr) in the array key
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
