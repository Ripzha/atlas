/* PROJECT ATLAS - Shared state.
   Admin, calibration and position modes, the current world, and lot overrides
   stored in localStorage (custom, hidden and renamed lots).
   Classic script, loaded right after the data files. */

let adminMode=false,logoClicks=0,logoTimer=null;
let currentWorld=null;
let calibMapMode=false,calibWorldMode=false;
let calibMapData=[],calibWorldData=[],calibMapIdx=0;
let posMode=false,posModeCallback=null,pendingPos=null;
let customLots=JSON.parse(localStorage.getItem('sw_custom_lots')||'{}');
let hiddenLots=JSON.parse(localStorage.getItem('sw_hidden_lots')||'{}');
let renamedLots=JSON.parse(localStorage.getItem('sw_renamed_lots')||'{}');
let adminWorldFilter=worlds[0].name,adminTab='lots';
function saveLots(){localStorage.setItem('sw_custom_lots',JSON.stringify(customLots))}
function saveHidden(){localStorage.setItem('sw_hidden_lots',JSON.stringify(hiddenLots))}
function saveRenamed(){localStorage.setItem('sw_renamed_lots',JSON.stringify(renamedLots))}
