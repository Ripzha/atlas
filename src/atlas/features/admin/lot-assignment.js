/* PROJECT ATLAS - Lot assignment (admin tab "assign").
   Assigns forum threads to free lots and writes them to the sheet via the
   Apps Script (action=updateLot).
   Classic script, loaded before core.js. */

var _assignLots = null;
var _assignWorld = null;

function renderAssignTab(c){
  if(!c) c = document.getElementById('admin-content');
  c.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.3)">⏳ Lade Lots...</div>';
  if(_assignLots){ buildAssignUI(c); return; }
  fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRRllRkwaCacdM0WZZT0cVQflhxJ9Fw5mgId-v615_kE2GdKdbwHMUYCG03HC8gUXfg7lucTs1Mqhg1/pub?output=csv&gid=306313316&single=true')
    .then(function(r){return r.text();})
    .then(function(csv){
      var rows = csv.split('\n');
      var headers = rows[0].split(',').map(function(h){return h.replace(/"/g,'').trim().toLowerCase();});
      var wIdx = headers.indexOf('welt');
      var nIdx = headers.indexOf('nr.');
      var nameIdx = headers.indexOf('name');
      var urlIdx = headers.indexOf('thread url');
      _assignLots = rows.slice(1).filter(function(r){return r.trim();}).map(function(r){
        var cols = r.split(',');
        var get = function(i){return (cols[i]||'').replace(/"/g,'').trim();};
        return {world:get(wIdx),nr:get(nIdx),name:get(nameIdx),threadUrl:get(urlIdx)};
      });
      buildAssignUI(c);
    })
    .catch(function(){ c.innerHTML = '<div style="color:#ff6b6b;padding:20px">Fehler beim Laden.</div>'; });
}

function buildAssignUI(c){
  var worlds = [];
  _assignLots.forEach(function(l){ if(l.world && worlds.indexOf(l.world)<0) worlds.push(l.world); });
  var selWorld = _assignWorld || worlds[0] || '';
  var unassigned = _assignLots.filter(function(l){return l.world===selWorld && l.nr && !l.threadUrl;});
  
  var worldOpts = worlds.map(function(w){
    return '<option value="'+w+'"'+(w===selWorld?' selected':'')+'>'+w+'</option>';
  }).join('');

  var grid = unassigned.length
    ? unassigned.map(function(l){
        return '<button class="a-btn" style="font-size:11px;padding:5px 8px" onclick="window._adminAssignSelect(\'' + l.nr.replace(/'/g,"\'") + '\')" data-nr="'+l.nr+'">'+l.nr+'</button>';
      }).join('')
    : '<div style="font-size:11px;color:rgba(255,255,255,0.3)">Alle vergeben ✓</div>';

  c.innerHTML = '<div style="margin-bottom:10px"><div class="a-label">Welt</div>'
    +'<select class="a-select" onchange="_assignWorld=this.value;buildAssignUI(document.getElementById(\'admin-content\'))">'+worldOpts+'</select></div>'
    +'<div style="font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:6px">Unvergeben ('+unassigned.length+'):</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">'+grid+'</div>'
    +'<div id="assign-form" style="display:none;border-top:0.5px solid rgba(255,255,255,0.08);padding-top:10px">'
    +'<div class="a-form-row"><div class="a-label">Ausgewählt: <span id="assign-nr-label" style="color:#4aaa6a"></span></div></div>'
    +'<div class="a-form-row"><div class="a-label">Art</div><div style="display:flex;gap:6px">'
    +'<button class="a-btn" id="assign-type-single" onclick="window._adminAssignType(\'single\')" style="flex:1;font-size:10px">Einzeln</button>'
    +'<button class="a-btn" id="assign-type-complex" onclick="window._adminAssignType(\'complex\')" style="flex:1;font-size:10px">Wohnkomplex</button>'
    +'</div></div>'
    +'<div id="assign-fields-single" style="display:none">'
    +'<div class="a-form-row"><div class="a-label">Thread-URL</div><input class="a-input" id="assign-url" placeholder="https://..."></div>'
    +'<div class="a-form-row"><div class="a-label">Bild-URL</div><input class="a-input" id="assign-img" placeholder="https://files.homepagemodules.de/..."></div>'
    +'<div class="a-form-row"><div class="a-label">Name</div><input class="a-input" id="assign-name" placeholder="z.B. Meine Wohnung"></div>'
    +'</div>'
    +'<div id="assign-fields-complex" style="display:none">'
    +'<div class="a-form-row"><div style="display:flex;gap:6px">'
    +'<button class="a-btn" id="assign-cx-existing" onclick="window._adminAssignCx(\'existing\')" style="flex:1;font-size:10px">Bestehend</button>'
    +'<button class="a-btn" id="assign-cx-new" onclick="window._adminAssignCx(\'new\')" style="flex:1;font-size:10px">Neu</button>'
    +'</div></div>'
    +'<div class="a-form-row"><div class="a-label">Einheit (A, B, 21...)</div><input class="a-input" id="assign-letter" maxlength="5" placeholder="A"></div>'
    +'<div class="a-form-row"><div class="a-label">Thread-URL Wohnung</div><input class="a-input" id="assign-url-unit" placeholder="https://..."></div>'
    +'<div class="a-form-row"><div class="a-label">Bild-URL Wohnung</div><input class="a-input" id="assign-img-unit" placeholder="https://files.homepagemodules.de/..."></div>'
    +'<div id="assign-cx-new-fields" style="display:none">'
    +'<div class="a-form-row"><div class="a-label">Übersichts-Bild-URL</div><input class="a-input" id="assign-img-overview" placeholder="https://files.homepagemodules.de/..."></div>'
    +'</div></div>'
    +'<button class="a-btn a-btn-primary" style="width:100%;margin-top:8px" onclick="window._adminAssignSave(\''+selWorld+'\')">Zuweisen</button>'
    +'<div id="assign-msg" style="font-size:11px;color:#4aaa6a;text-align:center;margin-top:6px;min-height:14px"></div>'
    +'</div>';
}

window._adminAssignSelect = function(nr){
  document.querySelectorAll('#admin-content .a-btn[data-nr]').forEach(function(b){
    b.style.background = b.getAttribute('data-nr')===nr ? 'rgba(74,170,106,0.3)' : '';
    b.style.borderColor = b.getAttribute('data-nr')===nr ? '#4aaa6a' : '';
  });
  window._adminAssignNr = nr;
  window._adminAssignTypeVal = null;
  window._adminAssignCxVal = null;
  document.getElementById('assign-nr-label').textContent = nr;
  document.getElementById('assign-form').style.display = 'block';
  document.getElementById('assign-msg').textContent = '';
};

window._adminAssignType = function(t){
  window._adminAssignTypeVal = t;
  document.getElementById('assign-type-single').style.background = t==='single'?'rgba(74,170,106,0.3)':'';
  document.getElementById('assign-type-complex').style.background = t==='complex'?'rgba(74,170,106,0.3)':'';
  document.getElementById('assign-fields-single').style.display = t==='single'?'block':'none';
  document.getElementById('assign-fields-complex').style.display = t==='complex'?'block':'none';
};

window._adminAssignCx = function(t){
  window._adminAssignCxVal = t;
  document.getElementById('assign-cx-existing').style.background = t==='existing'?'rgba(74,170,106,0.3)':'';
  document.getElementById('assign-cx-new').style.background = t==='new'?'rgba(74,170,106,0.3)':'';
  document.getElementById('assign-cx-new-fields').style.display = t==='new'?'block':'none';
};

window._adminAssignSave = function(world){
  var nr = window._adminAssignNr;
  var msg = document.getElementById('assign-msg');
  var t = window._adminAssignTypeVal;
  if(!nr||!t){ msg.style.color='#ff6b6b'; msg.textContent='Bitte Art wählen.'; return; }
  msg.style.color='rgba(255,255,255,0.4)'; msg.textContent='Speichern...';

  function doSave(saveNr, threadUrl, imgUrl, name){
    var params = new URLSearchParams({action:'updateLot',world:world,nr:saveNr,threadUrl:threadUrl||'',imgUrl:imgUrl||'',name:name||''});
    fetch('https://script.google.com/macros/s/AKfycbzJ_fMI1LBjmFAQDhjD1sr3hJtdUj4OOor_WiWX3asl_eX0FXDN1wr64cNON3odhHdX/exec?'+params.toString(),{mode:'no-cors'})
      .then(function(){
        msg.style.color='#4aaa6a'; msg.textContent='Zugewiesen!';
        var lot = _assignLots.find(function(l){return l.world===world&&l.nr===saveNr;});
        if(lot){ if(threadUrl) lot.threadUrl=threadUrl; }
        setTimeout(function(){ buildAssignUI(document.getElementById('admin-content')); }, 1200);
      }).catch(function(){ msg.style.color='#ff6b6b'; msg.textContent='Fehler.'; });
  }

  if(t==='single'){
    var url = (document.getElementById('assign-url').value||'').trim();
    var img = (document.getElementById('assign-img').value||'').trim();
    var name = (document.getElementById('assign-name').value||'').trim();
    if(!url){ msg.style.color='#ff6b6b'; msg.textContent='Thread-URL erforderlich.'; return; }
    doSave(nr, url, img, name);
  } else {
    var cx = window._adminAssignCxVal;
    if(!cx){ msg.style.color='#ff6b6b'; msg.textContent='Bestehend oder neu?'; return; }
    var letter = ((document.getElementById('assign-letter').value||'').trim()).toUpperCase();
    var unitNr = nr + (letter||'');
    var urlUnit = (document.getElementById('assign-url-unit').value||'').trim();
    var imgUnit = (document.getElementById('assign-img-unit').value||'').trim();
    if(!urlUnit){ msg.style.color='#ff6b6b'; msg.textContent='Thread-URL erforderlich.'; return; }
    doSave(unitNr, urlUnit, imgUnit, '');
    if(cx==='new'){
      var imgOv = (document.getElementById('assign-img-overview').value||'').trim();
      if(imgOv) doSave(nr, '', imgOv, '');
    }
  }
};
