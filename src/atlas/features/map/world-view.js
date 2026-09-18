/* PROJECT ATLAS - World view.
   Entering a world (image, rent info, lots), rendering lots and clusters,
   going back, and clicks in the world view (calibration mode).
   Called from inline handlers: goBack().
   Other files can react to entering a world via on('enter-world', fn) from
   core/events.js (the world search uses it for "Zuletzt besucht"). */

import { IMG_CARD, imageUrl } from '../../core/images.js?v=202609182234';
import { emit, on } from '../../core/events.js?v=202609182234';
import { worldLots } from '../../data/world-lots.js?v=202609182234';
import { customLots, state } from '../../core/state.js?v=202609182234';
import {
  fetchSheetLots,
  getLots,
  sheetLots,
  sheetLotsLoaded,
  sheetWorldMeta,
} from '../../core/sheet-data.js?v=202609182234';
import { repositionTooltips } from '../../ui/tooltips.js?v=202609182234';
import { showMobileDotBar } from '../../ui/mobile-dot-bar.js?v=202609182234';
import { updateAllTokens } from '../characters/tokens.js?v=202609182234';
import { enterBuilding, exitBuilding } from '../buildings/building-view.js?v=202609182234';
import {
  calibWorldLots,
  updateCalibLog,
  updateCalibrating,
} from '../admin/calibration.js?v=202609182234';
import { renderAdminContent } from '../admin/admin-panel.js?v=202609182234';
import { getBuildingNrRange, groupLots, parseLotLabel } from './lot-helpers.js?v=202609182234';
import { mapC, mapIA } from './continent-map.js?v=202609182234';

export function enterWorld(w){
  emit('enter-world', w);
  try{sessionStorage.setItem('atlas_world',w.name);}catch(e){}
  state.currentWorld=w;
  mapC.classList.remove('active');
  const wc=document.getElementById('world-container');
  wc.classList.add('active');
  sizeWorldImageArea();
  document.getElementById('world-name-display').textContent=w.name;
  document.getElementById('world-type-display').textContent=w.type;
  renderWorldRent(w);
  setWorldBg(w);
  document.getElementById('world-subtitle').textContent='/ '+w.name;
  document.getElementById('btn-back').style.display='inline-block';
  document.getElementById('mob-back').style.display='flex';
  state.calibWorldData=[];updateCalibLog('world');
  var _cl0=calibWorldLots(w.name)[0];document.getElementById('calib-world-next').textContent=(_cl0?_cl0.label:'—');
  document.getElementById('calib-world-count').textContent='0';
  exitBuilding();
  // Loading screen only on the FIRST world entry of the session (sheet lots not loaded yet)
  var _showLoader = (typeof sheetLotsLoaded !== 'undefined' && !sheetLotsLoaded && typeof window.showAtlasLoading === 'function');
  if(_showLoader) window.showAtlasLoading('Welt wird geladen…');
  fetchSheetLots(()=>{
    // After the sheet fetch: image, rent and lots again in case the data only arrived now
    renderWorldSheetData(w);
    if(_showLoader && typeof window.hideAtlasLoading === 'function') window.hideAtlasLoading();
  });
}

// Rent info from sheet meta (row with welt=... but without nr)
function renderWorldRent(w){
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
}

// World image: sheet meta wins over the hardcoded w.img. Skipped if the same
// image is already shown (no reload, no flicker).
// If the image fails to load, the gradient is shown instead. The gradient markup
// contains double quotes, so they are escaped as &quot; inside the onerror
// attribute. An image replaced in the meantime has no parent any more, hence
// the parentElement check.
function setWorldBg(w){
  var bg=document.getElementById('world-bg');
  var sheetImg=(sheetWorldMeta[w.name]||{}).img;
  var imgUrl=sheetImg||w.img;
  var current=bg.querySelector('img');
  if(imgUrl && current && current.getAttribute('src')===imgUrl) return;
  const _grad=`<div style="position:absolute;inset:0;background:linear-gradient(135deg,${w.color}33,#0a1420)"></div>`;
  bg.innerHTML=imgUrl
    ?`<img src="${imgUrl}" alt="${w.name}" decoding="async" style="width:100%;height:100%;object-fit:cover;filter:brightness(0.65) saturate(0.9);display:block" onerror="if(this.parentElement)this.parentElement.innerHTML='${_grad.replace(/'/g,"\\'").replace(/"/g,'&quot;')}'">`
    :_grad;
}

// Everything in the world view that depends on the sheet data.
function renderWorldSheetData(w){
  setWorldBg(w);
  renderWorldRent(w);
  renderLots(w); if(state.adminMode)renderAdminContent(); setTimeout(updateAllTokens,100); setTimeout(repositionTooltips,200);
}

// Fresh sheet data arrived in the background: update the open world.
on('sheet-lots-updated', function(){
  if(state.currentWorld && document.getElementById('world-container').classList.contains('active')){
    renderWorldSheetData(state.currentWorld);
  }
});

