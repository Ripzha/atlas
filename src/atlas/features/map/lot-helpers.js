/* PROJECT ATLAS - Lot helpers.
   Label parsing ("Nr. 5ZZ" → "Nr. 5"), nr ranges for building clusters, and
   grouping of lots that share one position. */

import { sheetLots, sheetLotsLoaded } from '../../core/sheet-data.js?v=202609182140';

export function parseLotLabel(lot){
  const name=lot.name||'';
  if(lot.nr){
    // Double+ letter suffix ONLY after digits ("Nr. 5ZZ", "Nr. 23ZY") - hide suffix
    const sufMatch=lot.nr.match(/^(.*?\d+)[A-Za-z]{2,}$/);
    if(sufMatch){
      return{num:sufMatch[1],sub:(name&&name!==lot.nr?name:'')};
    }
    // Everything else: show full nr (includes single-letter "Nr. A", words, word chains)
    return{num:lot.nr,sub:(name&&name!==lot.nr?name:'')};
  }
  const m=name.match(/^(Nr\.\s*\d+[A-Za-z]?)\s*[-–]\s*(.+)$/);
  if(m)return{num:m[1],sub:m[2].trim()};
  const n=name.match(/^(Nr\.\s*\d+[A-Za-z]?)$/);
  if(n)return{num:n[1],sub:''};
  return{num:name,sub:''};
}
// For building cluster dots: compute the nr range from the sheet
// Example: building="Culpepper-Apartments" with Nr. 1, 2, 3, 4 in the sheet → "Nr. 1-4"
export function getBuildingNrRange(buildingName, wname){
  if(!sheetLotsLoaded) return '';
  const worldSheet = sheetLots[wname] || {};
  const nrs = new Set();
  Object.keys(worldSheet).forEach(key=>{
    if(!key.startsWith(buildingName+'|')) return;
    let entry = worldSheet[key];
    // Dot-Group keys are always arrays - take first entry
    if(Array.isArray(entry)) entry = entry[0];
    if(!entry || entry.dotGroup !== buildingName) return;
    // Extract number from "Nr. 1", "Nr. 5ZZ" etc.
    const m = key.split('|')[1].match(/^Nr\.\s*(\d+)/);
    if(m) nrs.add(parseInt(m[1]));
  });
  if(nrs.size === 0) return '';
  const sorted = [...nrs].sort((a,b)=>a-b);
  if(sorted.length === 1) return 'Nr. '+sorted[0];
  // Check if sequence is continuous
  const min = sorted[0], max = sorted[sorted.length-1];
  const isContinuous = (max - min + 1) === sorted.length;
  if(isContinuous) return 'Nr. '+min+'-'+max;
  return 'Nr. '+sorted.join(',');
}
export function groupLots(lots){
  const groups=[],used=new Set();
  lots.forEach((lot,i)=>{
    if(used.has(i))return;
    const g=[lot];used.add(i);
    lots.forEach((o,j)=>{if(i===j||used.has(j))return;if(lot.x===o.x&&lot.y===o.y){g.push(o);used.add(j);}});
    groups.push({x:lot.x,y:lot.y,lots:g});
  });
  return groups;
}
