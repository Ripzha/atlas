/* PROJECT ATLAS - Lot editor (admin, legacy).
   Rename/hide hardcoded lots, add custom lots stored in localStorage, export
   worldLots. Note: renderLotsTab and renderExportTab are not reachable from
   the current admin panel (setAdminTab only knows "assign" and "routen").
   startPosMode/cancelPosMode and the position mode are still in use.
   Classic script, loaded before core.js. */

function renameLot(wname,origName,custIdx){
  const current = custIdx!=null ? customLots[wname][custIdx].name : (renamedLots[wname]?.[origName]||origName);
  const neu=prompt('Neuer Name:',current);
  if(!neu||neu===current)return;
  if(custIdx!=null){
    customLots[wname][custIdx].name=neu;saveLots();
  } else {
    if(!renamedLots[wname])renamedLots[wname]={};
    renamedLots[wname][origName]=neu;saveRenamed();
  }
  if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();
}
function hideHardLot(wname,lotName){
  if(!hiddenLots[wname])hiddenLots[wname]=[];
  if(!hiddenLots[wname].includes(lotName))hiddenLots[wname].push(lotName);
  saveHidden();if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();
}
function restoreHardLot(wname,lotName){
  if(!hiddenLots[wname])return;
  hiddenLots[wname]=hiddenLots[wname].filter(n=>n!==lotName);
  saveHidden();if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();
}
function startPosForLot(wname,idx){
  if(!currentWorld||currentWorld.name!==wname){alert('Zuerst die Welt "'+wname+'" betreten.');return;}
  posMode=true;document.getElementById('world-container').style.cursor='crosshair';document.getElementById('calib-mode-bar').style.display='block';
  posModeCallback=(x,y)=>{customLots[wname][idx].x=x;customLots[wname][idx].y=y;saveLots();renderLots(currentWorld);renderAdminContent();};
}
function renderLotsTab(){
  const wname=adminWorldFilter;
  const hardLots=worldLots[wname]||[];
  const hidden=hiddenLots[wname]||[];
  const custLots=customLots[wname]||[];
  const worldOpts=worlds.map(w=>`<option value="${w.name}" ${w.name===wname?'selected':''}>${w.name}</option>`).join('');
  const hardHtml=hardLots.map(l=>{
    const isHidden=hidden.includes(l.name);
    const displayName=(renamedLots[wname]||{})[l.name]||l.name;
    const isRenamed=displayName!==l.name;
    return `<div class="lot-entry" style="opacity:${isHidden?0.4:1}"><div style="flex:1;min-width:0"><div class="lot-entry-name">${displayName}${isRenamed?` <span style="font-size:9px;color:rgba(255,200,0,0.6)">(war: ${l.name})</span>`:''}</div><div class="lot-entry-sub">x:${l.x} y:${l.y} <span class="badge badge-hard">Hard</span>${l.active?' <span class="badge badge-active">Aktiv</span>':''}</div></div><button class="a-btn a-btn-ghost" style="font-size:9px;padding:3px 7px" onclick="renameLot('${wname}','${l.name.replace(/'/g,"\\'")}',null)" title="Umbenennen">✏️</button>${isHidden?`<button class="a-btn a-btn-ghost" style="font-size:9px;padding:3px 7px" onclick="restoreHardLot('${wname}','${l.name.replace(/'/g,"\\'")}')">↩</button>`:`<button class="a-btn a-btn-danger" style="font-size:9px;padding:3px 7px" onclick="hideHardLot('${wname}','${l.name.replace(/'/g,"\\'")}')">✕</button>`}</div>`;
  }).join('');
  const custHtml=custLots.map((l,i)=>{
    const needsCalib=l._needsCalib||(l.x===50&&l.y===50);
    return `<div class="lot-entry" style="border-color:${needsCalib?'rgba(255,200,0,0.3)':'rgba(255,255,255,0.07)'}"><div style="flex:1;min-width:0"><div class="lot-entry-name">${l.name}</div><div class="lot-entry-sub">x:${l.x} y:${l.y} <span class="badge badge-custom">Custom</span>${needsCalib?' <span class="badge" style="background:rgba(255,200,0,0.15);color:#ffcc44">📍 pos fehlt</span>':''}</div></div><button class="a-btn a-btn-ghost" style="font-size:9px;padding:3px 7px" onclick="renameLot('${wname}',null,${i})" title="Umbenennen">✏️</button><button class="a-btn a-btn-pos" style="font-size:9px;padding:3px 7px" onclick="startPosForLot('${wname}',${i})" title="Position setzen">📍</button><button class="a-btn a-btn-ghost" style="font-size:9px;padding:3px 7px" onclick="toggleCustomActive('${wname}',${i})">${l.active?'Inaktiv':'Aktiv'}</button><button class="a-btn a-btn-danger" style="font-size:9px;padding:3px 7px" onclick="removeCustomLot('${wname}',${i})">✕</button></div>`;
  }).join('');
  return `<div class="a-form-row"><div class="a-label">Welt</div><select class="a-select" onchange="adminWorldFilter=this.value;renderAdminContent()">${worldOpts}</select></div><div style="font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:8px">${hardLots.length-hidden.length} sichtbar · ${hidden.length} versteckt · ${custLots.length} custom</div>${hardHtml}${custHtml}<div style="border-top:0.5px solid rgba(255,255,255,0.08);margin:14px 0 12px"></div><div style="font-size:11px;color:#ffcc44;font-weight:500;margin-bottom:10px">+ Ort hinzufügen</div><div class="a-form-row"><div class="a-label">Name</div><input class="a-input" id="a-new-name" placeholder="z.B. Nr. 5 - Meine Wohnung"></div><div class="a-form-row"><div class="a-label">Thread-URL <span style="color:rgba(255,255,255,0.3)">(optional — leer = Subforum)</span></div><input class="a-input" id="a-new-url" placeholder="https://www.simsforumrpg.de/t..."></div><div class="a-form-row" style="display:flex;gap:8px;align-items:center"><div style="flex:1"><div class="a-label">Position</div><div id="a-pos-display" style="font-size:10px;color:rgba(255,255,255,0.4)">${pendingPos?`x:${pendingPos.x}, y:${pendingPos.y} ✓`:'Noch nicht gesetzt'}</div></div><button class="a-btn a-btn-pos" onclick="startPosMode()" style="margin-top:14px">${currentWorld?'📍 Setzen':'Erst Welt betreten'}</button></div><div class="a-form-row" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="a-new-active"><label for="a-new-active" style="font-size:11px;color:rgba(255,255,255,0.6)">Als aktiv markieren</label></div><button class="a-btn a-btn-primary" style="width:100%;margin-top:4px" onclick="addCustomLot()">Ort hinzufügen</button>`;
}

