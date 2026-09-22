/* PROJECT ATLAS - Pinch zoom and pan.
   Touch zoom/pan for the continent map and the world view. The world zoom is
   paused while calibration mode is active (calibWorldMode from core/state.js). */

import { state } from '../core/state.js?v=202609221359';

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
    // Show tokens on touch devices from 50% zoom (sc >= 1.5)
    el.classList.toggle('tokens-on-zoom',sc>=1.5);
  }
  function clampPan(){
    const ww=wrap.clientWidth,wh=wrap.clientHeight;
    const ew=el.offsetWidth,eh=el.offsetHeight;
    const sw=ew*sc,sh=eh*sc;
    // transform-origin: 50% 50% — the element scales from its center.
    // At tx=0, ty=0 the element is flex-centered in the wrap.
    // Max pan: as long as the element edge does not slide into the wrap.
    // If sw > ww: max |tx| = (sw - ww) / 2
    // If sw <= ww: tx must be 0 (otherwise gaps show)
    // On touch + zoom: allow vertical pan for 16:9 maps in portrait
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
    // A touch on the "Andere Welten" portal must drag the portal, not pan the map
    if(e.target.closest && e.target.closest('#otherworld-portal')) return;
    if(e.touches.length===1){
      p1x=e.touches[0].clientX-tx;
      p1y=e.touches[0].clientY-ty;
    }
    if(e.touches.length===2){
      const a=e.touches[0],b=e.touches[1];
      pd0=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)||1;
      sc0=sc;
      // Wrap center as anchor (matches transform-origin: 50% 50%)
      const wr=wrap.getBoundingClientRect();
      const wcx=wr.left+wr.width/2, wcy=wr.top+wr.height/2;
      const mx=(a.clientX+b.clientX)/2,my=(a.clientY+b.clientY)/2;
      // Element-local coordinate of the finger point before scaling (relative to element center)
      // Element center on screen is (wcx + tx, wcy + ty)
      lx0=(mx-(wcx+tx))/sc0;
      ly0=(my-(wcy+ty))/sc0;
      // Store wrap center as nlx/nly for move
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
      // The finger point must stay at the same element-local coordinate (lx0,ly0)
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
  guard:()=>state.calibWorldMode
});
const _mapZoom=makePinchZoom(document.getElementById('map-image-area'));
// Expose on window so goBack() can reset the zoom
window._worldZoom=_worldZoom;
window._mapZoom=_mapZoom;
