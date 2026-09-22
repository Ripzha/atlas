/* PROJECT ATLAS - Event pill (forum).
   On the forum start page and the portal, shows the running RPG event as a
   pill in the forum header. The pill itself lives in src/shared/event-pill/ and
   is shared with the map; only the settings below are specific to the forum.

   Desktop: the pill sits in the header, inside the parent of the particles
   canvas (#particleoverlay). Phones: attached to <body>; where it sits there is
   decided by styles/forum/forum.css, so nothing is set from here. */

import { createEventPill } from '../shared/event-pill/event-pill.js?v=202609221545';

export function initEventPill(){
  createEventPill({
    anchors: ['#particleoverlay'],
    pages: ['/', '/index.php', '/portal.php'],   // elsewhere it would only cover content
    draggable: false,
    mobileStyle: null
  });
}
