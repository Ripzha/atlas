/* PROJECT ATLAS - Building calibration (admin).
   Click mode to record apartment coordinates per floor and copy them. Called
   from inline handlers: toggleBuildingCalib(), clearBuildingCalib(),
   copyBuildingCalib(). */

import { BUILDINGS } from '../../data/buildings.js?v=202609181426';
import { buildingFloorIdx, currentBuildingKey } from './building-view.js?v=202609181426';

let calibBuildingMode=false,calibBuildingData=[];

function getBuildingCalibLots(){
  const allLots=BUILDINGS[currentBuildingKey]?.lots||[];
  // Only lots visible on current floor (no floors prop = all floors)
  return allLots.filter(l=>!l.floors||l.floors.includes(buildingFloorIdx));
}
export function toggleBuildingCalib(){
  calibBuildingMode=!calibBuildingMode;
  const panel=document.getElementById('calib-building-panel');
  const bc=document.getElementById('building-container');
  panel.style.display=calibBuildingMode?'block':'none';
  bc.style.cursor=calibBuildingMode?'crosshair':'default';
  if(calibBuildingMode){
    calibBuildingData=[];
    const lots=getBuildingCalibLots();
    const floorLabel=BUILDINGS[currentBuildingKey]?.imgs?.length>1?' (Ebene '+(buildingFloorIdx+1)+')':'';
    document.getElementById('calib-building-next').textContent=(lots[0]?.name||'—')+floorLabel;
    document.getElementById('calib-building-count').textContent='0 / '+lots.length;
    document.getElementById('calib-building-log').textContent='Noch keine Klicks...';
  }
}
export function clearBuildingCalib(){
  calibBuildingData=[];
  const lots=getBuildingCalibLots();
  document.getElementById('calib-building-next').textContent=lots[0]?.name||'—';
  document.getElementById('calib-building-count').textContent='0 / '+lots.length;
  document.getElementById('calib-building-log').textContent='Noch keine Klicks...';
}
export function copyBuildingCalib(){
  const txt=calibBuildingData.map(d=>`{name:"${d.name}",x:${d.x},y:${d.y}}`).join(',\n');
  navigator.clipboard.writeText(txt).then(()=>alert('✓ Kopiert!'));
}

document.addEventListener('DOMContentLoaded',function(){
  document.getElementById('building-container').addEventListener('click',function(e){
    if(!calibBuildingMode)return;
    if(e.target.closest('.calib-panel')||e.target.closest('.calib-btn')||e.target.closest('#floor-nav'))return;
    const bc=document.getElementById('building-bg-inner')||document.getElementById('building-container');
    const r=bc.getBoundingClientRect();
    const x=+((e.clientX-r.left)/r.width*100).toFixed(1);
    const y=+((e.clientY-r.top)/r.height*100).toFixed(1);
    const lots=getBuildingCalibLots();
    const idx=calibBuildingData.length;
    if(idx>=lots.length){alert('Alle '+lots.length+' Lots auf dieser Ebene gesetzt!');return;}
    calibBuildingData.push({name:lots[idx].name,x,y,floor:buildingFloorIdx});
    const log=document.getElementById('calib-building-log');
    log.innerHTML=calibBuildingData.map(d=>`<div style="color:#ffcc44">${d.name}</div><div style="color:#777">x:${d.x}, y:${d.y}</div>`).join('');
    log.scrollTop=log.scrollHeight;
    const floorLabel=BUILDINGS[currentBuildingKey]?.imgs?.length>1?' (Ebene '+(buildingFloorIdx+1)+')':'';
    document.getElementById('calib-building-next').textContent=(lots[idx+1]?.name||'✅ Fertig!')+floorLabel;
    document.getElementById('calib-building-count').textContent=calibBuildingData.length+' / '+lots.length;
  });
});
