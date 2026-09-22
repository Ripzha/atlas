/* PROJECT ATLAS - Event pill (map).
   Shows the running RPG event as a pill; a click opens a panel with the
   AI-generated summary. The pill itself lives in src/shared/event-pill/ and is
   shared with the forum scripts; only the settings below are specific to the
   map.

   Desktop: the pill sits inside #center. Phones: attached to <body>, bottom
   left — nothing else is there on the continent map. On a world map a CSS
   override (body:has(#world-container.active)) moves it bottom right.
   The pill can be dragged anywhere; the position is remembered per browser. */

import { createEventPill } from '../../../shared/event-pill/event-pill.js?v=202609221541';

createEventPill({
  anchors: ['#center'],
  pages: null,          // the map is one page: the pill may show everywhere
  draggable: true,
  mobileStyle: {
    position: 'fixed',
    top: 'auto',
    bottom: 'calc(110px + env(safe-area-inset-bottom))',
    left: '8px',
    right: 'auto',
    transform: 'none',
    padding: '5px 12px 5px 8px',
    'max-width': 'calc(100vw - 16px)',
    width: 'auto',
    display: 'flex',
    'justify-content': 'flex-start'
  }
});
