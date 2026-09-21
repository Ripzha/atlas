/* PROJECT ATLAS - World search.
   Search box with favorites and recently visited worlds. Records recent
   worlds through the 'enter-world' event (core/events.js). */

import { on } from '../../core/events.js?v=202609211308';
import { worlds } from '../../data/worlds.js?v=202609211308';
import { mapIA } from './continent-map.js?v=202609211308';

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
  on('enter-world', function(w){
    if(w&&w.name){
      let r=loadRecents().filter(n=>n!==w.name);
      r.unshift(w.name);
      saveRecents(r.slice(0,MAX_RECENTS));
    }
  });

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
  // A click anywhere (not on the search/dot) ends the focus
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

    // Favorites
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

    // All worlds (without favorites/recents — for an empty query)
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
  // Escape closes the dropdown and the focus
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){dropdown.classList.remove('open');clearFocus();searchInput.blur();}
    if(e.key==='Enter' && dropdown.classList.contains('open')){
      const first=dropdown.querySelector('.ws-item');
      if(first) first.click();
    }
  });
})();