export function goBack(){
  const bc=document.getElementById('building-container');
  if(bc&&bc.style.display!=='none'){exitBuilding();return;}
  document.getElementById('world-container').classList.remove('active');
  mapC.classList.add('active');
  document.getElementById('world-subtitle').textContent='';
  document.getElementById('btn-back').style.display='none';
  document.getElementById('mob-back').style.display='none';
  state.calibWorldMode=false;
  document.getElementById('calib-world-panel').style.display='none';
  updateCalibrating();
  document.getElementById('world-container').style.cursor='default';
  // Reset the world zoom so the next entry is not zoomed in
  if(window._worldZoom && window._worldZoom.reset) window._worldZoom.reset();
  // Reset view states on the continent map
  mapIA.querySelectorAll('.world-dot.show-tokens').forEach(d=>d.classList.remove('show-tokens'));
  mapIA.classList.remove('focus-mode');
  mapIA.querySelectorAll('.world-dot.focused').forEach(d=>d.classList.remove('focused'));
  try{sessionStorage.removeItem('atlas_world');sessionStorage.removeItem('atlas_building');}catch(e){}
  state.currentWorld=null;
}

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
        ?`<div class="lot-tooltip" style="${_tb};padding:0;overflow:hidden;min-width:160px"><img src="${imageUrl(lot.img,IMG_CARD)}" loading="lazy" decoding="async" style="width:100%;height:90px;object-fit:cover;display:block"><div style="padding:7px 10px">${_ti}</div></div>`
        :`<div class="lot-tooltip" style="${_tb};padding:6px 10px">${_ti}</div>`;
      ld.innerHTML=(lot.info?`<div class="lot-inner" style="width:11px;height:11px;background:${_dotBg};box-shadow:${_dotShadow};transform:rotate(45deg);border-radius:2px"></div>`:`<div class="lot-pulse"></div><div class="lot-inner" style="width:12px;height:12px;background:${_dotBg};box-shadow:${_dotShadow}"></div>`)+`<div class="lot-label">${(()=>{const p=parseLotLabel(lot);return p.sub?`${p.num}<span class="lot-sublabel">${p.sub}</span>`:p.num;})()}</div><div class="dot-char-tokens" data-lot-url="${lot.url||''}"></div>${_tt}`;
      if(!lot.info){ld.addEventListener('click',e=>{
        e.stopPropagation();
        if(state.calibWorldMode)return;
        if(!lot.url)return; // complex anchor etc. without URL: no about:blank click
        // Touch devices (any screen size): tap-to-preview, tap-to-enter pattern
        if(window.matchMedia('(pointer:coarse)').matches){
          // First tap: show tokens + mobile bar
          // Second tap on the same lot: straight to the thread
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
      const lblParts=isBuilding?(()=>{const base=buildings[0].split('-')[0].trim();const range=getBuildingNrRange(buildings[0],state.currentWorld?.name);return{main:range||base,sub:range?base:''};})():(()=>{
        // Non-building cluster: find the main nr (without letter suffix) = apartment complex anchor
        // Fallback: use parseLotLabel on first lot to strip ZZ/ZY suffix → "Nr. 6ZZ" → "Nr. 6"
        const mainLot=group.lots.find(l=>l.nr&&/^Nr\.\s*\d+$/.test(l.nr))||group.lots[0];
        const baseNum=parseLotLabel(mainLot).num;
        return{main:baseNum,sub:''};
      })();
      const lbl=lblParts.sub?`${lblParts.main}<span class="lot-sublabel">${lblParts.sub}</span>`:lblParts.main;
      const lblPlain=lblParts.sub?`${lblParts.main} · ${lblParts.sub}`:lblParts.main;
      const itemsHtml=group.lots.map(l=>`<div class="cluster-item" data-url="${l.url}">${l.img?`<img class="cluster-item-preview" src="${imageUrl(l.img,IMG_CARD)}" loading="lazy" decoding="async">`:''}<div class="cluster-pip" style="background:${l.active?'#4aaa6a':'rgba(255,255,255,0.4)'}"></div>${parseLotLabel(l).num}${parseLotLabel(l).sub?` <span style="color:rgba(255,255,255,0.45);font-size:10px">– ${parseLotLabel(l).sub}</span>`:''}<div class="cluster-item-chars" data-lot-url="${l.url||''}"></div></div>`).join('');
      // All lot URLs of the group as a pipe string — updateAllTokens aggregates characters from it
      const clusterUrls=group.lots.map(l=>l.url||'').filter(Boolean).join('|');
      const lotsWithImg=group.lots.filter(l=>l.img);
      // Apartment complex anchor image: if no lot has its own image, look in the
      // sheet for an anchor (row with the same dotGroup, without threadUrl, with imgUrl)
      let anchorImg=null;
      if(!isBuilding && !lotsWithImg.length && state.currentWorld){
        const ws=sheetLots[state.currentWorld.name]||{};
        // Find the main number of the group (e.g. "11" from "Nr. 11A", "Nr. 11B")
        const mainLot=group.lots.find(l=>l.nr&&/^Nr\.\s*\d+$/.test(l.nr))||group.lots[0];
        const mainNum=mainLot&&mainLot.nr?mainLot.nr.replace(/^Nr\.\s*/,'').trim():'';
        if(mainNum){
          // Search the sheet for entries with a matching dotGroup and imgUrl
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
        ?`<div class="cluster-hover" style="border:1px solid ${color}88;box-shadow:0 6px 28px ${color}44;min-width:180px"><img src="${imageUrl(buildingImg,IMG_CARD)}" loading="lazy" decoding="async" style="width:100%;height:110px;object-fit:cover;display:block"><div class="hover-footer"><span class="hover-type">${lblPlain}</span><span class="hover-action" style="color:${color}">Betreten →</span></div></div>`
        :(!isBuilding&&lotsWithImg.length>0)?`<div class="cluster-hover" style="border:1px solid ${color}88;box-shadow:0 6px 28px ${color}44"><div style="display:flex;gap:1px">${lotsWithImg.map(l=>`<div style="position:relative;flex:1;min-width:0"><img src="${imageUrl(l.img,IMG_CARD)}" loading="lazy" decoding="async" style="width:100%;height:75px;object-fit:cover;display:block"><div style="position:absolute;bottom:3px;left:5px;font-size:8px;font-weight:600;text-shadow:0 1px 3px #000;color:#fff">${parseLotLabel(l).num}</div></div>`).join('')}</div><div class="hover-footer"><span class="hover-type">${group.lots.length} Orte</span><span class="hover-action" style="color:${color}">Klicken →</span></div></div>`
        :(!isBuilding&&anchorImg)?`<div class="cluster-hover" style="border:1px solid ${color}88;box-shadow:0 6px 28px ${color}44;min-width:180px"><img src="${imageUrl(anchorImg,IMG_CARD)}" loading="lazy" decoding="async" style="width:100%;height:110px;object-fit:cover;display:block"><div class="hover-footer"><span class="hover-type">${group.lots.length} Orte</span><span class="hover-action" style="color:${color}">Klicken →</span></div></div>`:'';
      cd.innerHTML=`<div class="cluster-inner" style="color:${color};border-color:${color};box-shadow:0 0 8px ${color}44">${isBuilding?'🏢':group.lots.length}</div><div class="cluster-label">${lbl}</div><div class="dot-char-tokens" data-cluster-urls="${clusterUrls}"></div>${clusterHoverHtml}${isBuilding?'':` <div class="cluster-popup"><div style="font-size:10px;color:rgba(255,165,0,0.7);margin-bottom:6px;padding:0 4px">📦 ${group.lots.length} Orte</div>${itemsHtml}</div>`}`;
      // Cluster items: two-tap behavior on mobile, open directly on desktop
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
        e.stopPropagation();if(state.calibWorldMode)return;
        if(isBuilding){enterBuilding(buildings[0],group.lots);return;}
        wc.querySelectorAll('.cluster-dot.open').forEach(c=>{if(c!==cd)c.classList.remove('open');});
        cd.classList.toggle('open');
      });
      wia.appendChild(cd);
    }
    group.lots.forEach(lot=>{
      // Skip lots without a name (otherwise the pill shows "undefined")
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

function sizeWorldImageArea(){
  const wia=document.getElementById('world-image-area');
  if(!wia)return;
  const cw=worldC.clientWidth,ch=worldC.clientHeight;
  const scale=Math.min(cw/1920,ch/1200);
  wia.style.width=(1920*scale)+'px';
  wia.style.height=(1200*scale)+'px';
}
window.addEventListener('resize',sizeWorldImageArea);

export const worldC=document.getElementById('world-container');
worldC.addEventListener('click',e=>{
  if(!e.target.closest('.cluster-dot'))worldC.querySelectorAll('.cluster-dot.open').forEach(c=>c.classList.remove('open'));
  if(!state.calibWorldMode)return;
  if(e.target.closest('.lot-dot')||e.target.closest('.cluster-dot')||e.target.closest('.calib-panel')||e.target.closest('.calib-btn')||e.target.closest('#world-lots-bar'))return;
  const wia2=document.getElementById('world-image-area');
  const r=wia2.getBoundingClientRect();
  const x=+((e.clientX-r.left)/r.width*100).toFixed(1);
  const y=+((e.clientY-r.top)/r.height*100).toFixed(1);
  // Same order as data/world-lots.js, see calibWorldLots()
  const allLots=calibWorldLots(state.currentWorld?.name||'');
  const idx=state.calibWorldData.length;
  if(idx>=allLots.length){alert('Alle '+allLots.length+' Orte sind gesetzt — jetzt kopieren.');return;}
  state.calibWorldData.push({nr:allLots[idx].nr,name:allLots[idx].name,x,y});
  updateCalibLog('world');
  var _cln=allLots[idx+1];document.getElementById('calib-world-next').textContent=(_cln?_cln.label:'✅ Fertig! Jetzt kopieren');
  document.getElementById('calib-world-count').textContent=state.calibWorldData.length;
});
