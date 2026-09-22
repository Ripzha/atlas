/* PROJECT ATLAS - Simstagram: bridge to window.
   Inline handlers in the markup and in generated HTML (onclick="openPost()") run
   in the global scope and cannot see a module's functions. The functions they
   need are attached to window here — in one place, so the list is easy to
   check. When an inline handler is replaced by addEventListener, its entry
   here goes away. */

import {
  autoH,
  cancelPopupWait,
  closeCompose,
  closePM,
  goPage,
  goToForumPost,
  jumpTo,
  loadFeed,
  openCommentPopup,
  openCompose,
  openLikePopup,
  openPost,
  refreshCmts,
} from './main.js?v=202609221410';

Object.assign(window, {
  autoH,
  cancelPopupWait,
  closeCompose,
  closePM,
  goPage,
  goToForumPost,
  jumpTo,
  loadFeed,
  openCommentPopup,
  openCompose,
  openLikePopup,
  openPost,
  refreshCmts,
});
