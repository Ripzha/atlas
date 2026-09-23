/* PROJECT ATLAS - Route editor (admin).
   Fullscreen editor to draw routes between worlds, analyze the network and
   export/import it as JSON. Saves to localStorage ('atlas_custom_routes'). The
   exported JSON is what src/atlas/data/routes.js contains. Called from inline
   handlers: closeRoutenEditor(), raTM(), raST(), raClear(), raSave(),
   raAnalyzeNet(), raCopyExport(), raImportPrompt(), raClearAll(),
   raIgnoreWorld(). */

import { worlds } from '../../data/worlds.js?v=202609230614';

(function(){

// Storage
const STORAGE_KEY='atlas_custom_routes';
function loadRoutes(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch(e){return {};}}
function saveRoutes(r){localStorage.setItem(STORAGE_KEY,JSON.stringify(r));}

let customRoutes=loadRoutes();

// Render the routes tab — builds the panel into the admin-content div
window.renderRoutenTab=function(container){
  // Instead of the narrow panel: its own fullscreen overlay
  container.innerHTML='<div style="padding:20px 0;text-align:center;color:rgba(255,255,255,0.4);font-size:12px">Routen-Editor wird geöffnet...</div>';
  setTimeout(()=>openRoutenEditor(),50);
};

function openRoutenEditor(){
  let overlay=document.getElementById('routen-editor-overlay');
  if(overlay){overlay.style.display='flex';initRoutenAdmin(document.getElementById('routen-admin-root'));return;}
  overlay=document.createElement('div');
  overlay.id='routen-editor-overlay';
  overlay.style.cssText='position:fixed;inset:0;z-index:500;background:rgba(4,10,20,0.97);display:flex;flex-direction:column;overflow:hidden';
  overlay.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:0.5px solid rgba(255,200,0,0.2);flex-shrink:0">
      <span style="font-size:13px;color:#ffcc44;font-weight:500">🗺 Routen-Editor</span>
      <button onclick="closeRoutenEditor()" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:20px;padding:0 4px">✕</button>
    </div>
    <div id="routen-admin-root" style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;min-height:0"></div>`;
  document.body.appendChild(overlay);
  initRoutenAdmin(document.getElementById('routen-admin-root'));
}

window.closeRoutenEditor=function(){
  const o=document.getElementById('routen-editor-overlay');
  if(o) o.style.display='none';
};

function initRoutenAdmin(root){
  const SEG={
    road:{stroke:'rgba(255,220,80,0.92)',shadow:'rgba(0,0,0,0.55)',dash:'3 2'},
    boat:{stroke:'rgba(80,170,240,0.92)',shadow:'rgba(0,20,60,0.55)',dash:'2 4'},
    plane:{stroke:'rgba(200,140,255,0.92)',shadow:'rgba(20,0,60,0.55)',dash:'6 3'}
  };

  let transport='car', segType='road';
  let fromW=null, toW=null, points=[];

  root.innerHTML=`
  <style>
  #ra-wrap{display:flex;gap:14px;height:100%;min-height:0}
  #ra-left{flex:1;min-width:0;display:flex;flex-direction:column;gap:0}
  #ra-mapbox{position:relative;width:100%;flex:1;min-height:0;background:#1a2535;border-radius:7px;border:0.5px solid rgba(255,200,0,0.2);overflow:hidden;cursor:crosshair;user-select:none}
  #ra-mapsvg{width:100%;height:100%;display:block}
  #ra-right{width:240px;flex-shrink:0;overflow-y:auto;display:flex;flex-direction:column;gap:0}
  .ra-row{display:flex;gap:6px}
  .ra-label{font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;margin-top:10px}
  .ra-label:first-child{margin-top:0}
  .ra-tb{flex:1;padding:6px 3px;font-size:11px;border:0.5px solid rgba(255,255,255,0.1);border-radius:5px;background:transparent;color:rgba(255,255,255,0.4);cursor:pointer;font-family:inherit;transition:all 0.15s}
  .ra-tb.car.on{background:rgba(74,170,106,0.15);border-color:rgba(74,170,106,0.4);color:#4aaa6a}
  .ra-tb.walk.on{background:rgba(180,130,70,0.15);border-color:rgba(180,130,70,0.4);color:#c4935a}
  .ra-tb.transit.on{background:rgba(80,140,220,0.15);border-color:rgba(80,140,220,0.4);color:#7aacee}
  .ra-tb.road.on{background:rgba(255,220,80,0.1);border-color:rgba(255,220,80,0.35);color:#ffd84a}
  .ra-tb.boat.on{background:rgba(50,130,200,0.15);border-color:rgba(50,130,200,0.4);color:#5a9fd4}
  .ra-tb.plane.on{background:rgba(160,100,220,0.15);border-color:rgba(160,100,220,0.4);color:#b07add}
  .ra-sel{width:100%;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.12);border-radius:5px;color:#fff;font-size:11px;padding:6px 8px;cursor:pointer;outline:none;font-family:inherit;margin-bottom:5px}
  .ra-sel option{background:#0a1628}
  .ra-hint{font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5;padding:7px 8px;background:rgba(255,255,255,0.03);border-radius:5px}
  .ra-hint b{color:rgba(255,255,255,0.7)}
  .ra-btns{display:flex;gap:6px;margin-top:8px}
  .ra-btn{flex:1;padding:7px;font-size:11px;border:0.5px solid rgba(255,255,255,0.1);border-radius:5px;background:transparent;color:rgba(255,255,255,0.4);cursor:pointer;font-family:inherit;transition:all 0.15s}
  .ra-btn.ok{border-color:rgba(74,170,106,0.4);color:#4aaa6a}
  .ra-btn.del{border-color:rgba(255,80,80,0.4);color:#ff8080}
  .ra-status{font-size:11px;padding:4px 0;min-height:16px;color:rgba(255,255,255,0.35)}
  .ra-status.ok{color:#4aaa6a}
  .ra-status.warn{color:#f5a623}
  #ra-saved{list-style:none;font-size:10px;max-height:120px;overflow-y:auto;margin-top:4px}
  #ra-saved li{padding:4px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);display:flex;justify-content:space-between;align-items:center;gap:6px}
  #ra-saved li:last-child{border:none}
  #ra-saved li b{color:rgba(255,255,255,0.85);font-weight:500}
  .ra-del-btn{font-size:9px;color:rgba(255,80,80,0.5);cursor:pointer;padding:1px 5px;border:0.5px solid rgba(255,80,80,0.2);border-radius:3px;background:none;flex-shrink:0}
  #ra-missing{list-style:none;font-size:10px;max-height:140px;overflow-y:auto;margin-top:4px}
  #ra-missing li{padding:4px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:6px;cursor:pointer;color:rgba(255,255,255,0.35)}
  #ra-missing li:hover{color:rgba(255,255,255,0.7)}
  #ra-missing li:last-child{border:none}
  .ra-miss-dot{width:5px;height:5px;border-radius:50%;background:rgba(255,80,80,0.6);flex-shrink:0}
  .ra-load{font-size:9px;color:rgba(80,140,220,0.7);padding:1px 5px;border:0.5px solid rgba(80,140,220,0.3);border-radius:3px;white-space:nowrap;margin-left:auto}
  .ra-prog-bar{height:3px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:6px;overflow:hidden}
  .ra-prog-fill{height:100%;background:#4aaa6a;border-radius:2px;transition:width 0.3s}
  .ra-prog-lbl{font-size:10px;color:rgba(255,255,255,0.3);display:flex;justify-content:space-between;margin-bottom:3px}
  .ra-export-box{font-size:10px;color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.04);border-radius:5px;padding:8px;font-family:monospace;word-break:break-all;max-height:180px;overflow-y:auto;margin-top:6px}
  </style>
  <div id="ra-wrap">
    <div id="ra-left">
      <div id="ra-mapbox">
        <svg id="ra-mapsvg" viewBox="0 0 560 315" xmlns="http://www.w3.org/2000/svg" style="pointer-events:none">
          <rect width="560" height="315" fill="#1a2535"/>
          <g id="ra-ghost-g" style="pointer-events:none;opacity:0.35"></g>
          <g id="ra-dots-g" style="pointer-events:all"></g>
          <g id="ra-lines-g"></g>
          <g id="ra-wp-g" style="pointer-events:all"></g>
        </svg>
      </div>
    </div>
    <div id="ra-right">
    <div class="ra-label">Transportmodus</div>
    <div class="ra-row">
      <button class="ra-tb car on" id="ra-tm-car" onclick="raTM('car')">Auto</button>
      <button class="ra-tb walk" id="ra-tm-walk" onclick="raTM('walk')">Fuss</button>
      <button class="ra-tb transit" id="ra-tm-transit" onclick="raTM('transit')">ÖV</button>
    </div>
    <div class="ra-label">Abschnittstyp</div>
    <div class="ra-row">
      <button class="ra-tb road on" id="ra-st-road" onclick="raST('road')">Strasse</button>
      <button class="ra-tb boat" id="ra-st-boat" onclick="raST('boat')">Boot</button>
      <button class="ra-tb plane" id="ra-st-plane" onclick="raST('plane')">Flug</button>
    </div>
    <div class="ra-label">Route</div>
    <select class="ra-sel" id="ra-from"><option value="">Start...</option></select>
    <select class="ra-sel" id="ra-to"><option value="">Ziel...</option></select>
    <div class="ra-hint" id="ra-hint">Welt anklicken = <b>Start</b> setzen</div>
    <div class="ra-btns">
      <button class="ra-btn del" onclick="raClear()">Leeren</button>
      <button class="ra-btn ok" onclick="raSave()">Speichern</button>
    </div>
    <div class="ra-status" id="ra-status"></div>
    <div class="ra-label">Gespeicherte Routen</div>
    <ul id="ra-saved"></ul>
    <div class="ra-label">Netzanalyse</div>
    <div class="ra-btns">
      <button class="ra-btn ok" onclick="raAnalyzeNet()">Netz analysieren</button>
    </div>
    <div id="ra-analysis" style="display:none;margin-top:6px"></div>
    <div class="ra-label">Fehlende Welten</div>
    <div class="ra-prog-lbl"><span id="ra-prog-txt">0 von ${worlds.length}</span><span id="ra-prog-pct" style="color:rgba(255,255,255,0.7);font-weight:500">0%</span></div>
    <div class="ra-prog-bar"><div class="ra-prog-fill" id="ra-prog-fill" style="width:0%"></div></div>
    <ul id="ra-missing"></ul>
    <div class="ra-label">Export / Import</div>
    <div class="ra-btns">
      <button class="ra-btn ok" onclick="raCopyExport()">JSON kopieren</button>
      <button class="ra-btn ok" onclick="raImportPrompt()">JSON importieren</button>
    </div>
    <div class="ra-btns" style="margin-top:5px">
      <button class="ra-btn del" onclick="raClearAll()">Alle löschen</button>
    </div>
    <div class="ra-export-box" id="ra-export-box">Noch keine Routen gespeichert.</div>
    </div>
  </div>`;

  const SVG_W=560,SVG_H=315;
  const sx=v=>v/100*SVG_W, sy=v=>v/100*SVG_H;
  const rv=v=>Math.round(v*10)/10;

  const mapbox=document.getElementById('ra-mapbox');
  const dotsG=document.getElementById('ra-dots-g');
  const linesG=document.getElementById('ra-lines-g');
  const wpG=document.getElementById('ra-wp-g');
  const ghostG=document.getElementById('ra-ghost-g');

  // Ghost routes: show all saved routes for the current transport mode faintly
  function drawGhostRoutes(){
    ghostG.innerHTML='';
    const SEG_GHOST={
      road:'rgba(255,220,80,0.9)',
      boat:'rgba(80,170,240,0.9)',
      plane:'rgba(200,140,255,0.9)'
    };
    Object.values(customRoutes).filter(r=>r.transport===transport).forEach(r=>{
      // Route points: start world + waypoints + end world
      const startW=worlds.find(w=>w.name===r.from);
      const endW=worlds.find(w=>w.name===r.to);
      if(!startW||!endW) return;
      const allPts=[
        {x:sx(startW.x),y:sy(startW.y),segType:'road'},
        ...(r.points||[]).map(p=>({x:sx(p.x),y:sy(p.y),segType:p.segType||'road'})),
        {x:sx(endW.x),y:sy(endW.y),segType:'road'}
      ];
      // Draw segments
      for(let i=0;i<allPts.length-1;i++){
        const a=allPts[i],b=allPts[i+1];
        const st=b.segType||a.segType||'road';
        const col=SEG_GHOST[st]||SEG_GHOST.road;
        const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
        ln.setAttribute('x1',a.x);ln.setAttribute('y1',a.y);
        ln.setAttribute('x2',b.x);ln.setAttribute('y2',b.y);
        ln.setAttribute('stroke',col);ln.setAttribute('stroke-width','1.2');
        ln.setAttribute('stroke-dasharray','2 2');ln.setAttribute('stroke-linecap','round');
        ghostG.appendChild(ln);
      }
    });
  }

  // Build world dots
  worlds.forEach(w=>{
    const selF=document.getElementById('ra-from');
    const selT=document.getElementById('ra-to');
    [selF,selT].forEach(s=>{const o=document.createElement('option');o.value=w.name;o.textContent=w.name;s.appendChild(o);});
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.style.cursor='pointer';
    g.addEventListener('click',e=>{e.stopPropagation();raWorldClick(w);});
    const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx',sx(w.x));c.setAttribute('cy',sy(w.y));c.setAttribute('r','5');
    c.setAttribute('fill','#3a6a5a');c.setAttribute('stroke','#7abf9a');c.setAttribute('stroke-width','1');
    c.id='ra-dot-'+w.name.replace(/[\s.]/g,'_');
    const t=document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',sx(w.x)+7);t.setAttribute('y',sy(w.y)+3);
    t.setAttribute('font-size','7');t.setAttribute('fill','#7ab4a0');
    t.textContent=w.name;
    g.appendChild(c);g.appendChild(t);dotsG.appendChild(g);
  });

  document.getElementById('ra-from').onchange=function(){const w=worlds.find(x=>x.name===this.value);if(w){fromW=w;raRedraw();}};
  document.getElementById('ra-to').onchange=function(){const w=worlds.find(x=>x.name===this.value);if(w){toW=w;raRedraw();}};

  // SVG-native coordinate conversion — independent of layout, padding, zoom
  function getCoords(e){
    const svgEl=document.getElementById('ra-mapsvg');
    const pt=svgEl.createSVGPoint();
    pt.x=e.clientX; pt.y=e.clientY;
    const svgPt=pt.matrixTransform(svgEl.getScreenCTM().inverse());
    return{x:rv(svgPt.x/SVG_W*100), y:rv(svgPt.y/SVG_H*100)};
  }

  // Click on empty map = free waypoint
  mapbox.addEventListener('click',function(e){
    if(e.target.closest('g')) return;
    const{x,y}=getCoords(e);
    points.push({x,y,segType,isWorld:false});
    raRedraw();raStatus('Wegpunkt ('+segType+') gesetzt');
  });

  function raWorldClick(w){
    if(!fromW){
      fromW=w;document.getElementById('ra-from').value=w.name;
      raDotColor(w,'#f5a623');raStatus('Start: '+w.name);
    } else if(!toW&&w.name!==fromW.name){
      toW=w;document.getElementById('ra-to').value=w.name;
      raDotColor(w,'#4aaa6a');raStatus('Ziel: '+w.name);
    } else if(w.name!==fromW?.name&&w.name!==toW?.name){
      points.push({x:w.x,y:w.y,segType,isWorld:true,worldName:w.name});
      raDotColor(w,'rgba(200,200,200,0.45)');
      raStatus('Durchfahrt: '+w.name);
    }
    raRedraw();
  }

  function raDotColor(w,col){
    const c=document.getElementById('ra-dot-'+w.name.replace(/[\s.]/g,'_'));
    if(c) c.setAttribute('fill',col);
  }

  function catmullPath(pts){
    if(pts.length<2) return null;
    if(pts.length===2) return`M${rv(pts[0].x)} ${rv(pts[0].y)} L${rv(pts[1].x)} ${rv(pts[1].y)}`;
    let d=`M${rv(pts[0].x)} ${rv(pts[0].y)}`;
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[Math.max(i-1,0)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(i+2,pts.length-1)];
      const c1x=p1.x+(p2.x-p0.x)/6,c1y=p1.y+(p2.y-p0.y)/6;
      const c2x=p2.x-(p3.x-p1.x)/6,c2y=p2.y-(p3.y-p1.y)/6;
      d+=` C${rv(c1x)} ${rv(c1y)},${rv(c2x)} ${rv(c2y)},${rv(p2.x)} ${rv(p2.y)}`;
    }
    return d;
  }

  function raRedraw(){
    wpG.innerHTML='';linesG.innerHTML='';
    drawGhostRoutes();
    const all=[];
    if(fromW) all.push({x:fromW.x,y:fromW.y,segType:'road',isWorld:true,worldName:fromW.name});
    points.forEach(p=>all.push(p));
    if(toW) all.push({x:toW.x,y:toW.y,segType:'road',isWorld:true,worldName:toW.name});
    if(all.length<2){raUpdateHint();return;}

    // Group segments by type and draw Bézier curves
    const svgPts=all.map(p=>({x:sx(p.x),y:sy(p.y),segType:p.segType}));
    let i=0;
    while(i<svgPts.length-1){
      const ct=svgPts[i+1].segType||svgPts[i].segType||'road';
      const seg=[svgPts[i]];
      let j=i+1;
      while(j<svgPts.length&&(svgPts[j].segType||ct)===ct){seg.push(svgPts[j]);j++;}
      const path=catmullPath(seg);
      if(path){
        const sc=SEG[ct]||SEG.road;
        ['shadow','main'].forEach(layer=>{
          const el=document.createElementNS('http://www.w3.org/2000/svg','path');
          el.setAttribute('d',path);el.setAttribute('fill','none');
          if(layer==='shadow'){el.setAttribute('stroke',sc.shadow);el.setAttribute('stroke-width','3');el.setAttribute('stroke-linecap','round');el.setAttribute('stroke-linejoin','round');}
          else{el.setAttribute('stroke',sc.stroke);el.setAttribute('stroke-width','1.5');el.setAttribute('stroke-dasharray',sc.dash);el.setAttribute('stroke-linecap','round');el.setAttribute('stroke-linejoin','round');}
          linesG.appendChild(el);
        });
      }
      i=j-1;
    }

    // Waypoint dots
    points.forEach((wp,i)=>{
      const sc=SEG[wp.segType]||SEG.road;
      const cx=sx(wp.x),cy=sy(wp.y);
      const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r',wp.isWorld?'5':'3');
      c.setAttribute('fill',wp.isWorld?'rgba(200,200,200,0.35)':sc.stroke.replace('0.92','1'));
      c.setAttribute('stroke','rgba(0,0,0,0.4)');c.setAttribute('stroke-width','0.8');
      c.style.cursor='pointer';c.style.pointerEvents='all';
      c.addEventListener('click',e=>{e.stopPropagation();points.splice(i,1);raRedraw();raStatus('Entfernt');});
      wpG.appendChild(c);
      if(wp.worldName){
        const t=document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x',cx+6);t.setAttribute('y',cy-5);
        t.setAttribute('font-size','6.5');t.setAttribute('fill','rgba(200,200,200,0.45)');
        t.textContent='('+wp.worldName.split(' ')[0]+')';
        wpG.appendChild(t);
      }
    });
    raUpdateHint();
  }

  window.raTM=function(t){transport=t;['car','walk','transit'].forEach(x=>document.getElementById('ra-tm-'+x).className='ra-tb '+x+(t===x?' on':''));drawGhostRoutes();};
  window.raST=function(t){segType=t;['road','boat','plane'].forEach(x=>document.getElementById('ra-st-'+x).className='ra-tb '+x+(t===x?' on':''));};

  window.raClear=function(){
    fromW=null;toW=null;points=[];
    document.getElementById('ra-from').value='';document.getElementById('ra-to').value='';
    worlds.forEach(w=>raDotColor(w,'#3a6a5a'));
    raRedraw();raStatus('Geleert');
  };

  window.raSave=function(){
    if(!fromW||!toW){raStatus('Start und Ziel setzen','warn');return;}
    if(fromW.name===toW.name){raStatus('Start und Ziel sind identisch','warn');return;}

    // Anchors: start + all transit worlds + destination
    const anchors=[
      {worldName:fromW.name,x:fromW.x,y:fromW.y},
      ...points.filter(p=>p.isWorld).map(p=>({worldName:p.worldName,x:p.x,y:p.y})),
      {worldName:toW.name,x:toW.x,y:toW.y}
    ];

    // Waypoints between two anchors (by index in points[])
    function wpsBetween(aName,bName){
      const worldIdxs=points.map((p,i)=>p.isWorld?{worldName:p.worldName,i}:null).filter(Boolean);
      const idxA=aName===fromW.name?-1:(worldIdxs.find(w=>w.worldName===aName)?.i??-1);
      const idxB=bName===toW.name?points.length:(worldIdxs.find(w=>w.worldName===bName)?.i??points.length);
      return points.filter((p,i)=>!p.isWorld&&i>idxA&&i<idxB);
    }

    let cnt=0;
    for(let i=0;i<anchors.length-1;i++){
      const a=anchors[i],b=anchors[i+1];
      const wps=wpsBetween(a.worldName,b.worldName);
      const transits=points.filter(p=>{
        if(!p.isWorld) return false;
        const pi=points.indexOf(p);
        const aIdx=a.worldName===fromW.name?-1:points.findIndex(p2=>p2.isWorld&&p2.worldName===a.worldName);
        const bIdx=b.worldName===toW.name?points.length:points.findIndex(p2=>p2.isWorld&&p2.worldName===b.worldName);
        return pi>aIdx&&pi<bIdx;
      }).map(p=>p.worldName);

      // Forward
      customRoutes[a.worldName+'|'+b.worldName+'|'+transport]={from:a.worldName,to:b.worldName,transport,points:wps,transits};
      // Backward
      customRoutes[b.worldName+'|'+a.worldName+'|'+transport]={from:b.worldName,to:a.worldName,transport,points:[...wps].reverse(),transits:[...transits].reverse()};
      cnt+=2;
    }
    saveRoutes(customRoutes);
    // Update the global variable for the navigator
    if(window.atlasCustomRoutes!==undefined) window.atlasCustomRoutes=customRoutes;
    raUpdateSavedList();raUpdateMissing();raUpdateExport();drawGhostRoutes();
    raStatus(cnt+' Routen gespeichert','ok');
  };

  function raUpdateSavedList(){
    const ul=document.getElementById('ra-saved');if(!ul)return;
    ul.innerHTML='';
    const keys=Object.keys(customRoutes);
    if(!keys.length){ul.innerHTML='<li style="color:rgba(255,255,255,0.25);padding:3px 0">Noch keine</li>';return;}
    keys.slice(-10).reverse().forEach(k=>{
      const r=customRoutes[k];
      const li=document.createElement('li');
      const hasBoat=r.points.some(p=>p.segType==='boat');
      const hasPlane=r.points.some(p=>p.segType==='plane');
      let txt='<b>'+r.from.split(' ')[0]+' → '+r.to.split(' ')[0]+'</b> <span>('+r.transport+')</span>';
      if(hasBoat) txt+=' <span style="color:#5a9fd4">Boot</span>';
      if(hasPlane) txt+=' <span style="color:#b07add">Flug</span>';
      li.innerHTML=txt;
      // Edit-Button
      const edit=document.createElement('button');
      edit.className='ra-del-btn';
      edit.textContent='✎';
      edit.style.cssText='color:rgba(100,180,255,0.6);border-color:rgba(100,180,255,0.25);margin-right:3px';
      edit.title='Route bearbeiten';
      edit.onclick=()=>loadRouteIntoEditor(k);
      // Delete button
      const del=document.createElement('button');
      del.className='ra-del-btn';del.textContent='✕';
      del.onclick=()=>{delete customRoutes[k];saveRoutes(customRoutes);if(window.atlasCustomRoutes!==undefined)window.atlasCustomRoutes=customRoutes;raUpdateSavedList();raUpdateMissing();raUpdateExport();drawGhostRoutes();};
      li.appendChild(edit);li.appendChild(del);ul.appendChild(li);
    });
  }

  function loadRouteIntoEditor(key){
    const r=customRoutes[key];
    if(!r) return;
    // Set transport
    transport=r.transport||'car';
    ['car','walk','transit'].forEach(x=>document.getElementById('ra-tm-'+x).className='ra-tb '+x+(transport===x?' on':''));
    // Set dropdowns
    fromW=worlds.find(w=>w.name===r.from)||null;
    toW=worlds.find(w=>w.name===r.to)||null;
    if(document.getElementById('ra-from')) document.getElementById('ra-from').value=r.from;
    if(document.getElementById('ra-to')) document.getElementById('ra-to').value=r.to;
    // Highlight dots
    worlds.forEach(w=>raDotColor(w,'#3a6a5a'));
    if(fromW) raDotColor(fromW,'#f5a623');
    if(toW) raDotColor(toW,'#4aaa6a');
    // Load waypoints
    points=r.points.map(p=>({...p}));
    // Highlight transit dots
    points.filter(p=>p.isWorld).forEach(p=>{
      const w=worlds.find(x=>x.name===p.worldName);
      if(w) raDotColor(w,'rgba(200,200,200,0.45)');
    });
    raRedraw();
    raStatus('Bearbeite: '+r.from+' → '+r.to,'ok');
    // Scroll up
    document.getElementById('ra-from')?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  const IGNORED_KEY='atlas_routes_ignored';
  let ignoredWorlds=new Set(JSON.parse(localStorage.getItem(IGNORED_KEY)||'[]'));

  function raUpdateMissing(){
    const covered=new Set();
    Object.values(customRoutes).forEach(r=>{
      covered.add(r.from);covered.add(r.to);
      r.transits?.forEach(t=>covered.add(t));
    });
    const missing=worlds.filter(w=>!covered.has(w.name)&&!ignoredWorlds.has(w.name));
    const ignored=worlds.filter(w=>!covered.has(w.name)&&ignoredWorlds.has(w.name));
    const total=worlds.filter(w=>!covered.has(w.name)).length;
    const pct=Math.round((worlds.length-worlds.filter(w=>!covered.has(w.name)).length)/worlds.length*100);
    const pt=document.getElementById('ra-prog-txt');
    const pp=document.getElementById('ra-prog-pct');
    const pf=document.getElementById('ra-prog-fill');
    if(pt) pt.textContent=(worlds.length-worlds.filter(w=>!covered.has(w.name)).length)+' von '+worlds.length+' Welten';
    if(pp) pp.textContent=pct+'%';
    if(pf) pf.style.width=pct+'%';
    const ul=document.getElementById('ra-missing');if(!ul)return;
    ul.innerHTML='';
    if(!missing.length&&!ignored.length){ul.innerHTML='<li style="color:#4aaa6a;padding:4px 0;font-size:10px">Alle Welten abgedeckt ✓</li>';return;}
    missing.forEach(w=>{
      const li=document.createElement('li');
      li.innerHTML='<div class="ra-miss-dot"></div><span style="flex:1">'+w.name+'</span><span class="ra-load" style="margin-right:4px">als Start</span><span class="ra-load" style="background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);cursor:pointer" onclick="raIgnoreWorld(\''+w.name.replace(/'/g,"\\'")+'\')" title="Aus Liste ausblenden">✕</span>';
      li.querySelector('.ra-load').addEventListener('click',()=>{
        raClear();fromW=w;document.getElementById('ra-from').value=w.name;
        raDotColor(w,'#f5a623');raStatus('Start: '+w.name);raUpdateHint();
      });
      ul.appendChild(li);
    });
    if(ignored.length){
      const div=document.createElement('li');
      div.style.cssText='color:rgba(255,255,255,0.2);font-size:9px;padding-top:6px;cursor:default;border:none;display:block';
      div.textContent='Ignoriert ('+ignored.length+'): '+ignored.map(w=>w.name).join(', ');
      const reset=document.createElement('span');
      reset.textContent=' · zurücksetzen';reset.style.cssText='color:rgba(80,140,220,0.5);cursor:pointer';
      reset.onclick=()=>{ignoredWorlds.clear();localStorage.setItem(IGNORED_KEY,'[]');raUpdateMissing();};
      div.appendChild(reset);ul.appendChild(div);
    }
  }

  window.raIgnoreWorld=function(name){
    ignoredWorlds.add(name);
    localStorage.setItem(IGNORED_KEY,JSON.stringify([...ignoredWorlds]));
    raUpdateMissing();
  };

  function raUpdateExport(){
    const box=document.getElementById('ra-export-box');if(!box)return;
    // Filter out self routes (from === to)
    const clean=Object.fromEntries(Object.entries(customRoutes).filter(([k,r])=>r.from!==r.to));
    box.textContent=Object.keys(clean).length?JSON.stringify(clean,null,2):'Noch keine Routen.';
  }

  window.raAnalyzeNet=function(){
    const box=document.getElementById('ra-analysis');
    if(!box) return;
    box.style.display='block';
    box.innerHTML='<div style="font-size:10px;color:rgba(255,255,255,0.3)">Analysiere...</div>';

    // Build graph from customRoutes — nodes = world names, edges = saved routes
    const graph={};
    worlds.forEach(w=>{graph[w.name]=[];});

    Object.values(customRoutes).filter(r=>r.from!==r.to).forEach(r=>{
      if(!graph[r.from]) graph[r.from]=[];
      // Edge weight = real path length in % of map size
      const fromW=worlds.find(w=>w.name===r.from);
      const toW=worlds.find(w=>w.name===r.to);
      if(!fromW||!toW) return;
      let dist=0;
      const allPts=[{x:fromW.x,y:fromW.y},...(r.points||[]),{x:toW.x,y:toW.y}];
      for(let i=0;i<allPts.length-1;i++){
        const a=allPts[i],b=allPts[i+1];
        dist+=Math.sqrt(Math.pow(a.x-b.x,2)+Math.pow(a.y-b.y,2));
      }
      graph[r.from].push({to:r.to,dist,segTypes:[...(new Set(r.points.map(p=>p.segType||'road')))]});
    });

    // Dijkstra from one source
    function dijkstra(start){
      const dist={};const prev={};const visited=new Set();
      worlds.forEach(w=>{dist[w.name]=Infinity;});
      dist[start]=0;
      const queue=new Set(worlds.map(w=>w.name));
      while(queue.size){
        // Next unvisited node with the smallest distance
        let u=null;
        queue.forEach(n=>{if(u===null||dist[n]<dist[u])u=n;});
        if(dist[u]===Infinity) break;
        queue.delete(u);
        (graph[u]||[]).forEach(edge=>{
          const alt=dist[u]+edge.dist;
          if(alt<dist[edge.to]){dist[edge.to]=alt;prev[edge.to]=u;}
        });
      }
      return{dist,prev};
    }

    // Straight-line distance between two worlds
    function airDist(a,b){
      return Math.sqrt(Math.pow(a.x-b.x,2)+Math.pow(a.y-b.y,2));
    }

    // Detour factor for all world pairs
    const issues=[];
    const isolated=[];

    worlds.forEach(w=>{
      const {dist,prev}=dijkstra(w.name);
      worlds.forEach(t=>{
        if(t.name===w.name) return;
        if(dist[t.name]===Infinity){
          // Only once per pair
          if(w.name<t.name) isolated.push(w.name+' ↔ '+t.name);
          return;
        }
        const ww=worlds.find(x=>x.name===w.name);
        const tw=worlds.find(x=>x.name===t.name);
        const air=airDist(ww,tw);
        if(air<3) return; // Ignore worlds very close to each other
        const factor=dist[t.name]/Math.max(air,1);
        if(factor>2.8&&w.name<t.name){
          // Reconstruct path
          const path=[];let cur=t.name;
          while(cur){path.unshift(cur);cur=prev[cur];}
          issues.push({from:w.name,to:t.name,factor:Math.round(factor*10)/10,hops:path.length-1,path});
        }
      });
    });

    issues.sort((a,b)=>b.factor-a.factor);

    // Show result
    let html='<div style="font-size:10px;line-height:1.7">';

    if(isolated.length){
      html+='<div style="color:#ff8080;font-weight:500;margin-bottom:6px">⚠ Nicht verbunden ('+isolated.length+'):</div>';
      isolated.slice(0,5).forEach(p=>{
        html+='<div style="color:rgba(255,120,120,0.7);padding:2px 0;border-bottom:0.5px solid rgba(255,255,255,0.05)">'+p+'</div>';
      });
      if(isolated.length>5) html+='<div style="color:rgba(255,255,255,0.2)">...und '+(isolated.length-5)+' weitere</div>';
      html+='<div style="height:8px"></div>';
    } else {
      html+='<div style="color:#4aaa6a;margin-bottom:6px">✓ Alle Welten verbunden</div>';
    }

    if(issues.length){
      // Most frequent intermediate world in detours = hotspot
      const hotspot={};
      issues.forEach(issue=>issue.path.slice(1,-1).forEach(n=>{hotspot[n]=(hotspot[n]||0)+1;}));
      const topHotspot=Object.entries(hotspot).sort((a,b)=>b[1]-a[1])[0];

      html+='<div style="padding:5px 8px;background:rgba(245,166,35,0.08);border-radius:5px;margin-bottom:8px;font-size:10px">';
      html+='<span style="color:#f5a623;font-weight:500">Tipp:</span> ';
      if(topHotspot) html+='Viele Umwege führen über <b style="color:rgba(255,255,255,0.7)">'+topHotspot[0]+'</b> ('+topHotspot[1]+'×). ';
      html+='Direkte Routen von/zu dieser Welt würden am meisten bringen.</div>';

      html+='<div style="color:#f5a623;font-weight:500;margin-bottom:4px">Top Umwege — direkte Route empfohlen:</div>';
      issues.slice(0,8).forEach(issue=>{
        const saving=Math.round((1-1/issue.factor)*100);
        html+='<div style="padding:4px 0;border-bottom:0.5px solid rgba(255,255,255,0.05)">';
        html+='<div><span style="color:rgba(255,255,255,0.8);font-weight:500">'+issue.from.split(' ')[0]+' → '+issue.to.split(' ')[0]+'</span>';
        html+=' <span style="color:#f5a623">'+issue.factor+'× Umweg</span></div>';
        html+='<div style="color:rgba(255,255,255,0.25);font-size:9px">aktuell via: '+issue.path.slice(1,-1).map(n=>n.split(' ')[0]).join(' → ')+'</div>';
        html+='<div style="color:#4aaa6a;font-size:9px">→ Direkte Route würde ~'+saving+'% Zeit sparen</div>';
        html+='</div>';
      });
      if(issues.length>8) html+='<div style="color:rgba(255,255,255,0.2);margin-top:3px">...und '+(issues.length-8)+' weitere</div>';
    } else {
      html+='<div style="color:#4aaa6a">✓ Keine grossen Umwege gefunden</div>';
    }

    html+='</div>';
    box.innerHTML=html;
  };

  window.raCopyExport=function(){
    const clean=Object.fromEntries(Object.entries(customRoutes).filter(([k,r])=>r.from!==r.to));
    navigator.clipboard.writeText(JSON.stringify(clean,null,2));
    raStatus('JSON kopiert ✓','ok');
  };

  window.raImportPrompt=function(){
    const txt=prompt('JSON einfügen:');
    if(!txt) return;
    try{
      const parsed=JSON.parse(txt);
      // Filter out self routes
      const clean=Object.fromEntries(Object.entries(parsed).filter(([k,r])=>r.from!==r.to));
      customRoutes=clean;
      saveRoutes(customRoutes);
      if(window.atlasCustomRoutes!==undefined) window.atlasCustomRoutes=customRoutes;
      raUpdateSavedList();raUpdateMissing();raUpdateExport();drawGhostRoutes();
      raStatus(Object.keys(clean).length+' Routen importiert','ok');
    }catch(e){raStatus('Ungültiges JSON','warn');}
  };

  window.raClearAll=function(){
    if(!confirm('Alle gespeicherten Routen löschen?')) return;
    customRoutes={};saveRoutes(customRoutes);
    if(window.atlasCustomRoutes!==undefined) window.atlasCustomRoutes=customRoutes;
    raUpdateSavedList();raUpdateMissing();raUpdateExport();drawGhostRoutes();
    raStatus('Alle Routen gelöscht','warn');
  };

  function raStatus(msg,type){
    const el=document.getElementById('ra-status');if(!el)return;
    el.textContent=msg;el.className='ra-status'+(type?' '+type:'');
  }
  function raUpdateHint(){
    const h=document.getElementById('ra-hint');if(!h)return;
    if(!fromW) h.innerHTML='Welt anklicken = <b>Start</b> setzen';
    else if(!toW) h.innerHTML='<b>'+fromW.name+'</b>. Zweite Welt = Ziel.';
    else h.innerHTML='Karte = freier Wegpunkt ('+segType+'). Welt = Durchfahrt. Punkt klicken = löschen.';
  }

  // Fill the map with the world image (same map URL as the main map)
  const mapImg=document.querySelector('#map-bg img');
  if(mapImg){
    const bg=document.createElementNS('http://www.w3.org/2000/svg','image');
    bg.setAttribute('href',mapImg.src);
    bg.setAttribute('x','0');bg.setAttribute('y','0');
    bg.setAttribute('width','560');bg.setAttribute('height','315');
    bg.setAttribute('preserveAspectRatio','xMidYMid slice');
    document.getElementById('ra-mapsvg').insertBefore(bg,ghostG);
  }

  // Load existing routes
  raUpdateSavedList();raUpdateMissing();raUpdateExport();drawGhostRoutes();
}

window.atlasCustomRoutes=loadRoutes();

})();
