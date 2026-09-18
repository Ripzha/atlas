/* PROJECT ATLAS - "Andere Welten" portal.
   Draggable portal on the continent map with particles and tokens of
   characters currently in outer worlds. Opens the "Andere Welten" view. */

import { IMG_THUMB, imageUrl } from '../../core/images.js?v=202609181817';
import { sheetWorldMeta } from '../../core/sheet-data.js?v=202609181817';
import { openOtherWorld } from './otherworld-view.js?v=202609181817';
import { CHARS } from '../characters/character-view.js?v=202609181817';

// "Andere Welten" portal: mini map with particles, drag + tokens
// Outer world characters = characters whose lastSeenName is a "hasAtlas=false" world
// PLUS the special case Bloodmoon Valley (hasAtlas=true, but listed in the modal — see openOtherWorld)
function getCharsInOuterWorlds(){
  return CHARS.filter(function(c){
    if(!c.lastSeenName || !c.lastSeenUrl) return false;
    var meta = sheetWorldMeta[c.lastSeenName];
    if(!meta) return false;
    if(meta.hasAtlas === false) return true;
    // Special case: Bloodmoon Valley is also listed in the modal
    if(c.lastSeenName === 'Bloodmoon Valley') return true;
    return false;
  });
}

export function updateOtherworldPortalTokens(){
  var portal = document.getElementById('otherworld-portal');
  if(!portal) return;
  var tokensEl = portal.querySelector('.ow-portal-tokens');
  if(!tokensEl) return;
  var chars = getCharsInOuterWorlds();
  if(!chars.length){ tokensEl.innerHTML = ''; return; }
  var MAX = 4;
  // Render all tokens; everything above MAX gets .ow-portal-token-hidden
  // → becomes visible on hover (same as the world dot tokens)
  var html = chars.map(function(c, i){
    var inner = c.img
      ? '<img class="ow-portal-token" src="' + imageUrl(c.img,IMG_THUMB) + '" alt="' + (c.n||'') + '" loading="lazy">'
      : '<div class="ow-portal-token-ph">' + ((c.n||'?').charAt(0)) + '</div>';
    var name = (c.n||'').replace(/"/g,'&quot;');
    var hiddenClass = i >= MAX ? ' ow-portal-token-hidden' : '';
    return '<div class="ow-portal-token-wrap' + hiddenClass + '">' +
      inner +
      '<div class="ow-portal-token-name">' + name + '</div>' +
      '</div>';
  }).join('');
  // +N count only above MAX (disappears on hover, then the hidden tokens show)
  var extra = chars.length - MAX;
  if(extra > 0){
    html += '<div class="ow-portal-token-wrap"><div class="ow-portal-count">+' + extra + '</div></div>';
  }
  tokensEl.innerHTML = html;
}
// Backward compatibility: the old name is still called from updateAllTokens
export function updateOtherworldArrowTokens(){ updateOtherworldPortalTokens(); }

// Particle animation: small lights swirling into the portal
function startPortalParticles(canvas){
  if(!canvas || canvas._started) return;
  canvas._started = true;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var cx = W/2, cy = H/2;
  var maxR = 50;
  var particles = [];
  var COUNT = 18;

  function spawn(){
    var angle = Math.random() * Math.PI * 2;
    var radius = maxR + Math.random() * 14;
    return {
      angle: angle,
      radius: radius,
      maxRadius: radius,
      speed: 0.008 + Math.random() * 0.012,
      shrink: 0.18 + Math.random() * 0.22,
      size: 0.8 + Math.random() * 1.4,
      alpha: 0.55 + Math.random() * 0.4,
      hueShift: Math.random() * 0.4
    };
  }
  for(var i=0;i<COUNT;i++){
    var p = spawn();
    p.radius = Math.random() * maxR;
    particles.push(p);
  }

  function frame(){
    ctx.clearRect(0,0,W,H);
    for(var i=0;i<particles.length;i++){
      var p = particles[i];
      p.angle += p.speed;
      p.radius -= p.shrink;
      var x = cx + Math.cos(p.angle) * p.radius;
      var y = cy + Math.sin(p.angle) * p.radius;
      var fade = Math.max(0, p.radius / p.maxRadius);
      var alpha = p.alpha * fade;
      var size = p.size * (0.6 + 0.4 * fade);
      // Greener near center, lighter at edge
      var g = 170 + Math.floor(40 * (1 - fade));
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, ' + g + ', 138, ' + alpha.toFixed(3) + ')';
      ctx.shadowColor = 'rgba(74,170,106,0.6)';
      ctx.shadowBlur = 4;
      ctx.fill();
      if(p.radius < 4){
        particles[i] = spawn();
      }
    }
    canvas._raf = requestAnimationFrame(frame);
  }
  frame();
}

