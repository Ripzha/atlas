/* PROJECT ATLAS - Choice menu for a character token in the world view.

   A click on a character token on a lot or cluster dot opens a small menu:
   the character's last post, or their profile (the character thread). Both
   open in a new tab, like the other forum links in ATLAS.

   Only inside the world view (#world-container). On the continent map a click
   on a token keeps its old meaning — it enters the world — so tokens there are
   left alone. The "+N" token is left alone as well.

   The click is caught in the capture phase, before it reaches the dot: the
   dot would otherwise open its own thread. */

import { CHARS } from './character-view.js?v=202609221509';
import { getThreadIdFromUrl } from './tokens.js?v=202609221509';

const MENU_ID = 'atlas-token-menu';

function escapeHtml(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* The character behind a token. Names are nearly always unique; if two share
   a name, the one last seen on this dot wins. */
function findChar(wrap){
  const name = wrap.getAttribute('data-char');
  if(!name) return null;
  const matches = CHARS.filter(c => (c.n||'') === name);
  if(matches.length <= 1) return matches[0] || null;
  const holder = wrap.closest('.dot-char-tokens');
  const urls = holder ? (holder.getAttribute('data-lot-url') || holder.getAttribute('data-cluster-urls') || '').split('|') : [];
  const ids = urls.map(getThreadIdFromUrl).filter(Boolean);
  return matches.find(c => ids.includes(getThreadIdFromUrl(c.lastSeenUrl))) || matches[0];
}

export function closeTokenMenu(){
  const m = document.getElementById(MENU_ID);
  if(m) m.remove();
}

function openTokenMenu(wrap, c){
  closeTokenMenu();
  const items = [];
  if(c.lastSeenUrl) items.push({ href: c.lastSeenUrl, icon: '↗', label: 'Letzter Beitrag', sub: c.lastSeenName || '' });
  if(c.u)           items.push({ href: c.u,           icon: '👤', label: 'Profil',          sub: 'Charakterbogen' });
  if(!items.length) return;

  const menu = document.createElement('div');
  menu.id = MENU_ID;
  menu.setAttribute('role', 'menu');
  menu.innerHTML =
    '<div class="tm-name">' + escapeHtml(c.n) + '</div>' +
    items.map(it =>
      '<a class="tm-item" role="menuitem" href="' + escapeHtml(it.href) + '" target="_blank" rel="noopener">' +
        '<span class="tm-icon">' + it.icon + '</span>' +
        '<span class="tm-text"><span class="tm-label">' + it.label + '</span>' +
        (it.sub ? '<span class="tm-sub">' + escapeHtml(it.sub) + '</span>' : '') + '</span></a>'
    ).join('');
  document.body.appendChild(menu);

  // Next to the token: below it if there is room, otherwise above; kept on screen
  const r = wrap.getBoundingClientRect();
  const w = menu.offsetWidth, h = menu.offsetHeight, gap = 8;
  let left = r.left + r.width / 2 - w / 2;
  let top = r.bottom + gap;
  if(top + h > window.innerHeight - 8) top = r.top - h - gap;
  left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
  top = Math.max(8, top);
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';

  menu.addEventListener('click', e => {
    if(e.target.closest('.tm-item')) setTimeout(closeTokenMenu, 0);   // let the link open first
  });
}

document.addEventListener('click', e => {
  const menu = document.getElementById(MENU_ID);
  if(menu && menu.contains(e.target)) return;          // clicks inside the menu
  const wrap = e.target.closest && e.target.closest('.dot-char-token-wrap');
  const inWorld = wrap && wrap.closest('#world-container');
  if(!wrap || !inWorld || wrap.classList.contains('dot-char-token-extra')){
    closeTokenMenu();                                   // a click anywhere else closes it
    return;
  }
  const c = findChar(wrap);
  if(!c) return;                                        // unknown: behave as before
  e.preventDefault();
  e.stopPropagation();                                  // the dot must not open its thread
  openTokenMenu(wrap, c);
}, true);

document.addEventListener('keydown', e => { if(e.key === 'Escape') closeTokenMenu(); });
window.addEventListener('resize', closeTokenMenu);
// Zooming or panning the map moves the token away from the menu
window.addEventListener('wheel', closeTokenMenu, { passive: true });
