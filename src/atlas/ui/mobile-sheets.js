/* PROJECT ATLAS - Mobile sheets.
   Bottom sheets on phones (navigation, activity), syncing the activity sheet
   with the desktop sidebar, and swipe-down to close.
   Classic script, loaded after core.js. Called from inline handlers:
   openSheet(), closeSheet(). */

function openSheet(id){
  document.getElementById('sheet-overlay').classList.add('open');
  ['nav','activity'].forEach(s=>document.getElementById('sheet-'+s).classList.toggle('open',s===id));
  // Activity sheet: clone content + click handlers from the desktop sidebar.
  // syncMobileActivitySheet does that (only acts while the sheet is open)
  if(id === 'activity' && typeof syncMobileActivitySheet === 'function'){
    syncMobileActivitySheet();
  }
}
function closeSheet(){document.getElementById('sheet-overlay').classList.remove('open');document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('open'));}

// Syncs the desktop sidebar content into the mobile activity sheet while it is open.
// Called after every updateSidebar* so the sheet updates live.
function syncMobileActivitySheet(){
  var sheet = document.getElementById('sheet-activity');
  if(!sheet || !sheet.classList.contains('open')) return;
  try {
    var pairs = [
      ['sidebar-activity', 'sidebar-activity-mob'],
      ['sidebar-newchars', 'sidebar-newchars-mob'],
      ['sidebar-forum',    'sidebar-forum-mob']
    ];
    pairs.forEach(function(p){
      var src = document.getElementById(p[0]);
      var dst = document.getElementById(p[1]);
      if(!src || !dst) return;
      dst.innerHTML = src.innerHTML;
      // Re-attach click handlers after the innerHTML copy (innerHTML does not copy listeners).
      // Hover preview listeners are NOT attached — useless on touch and needlessly heavy.
      // Also remove data-tip attributes — those are desktop tooltips.
      dst.querySelectorAll('[data-url]').forEach(function(item){
        item.removeAttribute('data-tip');
        var url = item.getAttribute('data-url');
        if(!url) return;
        item.addEventListener('click', function(){ window.open(url, '_blank'); });
      });
    });
  } catch(_){}
}

document.querySelectorAll('.sheet').forEach(sheet=>{
  let sy=0, startedOnHandle=false;
  sheet.addEventListener('touchstart', e=>{
    sy = e.touches[0].clientY;
    // Close only if the touch starts on the handle (grip at the top).
    // Otherwise the user is scrolling inside the sheet — no close trigger, or it would eat scroll-up gestures.
    startedOnHandle = !!e.target.closest('.sheet-handle');
  }, {passive:true});
  sheet.addEventListener('touchend', e=>{
    if(!startedOnHandle) return;
    const dy = e.changedTouches[0].clientY - sy;
    if(dy > 60) closeSheet();
  }, {passive:true});
});
