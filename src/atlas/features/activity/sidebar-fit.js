/* PROJECT ATLAS - Fits the right sidebar to the available height.

   "Zuletzt gesehen" and "Im Forum" draw more entries than usually fit (see
   LAST_SEEN_MAX and FORUM_MAX). This module hides entries from the bottom of the
   lists until the sidebar no longer scrolls: on a laptop fewer, on a large
   screen more. It takes from the longer list first; on a tie from "Im Forum",
   because "Zuletzt gesehen" matters more. Each list keeps at least one entry.

   The entries are hidden with a separate style element, NOT inside the lists'
   markup: the mobile sheets copy that markup one to one (ui/mobile-sheets.js),
   and would otherwise lose the hidden entries as well.

   Runs again whenever the sidebar changes size or a list is redrawn. */

const LISTS = ['sidebar-activity', 'sidebar-forum'];   // in order of importance
const STYLE_ID = 'atlas-sidebar-fit';

function styleElement(){
  let el = document.getElementById(STYLE_ID);
  if(!el){
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  return el;
}

function applyCounts(counts, totals){
  styleElement().textContent = LISTS.map((id, i) =>
    counts[i] < totals[i] ? '#' + id + ' > :nth-child(n+' + (counts[i] + 1) + '){display:none!important}' : ''
  ).join('\n');
}

export function fitRightSidebar(){
  const right = document.getElementById('right');
  const lists = LISTS.map(id => document.getElementById(id));
  // Hidden (phones): nothing to fit, show everything
  if(!right || right.offsetParent === null || lists.some(l => !l)){
    styleElement().textContent = '';
    return;
  }
  const totals = lists.map(l => l.children.length);
  const counts = totals.slice();
  applyCounts(counts, totals);

  let guard = 60;
  while(right.scrollHeight > right.clientHeight + 1 && guard-- > 0){
    // The longer list gives up an entry; on a tie the less important one
    let i = counts[0] > counts[1] ? 0 : 1;
    if(counts[i] <= 1) i = 1 - i;
    if(counts[i] <= 1) break;          // both at their minimum
    counts[i]--;
    applyCounts(counts, totals);
  }
}

let pending = false;
function scheduleFit(){
  if(pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; fitRightSidebar(); });
}

function watch(){
  const right = document.getElementById('right');
  if(!right) return;
  if(typeof ResizeObserver === 'function') new ResizeObserver(scheduleFit).observe(right);
  window.addEventListener('resize', scheduleFit);
  const lists = LISTS.concat(['sidebar-newchars']).map(id => document.getElementById(id)).filter(Boolean);
  const mo = new MutationObserver(scheduleFit);
  lists.forEach(l => mo.observe(l, { childList: true }));
  scheduleFit();
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
else watch();
