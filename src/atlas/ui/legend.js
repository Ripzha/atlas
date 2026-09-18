/* PROJECT ATLAS - Legend.
   Toggles the legend boxes and closes them on outside clicks.
   Called from inline handlers: toggleLegend(). */

export function toggleLegend(btn){btn.nextElementSibling.classList.toggle('open');}
document.addEventListener('click',e=>{document.querySelectorAll('.legend-box.open').forEach(b=>{if(!b.previousElementSibling.contains(e.target)&&!b.contains(e.target))b.classList.remove('open');});});