// Drag logic: the portal stays at the map edge and snaps automatically
function initOtherworldPortal(){
  var portal = document.getElementById('otherworld-portal');
  if(!portal) return;
  var container = document.getElementById('map-image-area');
  if(!container) return;

  // Start particles
  var canvas = portal.querySelector('.ow-portal-particles');
  if(canvas) startPortalParticles(canvas);

  // Load saved position (migrates the old key)
  var saved = null;
  try {
    saved = JSON.parse(localStorage.getItem('sw_ow_portal_pos') || 'null');
    if(!saved) saved = JSON.parse(localStorage.getItem('sw_ow_arrow_pos') || 'null');
  } catch(_){}
  if(saved && saved.edge && typeof saved.pct === 'number'){
    applyPosition(saved.edge, saved.pct);
  } else {
    applyPosition('right', 50);
  }

  function applyPosition(edge, pct){
    portal.setAttribute('data-edge', edge);
    portal.style.left = portal.style.right = portal.style.top = portal.style.bottom = 'auto';
    portal.style.transform = '';
    var off = '14px'; // distance from the edge
    if(edge === 'right'){
      portal.style.right = off;
      portal.style.top = pct + '%';
      portal.style.transform = 'translateY(-50%)';
    } else if(edge === 'left'){
      portal.style.left = off;
      portal.style.top = pct + '%';
      portal.style.transform = 'translateY(-50%)';
    } else if(edge === 'top'){
      portal.style.top = off;
      portal.style.left = pct + '%';
      portal.style.transform = 'translateX(-50%)';
    } else if(edge === 'bottom'){
      portal.style.bottom = off;
      portal.style.left = pct + '%';
      portal.style.transform = 'translateX(-50%)';
    }
  }

  var dragging = false;
  var startX = 0, startY = 0;
  var moved = false;

  function onPointerDown(e){
    dragging = true;
    moved = false;
    startX = e.clientX || 0;
    startY = e.clientY || 0;
    portal.classList.add('dragging');
    try { portal.setPointerCapture && portal.setPointerCapture(e.pointerId); } catch(_){}
    e.preventDefault();
  }

  function onPointerMove(e){
    if(!dragging) return;
    var x = e.clientX || 0;
    var y = e.clientY || 0;
    if(Math.abs(x - startX) > 4 || Math.abs(y - startY) > 4) moved = true;
    if(!moved) return;

    var r = container.getBoundingClientRect();
    var localX = Math.max(0, Math.min(r.width, x - r.left));
    var localY = Math.max(0, Math.min(r.height, y - r.top));

    var distLeft = localX, distRight = r.width - localX;
    var distTop = localY, distBottom = r.height - localY;
    var min = Math.min(distLeft, distRight, distTop, distBottom);
    var edge, pct;
    if(min === distLeft){ edge = 'left'; pct = (localY / r.height) * 100; }
    else if(min === distRight){ edge = 'right'; pct = (localY / r.height) * 100; }
    else if(min === distTop){ edge = 'top'; pct = (localX / r.width) * 100; }
    else { edge = 'bottom'; pct = (localX / r.width) * 100; }
    pct = Math.max(10, Math.min(90, pct));
    applyPosition(edge, pct);
  }

  function onPointerUp(e){
    if(!dragging) return;
    dragging = false;
    portal.classList.remove('dragging');
    try { portal.releasePointerCapture && portal.releasePointerCapture(e.pointerId); } catch(_){}

    if(moved){
      var edge = portal.getAttribute('data-edge') || 'right';
      var pct = 50;
      if(edge === 'right' || edge === 'left'){
        pct = parseFloat(portal.style.top) || 50;
      } else {
        pct = parseFloat(portal.style.left) || 50;
      }
      try { localStorage.setItem('sw_ow_portal_pos', JSON.stringify({edge:edge, pct:pct})); } catch(_){}
    } else {
      if(typeof openOtherWorld === 'function') openOtherWorld();
    }
  }

  portal.addEventListener('pointerdown', onPointerDown);
  portal.addEventListener('pointermove', onPointerMove);
  portal.addEventListener('pointerup', onPointerUp);
  portal.addEventListener('pointercancel', onPointerUp);

  portal.addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      if(typeof openOtherWorld === 'function') openOtherWorld();
    }
  });

  updateOtherworldPortalTokens();
}

// Start once the document is parsed. Always via DOMContentLoaded: the portal
// needs CHARS and sheetWorldMeta from other files, which are only guaranteed
// to be ready then (ES modules run after parsing, but before this event).
document.addEventListener('DOMContentLoaded', initOtherworldPortal);
