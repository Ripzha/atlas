/* PROJECT ATLAS - Shared state.
   Admin and calibration modes and the current world (object "state"), and lot
   overrides read from localStorage (custom, hidden and renamed lots). The
   overrides exist only in browsers where the former lot editor was used; they
   are applied in getLots(). */

// Mutable state shared across files. It lives in one object so every file can
// change it (state.currentWorld = w). Imported plain variables would be
// read-only in ES modules.
export const state={
  adminMode:false, logoClicks:0, logoTimer:null, adminTab:'lots',
  currentWorld:null,
  calibMapMode:false, calibWorldMode:false,
  calibMapData:[], calibWorldData:[], calibMapIdx:0,
};

export let customLots=JSON.parse(localStorage.getItem('sw_custom_lots')||'{}');
export let hiddenLots=JSON.parse(localStorage.getItem('sw_hidden_lots')||'{}');
export let renamedLots=JSON.parse(localStorage.getItem('sw_renamed_lots')||'{}');
