/* PROJECT ATLAS - Forum scripts, entry point.
   Loaded on every forum page by the Xobor field "Eigenes JavaScript" (see
   docs/FORUM.md). This file itself is loaded without a version marker, so a
   change reaches the forum within about ten minutes (GitHub Pages cache)
   without touching Xobor. Everything it loads carries a version marker, so the
   files always arrive as a matching set.

   Each feature decides for itself whether it is needed on the current page.
   A feature that fails does not stop the others. */

import { initLastSeenTracker } from './last-seen-tracker.js?v=202609221526';
import { initCharacterEditor } from './character-editor.js?v=202609221526';
import { initLotAssignment } from './lot-assignment.js?v=202609221526';
import { initEventPill } from './event-pill.js?v=202609221526';

const FEATURES = { initLastSeenTracker, initCharacterEditor, initLotAssignment, initEventPill };

const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = new URL('../../styles/forum/forum.css?v=202609221526', import.meta.url).href;
document.head.appendChild(css);

function start(){
  for(const [name, init] of Object.entries(FEATURES)){
    try { init(); } catch(e){ console.error('[ATLAS] ' + name + ':', e); }
  }
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
