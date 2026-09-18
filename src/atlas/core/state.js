/* PROJECT ATLAS - Shared state.
   Admin and calibration modes, the current world, and lot overrides read from
   localStorage (custom, hidden and renamed lots). The overrides exist only in
   browsers where the former lot editor was used; they are applied in getLots().
   Classic script, loaded right after the data files. */

let adminMode=false,logoClicks=0,logoTimer=null;
let currentWorld=null;
let calibMapMode=false,calibWorldMode=false;
let calibMapData=[],calibWorldData=[],calibMapIdx=0;
let customLots=JSON.parse(localStorage.getItem('sw_custom_lots')||'{}');
let hiddenLots=JSON.parse(localStorage.getItem('sw_hidden_lots')||'{}');
let renamedLots=JSON.parse(localStorage.getItem('sw_renamed_lots')||'{}');
let adminTab='lots';
