/* PROJECT ATLAS - Tooltips.
   Sidebar nav tooltips (items with a data-tip attribute) and repositioning of
   lot/cluster tooltips that would leave the screen. */

// Hover tooltip for sidebar items with a data-tip attribute.
// Same style as .activity-preview, but without fetch/async.
var _navTipEl = null;
function showNavTip(item, text){
  hideNavTip();
  var rect = item.getBoundingClientRect();
  var div = document.createElement('div');
  div.className = 'activity-preview';
  div.textContent = text;
  document.body.appendChild(div);
  _navTipEl = div;
  // Measure the real width instead of assuming max-width — otherwise the tooltip
  // ends up needlessly far from the item for short texts
  var w = div.offsetWidth;
  var left = rect.right + 12;
  var side = 'right';
  if(left + w > window.innerWidth - 8){
    left = rect.left - w - 12;
    side = 'left';
  }
  var top = rect.top + rect.height/2 - div.offsetHeight/2;
  if(top < 8) top = 8;
  if(top + div.offsetHeight > window.innerHeight - 8) top = window.innerHeight - div.offsetHeight - 8;
  div.style.left = left + 'px';
  div.style.top = top + 'px';
  div.classList.add(side);
}
function hideNavTip(){
  if(_navTipEl){
    _navTipEl.remove();
    _navTipEl = null;
  }
}
document.addEventListener('mouseover', function(e){
  var t = e.target.closest('[data-tip]');
  if(t) showNavTip(t, t.getAttribute('data-tip'));
});
document.addEventListener('mouseout', function(e){
  var t = e.target.closest('[data-tip]');
  if(t) hideNavTip();
});

// Reposition lot/cluster tooltips that would go off-screen
export function repositionTooltips(){
  document.querySelectorAll('.lot-dot, .cluster-dot').forEach(function(dot){
    var tt = dot.querySelector('.lot-tooltip, .cluster-hover');
    if(!tt) return;
    dot.addEventListener('mouseenter', function(){
      // Reset first
      tt.style.bottom = '';
      tt.style.top = '';
      tt.style.transform = '';
      // Check after display
      requestAnimationFrame(function(){
        var r = tt.getBoundingClientRect();
        var dotR = dot.getBoundingClientRect();
        // Off top
        if(r.top < 60){
          tt.style.bottom = 'auto';
          tt.style.top = '18px';
          tt.style.transform = 'translateX(-50%)';
        }
        // Off right
        if(r.right > window.innerWidth - 10){
          tt.style.left = 'auto';
          tt.style.right = '0';
          tt.style.transform = 'none';
        }
        // Off left
        if(r.left < 10){
          tt.style.left = '0';
          tt.style.transform = 'none';
        }
      });
    });
    dot.addEventListener('mouseleave', function(){
      tt.style.bottom = '';
      tt.style.top = '';
      tt.style.transform = '';
      tt.style.left = '';
      tt.style.right = '';
    });
  });
}
setTimeout(repositionTooltips, 1000);
