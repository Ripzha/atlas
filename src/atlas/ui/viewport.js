/* ==========================================================================
   PROJECT ATLAS - Galaxy / iframe viewport fix
   --------------------------------------------------------------------------
   Problem: When ATLAS runs as an iframe inside the forum (Xobor sets no
   viewport meta tag), Samsung/Chrome Android renders the forum with a 980px
   default layout viewport and scales it down visually. The iframe inherits
   the 980px -> innerWidth lies -> mobile media queries never match -> the
   phone gets the desktop sidebars.

   Fix: Detect "physical device is narrow (screen.width), iframe reports wide"
   and force the existing media queries on via the CSSOM (mediaText).
   No duplicated CSS. No effect on GitHub directly / desktop / tablet.

   IMPORTANT: This must be a classic script (not a module) and must come
   AFTER the <link> to the stylesheet. The browser blocks classic scripts
   until preceding stylesheets are loaded, so the CSSOM rules are reliably
   available.

   To remove: delete this file and revert the two __atlasForceMobile checks
   in fitCharGrid (src/atlas/core.js) and in the event pill
   (src/atlas/features/events/event-pill.js).
   ========================================================================== */
(function(){
  'use strict';
  try {
    var realW = screen.width || 0;
    var layoutW = document.documentElement.clientWidth || window.innerWidth || 0;
    // Only active if the device is physically narrow but the layout viewport is wide (iframe lie).
    if (!(realW > 0 && realW <= 768 && layoutW > 768)) return;
    window.__atlasForceMobile = true;

    // 1) Wrap matchMedia: '(max-width:768px)' queries report true.
    //    (Covers the JS isMobile checks without touching each call site.)
    var _origMM = window.matchMedia.bind(window);
    window.matchMedia = function(q){
      if (/max-width:\s*768px/.test(q)) {
        return {
          matches: true, media: q, onchange: null,
          addListener: function(){}, removeListener: function(){},
          addEventListener: function(){}, removeEventListener: function(){},
          dispatchEvent: function(){ return false; }
        };
      }
      return _origMM(q);
    };

    // 2) Rewrite CSS media queries via the CSSOM:
    //    - Mobile queries (max-width <= 768, no min-width): always apply
    //    - Tablet query (min-width + pointer:coarse): never apply
    function rewriteMediaRules(){
      for (var s = 0; s < document.styleSheets.length; s++) {
        var rules;
        try { rules = document.styleSheets[s].cssRules; } catch(e){ continue; }
        if (!rules) continue;
        for (var i = 0; i < rules.length; i++) {
          var r = rules[i];
          if (!(r instanceof CSSMediaRule)) continue;
          var cond = r.conditionText || r.media.mediaText || '';
          if (/min-width/.test(cond)) {
            // Tablet landscape block: never apply on phones
            if (/pointer:\s*coarse/.test(cond)) {
              try { r.media.mediaText = 'not all'; } catch(e){}
            }
            continue;
          }
          var m = cond.match(/max-width:\s*(\d+)px/);
          if (m && realW <= parseInt(m[1], 10)) {
            try { r.media.mediaText = 'all'; } catch(e){}
          }
        }
      }
    }
    rewriteMediaRules(); // Styles in <head> (already parsed)
    document.addEventListener('DOMContentLoaded', rewriteMediaRules); // later <style> blocks in <body>
  } catch(e){}
})();
