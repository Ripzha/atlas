/* PROJECT ATLAS - Legend.
   Toggles the legend boxes and closes them on outside clicks.
   Called from inline handlers: toggleLegend(). */

export function toggleLegend(btn){btn.nextElementSibling.classList.toggle('open');}
document.addEventListener('click',e=>{document.querySelectorAll('.legend-box.open').forEach(b=>{if(!b.previousElementSibling.contains(e.target)&&!b.contains(e.target))b.classList.remove('open');});});

/* Places the world legend in the bottom right corner of the map picture — on
   the map and above the bar of occupied lots, not squeezed into that bar.
   The map keeps its aspect ratio and is centred (sizeWorldImageArea in
   world-view.js), so its corner moves with the window size. The offset*
   values ignore the zoom transform on purpose: the legend stays put while the
   map is zoomed or panned. If this does not run, the CSS position in base.css
   (bottom right of the view) remains as the fallback. */
const GAP = 10;

function placeWorldLegend(){
  const wc = document.getElementById('world-container');
  const map = document.getElementById('world-image-area');
  if(!wc || !map || !wc.classList.contains('active')) return;
  const btn = wc.querySelector(':scope > .legend-btn');
  const box = wc.querySelector(':scope > .legend-box');
  if(!btn || !box || !map.offsetWidth) return;

  const W = wc.clientWidth, H = wc.clientHeight;
  // Map corner, relative to .image-area-wrap, which fills #world-container
  let bottomEdge = Math.min(map.offsetTop + map.offsetHeight, H);
  const rightEdge = Math.min(map.offsetLeft + map.offsetWidth, W);
  // Never below the top of the bar of occupied lots
  const bar = document.getElementById('world-lots-bar');
  if(bar && bar.offsetHeight && getComputedStyle(bar).display !== 'none'){
    bottomEdge = Math.min(bottomEdge, bar.offsetTop);
  }
  const bottom = (H - bottomEdge) + GAP;
  const right = (W - rightEdge) + GAP;
  btn.style.bottom = bottom + 'px';
  btn.style.right = right + 'px';
  box.style.bottom = (bottom + btn.offsetHeight + 6) + 'px';
  box.style.right = right + 'px';
}

let pending = false;
function schedule(){
  if(pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; placeWorldLegend(); });
}

function watch(){
  const wc = document.getElementById('world-container');
  if(!wc) return;
  const targets = [wc, document.getElementById('world-image-area'), document.getElementById('world-lots-bar')].filter(Boolean);
  if(typeof ResizeObserver === 'function'){
    const ro = new ResizeObserver(schedule);
    targets.forEach(t => ro.observe(t));
  }
  // Entering a world switches #world-container to .active
  new MutationObserver(schedule).observe(wc, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', schedule);
  schedule();
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
else watch();
