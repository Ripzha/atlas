/* PROJECT ATLAS - Start-up.
   Loads characters, sheet lots, stats and forum activity as soon as the page
   is parsed (from the cache first, then fresh in the background), restores the
   last view, prioritizes images of the entry view, and pauses periodic updates
   while the tab is hidden. Imported last by main.js. */

import { IMG_CARD, imageUrl } from './images.js?v=202609201833';
import { on } from './events.js?v=202609201833';
import { readCache } from './cache.js?v=202609201833';
import { otherworlds, worlds } from '../data/worlds.js?v=202609201833';
import { worldLots } from '../data/world-lots.js?v=202609201833';
import { fetchSheetLots, sheetWorldMeta } from './sheet-data.js?v=202609201833';
import { repositionTooltips } from '../ui/tooltips.js?v=202609201833';
import {
  updateSidebarForum,
  updateSidebarStats,
} from '../features/activity/sidebar-feeds.js?v=202609201833';
import { openOtherWorld } from '../features/otherworlds/otherworld-view.js?v=202609201833';
import { enterBuilding } from '../features/buildings/building-view.js?v=202609201833';
import {
  fetchCharsFromScript,
  openCharView,
} from '../features/characters/character-view.js?v=202609201833';
import { enterWorld } from '../features/map/world-view.js?v=202609201833';

// Detection runs BEFORE load so other functions can read it
var ENTRY_MODE = (function(){
  try {
    if(location.hash && location.hash.match(/^#chars/)) return 'chars';
    if(sessionStorage.getItem('atlas_world')) return 'world';
  } catch(e){}
  return 'continent'; // Default
})();
// After load: the first N images of the entry view get fetchpriority=high
// so they render faster. The browser loads them in parallel to the lazy logic.
// Mobile-aware: sidebars are display:none below 768px → not prioritized,
// the character tokens on the world dots instead (those are visible).
function _prioritizeInitialImages(){
  try {
    var isMobile = window.matchMedia('(max-width:768px)').matches;
    var sel, limit;
    if(ENTRY_MODE === 'chars'){
      sel = '.char-portrait';
      limit = isMobile ? 8 : 12;
    } else if(ENTRY_MODE === 'world'){
      // On mobile .cluster-hover is hidden — lot tooltip images only
      sel = isMobile ? '.lot-tooltip img' : '.lot-tooltip img, .cluster-item-preview';
      limit = isMobile ? 6 : 12;
    } else {
      // continent Default
      if(isMobile){
        // Sidebars and .hover-card are display:none — but the tokens on the dots are visible
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

// Bot protection / quota saving: user interaction counts (mouse, scroll, touch, keyboard).
// Avoidable Apps Script calls wait until a real user is present.
export var _hasInteracted = false;
function _markInteracted(){ _hasInteracted = true; }
['mousemove','scroll','keydown','touchstart','click'].forEach(function(ev){
  window.addEventListener(ev, _markInteracted, {once:true, passive:true});
});

// Tab visibility: periodic updates only run while the tab is in the foreground
export function _isVisible(){ return document.visibilityState !== 'hidden'; }

// setInterval wrapper that pauses while the tab is hidden
function _smartInterval(fn, ms){
  return setInterval(function(){
    if(!_isVisible()) return;
    fn();
  }, ms);
}

// Start-up: runs once the document is parsed (DOMContentLoaded), not on
// window "load" — that would also wait for every image, including the large
// continent map, before any data is shown.
document.addEventListener('DOMContentLoaded',function(){
  // The loading screen is only needed on the very first visit: with cached
  // characters and lots, everything is shown immediately and refreshed in the
  // background. Hide it once the characters fetch AND the lots fetch are done.
  var _initLoaderActive = false;
  var _initPending = 2; // Chars + Lots
  var _hasCache = !!(readCache('chars') && readCache('sheet-lots'));
  if(!_hasCache && typeof window.showAtlasLoading === 'function'){
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
  // Safety timeout: hide the loader after 6s at the latest (in case the network is dead)
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
  // Fetch the sheet lots on load so the hover preview images on the
  // continent map show the sheet image (not only after entering a world)
  fetchSheetLots(function(){
    _initStepDone();
    updateHoverImages();
  });
  on('sheet-lots-updated', updateHoverImages);
  // Periodic updates pause while the tab is hidden
  _smartInterval(updateSidebarForum, 5*60*1000);
  _smartInterval(updateSidebarStats, 2*60*1000);

  // Restore the last view: character view from the URL hash, otherwise the
  // world/building/view saved in sessionStorage
  var charMatch = location.hash.match(/^#chars-(.+)$/);
  if(charMatch){
    openCharView(charMatch[1]);
  }
  try{
    var saved=sessionStorage.getItem('atlas_world');
    var savedBuilding=sessionStorage.getItem('atlas_building');
    var savedView=sessionStorage.getItem('atlas_view'); // 'chars' | 'otherworlds' | null
    if(saved){
      var w=worlds.find(function(x){return x.name===saved;});
      if(!w)w=otherworlds.find(function(x){return x.name===saved;});
      if(w)setTimeout(function(){
        enterWorld(w);
        // After enterWorld (which triggers fetchSheetLots) restore the building too
        if(savedBuilding){
          setTimeout(function(){
            // Find the building lots in the current world
            var lots=(worldLots[w.name]||[]).filter(function(l){return l.building===savedBuilding;});
            if(lots.length && typeof enterBuilding==='function') enterBuilding(savedBuilding,lots);
          },600);
        }
      },100);
    }
    if(!charMatch && savedView === 'chars'){
      setTimeout(function(){ openCharView('haupt'); }, 150);
    } else if(!charMatch && savedView === 'otherworlds'){
      setTimeout(function(){ openOtherWorld(); }, 150);
    }
  }catch(e){}

  // Prioritize images of the entry view — after the DOM is built
  setTimeout(_prioritizeInitialImages, 100);
  setTimeout(_prioritizeInitialImages, 800); // second pass in case the sidebars render later
});

// Update all hover images on the continent map in case the sheet overrides a
// world image.
function updateHoverImages(){
  document.querySelectorAll('.world-dot').forEach(function(dot){
    var wname=dot.dataset.worldKey;
    var sheetImg=imageUrl((sheetWorldMeta[wname]||{}).img,IMG_CARD);
    if(!sheetImg)return;
    var img=dot.querySelector('.hover-img');
    if(img){
      if(img.getAttribute('src')!==sheetImg) img.src=sheetImg;
      img.style.display='block';
    } else {
      // If there was no image before (w.img empty): insert one
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
}
