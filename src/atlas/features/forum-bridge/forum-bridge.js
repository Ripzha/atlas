/* PROJECT ATLAS - Forum bridge.
   Receives postMessage calls from the forum header (atlas_header.html), which
   runs on a different origin:
     'auth-status'     show login/register buttons for guests only
     'atlas-highlight' highlight an element (used by the Eve guide)
     'open-charview'   open the character view (used by the Eve guide)
   Classic script, loaded after core.js. */

// Eve lives in the Xobor header (different origin) and cannot reach into our DOM.
// She sends postMessage({action:'atlas-highlight', selector:'...'})
// and we place an overlay div over the element. We do NOT do this as a
// class on the element itself, because overflow:auto/hidden would clip the glow
// (e.g. the scrollable #left sidebar).
(function(){
  var style = document.createElement('style');
  style.textContent =
    '.atlas-highlight-overlay{' +
    '  position:fixed;' +
    '  pointer-events:none;' +
    '  z-index:99999;' +
    '  border-radius:8px;' +
    '  animation:atlasHighlightGlow 1.5s ease-in-out infinite;' +
    '}' +
    '@keyframes atlasHighlightGlow{' +
    '  0%,100%{' +
    '    box-shadow:0 0 0 0 rgba(74,170,106,0),0 0 0 rgba(74,170,106,0);' +
    '  }' +
    '  50%{' +
    '    box-shadow:0 0 0 2px rgba(74,170,106,0.85),0 0 32px 6px rgba(74,170,106,0.55);' +
    '  }' +
    '}';
  document.head.appendChild(style);

  var overlayEl = null;
  var trackedElement = null;
  var updateInterval = null;

  function clearHighlight() {
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
    trackedElement = null;
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  }

  function positionOverlay() {
    if (!overlayEl || !trackedElement) return;
    var rect = trackedElement.getBoundingClientRect();
    // Element no longer visible (rect is zero): hide the overlay
    if (rect.width === 0 && rect.height === 0) {
      overlayEl.style.display = 'none';
      return;
    }
    overlayEl.style.display = 'block';
    overlayEl.style.left = rect.left + 'px';
    overlayEl.style.top = rect.top + 'px';
    overlayEl.style.width = rect.width + 'px';
    overlayEl.style.height = rect.height + 'px';
  }

  function setHighlight(selector) {
    clearHighlight();
    if (!selector) return;
    try {
      var el = document.querySelector(selector);
      if (!el) return;
      trackedElement = el;
      overlayEl = document.createElement('div');
      overlayEl.className = 'atlas-highlight-overlay';
      document.body.appendChild(overlayEl);
      positionOverlay();
      // Update the position continuously — the element can move (scrolling,
      // resize, dynamic content) and the glow must follow it.
      updateInterval = setInterval(positionOverlay, 60);
    } catch(e) {}
  }

  window.addEventListener('message', function(e){
    if (!e.data) return;
    // 'auth-status' — the forum JS (atlas_header) tells us whether the user is a guest.
    // Login/register buttons are shown to guests only.
    if (e.data.action === 'auth-status') {
      var login = document.getElementById('btn-login');
      var reg = document.getElementById('btn-register');
      if (login) login.style.display = e.data.isGuest ? 'inline-block' : 'none';
      if (reg) reg.style.display = e.data.isGuest ? 'inline-block' : 'none';
      return;
    }
    // 'atlas-highlight' — standard highlight by CSS selector
    if (e.data.action === 'atlas-highlight') {
      setHighlight(e.data.selector);
      return;
    }
    // 'open-charview' — Eve can open the character view so the next
    // step (create a character) has visible context (especially on mobile).
    if (e.data.action === 'open-charview') {
      try {
        if (typeof window.openCharView === 'function') {
          window.openCharView();
        }
        // On mobile: close the bottom sheet if open (openCharView does not touch it)
        if (typeof window.closeSheet === 'function') {
          window.closeSheet();
        }
      } catch(err) {}
      return;
    }
  });
  window.addEventListener('resize', positionOverlay);

  // Clear the highlight on click on nav items/dots (otherwise e.g. the
  // character tab stays highlighted and covers the character cards)
  document.addEventListener('click', function(e) {
    var navItem = e.target.closest('.nav-item, .world-dot, .lot-dot, #char-create-btn');
    if (navItem) {
      setTimeout(clearHighlight, 100);
    }
  });
})();