function renderExportTab(){
  const combined={};
  [...Object.keys(worldLots),...Object.keys(customLots)].forEach(k=>{
    combined[k]=[
      ...(worldLots[k]||[]).filter(l=>!(hiddenLots[k]||[]).includes(l.name)),
      ...(customLots[k]||[]).map(l=>{const c={...l};delete c._src;delete c._needsCalib;return c;})
    ];
  });
  const code='const worldLots='+JSON.stringify(combined,null,2)+';';
  return `
    <div style="background:rgba(255,200,0,0.08);border:0.5px solid rgba(255,200,0,0.3);border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:11px;line-height:1.7">
      <div style="color:#ffcc44;font-weight:500;margin-bottom:4px">📋 So verwendest du den Export:</div>
      <div style="color:rgba(255,255,255,0.6)">1. Unten auf „Kopieren" klicken</div>
      <div style="color:rgba(255,255,255,0.6)">2. GitHub → <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px">index.html</code> öffnen → ✏️ Edit</div>
      <div style="color:rgba(255,255,255,0.6)">3. Im Code <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px">const worldLots=</code> suchen (Ctrl+F)</div>
      <div style="color:rgba(255,255,255,0.6)">4. Alles von <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px">const worldLots=</code> bis zum abschliessenden <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px">};</code> markieren und ersetzen</div>
      <div style="color:rgba(255,255,255,0.6)">5. Commit → fertig ✓</div>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);border-radius:6px;padding:10px;font-size:9px;font-family:monospace;color:#aaa;max-height:220px;overflow-y:auto;white-space:pre;line-height:1.5">${code.replace(/</g,'&lt;')}</div>
    <button class="a-btn a-btn-primary" style="width:100%;margin-top:10px" onclick="copyExport()">📋 worldLots kopieren</button>
    <div style="border-top:0.5px solid rgba(255,255,255,0.08);margin:14px 0 10px"></div>
    <button class="a-btn a-btn-danger" style="width:100%" onclick="clearAllCustom()">🗑 Alle Custom-Lots löschen</button>`;
}
function startPosMode(){if(!currentWorld){alert('Zuerst eine Welt betreten.');return;}posMode=true;worldC.style.cursor='crosshair';document.getElementById('calib-mode-bar').style.display='block';posModeCallback=(x,y)=>{pendingPos={x,y};const el=document.getElementById('a-pos-display');if(el)el.textContent=`x:${x}, y:${y} ✓`;};}
function cancelPosMode(){posMode=false;worldC.style.cursor='default';document.getElementById('calib-mode-bar').style.display='none';posModeCallback=null;}
function addCustomLot(){const name=document.getElementById('a-new-name')?.value?.trim();let url=document.getElementById('a-new-url')?.value?.trim();const active=document.getElementById('a-new-active')?.checked||false;if(!name){alert('Name eingeben.');return;}if(!url){url=worlds.find(w=>w.name===adminWorldFilter)?.url||BASE;}if(!pendingPos){alert('Position setzen.');return;}const wname=adminWorldFilter;if(!customLots[wname])customLots[wname]=[];customLots[wname].push({name,url,x:pendingPos.x,y:pendingPos.y,active});pendingPos=null;saveLots();if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();}
function removeCustomLot(wname,idx){if(!confirm(`"${customLots[wname][idx].name}" löschen?`))return;customLots[wname].splice(idx,1);if(!customLots[wname].length)delete customLots[wname];saveLots();if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();}
function toggleCustomActive(wname,idx){customLots[wname][idx].active=!customLots[wname][idx].active;saveLots();if(currentWorld?.name===wname)renderLots(currentWorld);renderAdminContent();}
function copyExport(){const combined={};[...Object.keys(worldLots),...Object.keys(customLots)].forEach(k=>{const renamed=renamedLots[k]||{};combined[k]=[...(worldLots[k]||[]).filter(l=>!(hiddenLots[k]||[]).includes(l.name)).map(l=>({...l,name:renamed[l.name]||l.name})),...(customLots[k]||[]).map(l=>{const c={...l};delete c._src;delete c._needsCalib;return c;})];});navigator.clipboard.writeText('const worldLots='+JSON.stringify(combined,null,2)+';').then(()=>alert('✓ Kopiert! Jetzt in GitHub einfügen.'));}
function clearAllCustom(){if(!confirm('Alle custom Lots löschen?'))return;customLots={};localStorage.removeItem('sw_custom_lots');if(currentWorld)renderLots(currentWorld);renderAdminContent();}
