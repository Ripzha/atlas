/* PROJECT ATLAS - Map calibration (admin).
   Click mode to record coordinates of world dots (continent map) and lots
   (world view) and copy them for src/atlas/data/.
   Called from inline handlers: toggleCalib(), copyCalib(), clearCalib().
   Classic script, loaded before core.js. */

function toggleCalib(mode){
  if(mode==='map'){calibMapMode=!calibMapMode;document.getElementById('calib-map-panel').style.display=calibMapMode?'block':'none';mapC.style.cursor=calibMapMode?'crosshair':'default';if(calibMapMode)document.getElementById('calib-next').textContent=worlds[calibMapIdx]?.name||'—';}
  else{calibWorldMode=!calibWorldMode;document.getElementById('calib-world-panel').style.display=calibWorldMode?'block':'none';worldC.style.cursor=calibWorldMode?'crosshair':'default';if(calibWorldMode)document.getElementById('calib-world-next').textContent=getLots(currentWorld?.name||'')[calibWorldData.length]?.name||'—';}
}
function updateCalibLog(mode){const data=mode==='map'?calibMapData:calibWorldData;const log=document.getElementById(mode==='map'?'calib-map-log':'calib-world-log');log.innerHTML=data.length===0?'Noch keine Klicks...':data.map(d=>`<div style="color:#ffcc44">${d.name}</div><div style="color:#777">x:${d.x}, y:${d.y}</div>`).join('');log.scrollTop=log.scrollHeight;}
function copyCalib(mode){
  const data = mode==='map'?calibMapData:calibWorldData;
  console.log('[copyCalib]', mode, 'data:', data);
  if(!data || data.length === 0){
    alert('Noch nichts zum Kopieren — erst Orte anklicken.');
    return;
  }
  const txt = data.map(d=>`{name:"${d.name}",x:${d.x},y:${d.y}}`).join(',\n');
  console.log('[copyCalib] txt:', txt.substring(0,200));
  // Primary: Clipboard API
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt)
      .then(()=>{ console.log('[copyCalib] OK via clipboard API'); alert('✓ Kopiert!'); })
      .catch(err=>{
        console.warn('[copyCalib] clipboard API failed:', err);
        copyCalibFallback(txt);
      });
  } else {
    copyCalibFallback(txt);
  }
}
function copyCalibFallback(txt){
  try {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if(ok){ alert('✓ Kopiert!'); }
    else { alert('Kopieren fehlgeschlagen. Bitte manuell aus Console kopieren (F12) — Text wurde dort geloggt.'); console.log('[copyCalib] MANUAL COPY:\n'+txt); }
  } catch(e){
    console.error('[copyCalib] fallback error:', e);
    alert('Kopieren fehlgeschlagen: '+e.message+'\nText in Console (F12).');
    console.log('[copyCalib] MANUAL COPY:\n'+txt);
  }
}
function clearCalib(mode){if(mode==='map'){calibMapData=[];calibMapIdx=0;document.getElementById('calib-next').textContent=worlds[0]?.name||'—';}else{calibWorldData=[];var _clc=getLots(currentWorld?.name||'')[0];document.getElementById('calib-world-next').textContent=(_clc?.nr||_clc?.name||'—');document.getElementById('calib-world-count').textContent='0';}updateCalibLog(mode);}
