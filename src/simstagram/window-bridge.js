/* PROJECT ATLAS - Simstagram: Bruecke zu window.
   Inline-Handler im Markup und im erzeugten HTML (onclick="openPost()") laufen
   im globalen Gueltigkeitsbereich und sehen die Funktionen eines Moduls nicht.
   Die Funktionen, die sie brauchen, haengen hier an window — an einer Stelle,
   damit die Liste leicht zu pruefen ist. Wird ein Inline-Handler durch
   addEventListener ersetzt, faellt sein Eintrag hier weg. */

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
} from './main.js?v=202609211308';

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
