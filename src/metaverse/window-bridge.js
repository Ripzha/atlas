/* PROJECT ATLAS - Metaverse: Bruecke zu window.
   Inline-Handler im Markup und im erzeugten HTML (onclick="showHome()") laufen
   im globalen Gueltigkeitsbereich und sehen die Funktionen eines Moduls nicht.
   Die Funktionen, die sie brauchen, haengen hier an window — an einer Stelle,
   damit die Liste leicht zu pruefen ist. Wird ein Inline-Handler durch
   addEventListener ersetzt, faellt sein Eintrag hier weg. */

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
} from './main.js?v=202609211339';

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
