/* PROJECT ATLAS - Shared state.
   Admin and calibration modes and the current world (object "state"), and lot
   overrides read from localStorage (custom, hidden and renamed lots). The
   overrides exist only in browsers where the former lot editor was used; they
   are applied in getLots().
   Classic script, loaded right after the data files. */

// Mutable state shared across files. It lives in one object so every file can
// change it (state.currentWorld = w). Imported plain variables would be
// read-only in ES modules.
const state={
  adminMode:false, logoClicks:0, logoTimer:null, adminTab:'lots',
  currentWorld:null,
  calibMapMode:false, calibWorldMode:false,
  calibMapData:[], calibWorldData:[], calibMapIdx:0,
};

let customLots=JSON.parse(localStorage.getItem('sw_custom_lots')||'{}');
let hiddenLots=JSON.parse(localStorage.getItem('sw_hidden_lots')||'{}');
let renamedLots=JSON.parse(localStorage.getItem('sw_renamed_lots')||'{}');
