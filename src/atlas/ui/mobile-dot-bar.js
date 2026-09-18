/* PROJECT ATLAS - Mobile dot bar.
   Bottom bar on touch devices that shows the tapped lot and opens its thread.
   Called from inline handlers: mobileDotOpen(). */

// Show the bar on tap, hide it on tap elsewhere
let _mobileDotUrl='';
export function showMobileDotBar(nr,name,url){
  _mobileDotUrl=url;
  const bar=document.getElementById('mobile-dot-bar');
  document.getElementById('mobile-dot-nr').textContent=nr||name;
  document.getElementById('mobile-dot-name').textContent=(nr&&name!==nr)?name:'';
  bar.classList.add('visible');
}
function hideMobileDotBar(){document.getElementById('mobile-dot-bar').classList.remove('visible');_mobileDotUrl='';}
export function mobileDotOpen(){if(_mobileDotUrl)window.open(_mobileDotUrl,'_blank');}

// Mobile: show bottom bar on tap, hide on tap elsewhere
document.addEventListener('touchstart',e=>{
  document.querySelectorAll('.tapped').forEach(el=>el.classList.remove('tapped'));
  if(e.target.closest('#mobile-dot-bar'))return;
  const dot=e.target.closest('.lot-dot,.cluster-dot,.world-dot');
  if(dot){dot.classList.add('tapped');}
  else{hideMobileDotBar();}
},{passive:true});
