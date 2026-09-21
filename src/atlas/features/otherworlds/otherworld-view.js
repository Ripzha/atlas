/* PROJECT ATLAS - "Andere Welten" view.
   Tiles for worlds without an ATLAS map (hasAtlas=FALSE in the sheet) plus
   Bloodmoon Valley. Falls back to OTHERWORLDS_DATA while the sheet loads.
   Called from inline handlers: openOtherWorld(), closeOtherWorlds(). */

import { IMG_TILE, imageUrl } from '../../core/images.js?v=202609211401';
import { OTHERWORLDS_DATA, otherworlds } from '../../data/worlds.js?v=202609211401';
import { sheetWorldMeta } from '../../core/sheet-data.js?v=202609211401';
import { buildCharTokensHtml, getCharsAtWorld } from '../characters/tokens.js?v=202609211401';
import { enterWorld } from '../map/world-view.js?v=202609211401';

export function openOtherWorld(){
  // Collect data from sheetWorldMeta: worlds with hasAtlas=FALSE → into the modal
  // Plus: Bloodmoon Valley as a special case (RPG world WITH its own ATLAS map AND in the modal)
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
  // Bloodmoon Valley: already special in OTHERWORLDS_DATA — RPG world in the modal
  // If present, add it at the front
  var bm = sheetWorldMeta['Bloodmoon Valley'];
  if(bm && bm.hasAtlas !== false){
    data.unshift({
      name: 'Bloodmoon Valley',
      type: bm.category || 'Vampirwelt',
      img: bm.img || null,
      world: otherworlds[0]  // world OBJECT (not a string) so enterWorld() works
    });
  }
  // Fallback: if the sheet is not loaded yet, use the hardcoded list
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
      img.className='ow-img';img.src=imageUrl(ow.img,IMG_TILE);img.alt=ow.name;
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
    // Show tokens on the tile (characters whose lastSeenName = this world)
    var tileChars = getCharsAtWorld(ow.name);
    if(tileChars.length){
      var tokensWrap = document.createElement('div');
      tokensWrap.innerHTML = buildCharTokensHtml(tileChars);
      var inner = tokensWrap.firstChild;
      if(inner){
        inner.setAttribute('data-world-name', ow.name); // so updateAllTokens can refresh it later
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

export function closeOtherWorlds(){
  document.getElementById('otherworlds-container').classList.remove('open');
  try{
    if(sessionStorage.getItem('atlas_view')==='otherworlds') sessionStorage.removeItem('atlas_view');
  }catch(e){}
}
