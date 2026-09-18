/* PROJECT ATLAS - Draggable panels.
   Makes the calibration panels draggable by their h4 header.
   Classic script, loaded before core.js. */

// Make calibration panels draggable (the h4 is the grab handle)
(function(){
  function makeDraggable(panel) {
    var header = panel.querySelector('h4');
    if (!header) return;
    var dragging = false, sx = 0, sy = 0, px = 0, py = 0;
    function onDown(e) {
      dragging = true;
      var t = e.touches ? e.touches[0] : e;
      sx = t.clientX; sy = t.clientY;
      var rect = panel.getBoundingClientRect();
      px = rect.left; py = rect.top;
      panel.style.left = px + 'px';
      panel.style.top = py + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var t = e.touches ? e.touches[0] : e;
      panel.style.left = (px + t.clientX - sx) + 'px';
      panel.style.top = (py + t.clientY - sy) + 'px';
    }
    function onUp(){ dragging = false; }
    header.addEventListener('mousedown', onDown);
    header.addEventListener('touchstart', onDown, {passive:false});
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, {passive:false});
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  }
  document.querySelectorAll('.calib-panel').forEach(makeDraggable);
})();
