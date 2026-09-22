/* PROJECT ATLAS - Route planner (navigator).
   Dijkstra on the defined road network (window.ATLAS_ROUTES, or the routes
   saved in the editor via localStorage). Offers an alternative without flight
   if the fastest route contains one. Called from inline handlers:
   toggleNavi(), setNaviMode(), calcNavi(), _naviShowAlt(). */

import { worlds } from '../../data/worlds.js?v=202609221517';

(function(){
  let naviMode=false; // 'from' | 'to' | false
  let naviTransport='car'; // 'walk' | 'car' | 'transit'

  const TRANSPORT={
    walk: {segMin:90, borderBonus:30, label:'zu Fuss'},
    car:  {segMin:25, borderBonus:10, label:'mit dem Auto'},
    transit:{segMin:15, borderBonus:5, label:'mit dem ÖV'}
  };

  window.setNaviMode=function(mode){
    naviTransport=mode;
    document.querySelectorAll('.np-mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    // If a route was already calculated, recalculate
    if(document.getElementById('navi-result').style.display==='block') calcNavi();
  };

  // Fill dropdowns
  function initNaviSelects(){
    const selFrom=document.getElementById('navi-from');
    const selTo=document.getElementById('navi-to');
    worlds.forEach(w=>{
      const a=document.createElement('option');a.value=w.name;a.textContent=w.name;selFrom.appendChild(a);
      const b=document.createElement('option');b.value=w.name;b.textContent=w.name;selTo.appendChild(b);
    });
  }
  initNaviSelects();

  // Toggle Panel
  window.toggleNavi=function(){
    const panel=document.getElementById('navi-panel');
    const btn=document.getElementById('navi-btn');
    const open=panel.classList.toggle('open');
    btn.classList.toggle('active',open);
    if(!open) clearNaviRoute();
  };

  // Dot click fills the navigator (called from the world dot click handler)
  window.naviDotClick=function(worldName){
    if(!document.getElementById('navi-panel').classList.contains('open')) return false;
    const from=document.getElementById('navi-from');
    const to=document.getElementById('navi-to');
    if(!from.value || (from.value && to.value)){
      from.value=worldName; to.value='';
    } else {
      to.value=worldName;
    }
    return true; // true = the click was handled here
  };

  // Calculate route
  window.calcNavi=function(){
    const fromName=document.getElementById('navi-from').value;
    const toName=document.getElementById('navi-to').value;
    if(!fromName||!toName){alert('Bitte Start und Ziel wählen.');return;}
    if(fromName===toName){alert('Start und Ziel sind identisch.');return;}
    const start=worlds.find(w=>w.name===fromName);
    const end=worlds.find(w=>w.name===toName);
    if(!start||!end) return;

    // Network: localStorage (editor) wins, otherwise the embedded routes
    const net=Object.keys(window.atlasCustomRoutes||{}).length>0
      ? window.atlasCustomRoutes
      : (window.ATLAS_ROUTES||{});

    // Build the graph ONLY from the defined network, no straight-line fallback
    const graph={};
    worlds.forEach(w=>{graph[w.name]=[];});
    Object.values(net).filter(r=>r.from&&r.to&&r.from!==r.to).forEach(r=>{
      if(!graph[r.from]) graph[r.from]=[];
      const fW=worlds.find(w=>w.name===r.from);
      const tW=worlds.find(w=>w.name===r.to);
      if(!fW||!tW) return;
      let dist=0;
      const pts=[{x:fW.x,y:fW.y},...(r.points||[]),{x:tW.x,y:tW.y}];
      for(let i=0;i<pts.length-1;i++) dist+=Math.sqrt(Math.pow(pts[i].x-pts[i+1].x,2)+Math.pow(pts[i].y-pts[i+1].y,2));
      graph[r.from].push({to:r.to,dist,key:r.from+'|'+r.to+'|'+r.transport});
    });

    // Dijkstra
    const distMap={},prevMap={};
    worlds.forEach(w=>{distMap[w.name]=Infinity;});
    distMap[fromName]=0;
    const queue=new Set(worlds.map(w=>w.name));
    while(queue.size){
      let u=null;queue.forEach(n=>{if(u===null||distMap[n]<distMap[u])u=n;});
      if(distMap[u]===Infinity) break;
      queue.delete(u);
      (graph[u]||[]).forEach(e=>{
        const alt=distMap[u]+e.dist;
        if(alt<distMap[e.to]){distMap[e.to]=alt;prevMap[e.to]={node:u,key:e.key};}
      });
    }

    if(distMap[toName]===Infinity){
      document.getElementById('navi-result').style.display='block';
      document.getElementById('navi-time').innerHTML='<span style="color:rgba(255,80,80,0.8)">Keine Route im Netz</span>';
      document.getElementById('navi-route-list').innerHTML='<li style="font-size:10px;color:rgba(255,255,255,0.3)">Für diese Verbindung wurde noch keine Route eingezeichnet.</li>';
      document.getElementById('navi-calc-info').textContent='Route fehlt im Netz.';
      return;
    }

    // Reconstruct path + used route keys
    const pathNames=[];const usedKeys=[];let cur=toName;
    while(cur){pathNames.unshift(cur);if(prevMap[cur]){usedKeys.unshift(prevMap[cur].key);cur=prevMap[cur].node;}else break;}

    // Collect segment types + waypoints
    let hasBoat=false,hasPlane=false;
    const allWaypoints=[];
    usedKeys.forEach((key,ki)=>{
      const r=net[key];if(!r) return;
      r.points.forEach(p=>{if(p.segType==='boat')hasBoat=true;if(p.segType==='plane')hasPlane=true;});
      const fW=worlds.find(w=>w.name===r.from);
      if(ki===0) allWaypoints.push({x:fW.x,y:fW.y,segType:'road'});
      (r.points||[]).forEach(p=>allWaypoints.push(p));
      const tW=worlds.find(w=>w.name===r.to);
      allWaypoints.push({x:tW.x,y:tW.y,segType:'road'});
    });

    // Travel time: real path length × speed factor per segment
    // Factor = minutes per map unit (1 unit ≈ about 1 km at map scale)
    const SPEED={car:{road:2.8,boat:4,plane:0.8},transit:{road:3.5,boat:3.2,plane:0.8},walk:{road:14,boat:3.2,plane:0.8}};
    const sp=SPEED[naviTransport]||SPEED.car;
    let totalMins=0;
    for(let i=0;i<allWaypoints.length-1;i++){
      const segDist=Math.sqrt(Math.pow(allWaypoints[i].x-allWaypoints[i+1].x,2)+Math.pow(allWaypoints[i].y-allWaypoints[i+1].y,2));
      const st=allWaypoints[i+1].segType||'road';
      totalMins+=segDist*(sp[st]||sp.road);
    }
    totalMins=Math.max(1,Math.round(totalMins));
    const h=Math.floor(totalMins/60),m=totalMins%60;
    const timeStr=(h>0?h+'h ':'')+(m>0?m+' min':'');
    const modeLabels={car:'mit dem Auto',transit:'mit dem ÖV',walk:'zu Fuss'};

    document.getElementById('navi-time').innerHTML=timeStr+' <span>'+(modeLabels[naviTransport]||'')+'</span>';
    document.getElementById('navi-calc-info').textContent='Route folgt dem Strassennetz ('+(pathNames.length)+' Orte)'+(hasBoat?' · Boot-Abschnitt':hasPlane?' · Flug-Abschnitt':'');

    const list=document.getElementById('navi-route-list');
    list.innerHTML='';
    pathNames.forEach((name,i)=>{
      const li=document.createElement('li');
      const isEnd=(i===0||i===pathNames.length-1);
      if(isEnd) li.className='np-endpoint';
      li.innerHTML='<div class="np-dot-marker"></div>'+(i>0?'<span class="np-arrow">&#9658;</span> ':'')+name;
      if(!isEnd) li.style.paddingLeft='4px';
      list.appendChild(li);
    });
    if(hasBoat||hasPlane){
      const badge=document.createElement('li');
      badge.style.cssText='padding-top:6px;font-size:10px;color:'+(hasBoat?'#5a9fd4':'#b07add');
      badge.textContent=hasBoat?'~ Wasserüberquerung per Boot':'Flug-Abschnitt';
      list.appendChild(badge);
    }
    document.getElementById('navi-result').style.display='block';
    drawNaviRoute(pathNames.map(n=>worlds.find(w=>w.name===n)),allWaypoints);

    // Offer an alternative without flight if the main route contains one
    const altDiv=document.getElementById('navi-alt');
    if(hasPlane){
      // Dijkstra without flight edges
      const graphNoPlane={};
      worlds.forEach(w=>{graphNoPlane[w.name]=[];});
      Object.values(net).filter(r=>r.from&&r.to&&r.from!==r.to).forEach(r=>{
        const hasPlaneEdge=r.points.some(p=>p.segType==='plane');
        if(hasPlaneEdge) return; // skip flight routes
        if(!graphNoPlane[r.from]) graphNoPlane[r.from]=[];
        const fW=worlds.find(w=>w.name===r.from);
        const tW=worlds.find(w=>w.name===r.to);
        if(!fW||!tW) return;
        let dist=0;
        const pts=[{x:fW.x,y:fW.y},...(r.points||[]),{x:tW.x,y:tW.y}];
        for(let i=0;i<pts.length-1;i++) dist+=Math.sqrt(Math.pow(pts[i].x-pts[i+1].x,2)+Math.pow(pts[i].y-pts[i+1].y,2));
        graphNoPlane[r.from].push({to:r.to,dist,key:r.from+'|'+r.to+'|'+r.transport});
      });
      const distAlt={},prevAlt={};
      worlds.forEach(w=>{distAlt[w.name]=Infinity;});
      distAlt[fromName]=0;
      const qAlt=new Set(worlds.map(w=>w.name));
      while(qAlt.size){
        let u=null;qAlt.forEach(n=>{if(u===null||distAlt[n]<distAlt[u])u=n;});
        if(distAlt[u]===Infinity) break;
        qAlt.delete(u);
        (graphNoPlane[u]||[]).forEach(e=>{
          const alt=distAlt[u]+e.dist;
          if(alt<distAlt[e.to]){distAlt[e.to]=alt;prevAlt[e.to]={node:u,key:e.key};}
        });
      }
      if(distAlt[toName]===Infinity){
        altDiv.style.display='block';
        altDiv.innerHTML='<div style="font-size:10px;color:rgba(255,255,255,0.25)">✈ Kein Alternativweg ohne Flug verfügbar</div>';
      } else {
        // Reconstruct the alternative path
        const altNames=[];const altKeys=[];let cur2=toName;
        while(cur2){altNames.unshift(cur2);if(prevAlt[cur2]){altKeys.unshift(prevAlt[cur2].key);cur2=prevAlt[cur2].node;}else break;}
        let altBoat=false;
        const altWp=[];
        altKeys.forEach((key,ki)=>{
          const r=net[key];if(!r) return;
          r.points.forEach(p=>{if(p.segType==='boat')altBoat=true;});
          const fW=worlds.find(w=>w.name===r.from);
          if(ki===0) altWp.push({x:fW.x,y:fW.y,segType:'road'});
          (r.points||[]).forEach(p=>altWp.push(p));
          const tW=worlds.find(w=>w.name===r.to);
          altWp.push({x:tW.x,y:tW.y,segType:'road'});
        });
        let altMins=0;
        for(let i=0;i<altWp.length-1;i++){
          const segDist=Math.sqrt(Math.pow(altWp[i].x-altWp[i+1].x,2)+Math.pow(altWp[i].y-altWp[i+1].y,2));
          const st=altWp[i+1].segType||'road';
          altMins+=segDist*(sp[st]||sp.road);
        }
        altMins=Math.max(1,Math.round(altMins));
        const ah=Math.floor(altMins/60),am=altMins%60;
        const altTime=(ah>0?ah+'h ':'')+(am>0?am+' min':'');
        altDiv.style.display='block';
        altDiv.innerHTML=`
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-bottom:5px">✈ Alternativweg ohne Flug:</div>
          <button onclick="window._naviShowAlt()" style="background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.15);border-radius:6px;color:rgba(255,255,255,0.6);font-size:11px;padding:5px 10px;cursor:pointer;width:100%;text-align:left">
            ${altTime} · ${altNames.length} Orte${altBoat?' · Boot':''}
            <span style="float:right;opacity:0.4">anzeigen ▸</span>
          </button>`;
        window._naviShowAlt=function(){
          drawNaviRoute(altNames.map(n=>worlds.find(w=>w.name===n)),altWp);
          document.getElementById('navi-time').innerHTML=altTime+' <span>'+(modeLabels[naviTransport]||'')+'</span>';
          document.getElementById('navi-calc-info').textContent='Alternative ohne Flug ('+altNames.length+' Orte)'+(altBoat?' · Boot-Abschnitt':'');
          const list=document.getElementById('navi-route-list');
          list.innerHTML='';
          altNames.forEach((name,i)=>{
            const li=document.createElement('li');
            const isEnd=(i===0||i===altNames.length-1);
            if(isEnd) li.className='np-endpoint';
            li.innerHTML='<div class="np-dot-marker"></div>'+(i>0?'<span class="np-arrow">&#9658;</span> ':'')+name;
            if(!isEnd) li.style.paddingLeft='4px';
            list.appendChild(li);
          });
          altDiv.querySelector('button').textContent='✓ Alternativweg aktiv';
          altDiv.querySelector('button').style.color='rgba(74,170,106,0.8)';
          altDiv.querySelector('button').style.borderColor='rgba(74,170,106,0.3)';
          altDiv.querySelector('button').onclick=null;
        };
      }
    } else {
      altDiv.style.display='none';
    }
  };

  function clearNaviRoute(){
    const svg=document.getElementById('navi-route-svg');
    if(svg) svg.innerHTML='';
    document.getElementById('navi-result').style.display='none';
  }

  function drawNaviRoute(stops,allWaypoints){
    const svg=document.getElementById('navi-route-svg');
    svg.innerHTML='';

    // If real waypoints exist: draw along the route
    const pts=allWaypoints&&allWaypoints.length>0 ? allWaypoints : stops;

    // Color by dominant segment type
    const hasBoat=pts.some&&pts.some(p=>p.segType==='boat');
    const hasPlane=pts.some&&pts.some(p=>p.segType==='plane');

    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1];
      const ax='x' in a?a.x:a.x, ay='y' in a?a.y:a.y;
      const bx='x' in b?b.x:b.x, by='y' in b?b.y:b.y;
      const st=b.segType||'road';
      const lineColor=st==='boat'?'rgba(80,170,240,0.9)':st==='plane'?'rgba(200,140,255,0.9)':'rgba(255,230,100,0.95)';
      const dash=st==='boat'?'2 3':st==='plane'?'6 3':'3 2';

      const shadow=document.createElementNS('http://www.w3.org/2000/svg','line');
      shadow.setAttribute('x1',ax);shadow.setAttribute('y1',ay);
      shadow.setAttribute('x2',bx);shadow.setAttribute('y2',by);
      shadow.setAttribute('stroke','rgba(0,0,0,0.55)');shadow.setAttribute('stroke-width','2.8');
      shadow.setAttribute('stroke-linecap','round');shadow.setAttribute('vector-effect','non-scaling-stroke');
      svg.appendChild(shadow);

      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',ax);line.setAttribute('y1',ay);
      line.setAttribute('x2',bx);line.setAttribute('y2',by);
      line.setAttribute('stroke',lineColor);line.setAttribute('stroke-width','1.4');
      line.setAttribute('stroke-dasharray',dash);line.setAttribute('stroke-linecap','round');
      line.setAttribute('vector-effect','non-scaling-stroke');
      svg.appendChild(line);
    }

    // Highlight world dots
    document.querySelectorAll('.world-dot').forEach(el=>{el.querySelector('.dot-inner').style.removeProperty('outline');});
    (stops||[]).forEach((w,i)=>{
      if(!w) return;
      const el=document.querySelector(`.world-dot[data-world-key="${w.name}"]`);
      if(!el) return;
      const inner=el.querySelector('.dot-inner');
      if(i===0||i===(stops.length-1)){inner.style.outline='2px solid rgba(255,230,100,1)';inner.style.outlineOffset='3px';}
      else{inner.style.outline='1.5px solid rgba(255,230,100,0.7)';inner.style.outlineOffset='2px';}
    });
  }

  // Close the panel when clicking away from it
  document.addEventListener('click',function(e){
    if(!e.target.closest('#navi-panel')&&!e.target.closest('#navi-btn')){
      const panel=document.getElementById('navi-panel');
      if(panel.classList.contains('open')){
        panel.classList.remove('open');
        document.getElementById('navi-btn').classList.remove('active');
      }
    }
  });

})();
