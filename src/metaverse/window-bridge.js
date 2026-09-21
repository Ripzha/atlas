/* PROJECT ATLAS - Metaverse: bridge to window.
   Inline handlers in the markup and in generated HTML (onclick="showHome()") run
   in the global scope and cannot see a module's functions. The functions they
   need are attached to window here — in one place, so the list is easy to
   check. When an inline handler is replaced by addEventListener, its entry
   here goes away. */

import {
  autoH,
  cancelPopupWait,
  closePM,
  loadFeed,
  openCommentPopup,
  openNewPost,
  openPost,
  refreshCmts,
  showHome,
  showSeries,
  slideNav,
  toggleInfo,
  toggleZoom,
} from './main.js?v=202609211447';

Object.assign(window, {
  autoH,
  cancelPopupWait,
  closePM,
  loadFeed,
  openCommentPopup,
  openNewPost,
  openPost,
  refreshCmts,
  showHome,
  showSeries,
  slideNav,
  toggleInfo,
  toggleZoom,
});
