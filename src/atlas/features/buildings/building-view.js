/* PROJECT ATLAS - Building view.
   Floor plans with apartment dots; floor switching. Data: BUILDINGS. Called
   from inline handlers: changeBuildingFloor(). */

import { IMG_CARD, imageUrl } from '../../core/images.js?v=202609182205';
import { on } from '../../core/events.js?v=202609182205';
import { BUILDINGS } from '../../data/buildings.js?v=202609182205';
import { worldLots } from '../../data/world-lots.js?v=202609182205';
import { state } from '../../core/state.js?v=202609182205';
import {
  applySheetData,
  sheetLotsLoaded,
  sheetWorldMeta,
} from '../../core/sheet-data.js?v=202609182205';
import { parseLotLabel } from '../map/lot-helpers.js?v=202609182205';

export let buildingFloorIdx=0,currentBuildingKey=null;

export function enterBuilding(buildingKey,lots){
  buildingFloorIdx=0;currentBuildingKey=buildingKey;
  const bc=document.getElementById('building-container');
  const data=BUILDINGS[buildingKey];
  bc.style.display='block';
  document.getElementById('building-name').textContent=buildingKey;
  try{sessionStorage.setItem('atlas_building',buildingKey);}catch(e){}
  // Show rent info in the building view as well (from the current world)
  (function(){
    var box=document.getElementById('building-rent-info');
    if(!box)return;
    var rent=state.currentWorld ? (sheetWorldMeta[state.currentWorld.name]||{}).rent : '';
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
      ?`<div style="padding:0;overflow:hidden;min-width:160px"><img src="${imageUrl(apt.img,IMG_CARD)}" loading="lazy" decoding="async" style="width:100%;height:90px;object-fit:cover;display:block"><div style="padding:7px 10px">${_textInner}</div></div>`
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
    // Fullscreen loader only for a new image (not again for the same src)
    var needsLoader = (bgImg.src !== img);
    if(needsLoader && typeof window.showAtlasLoading === 'function'){
      window.showAtlasLoading('Karte wird geladen…');
    }
    bgImg.onload=hideLoader;
    bgImg.onerror=hideLoader;
    bgImg.src=img;
    bgImg.style.display='block';
    document.getElementById('building-no-img').style.display='none';
    // If the image is cached, complete=true → no load event. Hide manually.
    if(bgImg.complete && bgImg.naturalWidth > 0) hideLoader();
  }
  else{
    bgImg.style.display='none';
    document.getElementById('building-no-img').style.display='block';
  }
}
export function changeBuildingFloor(dir){
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
export function exitBuilding(){const bc=document.getElementById('building-container');if(bc)bc.style.display='none';try{sessionStorage.removeItem('atlas_building');}catch(e){}}

// Fresh sheet data arrived in the background: update an open building.
on('sheet-lots-updated', function(){
  var bc=document.getElementById('building-container');
  if(currentBuildingKey && bc && bc.style.display!=='none') renderBuildingLots();
});
