/* PROJECT ATLAS - Continent map.
   Sizes the map image, creates the world dots with hover cards and token
   containers, handles tap-to-preview on touch devices and the map calibration
   click. */

import { IMG_CARD, imageUrl } from '../../core/images.js?v=202609221307';
import { worlds } from '../../data/worlds.js?v=202609221307';
import { state } from '../../core/state.js?v=202609221307';
import { updateAllTokens } from '../characters/tokens.js?v=202609221307';
import { updateCalibLog } from '../admin/calibration.js?v=202609221307';
import { enterWorld } from './world-view.js?v=202609221307';

export const mapC=document.getElementById('map-container');
export const mapIA=document.getElementById('map-image-area');

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
  el.innerHTML=`<div class="dot-pulse" style="width:34px;height:34px;border-color:${w.color}"></div><div class="dot-inner" style="width:11px;height:11px;background:${w.color};box-shadow:0 0 5px ${w.color}"></div><div class="dot-label">${w.name}</div><div class="dot-char-tokens" data-world-name="${w.name}"></div><div class="hover-card" style="border:1px solid ${w.color}88;box-shadow:0 6px 28px ${w.color}44"><div style="position:relative">${w.img?`<img class="hover-img" src="${imageUrl(w.img,IMG_CARD)}" loading="lazy" decoding="async" onerror="this.style.display='none'">`:''}<div class="hover-gradient"></div><div class="hover-name">${w.name}</div></div><div class="hover-footer"><span class="hover-type">${w.type}</span><span class="hover-action" style="color:${w.color}">Öffnen →</span></div></div>`;
  el.addEventListener('click',e=>{
    e.stopPropagation();
    if(state.calibMapMode)return;
    // Navigator mode: a click fills the dropdown instead of entering the world
    if(window.naviDotClick && naviDotClick(w.name)) return;
    // On mobile: first tap = preview (tokens + focus), second tap = enter the world
    if(window.matchMedia('(pointer:coarse)').matches){
      if(el.classList.contains('show-tokens')){
        // second tap → enter
        enterWorld(w);
      } else {
        // first tap → show preview + focus the world
        mapIA.querySelectorAll('.world-dot.show-tokens').forEach(d=>{if(d!==el)d.classList.remove('show-tokens');});
        el.classList.add('show-tokens');
        // Focus the world (dim the other dots)
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
  // Mobile: make the hover card itself clickable so a tap on the card area
  // (with the "Öffnen →" text) also enters the world. Before: pointer-events:none
  // let taps through — but they rarely hit the dot and landed on
  // background elements. A direct card click is more robust.
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
// A tap anywhere else (not on a world dot) closes the token preview
if(window.matchMedia('(pointer:coarse)').matches){
  document.addEventListener('click',function(e){
    if(!e.target.closest('.world-dot') && !e.target.closest('#world-search-box')){
      mapIA.querySelectorAll('.world-dot.show-tokens').forEach(d=>d.classList.remove('show-tokens'));
      // clear the focus as well
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

mapC.addEventListener('click',e=>{
  if(!state.calibMapMode)return;
  if(e.target.closest('.calib-panel')||e.target.closest('.calib-btn'))return;
  const r=mapIA.getBoundingClientRect();
  const x=+((e.clientX-r.left)/r.width*100).toFixed(1);
  const y=+((e.clientY-r.top)/r.height*100).toFixed(1);
  const w=worlds[state.calibMapIdx];
  if(!w){alert('Alle kalibriert!');return;}
  state.calibMapData.push({name:w.name,x,y});state.calibMapIdx++;
  updateCalibLog('map');
  document.getElementById('calib-next').textContent=worlds[state.calibMapIdx]?.name||'✓ Fertig';
},true);
