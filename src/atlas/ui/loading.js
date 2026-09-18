/* PROJECT ATLAS - Loading screen. API: window.showAtlasLoading() / hideAtlasLoading() */

(function(){
  'use strict';
  var loadingScreen = document.getElementById('atlas-loading-screen');
  var dustWrap = document.getElementById('als-dust-wrap');
  var dustInterval = null;

  function spawnDustParticle(){
    if(!dustWrap) return;
    var p = document.createElement('div');
    p.className = 'als-dust-particle';
    var angle = Math.random() * Math.PI * 2;
    var startDist = 115 + Math.random() * 15;
    var endDist = 180 + Math.random() * 60;
    p.style.setProperty('--sx', Math.cos(angle) * startDist + 'px');
    p.style.setProperty('--sy', Math.sin(angle) * startDist + 'px');
    p.style.setProperty('--ex', Math.cos(angle) * endDist + 'px');
    p.style.setProperty('--ey', Math.sin(angle) * endDist + 'px');
    var duration = 1800 + Math.random() * 1200;
    p.style.animation = 'alsDustFly ' + duration + 'ms linear forwards';
    dustWrap.appendChild(p);
    setTimeout(function(){ p.remove(); }, duration + 100);
  }

  /**
   * Show the ATLAS loading screen.
   * @param {string} [label] Optional text instead of "Lädt…"
   */
  window.showAtlasLoading = function(label){
    if(!loadingScreen) return;
    if(label){
      var lblEl = loadingScreen.querySelector('.als-label');
      if(lblEl) lblEl.textContent = label;
    }
    loadingScreen.classList.add('als-visible');
    for(var i = 0; i < 6; i++) setTimeout(spawnDustParticle, i * 180);
    if(dustInterval) clearInterval(dustInterval);
    dustInterval = setInterval(spawnDustParticle, 220);
  };

  /** Hide the ATLAS loading screen. */
  window.hideAtlasLoading = function(){
    if(!loadingScreen) return;
    loadingScreen.classList.remove('als-visible');
    if(dustInterval){ clearInterval(dustInterval); dustInterval = null; }
    setTimeout(function(){
      if(dustWrap) dustWrap.innerHTML = '';
      var lblEl = loadingScreen.querySelector('.als-label');
      if(lblEl) lblEl.textContent = 'Lädt…'; // Reset to default
    }, 400);
  };
})();
