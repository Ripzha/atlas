/* PROJECT ATLAS - Character sheet generator.
   Split out of character-sheet.html (stage 5). The code is unchanged; it only
   runs as an ES module now. The page has no inline handlers, so it needs no
   bridge to window.

   Dependency: this file reads src/atlas/data/world-lots.js as TEXT and finds
   the worldLots declaration by pattern (see extractObj further down). If the
   way that declaration is written changes, the home selection here breaks. */

var APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzJ_fMI1LBjmFAQDhjD1sr3hJtdUj4OOor_WiWX3asl_eX0FXDN1wr64cNON3odhHdX/exec";

var C={bg:"#070f1a",card:"#0d1f2d",card2:"#0a1828",border:"rgba(255,255,255,0.1)",accent:"#4aaa6a",teal:"#3a8aaa",text:"#ddeedd",muted:"rgba(255,255,255,0.45)",input:"rgba(255,255,255,0.07)",danger:"#e05555"};

var FIELDS=[
  {key:"name",label:"Name",hint:"Wie heisst dein Charakter? Hat er einen Kosenamen?",multi:false},
  {key:"age",label:"Alter",hint:"Wie alt ist dein Charakter? Geburtsdatum?",multi:false},
  {key:"gender",label:"Geschlecht",hint:"Männlich, weiblich, divers?",multi:false},
  {key:"orientation",label:"Orientierung",hint:"Zu welchem Geschlecht fühlt sich der Charakter hingezogen?",multi:false,optional:true},
  {key:"occult",label:"Okkultismus",hint:"Vampir, Magier, Meersim oder Alien?",multi:false,optional:true},
  {key:"job",label:"Beruf",hint:"Was arbeitet dein Charakter?",multi:true},
  {key:"wealth",label:"Einkommen / Vermögen",hint:"Reich, arm, durchschnittlich?",multi:true},
  {key:"goals",label:"Ziele",hint:"Welches Ziel verfolgt dein Sim?",multi:true},
  {key:"group",label:"Gruppierung",hint:"In einer Gruppe? Angesehen oder verrufen?",multi:true,optional:true},
  {key:"origin",label:"Herkunft",hint:"Wo kommt dein Charakter her? z.B. \"aus Sulani\" oder \"Geboren in Britechester...\"",multi:true},
  {key:"hobbies",label:"Hobbies",hint:"Was macht dein Charakter in der Freizeit?",multi:true},
  {key:"home",label:"Wohnort / Haus",hint:"Wähle eine noch freie Kartennummer.",multi:false},
  {key:"livingSit",label:"Wohnsituation",hint:"Allein, WG, bei den Eltern, mit Partner?",multi:true},
  {key:"family",label:"Familie / Tiere / NPCs",hint:"Verwandtschaft, Freunde, Feinde?",multi:true},
  {key:"skills",label:"Fähigkeiten",hint:"Was kann dein Charakter besonders gut?",multi:true},
  {key:"appearance",label:"Aussehen",hint:"Wie gross? Besondere Merkmale?",multi:true},
  {key:"voice",label:"Stimme",hint:"Hoch, tief, rau, sanft?",multi:true},
  {key:"scent",label:"Geruch / Duft",hint:"Wie riecht der Charakter?",multi:true},
  {key:"personality",label:"Persönlichkeit",hint:"Lustig? Verschlossen? Draufgänger?",multi:true},
  {key:"history",label:"Geschichte",hint:"Was hat dein Charakter bisher erlebt?",multi:true}
];

// Pro-Feld-Kontext fuer die KI-Hilfe — klarstellt was im jeweiligen Feld
// gemeint ist. Verhindert dass Mistral "Orientierung" als Lebensrichtung
// oder "Okkultismus" als esoterische Praktik interpretiert.
var FIELD_AI_CONTEXT={
  name:"Der Vorname und ggf. Nachname oder Kosename des Charakters.",
  age:"Numerisches Alter oder Geburtsdatum. Bei Sims meist 18-80 Jahre.",
  gender:"Geschlechtsidentitaet: maennlich, weiblich, divers, non-binaer etc.",
  orientation:"SEXUELLE ORIENTIERUNG: hetero, schwul, lesbisch, bi, pan, asexuell etc. Nicht zu verwechseln mit Lebensziel oder Religion.",
  occult:"OKKULT-STATUS in Sims 4: Vampir, Werwolf, Magier (Hexe/Hexer), Meersim, Alien, Pflanzensim, Geist, Servo (Roboter), oder normaler Sim. Es geht NICHT um esoterische Praktiken oder Religion.",
  job:"Beruf oder Berufung des Charakters, z.B. Arzt, Detektiv, Musiker, Bauer, arbeitssuchend.",
  wealth:"Finanzielle Lage und Lebensstandard: reich, arm, durchschnittlich, Schulden, Erbe.",
  goals:"Was will der Charakter im Leben erreichen? Kurzfristig und langfristig.",
  group:"Soziale Gruppe oder Zugehoerigkeit: Familie, Clique, Verein, Subkultur, Aussenseiter.",
  origin:"Herkunft im Sinne von Geburtsort, Heimat oder familiaere/kulturelle Wurzeln.",
  hobbies:"Freizeitbeschaeftigungen, Leidenschaften abseits vom Beruf.",
  home:"Aktueller Wohnort im RPG-Universum (Welt-Name + ggf. Grundstuecks-Nummer).",
  livingSit:"Wohnsituation: allein, WG, mit Familie/Partner, Hausbesitz oder Miete.",
  family:"Familienverhaeltnisse, Tiere und wichtige Nicht-Spieler-Charaktere im Umfeld.",
  skills:"Faehigkeiten und Talente des Charakters — was kann er besonders gut?",
  appearance:"Aeusseres Erscheinungsbild: Koerperbau, Haare, Augen, Stil, Narben, Auffaelligkeiten.",
  voice:"Klang der Stimme: Tonhoehe, Lautstaerke, Akzent, Sprechgewohnheiten.",
  scent:"Wie riecht der Charakter? Parfum, natuerlicher Duft, Beruf-bedingter Geruch.",
  personality:"Charaktereigenschaften, Temperament, Eigenheiten.",
  history:"Bisheriger Lebenslauf, praegende Erlebnisse, Geschichte vor dem RPG-Start."
};

var SECTIONS=[
  {title:"Identität",fields:["name","age","gender","orientation","occult"]},
  {title:"Leben",fields:["job","wealth","goals","group","origin","hobbies"]},
  {title:"Zuhause",fields:["home","livingSit","family"]},
  {title:"Charakter",fields:["skills","appearance","voice","scent","personality","history"]},
  {title:"Blatt",fields:[]}
];

var SYS="Du bist ein kreativer Autor-Assistent für das Forum-RPG auf simsforumrpg.de (Sims 4 basiert).\nHilf dem Nutzer ein Feld im Charakterbogen zu füllen oder zu vertiefen.\nAntworte auf Deutsch. Kein Markdown, keine Sternchen.\nGib 1-2 kurze Autoren-Tipps für dieses Feld, dann 2-3 Fragen die der Nutzer sich stellen kann.\nKeine fertigen Texte zum Einfügen – der Nutzer schreibt selbst.";

var state={
  step:0,
  char:(function(){var o={};FIELDS.forEach(function(f){o[f.key]="";});return o;}()),
  imgPreview:null,imgB64:null,imgMime:null,imgUrl:"",showUrlPopup:false,urlPopupInput:"",
  ai:{},
  importText:"",importing:false,showImport:false,
  ctxEntries:[],ctxLabel:"",ctxText:"",showCtx:false,
  showAtlas:false,atlasPlayer:"",atlasThread:"",atlasPortrait:"",atlasType:"haupt",atlasSaving:false,atlasSaved:false,
  showPost:false,postType:"haupt",postCopied:false
};

// ── localStorage Persistenz ──
function saveLocalDraft(){
  try{localStorage.setItem('sw_charbogen',JSON.stringify({char:state.char,step:state.step,imgPreview:state.imgPreview,postType:state.postType,imgUrl:state.imgUrl}));}catch(e){}
}
function loadLocalDraft(){
  try{
    var s=localStorage.getItem('sw_charbogen');
    if(!s)return false;
    var d=JSON.parse(s);
    if(!d.char||!Object.keys(d.char).some(function(k){return d.char[k];}))return false;
    if(confirm("Es gibt einen gespeicherten Entwurf. Weiterarbeiten?")){
      FIELDS.forEach(function(f){if(d.char[f.key])state.char[f.key]=d.char[f.key];});
      if(d.step)state.step=d.step;
      if(d.imgPreview)state.imgPreview=d.imgPreview;
      if(d.imgUrl)state.imgUrl=d.imgUrl;
      if(d.postType)state.postType=d.postType;
      return true;
    }
  }catch(e){}
  return false;
}

// ── BBCode Generator ──
var FORUM_IDS={haupt:"51849",neben:"51850",randfigur:"51851",passant:"52617"};
function generateBBCode(){
  var c=state.char;
  var lines=[];
  // ── Schicke Kopf-Karte ──
  // Nur kurze, garantiert-knappe Felder im Header. Beruf und Herkunft koennen
  // beliebig lang werden (Freitext) — die sprengen die zentrierte Karte, also
  // stehen sie nur ausgeschrieben in der Leben-Sektion.
  lines.push("[center][size=5][b][color=#4d7a4d]"+(c.name||"???")+"[/color][/b][/size][/center]");
  var ageStr = c.age ? (/jahre?\s*$/i.test(c.age.trim()) ? c.age : c.age+" Jahre") : "";
  var sub=[ageStr,c.gender,c.orientation,c.occult].filter(Boolean).join(" · ");
  if(sub)lines.push("[center][i]"+sub+"[/i][/center]");
  // Visuelle Trennung (Xobor hat kein [hr] — Unicode-Linie statt dessen)
  lines.push("");
  lines.push("[center][color=#9aaa9a]━━━━━━━━━━━━━━━━━━━━[/color][/center]");
  lines.push("");

  // ── Alle Sektionen mit allen Feldern als ausgeschriebene Liste ──
  // Identitaet kommt zuerst (auch wenn manche Felder schon im Header sind — doppelt
  // ist sicherer als wenn der Forum-Leser etwas verpasst, weil das Auge die
  // Header-Karte als Bild und nicht als Datenliste liest).
  SECTIONS.slice(0,-1).forEach(function(sec){
    var sf=sec.fields.map(function(k){return FIELDS.find(function(f){return f.key===k;});})
      .filter(function(f){return f&&c[f.key]&&c[f.key].trim&&c[f.key].trim();});
    if(!sf.length)return;
    lines.push("[b][color=#3d6f8a]— "+sec.title.toUpperCase()+" —[/color][/b]");
    lines.push("");
    sf.forEach(function(f){
      lines.push("[b]"+f.label+":[/b]");
      lines.push(c[f.key]);
      lines.push("");
    });
    // Sektion-Ende: Unicode-Trennlinie (zarter als die Kopf-Trennung)
    lines.push("[center][color=#9aaa9a]· · ·[/color][/center]");
    lines.push("");
  });
  return lines.join("\n");
}

// ── helpers ──
function qs(id){return document.getElementById(id);}
function mk(tag,style,children){
  var e=document.createElement(tag);
  if(style){
    Object.keys(style).forEach(function(k){
      if(k==="src"||k==="href"||k==="id"||k==="type"||k==="accept"||k==="rows"||k==="placeholder"||k==="value"||k==="target"||k==="rel"||k==="name"||k==="title"){
        e.setAttribute(k,style[k]);
      } else if(k==="style"&&typeof style[k]==="object"){
        Object.assign(e.style,style[k]);
      } else if(k==="style"&&typeof style[k]==="string"){
        e.style.cssText=style[k];
      } else {
        e.style[k]=style[k];
      }
    });
  }
  if(children)children.forEach(function(c){if(c!=null)e.appendChild(typeof c==="string"?document.createTextNode(c):c);});
  return e;
}
function div(s,c){return mk("div",s,c);}
function span(s,c){return mk("span",s,c);}
var INP={width:"100%",padding:"8px 11px",borderRadius:"6px",border:"1px solid "+C.border,fontSize:"13px",background:C.input,color:C.text,boxSizing:"border-box",colorScheme:"dark"};
function btn(label,bg,cb,sm,out,dis){
  var e=mk("button",{background:out?"transparent":(bg||C.accent),color:out?(bg||C.accent):"#fff",border:"1px solid "+(bg||C.accent),borderRadius:"7px",padding:sm?"4px 10px":"7px 14px",fontSize:sm?"11px":"13px",fontWeight:"600",cursor:dis?"not-allowed":"pointer",opacity:dis?"0.5":"1",whiteSpace:"nowrap"});
  e.textContent=label;
  if(!dis&&cb)e.addEventListener("click",cb);
  return e;
}
function stripMd(t){return(t||"").replace(/\*\*(.*?)\*\*/g,"$1").replace(/\*(.*?)\*/g,"$1").replace(/^#+\s/gm,"");}
function toStr(v){if(v==null)return"";if(Array.isArray(v))return v.map(toStr).join("\n");if(typeof v==="object")return Object.values(v).map(toStr).join("\n");return String(v);}
function charCtx(){
  var m=FIELDS.filter(function(f){return state.char[f.key];}).map(function(f){return f.label+": "+state.char[f.key];}).join("\n");
  var r=state.ctxEntries.length?"\n\n--- VERWANDTE CHARAKTERE ---\n"+state.ctxEntries.map(function(e){return"["+e.label+"]\n"+e.text;}).join("\n\n"):"";
  return m+r;
}

// ── API ──
function mistral(messages,model,maxTok,cb){
  fetch(APPS_SCRIPT_URL,{
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({
      action:"mistral",
      messages:messages,
      model:model||"mistral-small-latest",
      max_tokens:maxTok||800
    })
  }).then(function(r){return r.json();}).then(function(d){
    if(d.error)cb(d.error,null);
    else if(d.ok&&d.text!=null)cb(null,d.text);
    else cb("Unbekannte Antwort vom Server",null);
  }).catch(function(e){cb(e.message,null);});
}

function callAI(key,msg,histOverride){
  var ai=state.ai[key]||{msgs:[],history:[],input:"",open:false};
  ai.loading=true;ai.open=true;
  ai.input="";  // clear input
  state.ai[key]=ai;
  draw();
  var hist=histOverride!==undefined?histOverride:(ai.history||[]);
  var newHist=hist.concat([{role:"user",content:msg}]);
  var sysMsg={role:"system",content:SYS+"\n\nCharakterbogen:\n"+charCtx()};

  var model="mistral-small-latest";
  var sendHist=hist.concat([{role:"user",content:msg}]);
  mistral([sysMsg].concat(sendHist),model,800,function(err,text){
    var ai2=state.ai[key]||{msgs:[],history:[]};
    ai2.loading=false;
    if(err){
      ai2.msgs=(ai2.msgs||[]).concat([{role:"assistant",content:"⚠️ "+err}]);
    } else {
      var t=stripMd(text);
      ai2.history=newHist.concat([{role:"assistant",content:t}]);
      ai2.msgs=(ai2.msgs||[]).concat([{role:"user",content:msg},{role:"assistant",content:t}]);
    }
    state.ai[key]=ai2;draw();
    // Scroll to bottom of this AI chat
    setTimeout(function(){
      var msgDivs=document.querySelectorAll('[data-ai-key="'+key+'"]');
      if(msgDivs.length){msgDivs[0].scrollTop=msgDivs[0].scrollHeight;}
    },50);
  });
}

// ── Image upload ──
function setupImgInput(){
  var inp=qs("imgInput");
  inp.addEventListener("change",function(){
    var file=inp.files[0];
    if(!file)return;
    var reader=new FileReader();
    reader.addEventListener("load",function(){
      var result=reader.result;
      if(!result||result.indexOf("data:")===-1){alert("Fehler: Bild konnte nicht gelesen werden.");return;}
      state.imgPreview=result;
      state.imgB64=result.split(",")[1];
      state.imgMime=file.type||"image/png";
      inp.value="";
      // Remove old preview if exists
      var existing=qs("preview-img");
      if(existing)existing.parentNode.removeChild(existing);
      // Redraw content only – shell stays
      var ca=qs("content");
      if(ca){
        ca.innerHTML="";
        var sec=SECTIONS[state.step];
        if(state.step<SECTIONS.length-1){
          ca.appendChild(div({fontSize:"10px",fontWeight:"800",letterSpacing:"3px",color:C.teal,marginBottom:"18px"},[sec.title.toUpperCase()]));
          sec.fields.forEach(function(k){var f=FIELDS.find(function(f){return f.key===k;});if(f)ca.appendChild(mkField(f));});
        } else {
          ca.appendChild(mkSheet());
        }
      }
    });
    reader.readAsDataURL(file);
  });
}

// ── Import ──
function doImport(){
  var txt=state.importText;
  if(!txt.trim())return;
  state.importing=true;draw();
  var fl=FIELDS.map(function(f){return'"'+f.key+'":"'+f.label+'"';}).join(",");
  mistral([
    {role:"system",content:"Analysiere einen Charakterbogen. Gib NUR ein JSON-Objekt zurück, keine Backticks, kein Markdown. Alle Werte als Strings. Felder: {"+fl+"}"},
    {role:"user",content:"Charakterbogen:\n\n"+txt}
  ],"mistral-small-latest",2000,function(err,raw){
    if(err){alert("Fehler: "+err);state.importing=false;draw();return;}
    try{
      var p=JSON.parse(raw.replace(/```json|```/g,"").trim());
      FIELDS.forEach(function(f){if(p[f.key]!=null)state.char[f.key]=toStr(p[f.key]);});
      state.importing=false;state.showImport=false;state.importText="";
    }catch(e){alert("Parse-Fehler: "+e.message);state.importing=false;}
    draw();
  });
}

// ── Download ──
function downloadDoc(){
  var name=state.char.name||"Charakter";
  var skip=["name","age","gender","occult","job","origin"];
  var h=['<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Calibri,sans-serif;margin:40px}h1{color:#4aaa6a;font-size:22pt}h2{color:#3a8aaa;font-size:12pt;margin:16px 0 4px;border-bottom:1px solid #96a896;padding-bottom:2px}p{font-size:11pt;white-space:pre-wrap;margin:2px 0 8px}.s{color:#4a564a;font-size:10pt}</style></head><body>'];
  h.push("<h1>"+name+"</h1>");
  var sub=[state.char.age&&state.char.age+" Jahre",state.char.gender,state.char.occult].filter(Boolean).join(" · ");
  if(sub)h.push('<p class="s">'+sub+"</p>");
  if(state.char.job)h.push('<p class="s" style="color:#3d6f8a">'+state.char.job+"</p>");
  if(state.char.origin)h.push('<p class="s">'+state.char.origin+"</p>");
  h.push('<hr style="border:none;border-top:2px solid #4d7a4d;margin:8px 0 16px"/>');
  SECTIONS.slice(0,-1).forEach(function(sec){
    var sf=sec.fields.map(function(k){return FIELDS.find(function(f){return f.key===k;});}).filter(function(f){return f&&state.char[f.key]&&skip.indexOf(f.key)===-1;});
    if(!sf.length)return;
    h.push("<h2>"+sec.title.toUpperCase()+"</h2>");
    sf.forEach(function(f){h.push("<p><strong>"+f.label+":</strong><br/>"+state.char[f.key].replace(/</g,"&lt;").replace(/\n/g,"<br/>")+"</p>");});
  });
  h.push("</body></html>");
  var blob=new Blob([h.join("")],{type:"application/msword"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");a.href=url;a.download=name+"_Charakterbogen.doc";
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

// ── Render AI block ──
function mkAI(key,label,val){
  var ai=state.ai[key]||{msgs:[],loading:false,input:"",open:false};
  var wrap=div({marginTop:"6px"});
  var hasContent=(ai.msgs&&ai.msgs.length>0)||ai.loading;
  var firstLoad=ai.loading&&(!ai.msgs||!ai.msgs.length);
  // Pro-Feld-Kontext fuer die KI damit z.B. "Orientierung" nicht falsch
  // interpretiert wird (sexuelle Orientierung, nicht Lebensziel) und
  // "Okkultismus" nicht als esoterische Praktik (Sims-4-Okkultzustaende).
  var fieldCtx=FIELD_AI_CONTEXT[key]||"";
  var startPrompt=key==="appearance"
    ?'Feld: "Aussehen". Bisheriger Inhalt: "'+(val||"leer")+'". Stelle 3-4 konkrete Fragen die helfen das Aussehen des Charakters zu beschreiben - z.B. zu Koerperbau, Haaren, Augen, besonderen Merkmalen, Narben, wie er sich bewegt oder wirkt. Kein Beschreibungstext, nur Fragen.'
    :'Feld: "'+label+'"'+(fieldCtx?' ('+fieldCtx+')':'')+'. Bisheriger Inhalt: "'+(val||"leer")+'". Gib 1-2 kurze Autoren-Tipps fuer dieses Feld, dann 2-3 Fragen die der Nutzer sich stellen kann um das Feld zu fuellen.';

  if(!hasContent){
    wrap.appendChild(btn("✨ Tipps & Fragen",C.teal,function(){callAI(key,startPrompt,[]);},true,true,false));
    return wrap;
  }
  if(firstLoad){
    var ld=div({display:"inline-flex",alignItems:"center",gap:"8px",background:"rgba(61,111,138,0.12)",border:"1px solid "+C.teal,borderRadius:"7px",padding:"4px 12px"});
    var dot=mk("span",{display:"inline-block",width:"10px",height:"10px",borderRadius:"50%",background:C.teal,animation:"pulse 1s infinite"});
    ld.appendChild(dot);ld.appendChild(mk("span",{fontSize:"12px",color:C.teal},["KI denkt nach…"]));
    wrap.appendChild(ld);return wrap;
  }
  var count=Math.ceil((ai.msgs||[]).length/2);
  var tog=btn((ai.open?"▲ ausblenden":"▼ Tipps & Fragen")+(count>0?" ("+count+")":""),C.muted,function(){
    state.ai[key]=state.ai[key]||{};state.ai[key].open=!state.ai[key].open;draw();
  },true,true,false);
  wrap.appendChild(tog);
  if(!ai.open)return wrap;

  var box=div({marginTop:"8px",background:C.input,border:"1px solid "+C.border,borderRadius:"10px",padding:"12px"});
  var msgs=div({maxHeight:"300px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px"});
  msgs.setAttribute("data-ai-key",key);
  (ai.msgs||[]).forEach(function(m){
    if(m.role==="user"){
      var ub=div({textAlign:"right"});
      ub.appendChild(span({background:C.accent,color:"#fff",borderRadius:"8px",padding:"4px 10px",fontSize:"12px",display:"inline-block",maxWidth:"80%"},[typeof m.content==="string"?m.content:"[Bild + Text]"]));
      msgs.appendChild(ub);
    } else {
      msgs.appendChild(div({background:C.card2,borderRadius:"8px",padding:"10px 12px",fontSize:"13px",color:C.text,whiteSpace:"pre-wrap",lineHeight:"1.7",border:"1px solid "+C.border},[m.content]));
    }
  });
  if(ai.loading&&ai.msgs&&ai.msgs.length){
    var ld2=div({display:"flex",alignItems:"center",gap:"8px"});
    var dot2=mk("span",{display:"inline-block",width:"8px",height:"8px",borderRadius:"50%",background:C.teal,animation:"pulse 1s infinite"});
    ld2.appendChild(dot2);ld2.appendChild(mk("span",{fontSize:"12px",color:C.teal},["…"]));
    msgs.appendChild(ld2);
  }
  box.appendChild(msgs);
  var row=div({display:"flex",gap:"6px",marginTop:"8px"});
  var ci=mk("input",Object.assign({},INP,{flex:"1",padding:"6px 10px"}));
  ci.placeholder="Nachfragen…";ci.value=ai.input||"";
  ci.addEventListener("input",function(){state.ai[key]=state.ai[key]||{};state.ai[key].input=ci.value;});
  ci.addEventListener("keydown",function(e){if(e.key==="Enter"){var v=(state.ai[key]||{}).input||"";if(v.trim())callAI(key,v);}});
  row.appendChild(ci);
  row.appendChild(btn("→",C.accent,function(){var v=(state.ai[key]||{}).input||"";if(v.trim())callAI(key,v);},false,false,false));
  box.appendChild(row);
  wrap.appendChild(box);
  return wrap;
}

// ── Render field ──

// Lazy-loaded Daten für Wohnort-Picker (1× pro Bogen-Sitzung)
// Quellen:
//   ATLAS_DATA = {worldLots, BUILDINGS}  — geparst aus index.html (für Lot-Positionen)
//   WORLDS_META = [{name, image, category, hasAtlas, externalUrl}]  — aus Sheet-CSV
//   LOTS_CACHE = aus Apps Script (für Lot-Namen, Bilder, Thread-URLs)
//   CHARS_CACHE = aus Apps Script (für „aktiv: X" Hinweis)
var ATLAS_DATA=null;
var WORLDS_META=null;
var LOTS_CACHE=null;
var CHARS_CACHE=null;
var DATA_LOADING=false;
// State des Pickers
var HOME_STATE={stage:1,world:"",building:""};
function loadHomeData(cb){
  if(ATLAS_DATA&&WORLDS_META&&LOTS_CACHE&&CHARS_CACHE){cb();return;}
  if(DATA_LOADING){setTimeout(function(){loadHomeData(cb);},200);return;}
  DATA_LOADING=true;
  Promise.all([
    loadAtlasJsData_(),
    loadSheetWorldMeta_(),
    fetch(APPS_SCRIPT_URL+"?action=getLots").then(function(r){return r.json();}),
    fetch(APPS_SCRIPT_URL+"?action=chars").then(function(r){return r.json();})
  ]).then(function(res){
    ATLAS_DATA=res[0]||{worldLots:{},BUILDINGS:{}};
    WORLDS_META=Array.isArray(res[1])?res[1]:[];
    LOTS_CACHE=Array.isArray(res[2])?res[2]:[];
    CHARS_CACHE=Array.isArray(res[3])?res[3]:[];
    DATA_LOADING=false;cb();
  }).catch(function(e){
    console.error("[Char-Bogen] Lade-Fehler:",e);
    ATLAS_DATA=ATLAS_DATA||{worldLots:{},BUILDINGS:{}};
    WORLDS_META=WORLDS_META||[];
    LOTS_CACHE=LOTS_CACHE||[];CHARS_CACHE=CHARS_CACHE||[];
    DATA_LOADING=false;cb();
  });
}
// Fetches the ATLAS data files (same origin) and parses worldLots + BUILDINGS from their source.
// Dependency: if worldLots or BUILDINGS move or change their declaration, these paths must follow.
function loadAtlasJsData_(){
  return Promise.all([
    fetch("src/atlas/data/buildings.js?v=202609221331").then(function(r){return r.text();}),
    fetch("src/atlas/data/world-lots.js?v=202609221331").then(function(r){return r.text();})
  ]).then(function(parts){return parts.join("\n");}).then(function(html){
    function extractObj(name){
      var re=new RegExp("const\\s+"+name+"\\s*=\\s*\\{");
      var m=re.exec(html);
      if(!m)return null;
      var s=m.index;
      var i=html.indexOf("{",s),d=0;
      while(i<html.length){
        if(html[i]==="{")d++;
        else if(html[i]==="}"){d--;if(d===0)break;}
        i++;
      }
      return html.substring(s+"const ".length,i+1);
    }
    var wl=extractObj("worldLots");
    var bd=extractObj("BUILDINGS");
    if(!wl)return{worldLots:{},BUILDINGS:{}};
    try{
      var fn=new Function(
        'var BASE="https://www.simsforumrpg.de/";'+
        'var IMG="https://files.homepagemodules.de/b855163/resize/1920x1200/";'+
        (bd?"var "+bd+";":"var BUILDINGS={};")+
        "var "+wl+";"+
        "return {worldLots:worldLots,BUILDINGS:BUILDINGS};"
      );
      return fn();
    }catch(e){console.error("Eval Fehler",e);return{worldLots:{},BUILDINGS:{}};}
  });
}
// Welt-Anker aus Sheet-CSV (gleiche URL wie ATLAS verwendet)
function loadSheetWorldMeta_(){
  // Echter CSV-Parser der Kommas innerhalb von Anfuehrungszeichen respektiert.
  // Vorher: r.split(",") brach bei jedem Komma in einer Zelle (z.B. lange URLs oder
  // mietinfo mit "Bla, blub"). Dadurch landete experience_required in der falschen Spalte.
  function parseCsvLine(line){
    var result=[], cur="", inQuotes=false;
    for(var i=0;i<line.length;i++){
      var ch=line[i];
      if(ch==='"'){
        if(inQuotes && line[i+1]==='"'){ cur+='"'; i++; }
        else inQuotes=!inQuotes;
      } else if(ch==="," && !inQuotes){
        result.push(cur); cur="";
      } else {
        cur+=ch;
      }
    }
    result.push(cur);
    return result;
  }
  return fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vRRllRkwaCacdM0WZZT0cVQflhxJ9Fw5mgId-v615_kE2GdKdbwHMUYCG03HC8gUXfg7lucTs1Mqhg1/pub?output=csv&gid=306313316&single=true").then(function(r){return r.text();}).then(function(csv){
    var rows=csv.split("\n");
    var headers=parseCsvLine(rows[0]).map(function(h){return h.trim().toLowerCase();});
    var wIdx=headers.indexOf("welt"),nIdx=headers.indexOf("nr."),imgIdx=headers.indexOf("bild url"),urlIdx=headers.indexOf("thread url"),catIdx=headers.indexOf("category"),haIdx=headers.indexOf("has_atlas"),exIdx=headers.indexOf("external_url"),expIdx=headers.indexOf("experience_required");
    console.log("[Char-Bogen] Sheet-Headers:", headers);
    console.log("[Char-Bogen] expIdx (experience_required):", expIdx);
    var out=[];
    rows.slice(1).filter(function(r){return r.trim();}).forEach(function(r){
      var cols=parseCsvLine(r);
      var get=function(i){return i<0?"":(cols[i]||"").trim();};
      var welt=get(wIdx),nr=get(nIdx);
      if(!welt||nr)return;  // nur Welt-Anker (Welt gesetzt, Nr leer)
      var ha=get(haIdx).toUpperCase();
      var exp=get(expIdx).toUpperCase();
      // Robuste Truthy-Erkennung: TRUE, WAHR, JA, YES, 1, X, OK
      var isExpReq=(exp==="TRUE"||exp==="WAHR"||exp==="JA"||exp==="YES"||exp==="1"||exp==="X"||exp==="OK");
      out.push({
        name:welt,
        image:get(imgIdx),
        category:get(catIdx),
        hasAtlas:!(ha==="FALSE"||ha==="FALSCH"),
        externalUrl:get(exIdx),
        forumUrl:get(urlIdx),
        experienceRequired:isExpReq
      });
    });
    console.log("[Char-Bogen] Welten gefiltert (experienceRequired):", out.filter(function(w){return w.experienceRequired;}).map(function(w){return w.name;}));
    return out;
  });
}

// Hilfsfunktionen
function homeThreadId_(u){var m=(u||"").match(/\/t(\d+)f/);return m?m[1]:"";}
function homeOccupantsByUrl_(lotUrl){
  if(!lotUrl||!CHARS_CACHE)return[];
  var tid=homeThreadId_(lotUrl);
  if(!tid)return[];
  return CHARS_CACHE.filter(function(c){
    var cu=c.lastSeenUrl||c.lastSeen||"";
    return cu&&homeThreadId_(cu)===tid;
  });
}

function mkHomePicker(){
  var pick=div({marginBottom:"8px"});

  // Banner: aktueller Wert
  if(state.char.home){
    var cur=div({background:C.card2,border:"1px solid "+C.teal,borderRadius:"8px",padding:"10px 12px",marginBottom:"10px",display:"flex",alignItems:"center",gap:"10px"});
    cur.appendChild(div({fontSize:"13px",color:C.text,flex:"1"},["✓ "+state.char.home]));
    var clr=mk("button",{background:"none",border:"1px solid "+C.border,color:C.muted,cursor:"pointer",borderRadius:"6px",padding:"4px 10px",fontSize:"11px"},["Ändern"]);
    clr.addEventListener("click",function(){
      state.char.home="";HOME_STATE={stage:1,world:"",building:""};
      saveLocalDraft();redrawHomePicker();
    });
    cur.appendChild(clr);
    pick.appendChild(cur);
  }

  // Loading
  if(!ATLAS_DATA||!WORLDS_META){
    pick.appendChild(div({padding:"12px",textAlign:"center",color:C.muted,fontSize:"12px",border:"1px dashed "+C.border,borderRadius:"8px"},["Lade Welten..."]));
    loadHomeData(function(){redrawHomePicker();});
    return pick;
  }

  // Stage-Router
  if(HOME_STATE.stage===3 && HOME_STATE.world && HOME_STATE.building){
    pick.appendChild(mkBuildingStage_());
  } else if(HOME_STATE.stage===2 && HOME_STATE.world){
    var wmeta=WORLDS_META.find(function(w){return w.name===HOME_STATE.world;});
    if(wmeta && !wmeta.hasAtlas){
      pick.appendChild(mkExternalWorldStage_(wmeta));
    } else {
      pick.appendChild(mkWorldStage_());
    }
  } else {
    pick.appendChild(mkWorldGridStage_());
  }

  // Freitext-Fallback unten — auch fuer erfundene Welten die erfahrene Spieler kennen
  var fb=div({marginTop:"12px",paddingTop:"10px",borderTop:"1px dashed "+C.border});
  fb.appendChild(div({fontSize:"10px",color:C.muted,marginBottom:"4px",letterSpacing:"1px"},["ODER FREITEXT"]));
  fb.appendChild(div({fontSize:"10px",color:C.muted,marginBottom:"6px",fontStyle:"italic",lineHeight:"1.4"},["z.B. obdachlos, gerade auf Reisen — oder wenn dein Char in einer erfundenen Welt wohnt (Bloodmoon Valley etc.), tipp den Welt-Namen hier ein."]));
  var ti=document.createElement("input");
  Object.assign(ti.style,INP);
  ti.value=state.char.home||"";
  ti.placeholder="z.B. Bloodmoon Valley, bei Familie unter der Brücke";
  ti.addEventListener("input",function(){state.char.home=ti.value;saveLocalDraft();});
  fb.appendChild(ti);
  pick.appendChild(fb);
  return pick;
}

// STAGE 1: Welt-Grid mit Welt-Bildern
function mkWorldGridStage_(){
  var wrap=div({});
  wrap.appendChild(div({fontSize:"11px",color:C.muted,marginBottom:"8px",letterSpacing:"1px"},["WELT WÄHLEN"]));
  // Filter: erfundene Welten (experienceRequired) werden ausgeblendet.
  // Erfahrene Spieler die sie kennen koennen sie unten im Freitext eintragen.
  var visibleWorlds=WORLDS_META.filter(function(w){return !w.experienceRequired;});
  // Sortieren: erst RPG-Welten (hasAtlas), dann externe
  var sorted=visibleWorlds.slice().sort(function(a,b){
    if(a.hasAtlas!==b.hasAtlas)return a.hasAtlas?-1:1;
    return a.name.localeCompare(b.name);
  });
  var grid=div({display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:"8px"});
  sorted.forEach(function(w){
    var card=div({background:C.card2,border:"1px solid "+C.border,borderRadius:"8px",overflow:"hidden",cursor:"pointer",position:"relative",transition:"all 0.15s"});
    card.addEventListener("mouseenter",function(){card.style.borderColor=C.teal;card.style.transform="translateY(-1px)";});
    card.addEventListener("mouseleave",function(){card.style.borderColor=C.border;card.style.transform="";});
    card.addEventListener("click",function(){
      HOME_STATE={stage:2,world:w.name,building:""};redrawHomePicker();
    });
    if(w.image){
      var im=document.createElement("img");
      im.src=w.image;
      Object.assign(im.style,{width:"100%",height:"75px",objectFit:"cover",display:"block"});
      card.appendChild(im);
    } else {
      card.appendChild(div({width:"100%",height:"75px",background:C.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px",opacity:"0.4"},["🌑"]));
    }
    if(!w.hasAtlas){
      card.appendChild(div({position:"absolute",top:"5px",right:"5px",fontSize:"8px",fontWeight:"700",letterSpacing:"0.5px",padding:"2px 5px",borderRadius:"3px",background:"rgba(140,110,180,0.85)",color:"#fff"},["EXTERN"]));
    }
    var txt=div({padding:"6px 8px"});
    txt.appendChild(div({fontSize:"12px",fontWeight:"600",color:C.text,marginBottom:"1px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},[w.name]));
    if(w.category)txt.appendChild(div({fontSize:"10px",color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},[w.category]));
    card.appendChild(txt);
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  return wrap;
}

// STAGE 2A: Mini-Karte mit Lot-Dots für RPG-Welten
function mkWorldStage_(){
  var wrap=div({});
  // Header mit Zurück
  var hdr=div({display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"});
  var back=mk("button",{background:"none",border:"1px solid "+C.border,color:C.muted,cursor:"pointer",borderRadius:"6px",padding:"4px 10px",fontSize:"11px"},["← Welten"]);
  back.addEventListener("click",function(){HOME_STATE={stage:1,world:"",building:""};redrawHomePicker();});
  hdr.appendChild(back);
  hdr.appendChild(div({fontSize:"13px",fontWeight:"600",color:C.text},[HOME_STATE.world]));
  wrap.appendChild(hdr);

  var wmeta=WORLDS_META.find(function(w){return w.name===HOME_STATE.world;});
  var lots=(ATLAS_DATA.worldLots[HOME_STATE.world]||[]).filter(function(l){return l&&typeof l.x==="number"&&typeof l.y==="number"&&!l.outdoor&&!l.info;});

  if(!lots.length){
    wrap.appendChild(div({padding:"16px",textAlign:"center",color:C.muted,fontSize:"12px",border:"1px dashed "+C.border,borderRadius:"8px"},["Diese Welt hat noch keine kalibrierten Wohnorte."]));
    return wrap;
  }

  // Mini-Karte
  var mapCard=div({position:"relative",width:"100%",aspectRatio:"1920/1200",background:C.card,borderRadius:"8px",overflow:"hidden",border:"1px solid "+C.border,marginBottom:"10px"});
  if(wmeta&&wmeta.image){
    var bg=document.createElement("img");
    bg.src=wmeta.image;
    Object.assign(bg.style,{width:"100%",height:"100%",objectFit:"cover",display:"block",filter:"brightness(0.7) saturate(0.95)"});
    mapCard.appendChild(bg);
  }

  // Cluster-Detection: gruppiere Lots an gleicher Position (Toleranz 0.5%)
  var groups=[];
  lots.forEach(function(l){
    var found=groups.find(function(g){return Math.abs(g.x-l.x)<0.5 && Math.abs(g.y-l.y)<0.5 && (!!g.lots[0].building)===(!!l.building);});
    if(found){found.lots.push(l);}
    else{groups.push({x:l.x,y:l.y,lots:[l]});}
  });

  // Selected lot ID for highlight
  var selectedLotKey=null;

  groups.forEach(function(g){
    var isCluster=g.lots.length>1;
    var isBuilding=!!g.lots[0].building;
    var dot=div({position:"absolute",left:g.x+"%",top:g.y+"%",transform:"translate(-50%,-50%)",cursor:"pointer",zIndex:5});
    var size=isCluster?"22px":"14px";
    var inner=div({width:size,height:size,borderRadius:"50%",border:"1.5px solid "+(isBuilding?"rgba(120,170,255,0.8)":"rgba(255,165,0,0.7)"),background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",color:"#fff",boxShadow:"0 0 6px rgba(0,0,0,0.6)"});
    if(isBuilding)inner.textContent="🏢";
    else if(isCluster)inner.textContent=String(g.lots.length);
    dot.appendChild(inner);
    // Tooltip
    var tip=div({position:"absolute",bottom:"calc(100% + 4px)",left:"50%",transform:"translateX(-50%)",background:"rgba(5,12,22,0.95)",color:"#fff",padding:"4px 8px",borderRadius:"4px",fontSize:"11px",whiteSpace:"nowrap",pointerEvents:"none",opacity:"0",transition:"opacity 0.1s",border:"0.5px solid "+C.border});
    var tipText=isCluster?(isBuilding?(g.lots[0].name||g.lots[0].nr):g.lots.length+" Wohnorte"):(g.lots[0].name||g.lots[0].nr);
    tip.textContent=tipText;
    dot.appendChild(tip);
    dot.addEventListener("mouseenter",function(){tip.style.opacity="1";inner.style.transform="scale(1.3)";});
    dot.addEventListener("mouseleave",function(){tip.style.opacity="0";inner.style.transform="";});
    dot.addEventListener("click",function(e){
      e.stopPropagation();
      if(isBuilding){
        // Stage 3: Apartment-Innen
        HOME_STATE={stage:3,world:HOME_STATE.world,building:g.lots[0].building,floorIdx:0};
        redrawHomePicker();
      } else if(isCluster){
        // Sub-Liste neben der Karte einblenden
        showClusterPopup_(g);
      } else {
        // Direkt wählen
        var l=g.lots[0];
        var label=l.name||l.nr;
        state.char.home=HOME_STATE.world+" "+label;
        saveLocalDraft();redrawHomePicker();
      }
    });
    mapCard.appendChild(dot);
  });
  wrap.appendChild(mapCard);

  // Cluster-Popup-Container (fix unterhalb der Karte, gefüllt bei Klick)
  var clusterBox=div({});
  clusterBox.id="home-cluster-list";
  wrap.appendChild(clusterBox);

  return wrap;
}
function showClusterPopup_(g){
  var box=document.getElementById("home-cluster-list");
  if(!box)return;
  box.innerHTML="";
  var hdr=div({fontSize:"11px",color:C.muted,marginBottom:"6px",letterSpacing:"1px"},[g.lots.length+" WOHNORTE AN DIESEM PUNKT"]);
  box.appendChild(hdr);
  var list=div({display:"flex",flexDirection:"column",gap:"4px"});
  g.lots.forEach(function(l){
    var label=l.name||l.nr;
    var occ=l.url?homeOccupantsByUrl_(l.url):[];
    var item=div({background:C.card2,border:"1px solid "+C.border,borderRadius:"6px",padding:"8px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:"10px"});
    item.addEventListener("mouseenter",function(){item.style.borderColor=C.teal;});
    item.addEventListener("mouseleave",function(){item.style.borderColor=C.border;});
    item.addEventListener("click",function(){
      state.char.home=HOME_STATE.world+" "+label;
      saveLocalDraft();redrawHomePicker();
    });
    item.appendChild(div({fontSize:"12px",color:C.text,flex:"1"},[label]));
    if(occ.length){
      var occText="aktiv: "+occ.slice(0,2).map(function(c){return c.name||c.n;}).join(", ");
      if(occ.length>2)occText+=" +"+(occ.length-2);
      item.appendChild(div({fontSize:"10px",color:C.muted,fontStyle:"italic"},[occText]));
    }
    list.appendChild(item);
  });
  box.appendChild(list);
}

// STAGE 2B: Externe Welt — kein Picker, einfach Bild + Button
function mkExternalWorldStage_(wmeta){
  var wrap=div({});
  var hdr=div({display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"});
  var back=mk("button",{background:"none",border:"1px solid "+C.border,color:C.muted,cursor:"pointer",borderRadius:"6px",padding:"4px 10px",fontSize:"11px"},["← Welten"]);
  back.addEventListener("click",function(){HOME_STATE={stage:1,world:"",building:""};redrawHomePicker();});
  hdr.appendChild(back);
  hdr.appendChild(div({fontSize:"13px",fontWeight:"600",color:C.text},[wmeta.name]));
  wrap.appendChild(hdr);

  var card=div({background:C.card2,border:"1px solid "+C.border,borderRadius:"8px",overflow:"hidden",marginBottom:"10px"});
  if(wmeta.image){
    var im=document.createElement("img");
    im.src=wmeta.image;
    Object.assign(im.style,{width:"100%",height:"180px",objectFit:"cover",display:"block"});
    card.appendChild(im);
  } else {
    card.appendChild(div({width:"100%",height:"100px",background:C.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"32px",opacity:"0.4"},["🌑"]));
  }
  var info=div({padding:"12px"});
  if(wmeta.category)info.appendChild(div({fontSize:"10px",color:C.muted,letterSpacing:"1px",marginBottom:"4px"},[wmeta.category.toUpperCase()]));
  info.appendChild(div({fontSize:"13px",color:C.text,marginBottom:"10px"},["Externe Welt — keine Karte mit Wohnorten, dein Charakter lebt einfach in "+wmeta.name+"."]));

  var btnRow=div({display:"flex",gap:"6px"});
  var pick=mk("button",{background:C.teal,color:"#0a1420",border:"none",borderRadius:"6px",padding:"8px 14px",fontSize:"12px",fontWeight:"600",cursor:"pointer",flex:"1"},["In "+wmeta.name+" wohnen"]);
  pick.addEventListener("click",function(){
    state.char.home=wmeta.name;
    saveLocalDraft();redrawHomePicker();
  });
  btnRow.appendChild(pick);
  if(wmeta.externalUrl){
    var link=mk("a",{background:"none",border:"1px solid "+C.border,color:C.muted,borderRadius:"6px",padding:"7px 12px",fontSize:"11px",textDecoration:"none"},["Forum-Thread →"]);
    link.href=wmeta.externalUrl;link.target="_blank";
    btnRow.appendChild(link);
  }
  info.appendChild(btnRow);
  card.appendChild(info);
  wrap.appendChild(card);
  return wrap;
}

// STAGE 3: Apartment-Innenraum mit Innen-Dots
function mkBuildingStage_(){
  var wrap=div({});
  var hdr=div({display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"});
  var back=mk("button",{background:"none",border:"1px solid "+C.border,color:C.muted,cursor:"pointer",borderRadius:"6px",padding:"4px 10px",fontSize:"11px"},["← "+HOME_STATE.world]);
  back.addEventListener("click",function(){HOME_STATE={stage:2,world:HOME_STATE.world,building:""};redrawHomePicker();});
  hdr.appendChild(back);
  hdr.appendChild(div({fontSize:"13px",fontWeight:"600",color:C.text},["🏢 "+HOME_STATE.building]));
  wrap.appendChild(hdr);

  var b=ATLAS_DATA.BUILDINGS[HOME_STATE.building];
  if(!b||!b.lots){
    wrap.appendChild(div({padding:"16px",textAlign:"center",color:C.muted,fontSize:"12px"},["Keine Daten zu diesem Apartment gefunden."]));
    return wrap;
  }

  // Floor-State: bei erstem Aufruf für dieses Building auf 0 initialisieren
  if(typeof HOME_STATE.floorIdx!=="number") HOME_STATE.floorIdx=0;
  var imgs=b.imgs||(b.img?[b.img]:[]);
  if(HOME_STATE.floorIdx>=imgs.length) HOME_STATE.floorIdx=0;
  var img=imgs[HOME_STATE.floorIdx]||"";

  var mapCard=div({position:"relative",width:"100%",background:C.card,borderRadius:"8px",overflow:"hidden",border:"1px solid "+C.border,marginBottom:"10px"});
  if(img){
    var bg=document.createElement("img");
    bg.src=img;
    Object.assign(bg.style,{width:"100%",height:"auto",display:"block",filter:"brightness(0.7)"});
    mapCard.appendChild(bg);
  }

  // Floor-Nav (rechts mittig, nur wenn mehrere Etagen)
  if(imgs.length>1){
    var floorNav=div({position:"absolute",right:"0",top:"50%",transform:"translateY(-50%)",zIndex:"10",display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",padding:"8px 6px",background:"rgba(5,13,24,0.85)",borderRadius:"8px 0 0 8px",border:"0.5px solid "+C.border,borderRight:"none"});
    var upBtn=mk("button",{background:"rgba(255,255,255,0.08)",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:"6px",color:"#fff",fontSize:"16px",width:"32px",height:"32px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:HOME_STATE.floorIdx>0?"1":"0.3"},["▲"]);
    var label=div({fontSize:"10px",fontWeight:"700",color:"rgba(255,255,255,0.7)",minWidth:"28px",textAlign:"center"},[(HOME_STATE.floorIdx+1)+" / "+imgs.length]);
    var downBtn=mk("button",{background:"rgba(255,255,255,0.08)",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:"6px",color:"#fff",fontSize:"16px",width:"32px",height:"32px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:HOME_STATE.floorIdx<imgs.length-1?"1":"0.3"},["▼"]);
    upBtn.addEventListener("click",function(e){
      e.stopPropagation();
      if(HOME_STATE.floorIdx>0){HOME_STATE.floorIdx--;redrawHomePicker();}
    });
    downBtn.addEventListener("click",function(e){
      e.stopPropagation();
      if(HOME_STATE.floorIdx<imgs.length-1){HOME_STATE.floorIdx++;redrawHomePicker();}
    });
    floorNav.appendChild(upBtn);
    floorNav.appendChild(label);
    floorNav.appendChild(downBtn);
    mapCard.appendChild(floorNav);
  }

  b.lots.forEach(function(l){
    if(typeof l.x!=="number"||typeof l.y!=="number")return;
    // Outdoor-Lots (Gassen/Strassen) und Info-Lots (Portale etc.) sind keine Wohnorte
    if(l.outdoor||l.info)return;
    // Floor-Filter: wenn lot.floors definiert ist, nur auf passender Etage zeigen
    if(Array.isArray(l.floors) && l.floors.indexOf(HOME_STATE.floorIdx)===-1) return;
    var label=l.name||l.nr||"?";
    var dot=div({position:"absolute",left:l.x+"%",top:l.y+"%",transform:"translate(-50%,-50%)",cursor:"pointer",zIndex:5});
    var inner=div({width:"14px",height:"14px",borderRadius:"50%",border:"1.5px solid rgba(120,170,255,0.8)",background:"rgba(0,0,0,0.5)",boxShadow:"0 0 6px rgba(0,0,0,0.6)"});
    dot.appendChild(inner);
    var tip=div({position:"absolute",bottom:"calc(100% + 4px)",left:"50%",transform:"translateX(-50%)",background:"rgba(5,12,22,0.95)",color:"#fff",padding:"4px 8px",borderRadius:"4px",fontSize:"11px",whiteSpace:"nowrap",pointerEvents:"none",opacity:"0",transition:"opacity 0.1s",border:"0.5px solid "+C.border});
    tip.textContent=label;
    dot.appendChild(tip);
    dot.addEventListener("mouseenter",function(){tip.style.opacity="1";inner.style.transform="scale(1.3)";});
    dot.addEventListener("mouseleave",function(){tip.style.opacity="0";inner.style.transform="";});
    dot.addEventListener("click",function(){
      state.char.home=HOME_STATE.world+" "+HOME_STATE.building+" "+label;
      saveLocalDraft();redrawHomePicker();
    });
    mapCard.appendChild(dot);
  });
  wrap.appendChild(mapCard);
  return wrap;
}

function redrawHomePicker(){
  var wrap=document.getElementById("home-picker-wrap");
  if(!wrap)return;
  wrap.innerHTML="";
  wrap.appendChild(mkHomePicker());
}


function mkField(f){
  var wrap=div({marginBottom:"20px",borderBottom:"1px solid "+C.border,paddingBottom:"18px"});
  wrap.appendChild(mk("label",{display:"block",fontSize:"13px",fontWeight:"700",color:C.accent,marginBottom:"2px"},[f.label+(f.optional?" · optional":"")]));
  wrap.appendChild(div({fontSize:"12px",color:C.muted,marginBottom:"6px",fontStyle:"italic"},[f.hint]));
  // Spezial: Wohnort-Picker statt simples Input
  if(f.key==="home"){
    var pwrap=div({});
    pwrap.id="home-picker-wrap";
    pwrap.appendChild(mkHomePicker());
    wrap.appendChild(pwrap);
    wrap.appendChild(mkAI(f.key,f.label,state.char[f.key]));
    return wrap;
  }
  if(f.key==="appearance"){
    var iw=div({marginBottom:"8px"});
    // Lokale Vorschau
    if(state.imgPreview){
      var img=document.createElement("img");
      img.src=state.imgPreview;img.style.maxHeight="150px";img.style.borderRadius="8px";img.style.display="block";img.style.marginBottom="8px";img.style.border="2px solid "+C.border;
      iw.appendChild(img);
      iw.appendChild(btn("🔄 Anderes Bild",C.teal,function(){qs("imgInput").click();},true,true,false));
    } else {
      iw.appendChild(btn("📷 Bild zur Vorschau hochladen",C.teal,function(){qs("imgInput").click();},true,true,false));
    }
    // Klarstellung: Bild ist NUR lokal zur visuellen Inspiration. Es wird NICHT
    // mit dem BBCode ins Forum gepostet. Forum-Bild laedt der User separat in
    // seinem Post hoch (oder Blaze hilft ihm dabei).
    iw.appendChild(div({
      fontSize:"10px",
      color:C.muted,
      marginTop:"4px",
      lineHeight:"1.5",
      fontStyle:"italic"
    },["Nur lokale Vorschau zur visuellen Inspiration beim Schreiben — das Bild wird nicht automatisch ins Forum geladen. Wenn du es im Forum-Post haben möchtest, behalte die Original-Datei: beim Posten hängst du sie über die Büroklammer (📎) selbst an."]));
    wrap.appendChild(iw);
  }
  var inp=document.createElement(f.multi?"textarea":"input");
  Object.assign(inp.style,INP);
  if(f.multi){inp.style.resize="vertical";inp.rows=3;}
  inp.value=state.char[f.key]||"";
  inp.placeholder=f.hint;
  inp.addEventListener("input",function(){state.char[f.key]=inp.value;saveLocalDraft();});
  wrap.appendChild(inp);
  wrap.appendChild(mkAI(f.key,f.label,state.char[f.key]));
  return wrap;
}

// ── Render sheet ──
function mkSheet(){
  var wrap=div({});

  // ── Anleitung ──
  var guide=div({background:"rgba(61,111,138,0.12)",border:"1px solid rgba(61,111,138,0.35)",borderRadius:"10px",padding:"16px 18px",marginBottom:"20px"});
  guide.appendChild(div({fontSize:"11px",fontWeight:"800",letterSpacing:"2px",color:C.teal,marginBottom:"10px"},["SO GEHT'S — LIES DAS ZUERST"]));
  var steps=[
    ["1","Bogen prüfen","Schau deinen Charakterbogen unten durch. Alles vollständig?"],
    ["2","Typ wählen & posten","Klicke auf \"📤 Im Forum posten\", wähle Haupt/Neben/Randfigur/Passant. Der Bogen öffnet sich automatisch im Forum zum Absenden."],
    ["3","Einloggen falls nötig","Falls du noch nicht eingeloggt bist, logge dich im Forum ein. Dein Bogen bleibt hier gespeichert und wartet auf dich."],
    ["4","Absenden","Im Forum: Titel eingeben (Name deines Charakters), dann Absenden klicken. Fertig!"]
  ];
  steps.forEach(function(s){
    var row=div({display:"flex",gap:"10px",marginBottom:"8px",alignItems:"flex-start"});
    var num=div({background:C.teal,color:"#fff",borderRadius:"50%",width:"20px",height:"20px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:"800",flexShrink:"0",marginTop:"1px"});
    num.textContent=s[0];
    var text=div({flex:"1"});
    text.appendChild(div({fontSize:"12px",fontWeight:"700",color:C.text,marginBottom:"1px"},[s[1]]));
    text.appendChild(div({fontSize:"11px",color:C.muted,lineHeight:"1.5"},[s[2]]));
    row.appendChild(num);row.appendChild(text);
    guide.appendChild(row);
  });
  wrap.appendChild(guide);

  wrap.appendChild(div({fontSize:"10px",fontWeight:"800",letterSpacing:"3px",color:C.teal,marginBottom:"18px"},["DEIN CHARAKTERBLATT"]));
  var sheet=div({border:"1px solid "+C.border,borderRadius:"10px",overflow:"hidden"});
  var hdr=div({background:"linear-gradient(135deg,"+C.card2+","+C.border+")",padding:"18px 20px",display:"flex",gap:"16px",alignItems:"flex-start",borderBottom:"1px solid "+C.border});
  if(state.imgPreview){
    var sheetImg=document.createElement("img");
    sheetImg.src=state.imgPreview;
    sheetImg.style.width="90px";
    sheetImg.style.height="110px";
    sheetImg.style.objectFit="cover";
    sheetImg.style.borderRadius="8px";
    sheetImg.style.border="2px solid "+C.accent;
    sheetImg.style.flexShrink="0";
    hdr.appendChild(sheetImg);
  }
  var hi=div({flex:"1"});
  hi.appendChild(div({fontSize:"22px",fontWeight:"900",color:C.accent},[state.char.name||"—"]));
  var sub=[state.char.age&&state.char.age+" Jahre",state.char.gender,state.char.occult].filter(Boolean).join(" · ");
  if(sub)hi.appendChild(div({fontSize:"13px",color:C.muted,marginTop:"2px"},[sub]));
  if(state.char.job)hi.appendChild(div({fontSize:"13px",color:C.teal,marginTop:"4px"},[state.char.job]));
  if(state.char.origin)hi.appendChild(div({fontSize:"12px",color:C.muted,marginTop:"2px"},[state.char.origin]));
  hdr.appendChild(hi);sheet.appendChild(hdr);
  var body=div({padding:"18px"});
  var skip=["name","age","gender","occult","job","origin"];
  SECTIONS.slice(0,-1).forEach(function(sec){
    var sf=sec.fields.map(function(k){return FIELDS.find(function(f){return f.key===k;});}).filter(function(f){return f&&state.char[f.key]&&skip.indexOf(f.key)===-1;});
    if(!sf.length)return;
    var sd=div({marginBottom:"18px"});
    sd.appendChild(div({fontSize:"9px",fontWeight:"800",letterSpacing:"3px",color:C.teal,borderBottom:"1px solid "+C.border,paddingBottom:"4px",marginBottom:"10px"},[sec.title.toUpperCase()]));
    sf.forEach(function(f){
      var row=div({marginBottom:"8px",display:"grid",gridTemplateColumns:"130px 1fr",gap:"8px"});
      row.appendChild(span({fontWeight:"700",color:C.muted,fontSize:"12px"},[f.label]));
      row.appendChild(span({color:C.text,fontSize:"13px",whiteSpace:"pre-wrap"},[state.char[f.key]]));
      sd.appendChild(row);
    });
    body.appendChild(sd);
  });
  sheet.appendChild(body);wrap.appendChild(sheet);
  // Hinweis: was passiert beim Posten + dass ATLAS-Registrierung automatisch
  // angeboten wird sobald der Char-Thread offen ist (das macht das Custom-JS
  // im Forum-Header).
  wrap.appendChild(div({
    fontSize:"10px",fontWeight:"800",letterSpacing:"3px",color:C.teal,
    marginTop:"18px",marginBottom:"4px",textAlign:"center"
  },["NÄCHSTER SCHRITT"]));
  wrap.appendChild(div({
    fontSize:"12px",color:C.muted,marginBottom:"10px",textAlign:"center",lineHeight:"1.5"
  },["Klick auf „Im Forum posten\". Dein Bogen kommt in die Zwischenablage und das Forum öffnet sich in einem neuen Tab. Nach dem Absenden landest du dort auf deiner Charakter-Seite — der Charakter wird automatisch im ATLAS registriert. Du musst nicht hierher zurückkehren — dieses Tab kannst du dann schliessen."]));

  // Hauptaktion: nur noch Forum-Post (ATLAS-Registrierung passiert von selbst)
  var btns=div({marginTop:"4px",display:"flex",gap:"8px",flexWrap:"wrap",justifyContent:"center"});
  btns.appendChild(btn("📤 Im Forum posten",C.accent,function(){state.showPost=true;draw();},false,false,false));
  wrap.appendChild(btns);

  // Nebenaktionen (Download, Neu starten) kleiner darunter
  var sideBtns=div({marginTop:"14px",display:"flex",gap:"8px",flexWrap:"wrap",justifyContent:"center"});
  sideBtns.appendChild(btn("⬇ Als Word herunterladen",C.muted,downloadDoc,false,true,false));
  sideBtns.appendChild(btn("↺ Neu starten",C.muted,function(){
    if(!confirm("Neuen Charakter erstellen? Alle Eingaben werden gelöscht."))return;
    FIELDS.forEach(function(f){state.char[f.key]="";});
    state.imgPreview=null;state.imgB64=null;state.imgMime=null;state.ai={};state.step=0;
    try{localStorage.removeItem('sw_charbogen');}catch(e){}
    draw();
  },false,true,false));
  wrap.appendChild(sideBtns);
  return wrap;
}

// ── Modals ──
function mkImportModal(){
  var ov=div({position:"fixed",inset:"0",background:"rgba(0,0,0,0.55)",zIndex:"200",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"});
  var box=div({background:C.card,border:"1px solid "+C.border,borderRadius:"14px",padding:"24px",width:"100%",maxWidth:"560px"});
  box.appendChild(div({fontSize:"14px",fontWeight:"800",color:C.accent,marginBottom:"8px"},["📋 Bogen importieren"]));
  box.appendChild(div({background:"rgba(74,170,106,0.08)",border:"1px solid rgba(74,170,106,0.25)",borderRadius:"8px",padding:"10px 12px",marginBottom:"12px",fontSize:"12px",color:C.muted,lineHeight:"1.6"},["Hast du deinen Charakterbogen bereits irgendwo geschrieben? Kopiere den ganzen Text und füge ihn hier ein. Die KI erkennt automatisch welche Information in welches Feld gehört.\n⚠ Keine Links – nur den Textinhalt des Bogens."]));
  var ta=mk("textarea",Object.assign({},INP,{resize:"vertical",display:"block",marginBottom:"12px"}));
  ta.rows=10;ta.placeholder="Bogen hier einfügen…";ta.value=state.importText;
  ta.addEventListener("input",function(){state.importText=ta.value;});
  box.appendChild(ta);
  var row=div({display:"flex",gap:"8px",justifyContent:"flex-end"});
  row.appendChild(btn("Abbrechen",C.muted,function(){state.showImport=false;draw();},false,true,false));
  var ibtn=btn(state.importing?"⏳ Lädt…":"✓ Felder befüllen",C.accent,function(){if(state.importText.trim())doImport();},false,false,state.importing);
  row.appendChild(ibtn);
  box.appendChild(row);
  ov.addEventListener("click",function(e){if(e.target===ov){state.showImport=false;draw();}});
  ov.appendChild(box);return ov;
}

function mkCtxModal(){
  var ov=div({position:"fixed",inset:"0",background:"rgba(0,0,0,0.55)",zIndex:"200",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"});
  var box=div({background:C.card,border:"1px solid "+C.border,borderRadius:"14px",padding:"24px",width:"100%",maxWidth:"580px",maxHeight:"85vh",overflowY:"auto"});
  box.appendChild(div({fontSize:"14px",fontWeight:"800",color:C.accent,marginBottom:"6px"},["👥 Bekannte Charaktere"]));
  box.appendChild(div({background:"rgba(61,111,138,0.1)",border:"1px solid rgba(61,111,138,0.3)",borderRadius:"8px",padding:"10px 12px",marginBottom:"16px",fontSize:"12px",color:C.muted,lineHeight:"1.6"},["Füge Bögen oder Infos zu verwandten Charakteren ein. Die KI liest diese mit.\nDer Name wird automatisch ins Familien-Feld eingetragen.\n⚠ Keine Links – nur Text."]));
  state.ctxEntries.forEach(function(e,i){
    var row=div({background:C.input,border:"1px solid "+C.border,borderRadius:"8px",padding:"10px 12px",display:"flex",gap:"8px",marginBottom:"8px"});
    var info=div({flex:"1"});
    info.appendChild(div({fontSize:"13px",fontWeight:"700",color:C.accent,marginBottom:"3px"},[e.label]));
    info.appendChild(div({fontSize:"12px",color:C.muted,maxHeight:"50px",overflow:"hidden"},[e.text.slice(0,180)+(e.text.length>180?"…":"")]));
    row.appendChild(info);
    var db=mk("button",{background:"transparent",border:"none",color:C.danger,cursor:"pointer",fontSize:"16px"});
    db.textContent="✕";
    (function(idx){db.addEventListener("click",function(){state.ctxEntries.splice(idx,1);draw();});})(i);
    row.appendChild(db);box.appendChild(row);
  });
  var ab=div({background:C.card2,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px"});
  ab.appendChild(div({fontSize:"12px",fontWeight:"700",color:C.teal,marginBottom:"10px"},["Neuen Charakter hinzufügen"]));
  var li=mk("input",Object.assign({},INP,{marginBottom:"8px",display:"block"}));
  li.placeholder='Name / Beziehung (z.B. "Mutter – Nicky")';li.value=state.ctxLabel;
  li.addEventListener("input",function(){state.ctxLabel=li.value;});
  ab.appendChild(li);
  var lt=mk("textarea",Object.assign({},INP,{resize:"vertical",display:"block",marginBottom:"10px"}));
  lt.rows=5;lt.placeholder="Charakterbogen oder kurze Beschreibung – kein Link!";lt.value=state.ctxText;
  lt.addEventListener("input",function(){state.ctxText=lt.value;});
  ab.appendChild(lt);
  ab.appendChild(btn("+ Hinzufügen",C.teal,function(){
    var label=state.ctxLabel.trim(),text=state.ctxText.trim();
    if(!label||!text)return;
    state.ctxEntries.push({label:label,text:text});
    var cur=state.char.family||"";
    if(!cur.split("\n").some(function(l){return l.trim()===label;}))state.char.family=cur?cur+"\n"+label:label;
    state.ctxLabel="";state.ctxText="";draw();
  },false,false,false));
  box.appendChild(ab);
  var ft=div({display:"flex",justifyContent:"flex-end",marginTop:"16px"});
  ft.appendChild(btn("Fertig",C.accent,function(){state.showCtx=false;draw();},false,false,false));
  box.appendChild(ft);
  ov.addEventListener("click",function(e){if(e.target===ov){state.showCtx=false;draw();}});
  ov.appendChild(box);return ov;
}

// ── ATLAS Registrierung ──
var APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzJ_fMI1LBjmFAQDhjD1sr3hJtdUj4OOor_WiWX3asl_eX0FXDN1wr64cNON3odhHdX/exec";
var SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vRRllRkwaCacdM0WZZT0cVQflhxJ9Fw5mgId-v615_kE2GdKdbwHMUYCG03HC8gUXfg7lucTs1Mqhg1/pub?output=csv&gid=474514580&single=true";

function mkAtlasModal(){
  var ov=div({position:"fixed",inset:"0",background:"rgba(0,0,0,0.6)",zIndex:"200",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"});
  var box=div({background:C.card,border:"1px solid "+C.border,borderRadius:"14px",padding:"24px",width:"100%",maxWidth:"500px"});

  if(state.atlasSaved){
    box.appendChild(div({fontSize:"22px",textAlign:"center",marginBottom:"8px"},["✅"]));
    box.appendChild(div({fontSize:"15px",fontWeight:"700",color:C.accent,textAlign:"center",marginBottom:"6px"},["Charakter registriert!"]));
    box.appendChild(div({fontSize:"12px",color:C.muted,textAlign:"center",marginBottom:"16px"},["Er erscheint beim nächsten Öffnen des ATLAS-Charakter-Panels."]));
    box.appendChild(div({display:"flex",justifyContent:"center"},[btn("Schliessen",C.accent,function(){state.showAtlas=false;state.atlasSaved=false;draw();},false,false,false)]));
    ov.appendChild(box);return ov;
  }

  box.appendChild(div({fontSize:"14px",fontWeight:"800",color:C.teal,marginBottom:"4px"},["🗺 In ATLAS registrieren"]));
  box.appendChild(div({background:"rgba(61,111,138,0.1)",border:"1px solid rgba(61,111,138,0.3)",borderRadius:"8px",padding:"10px 12px",marginBottom:"16px",fontSize:"12px",color:C.muted,lineHeight:"1.6"},["Nach dem Posten im Forum hier eintragen. Der Charakter erscheint dann automatisch im ATLAS-Charakterpanel."]));

  function field(label,val,setter,ph){
    var w=div({marginBottom:"12px"});
    w.appendChild(div({fontSize:"12px",fontWeight:"700",color:C.accent,marginBottom:"4px"},[label]));
    var i=mk("input",Object.assign({},INP));i.value=val;i.placeholder=ph||"";
    i.addEventListener("input",function(){setter(i.value);});
    w.appendChild(i);return w;
  }

  box.appendChild(field("Dein Forum-Username *","",function(v){state.atlasPlayer=v;},"z.B. Ripzha"));
  box.appendChild(field("Thread-URL des Charakterbogens *","",function(v){state.atlasThread=v;},"https://www.simsforumrpg.de/t..."));
  box.appendChild(field("Portrait-URL (erstes Bild im Post)","",function(v){state.atlasPortrait=v;},"https://files.homepagemodules.de/..."));

  var tw=div({marginBottom:"16px"});
  tw.appendChild(div({fontSize:"12px",fontWeight:"700",color:C.accent,marginBottom:"6px"},["Typ *"]));
  var trow=div({display:"flex",gap:"8px"});
  ["haupt","neben","statist"].forEach(function(t){
    var b=btn(t.charAt(0).toUpperCase()+t.slice(1),state.atlasType===t?C.accent:C.muted,function(){state.atlasType=t;draw();},true,state.atlasType!==t,false);
    trow.appendChild(b);
  });
  tw.appendChild(trow);box.appendChild(tw);

  var row=div({display:"flex",gap:"8px",justifyContent:"flex-end"});
  row.appendChild(btn("Abbrechen",C.muted,function(){state.showAtlas=false;draw();},false,true,false));
  row.appendChild(btn(state.atlasSaving?"⏳ Speichert…":"💾 Speichern",C.accent,function(){
    if(!state.atlasPlayer.trim()||!state.atlasThread.trim()){alert("Bitte Username und Thread-URL angeben.");return;}
    saveToAtlas();
  },false,false,state.atlasSaving));
  box.appendChild(row);
  ov.addEventListener("click",function(e){if(e.target===ov){state.showAtlas=false;draw();}});
  ov.appendChild(box);return ov;
}

function saveToAtlas(){
  state.atlasSaving=true;draw();
  var payload={
    name:state.char.name||"Unbekannt",
    player:state.atlasPlayer.trim(),
    type:state.atlasType,
    threadUrl:state.atlasThread.trim(),
    portraitUrl:state.atlasPortrait.trim(),
    home:state.char.home||"",
    job:state.char.job||"",
    age:state.char.age||""
  };
  fetch(APPS_SCRIPT_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  }).then(function(){
    state.atlasSaving=false;state.atlasSaved=true;
    state.atlasPlayer="";state.atlasThread="";state.atlasPortrait="";
    draw();
  }).catch(function(e){
    state.atlasSaving=false;
    alert("Fehler: "+e.message+"\n\nBitte Apps Script URL in der Datei konfigurieren.");
    draw();
  });
}

function mkPostModal(){
  var ov=div({position:"fixed",inset:"0",background:"rgba(0,0,0,0.6)",zIndex:"200",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"});
  var box=div({background:C.card,border:"1px solid "+C.border,borderRadius:"14px",padding:"24px",width:"100%",maxWidth:"500px"});
  box.appendChild(div({fontSize:"14px",fontWeight:"800",color:C.accent,marginBottom:"12px"},["📤 Im Forum posten"]));

  if(state.postCopied){
    // Wizard nach dem BBCode-Kopieren und Forum-Öffnen
    box.appendChild(div({background:"rgba(77,122,77,0.15)",border:"1px solid rgba(77,122,77,0.4)",borderRadius:"8px",padding:"12px 14px",marginBottom:"14px",fontSize:"13px",color:C.accent,lineHeight:"1.6",fontWeight:"600"},
      ["✅ BBCode kopiert — das Forum-Fenster ist offen"]));

    box.appendChild(div({fontSize:"12px",fontWeight:"700",color:C.text,marginBottom:"8px"},["So geht's weiter:"]));

    var steps=div({marginBottom:"14px"});
    function mkStep(num,txt){
      var s=div({display:"flex",gap:"10px",marginBottom:"8px",fontSize:"12px",color:C.text,lineHeight:"1.5"});
      s.appendChild(div({background:C.accent,color:C.bg,width:"20px",height:"20px",minWidth:"20px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"800",fontSize:"11px"},[String(num)]));
      s.appendChild(div({flex:"1"},[txt]));
      return s;
    }
    steps.appendChild(mkStep(1,"Wechsle ins Forum-Fenster und logge dich ein (oder registriere dich, dein Bogen bleibt hier erhalten)"));
    steps.appendChild(mkStep(2,"Gib den Namen deines Charakters als Titel ein"));

    // Step 3: hervorgehobener Block weil Copy-Paste der entscheidende Schritt ist
    // — auf Mobile uebersehen viele User dass Strg+V nicht funktioniert.
    var pasteStep=div({
      display:"flex",gap:"10px",marginBottom:"8px",
      background:"rgba(74,170,106,0.12)",
      border:"1.5px solid rgba(74,170,106,0.5)",
      borderRadius:"8px",
      padding:"10px 12px"
    });
    pasteStep.appendChild(div({
      background:C.accent,color:C.bg,
      width:"22px",height:"22px",minWidth:"22px",
      borderRadius:"50%",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontWeight:"800",fontSize:"12px"
    },["3"]));
    var pasteCol=div({flex:"1",fontSize:"12px",color:C.text,lineHeight:"1.5"});
    pasteCol.appendChild(mk("div",{fontWeight:"800",color:C.accent,marginBottom:"3px"},["BBCode einfügen — wichtigster Schritt"]));
    pasteCol.appendChild(mk("div",{marginBottom:"6px"},["Klick ins Nachrichten-Feld im Forum, dann einfügen:"]));
    var pasteHow=div({fontSize:"11px",color:C.muted,lineHeight:"1.6"});
    var howDesktop=mk("div",{});
    howDesktop.appendChild(mk("strong",{color:C.text},["Desktop: "]));
    howDesktop.appendChild(document.createTextNode("Strg+V (Windows) oder Cmd+V (Mac)"));
    pasteHow.appendChild(howDesktop);
    var howMobile=mk("div",{marginTop:"2px"});
    howMobile.appendChild(mk("strong",{color:C.text},["Handy: "]));
    howMobile.appendChild(document.createTextNode("ins Feld tippen und gedrückt halten → \"Einfügen\" wählen"));
    pasteHow.appendChild(howMobile);
    pasteCol.appendChild(pasteHow);
    pasteStep.appendChild(pasteCol);
    steps.appendChild(pasteStep);

    steps.appendChild(mkStep(4,'Unten auf „Absenden" klicken — dein Thread ist online'));
    box.appendChild(steps);


    // Copy-Buttons: BBCode nochmal kopieren + Forum-Link nochmal öffnen
    var toolRow=div({display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"14px"});
    toolRow.appendChild(btn("📋 BBCode nochmal kopieren",C.muted,function(){
      var bb=generateBBCode();
      // Synchrones Fallback + Promise — siehe Hauptpost-Button fuer Details
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(bb).catch(function(){
          var ta=document.createElement("textarea");ta.value=bb;ta.style.position="fixed";ta.style.top="-1000px";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");}catch(e){}document.body.removeChild(ta);
        });
      } else {
        var ta=document.createElement("textarea");ta.value=bb;ta.style.position="fixed";ta.style.top="-1000px";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");}catch(e){}document.body.removeChild(ta);
      }
      alert("BBCode erneut in Zwischenablage kopiert.");
    },true,true,false));
    toolRow.appendChild(btn("🔁 Forum-Fenster öffnen",C.muted,function(){
      var fid=FORUM_IDS[state.postType]||"51849";
      var nameParam = state.char.name ? "&plan_name="+encodeURIComponent(state.char.name) : "";
      window.open("https://www.simsforumrpg.de/new.php?forum="+fid+nameParam,"_blank","noopener");
    },true,true,false));
    box.appendChild(toolRow);

    // Bild-Hinweis — je nach Bogen-Status
    var hasImg = !!(state.imgPreview||state.imgB64||state.imgUrl);
    var imgBox=div({background:"rgba(61,111,138,0.1)",border:"1px solid rgba(61,111,138,0.3)",borderRadius:"8px",padding:"10px 12px",marginBottom:"10px",fontSize:"11px",color:C.muted,lineHeight:"1.65"});
    if(hasImg){
      imgBox.appendChild(div({fontWeight:"700",color:"#7bb4d4",marginBottom:"4px",fontSize:"12px"},["📷 Portrait im Forum-Post einfügen"]));
      var row1=div({});
      row1.appendChild(document.createTextNode('Du hast im Bogen schon ein Bild hochgeladen — speichere es zuerst lokal (Rechtsklick → „Bild speichern unter"). Im Forum-Fenster dann auf die '));
      var kl1=mk("strong",{color:C.text},['📎 Büroklammer („Dateien anhängen")']);
      row1.appendChild(kl1);
      row1.appendChild(document.createTextNode(" klicken → Datei auswählen → hochladen. Das Bild erscheint automatisch im Post."));
      imgBox.appendChild(row1);
    } else {
      imgBox.appendChild(div({fontWeight:"700",color:"#7bb4d4",marginBottom:"4px",fontSize:"12px"},["📷 Bild hinzufügen (optional)"]));
      var row2=div({});
      row2.appendChild(document.createTextNode("Willst du ein Portrait zeigen? Im Forum-Fenster auf die "));
      var kl2=mk("strong",{color:C.text},['📎 Büroklammer („Dateien anhängen")']);
      row2.appendChild(kl2);
      row2.appendChild(document.createTextNode(" klicken → Bild hochladen. Das Bild wird am Ende des Posts angehängt."));
      imgBox.appendChild(row2);
    }
    box.appendChild(imgBox);

    // BBCode-Erklärung (aufklappbar)
    var bbcDetails=mk("details",{marginBottom:"14px",background:"rgba(255,255,255,0.03)",border:"1px solid "+C.border,borderRadius:"8px",padding:"0"});
    var bbcSummary=mk("summary",{padding:"8px 12px",cursor:"pointer",fontSize:"11px",fontWeight:"600",color:C.muted,userSelect:"none"});
    bbcSummary.textContent="❓ Was ist BBCode? Warum sehe ich [b]…[/b] im Text?";
    bbcDetails.appendChild(bbcSummary);
    var bbcBody=div({padding:"0 12px 12px 12px",fontSize:"11px",color:C.muted,lineHeight:"1.65"});
    bbcBody.appendChild(div({marginBottom:"6px"},["BBCode ist die Formatierungs-Sprache des Forums. Die eckigen Klammern werden automatisch in Formatierung umgewandelt — sie sind im fertigen Post nicht sichtbar."]));
    var egRow=div({display:"grid",gridTemplateColumns:"auto 1fr",gap:"4px 10px",fontSize:"10px",marginTop:"8px",fontFamily:"monospace"});
    function mkEg(code,result){
      egRow.appendChild(mk("span",{color:"#888",whiteSpace:"nowrap"},[code]));
      egRow.appendChild(mk("span",{color:C.text},[result]));
    }
    mkEg("[b]Fett[/b]","wird → Fett");
    mkEg("[i]Kursiv[/i]","wird → Kursiv");
    mkEg("[color=#4aaa6a]Grün[/color]","wird → farbiger Text");
    mkEg("[img]url.jpg[/img]","wird → Bild eingebettet");
    bbcBody.appendChild(egRow);
    bbcBody.appendChild(div({marginTop:"10px",fontSize:"10px",fontStyle:"italic",color:C.muted},["Einfach mit Strg+V einfügen und abschicken — das Forum formatiert alles automatisch."]));
    bbcDetails.appendChild(bbcBody);
    box.appendChild(bbcDetails);

    var row=div({display:"flex",gap:"8px",flexWrap:"wrap",justifyContent:"flex-end"});
    row.appendChild(btn("Fertig",C.accent,function(){state.showPost=false;state.postCopied=false;draw();},false,false,false));
    box.appendChild(row);
  } else {
    // Schritt 1: Typ wählen und posten
    box.appendChild(div({fontSize:"12px",color:C.muted,marginBottom:"14px",lineHeight:"1.6"},
      ["Wähle den Charaktertyp. Du wirst danach automatisch zur richtigen Forenseite weitergeleitet.\n⚠ Du musst im Forum eingeloggt sein."]));
    var tw=div({marginBottom:"16px"});
    tw.appendChild(div({fontSize:"12px",fontWeight:"700",color:C.accent,marginBottom:"8px"},["Typ"]));
    var trow=div({display:"flex",gap:"6px",flexWrap:"wrap"});
    [{id:"haupt",label:"Hauptcharakter"},{id:"neben",label:"Nebencharakter"},{id:"randfigur",label:"Randfigur"},{id:"passant",label:"Passant"}].forEach(function(t){
      trow.appendChild(btn(t.label,state.postType===t.id?C.accent:C.muted,function(){state.postType=t.id;draw();},true,state.postType!==t.id,false));
    });
    tw.appendChild(trow);box.appendChild(tw);
    // Login-Hinweis
    var loginBox=div({background:"rgba(61,111,138,0.1)",border:"1px solid rgba(61,111,138,0.3)",borderRadius:"8px",padding:"10px 12px",marginBottom:"14px",fontSize:"12px",color:C.muted,lineHeight:"1.6"});
    var loginLink=mk("a",{href:"https://www.simsforumrpg.de/login.php",target:"_blank",rel:"noopener",style:"color:#3a8aaa;font-weight:700"});
    loginLink.textContent="Jetzt einloggen / registrieren";
    loginBox.appendChild(document.createTextNode("Noch nicht eingeloggt? "));
    loginBox.appendChild(loginLink);
    loginBox.appendChild(document.createTextNode(" — öffnet neues Tab, dein Bogen bleibt hier erhalten."));
    box.appendChild(loginBox);

    // WICHTIGER HINWEIS vor dem Klick: User muss verstehen dass nach dem Klick
    // Copy-Paste noetig ist, sonst klickt er und kommt im Forum nicht weiter.
    var pasteHint=div({
      background:"rgba(74,170,106,0.12)",
      border:"1.5px solid rgba(74,170,106,0.5)",
      borderRadius:"8px",
      padding:"12px 14px",
      marginBottom:"14px"
    });
    pasteHint.appendChild(mk("div",{fontSize:"12px",fontWeight:"800",color:C.accent,marginBottom:"6px"},["So geht's danach:"]));
    var pasteList=div({fontSize:"12px",color:C.text,lineHeight:"1.55"});
    pasteList.appendChild(mk("div",{marginBottom:"3px"},["1. Dein Bogen kommt in die Zwischenablage, das Forum öffnet sich in einem neuen Tab"]));
    pasteList.appendChild(mk("div",{marginBottom:"3px"},["2. Im Forum: Titel = Name deines Charakters"]));
    var pasteRow=div({marginBottom:"3px"});
    pasteRow.appendChild(mk("strong",{color:C.accent},["3. BBCode einfügen: "]));
    pasteRow.appendChild(document.createTextNode("ins Textfeld klicken, dann:"));
    pasteList.appendChild(pasteRow);
    var howBox=div({fontSize:"11px",color:C.muted,marginLeft:"14px",lineHeight:"1.6"});
    var howDesktop=mk("div",{});
    howDesktop.appendChild(mk("strong",{color:C.text},["Desktop: "]));
    howDesktop.appendChild(document.createTextNode("Strg+V (Windows) oder Cmd+V (Mac)"));
    howBox.appendChild(howDesktop);
    var howMobile=mk("div",{marginTop:"2px"});
    howMobile.appendChild(mk("strong",{color:C.text},["Handy: "]));
    howMobile.appendChild(document.createTextNode("ins Feld tippen und gedrückt halten → \"Einfügen\" wählen"));
    howBox.appendChild(howMobile);
    pasteList.appendChild(howBox);
    pasteList.appendChild(mk("div",{marginTop:"3px"},["4. Absenden → fertig. Auf der Charakter-Seite wirst du gefragt ob er ins ATLAS-Sheet eingetragen werden soll. Du musst nicht zurück in dieses Tab — kannst es dann schliessen."]));
    pasteHint.appendChild(pasteList);
    box.appendChild(pasteHint);

    var row=div({display:"flex",gap:"8px",justifyContent:"flex-end"});
    row.appendChild(btn("Abbrechen",C.muted,function(){state.showPost=false;draw();},false,true,false));
    row.appendChild(btn("📤 Im Forum posten",C.accent,function(){
      var bb=generateBBCode();
      var fid=FORUM_IDS[state.postType]||"51849";
      saveLocalDraft();
      var nameParam = state.char.name ? "&plan_name="+encodeURIComponent(state.char.name) : "";
      var forumUrl = "https://www.simsforumrpg.de/new.php?forum="+fid+nameParam;
      // BBCode in die Zwischenablage. WICHTIG: Erst Clipboard-Write abwarten,
      // DANN erst window.open — sonst kann das Tab-Öffnen den Write abbrechen
      // (Fokuswechsel vom Tab) und der User landet im Forum mit leerem Clipboard.
      // Zusätzlich: execCommand-Fallback IMMER versuchen wenn Promise rejected
      // (z.B. Permissions-Denied in einigen Browsern).
      function fallbackCopy(){
        var ta=document.createElement("textarea");
        ta.value=bb;
        ta.style.position="fixed";ta.style.top="-1000px";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch(e) { console.warn("Copy-Fallback failed:", e); }
        document.body.removeChild(ta);
      }
      function openForum(){
        window.open(forumUrl,"_blank","noopener");
        state.postCopied=true;
        draw();
      }
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(bb).then(openForum).catch(function(err){
          console.warn("Clipboard-API fehlgeschlagen, nutze Fallback:", err);
          fallbackCopy();
          openForum();
        });
      } else {
        fallbackCopy();
        openForum();
      }
    },false,false,false));
    box.appendChild(row);
  }
  ov.addEventListener("click",function(e){if(e.target===ov){state.showPost=false;state.postCopied=false;draw();}});
  ov.appendChild(box);return ov;
}

// ── Main draw ──
function draw(){
  // ── App shell (only once) ──
  var app=qs("app");
  if(!qs("main-wrap")){
    app.innerHTML="";
    var wrap=div({maxWidth:"700px",margin:"0 auto",padding:"20px 16px",background:C.bg,minHeight:"100vh"});
    wrap.id="main-wrap";
    // header
    var hdr=div({textAlign:"center",marginBottom:"24px"});
    hdr.appendChild(div({fontSize:"26px",fontWeight:"900",letterSpacing:"2px",color:C.accent},["CHARAKTERBOGEN"]));
    hdr.appendChild(div({width:"60px",height:"2px",background:"linear-gradient(90deg,transparent,"+C.accent+",transparent)",margin:"8px auto 8px"}));
    var badge=div({display:"inline-flex",alignItems:"center",gap:"5px",background:"rgba(74,170,106,0.1)",border:"0.5px solid rgba(74,170,106,0.3)",borderRadius:"20px",padding:"3px 10px",fontSize:"10px",color:"rgba(74,170,106,0.7)",letterSpacing:"1px",marginBottom:"12px"});
    var dot=mk("span",{width:"5px",height:"5px",borderRadius:"50%",background:"#4aaa6a",display:"inline-block",flexShrink:"0"});
    badge.appendChild(dot);
    badge.appendChild(document.createTextNode("Ein Projekt ATLAS Feature"));
    hdr.appendChild(div({textAlign:"center"},[badge]));
    var hbtns=div({display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap"});
    hbtns.appendChild(btn("📋 Bogen importieren",C.muted,function(){state.showImport=true;draw();},true,true,false));
    hbtns.appendChild(btn("👥 Bekannte Charaktere",C.muted,function(){state.showCtx=true;draw();},true,true,false));
    hdr.appendChild(hbtns);
    wrap.appendChild(hdr);
    var tabs=div({display:"flex",gap:"3px",marginBottom:"20px"});tabs.id="tabs";wrap.appendChild(tabs);
    var ca=div({background:C.card,borderRadius:"12px",padding:"22px",border:"1px solid "+C.border,minHeight:"300px"});ca.id="content";wrap.appendChild(ca);
    var nav=div({display:"flex",justifyContent:"space-between",marginTop:"14px"});nav.id="nav";wrap.appendChild(nav);
    app.appendChild(wrap);
  }

  // ── Tabs ──
  var tabs=qs("tabs");tabs.innerHTML="";
  SECTIONS.forEach(function(s,i){
    var t=mk("button",{flex:"1",padding:"8px 4px",borderRadius:"6px",border:"1px solid "+(i===state.step?C.accent:C.border),cursor:"pointer",fontSize:"11px",fontWeight:"700",
      background:i===state.step?C.accent:i<state.step?"rgba(74,170,106,0.12)":C.card,
      color:i===state.step?"#fff":i<state.step?C.accent:C.muted});
    t.textContent=s.title;
    (function(idx){t.addEventListener("click",function(){state.step=idx;draw();});})(i);
    tabs.appendChild(t);
  });

  // ── Content ──
  var ca=qs("content");ca.innerHTML="";
  var sec=SECTIONS[state.step];
  if(state.step<SECTIONS.length-1){
    ca.appendChild(div({fontSize:"10px",fontWeight:"800",letterSpacing:"3px",color:C.teal,marginBottom:"18px"},[sec.title.toUpperCase()]));
    sec.fields.forEach(function(k){var f=FIELDS.find(function(f){return f.key===k;});if(f)ca.appendChild(mkField(f));});
  } else {
    ca.appendChild(mkSheet());
  }

  // ── Nav ──
  var nav=qs("nav");nav.innerHTML="";
  nav.appendChild(btn("← Zurück",C.muted,function(){state.step=Math.max(0,state.step-1);draw();},false,true,state.step===0));
  nav.appendChild(btn("Weiter →",C.accent,function(){state.step=Math.min(SECTIONS.length-1,state.step+1);draw();},false,false,state.step===SECTIONS.length-1));

  // ── Modals ──
  var modals=qs("modals");modals.innerHTML="";
  if(state.showImport)modals.appendChild(mkImportModal());
  if(state.showCtx)modals.appendChild(mkCtxModal());
  if(state.showAtlas)modals.appendChild(mkAtlasModal());
  if(state.showPost)modals.appendChild(mkPostModal());
}

setupImgInput();
loadLocalDraft();
draw();


// ═══════════════════════════════════════════════════════════════
// EVE-GUIDE für den Char-Bogen
// ═══════════════════════════════════════════════════════════════
// - Reopen-Button (Fragezeichen unten rechts) IMMER sichtbar
// - Auto-Popup beim ersten Besuch (kein localStorage-Check moeglich
//   im Inkognito, deshalb sessionStorage als "schon gesehen"-Flag)
// - 7 Steps die durch den Bogen fuehren: Begruessung, Bogen-Importieren-Button,
//   Bekannte-Chars-Button, KI-Hilfe, Tabs, Im-Forum-Posten, Discord-Schluss
// - Jeder Step kann ein Element hervorheben (Spotlight wie im Forum-Guide)
// ═══════════════════════════════════════════════════════════════
(function(){
  var DONE_KEY = 'eve_charbogen_seen';
  var CLOSED_KEY = 'eve_charbogen_closed_session';

  var EVE_IMGS = [
    'https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1153_VSLsipkW.png',
    'https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1152_mqaXzPEn.png',
    'https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1150_xjPUYcNu.png',
    'https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1151_YImvSyHw.png',
    'https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1149_RrOhvmbf.png',
    'https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1148_iCMAzrYm.png'
  ];

  // Helfer um Elemente per Text-Label zu finden (keine IDs im Bogen)
  function findByText(selector, text){
    var els = document.querySelectorAll(selector);
    for(var i = 0; i < els.length; i++){
      if((els[i].textContent || '').trim().indexOf(text) !== -1) return els[i];
    }
    return null;
  }
  function findTabByText(text){
    return findByText('#tabs button', text);
  }

  // Steps: jeder hat img, text, btns, optional highlight-Selektor
  var STEPS = {
    'intro': {
      img: 0,
      text: function(){
        return 'Schön dass du dir einen Charakter erstellen willst — ich helf dir kurz durch den Bogen! Magst du eine Mini-Tour? Dauert nur 1 Minute.';
      },
      btns: function(){
        return [
          { label:'Ja, zeig mir', cls:'primary', act:'next', next:'char-types' },
          { label:'Nö, kenn ich', cls:'ghost', act:'close-soft' }
        ];
      }
    },
    'char-types': {
      img: 1,
      text: function(){
        return 'Erstmal: <strong>welche Rolle</strong> spielt dein Char?<br><br>• <strong>Haupt</strong> — meist dein erster Char, hat eine eigene Story die du verfolgst, wohnt in deinem Sims-4-Savefile.<br>• <strong>Neben</strong> — kann auch eine Story haben, lebt aber nicht im Savefile (Platzmangel).<br>• <strong>Randfigur</strong> — unterstützt Haupt- oder Nebenfiguren in deren Storys.<br>• <strong>Passant</strong> — Char ohne eigene Story, taucht situativ auf.<br><br>Du kannst Chars später <strong>befördern oder degradieren</strong>, wie es passt.';
      },
      btns: function(){
        return [
          { label:'← Zurück', cls:'ghost', act:'next', next:'intro' },
          { label:'Verstanden', cls:'primary', act:'next', next:'import-btn' },
          { label:'Schliessen', cls:'ghost', act:'close-soft' }
        ];
      }
    },
    'import-btn': {
      img: 1,
      highlight: function(){ return findByText('#main-wrap button', 'Bogen importieren'); },
      text: function(){
        return 'Oben links findest du <strong>📋 Bogen importieren</strong>. Wenn du schonmal einen Bogen angefangen hast oder einen von woanders übernehmen willst, kannst du den Text hier reinkopieren und es füllt sich alles automatisch.';
      },
      btns: function(){
        return [
          { label:'← Zurück', cls:'ghost', act:'next', next:'char-types' },
          { label:'Weiter', cls:'primary', act:'next', next:'known-chars' },
          { label:'Schliessen', cls:'ghost', act:'close-soft' }
        ];
      }
    },
    'known-chars': {
      img: 2,
      highlight: function(){ return findByText('#main-wrap button', 'Bekannte Charaktere'); },
      text: function(){
        return 'Daneben siehst du <strong>👥 Bekannte Charaktere</strong>. Hier trägst du Chars ein die <strong>dein Char</strong> kennt — Familie, Freunde, Kollegen, Rivalen, Exes. Pro bekanntem Char kannst du <strong>Details ergänzen</strong> (wie sie sich kennen, Beziehungsdynamik etc.). Wenn die KI dir später Tipps gibt, berücksichtigt sie diese Beziehungen.';
      },
      btns: function(){
        return [
          { label:'← Zurück', cls:'ghost', act:'next', next:'import-btn' },
          { label:'Weiter', cls:'primary', act:'next', next:'ai-help' },
          { label:'Schliessen', cls:'ghost', act:'close-soft' }
        ];
      }
    },
    'ai-help': {
      img: 3,
      text: function(){
        return 'Bei vielen Feldern siehst du den Button <strong>✨ Tipps & Fragen</strong>. Die KI gibt dir Anregungen und Fragen zum Nachdenken — sie schreibt dir <em>keinen</em> fertigen Text zum Reinkopieren. Wir arbeiten gerne mit KI, aber bitte kein Copy-Paste — der Bogen soll deine Stimme tragen. Die KI ist ein super Werkzeug für Kreativität, mehr nicht.';
      },
      btns: function(){
        return [
          { label:'← Zurück', cls:'ghost', act:'next', next:'known-chars' },
          { label:'Verstanden', cls:'primary', act:'next', next:'tabs' },
          { label:'Schliessen', cls:'ghost', act:'close-soft' }
        ];
      }
    },
    'tabs': {
      img: 4,
      highlight: function(){ return document.getElementById('tabs'); },
      text: function(){
        return 'Oben siehst du die <strong>Abschnitte</strong>: Identität, Leben, Zuhause, Charakter und Blatt. Das sind die Kategorien durch die du arbeitest. Du kannst zwischen ihnen springen — was du eingibst wird automatisch zwischengespeichert.';
      },
      btns: function(){
        return [
          { label:'← Zurück', cls:'ghost', act:'next', next:'ai-help' },
          { label:'Weiter', cls:'primary', act:'next', next:'post' },
          { label:'Schliessen', cls:'ghost', act:'close-soft' }
        ];
      }
    },
    'post': {
      img: 5,
      onEnter: function(){
        // Zum Blatt-Tab (letzter Tab) springen damit "Im Forum posten" sichtbar wird
        var tabBtns = document.querySelectorAll('#tabs button');
        if(tabBtns.length){
          var blatt = tabBtns[tabBtns.length - 1];
          if(blatt && (blatt.textContent || '').indexOf('Blatt') !== -1){
            blatt.click();
          }
        }
      },
      highlight: function(){
        // "Im Forum posten" gibts mehrfach (im Blatt-Tab + im Modal) — den ersten sichtbaren
        var btns = document.querySelectorAll('#main-wrap button');
        for(var i = 0; i < btns.length; i++){
          if((btns[i].textContent || '').indexOf('Im Forum posten') !== -1){
            return btns[i];
          }
        }
        return null;
      },
      text: function(){
        return 'Im letzten Tab <strong>Blatt</strong> findest du <strong>📤 Im Forum posten</strong>. Klick drauf wenn du fertig bist — <strong>dein kompletter Bogen wird automatisch kopiert</strong> und das Forum öffnet sich. Du musst nur noch im Forum-Textfeld einmal <strong>einfügen</strong> (Strg+V oder Rechtsklick → Einfügen) und absenden.';
      },
      btns: function(){
        return [
          { label:'← Zurück', cls:'ghost', act:'next', next:'tabs' },
          { label:'Weiter', cls:'primary', act:'next', next:'discord' },
          { label:'Schliessen', cls:'ghost', act:'close-soft' }
        ];
      }
    },
    'discord': {
      img: 0,
      text: function(){
        return 'Falls du irgendwo hängst: komm einfach in unseren <strong><a href="https://www.simsforumrpg.de/page-855163-1.html" target="_blank" style="color:#3a8aaa;text-decoration:underline">Discord</a></strong> und schreib zum Beispiel „Hey ich erstell grad einen Char und da ist dies und das, was muss ich machen?" — wir helfen gern. Viel Spass beim Erschaffen!';
      },
      btns: function(){
        return [
          { label:'← Zurück', cls:'ghost', act:'next', next:'post' },
          { label:'Danke Eve!', cls:'primary', act:'close-soft' }
        ];
      }
    }
  };

  // ─── DOM ───────────────────────────────────────────────────────
  var overlay, fig, img, bubble, textEl, btnsEl, closeBtn, reopen, spotlight;
  function appendDom(){
    if(overlay) return;
    overlay = document.createElement('div'); overlay.id = 'ec-overlay';
    fig = document.createElement('div'); fig.id = 'ec-fig';
    img = document.createElement('img'); img.id = 'ec-img'; img.src = EVE_IMGS[0]; img.alt = 'Eve';
    fig.appendChild(img);
    bubble = document.createElement('div'); bubble.id = 'ec-bubble';
    var miniPortrait = document.createElement('img'); miniPortrait.id = 'ec-mini'; miniPortrait.src = EVE_IMGS[0]; miniPortrait.alt = 'Eve';
    bubble.appendChild(miniPortrait);
    var nameTag = document.createElement('div'); nameTag.id = 'ec-name-tag'; nameTag.textContent = 'Eve';
    bubble.appendChild(nameTag);
    textEl = document.createElement('div'); textEl.id = 'ec-text';
    btnsEl = document.createElement('div'); btnsEl.id = 'ec-btns';
    closeBtn = document.createElement('div'); closeBtn.id = 'ec-close'; closeBtn.textContent = '✕';
    closeBtn.onclick = closeSoft;
    bubble.appendChild(textEl); bubble.appendChild(btnsEl); bubble.appendChild(closeBtn);
    overlay.appendChild(bubble); overlay.appendChild(fig);
    document.body.appendChild(overlay);

    reopen = document.createElement('div'); reopen.id = 'ec-reopen'; reopen.textContent = '?';
    reopen.title = 'Eve braucht? Klick!';
    reopen.onclick = function(){
      try { sessionStorage.removeItem(CLOSED_KEY); } catch(e){}
      render('intro');
    };
    document.body.appendChild(reopen);

    spotlight = document.createElement('div'); spotlight.id = 'ec-spotlight';
    document.body.appendChild(spotlight);
  }

  function closeSoft(){
    if(overlay) overlay.classList.add('hidden');
    if(spotlight) spotlight.classList.remove('active');
    if(reopen) reopen.classList.add('visible');
    try { sessionStorage.setItem(CLOSED_KEY, '1'); } catch(e){}
    try { localStorage.setItem(DONE_KEY, '1'); } catch(e){}
  }

  function clearHighlight(){
    if(spotlight) spotlight.classList.remove('active');
    // Highlight-Klasse von vorherigen Elementen entfernen
    document.querySelectorAll('.ec-highlighted').forEach(function(el){
      el.classList.remove('ec-highlighted');
    });
  }

  function setHighlight(el){
    clearHighlight();
    if(!el) return;
    el.classList.add('ec-highlighted');
    // Spotlight-Box um Element platzieren
    var r = el.getBoundingClientRect();
    if(r.width === 0 && r.height === 0) return; // Element ist hidden
    spotlight.style.left = (r.left - 8) + 'px';
    spotlight.style.top = (r.top - 8) + 'px';
    spotlight.style.width = (r.width + 16) + 'px';
    spotlight.style.height = (r.height + 16) + 'px';
    spotlight.classList.add('active');
    // Scroll-into-view falls nicht sichtbar
    if(r.top < 0 || r.bottom > window.innerHeight){
      el.scrollIntoView({behavior:'smooth', block:'center'});
      // Nach Scroll-Animation Position aktualisieren
      setTimeout(function(){
        var r2 = el.getBoundingClientRect();
        spotlight.style.left = (r2.left - 8) + 'px';
        spotlight.style.top = (r2.top - 8) + 'px';
      }, 350);
    }
  }

  var curStepId = 'intro';
  function render(stepId){
    if(!STEPS[stepId]) return;
    appendDom();
    var step = STEPS[stepId];
    curStepId = stepId;

    overlay.classList.remove('hidden');
    if(reopen) reopen.classList.remove('visible');

    img.src = EVE_IMGS[step.img] || EVE_IMGS[0];
    var mini = document.getElementById('ec-mini');
    if(mini) mini.src = EVE_IMGS[step.img] || EVE_IMGS[0];
    textEl.innerHTML = step.text();
    // Step-spezifischer onEnter (z.B. Tab wechseln)
    if(typeof step.onEnter === 'function'){
      try { step.onEnter(); } catch(e){}
    }

    btnsEl.innerHTML = '';
    var btns = step.btns();
    btns.forEach(function(b){
      var el = document.createElement('button');
      el.className = 'ec-btn ' + (b.cls || 'primary');
      el.textContent = b.label;
      el.onclick = function(){
        if(b.act === 'close-soft'){ closeSoft(); return; }
        if(b.act === 'next' && b.next){ render(b.next); return; }
      };
      btnsEl.appendChild(el);
    });

    // Highlight setzen — laengere Verzoegerung damit DOM nach evtl. onEnter (Tab-Wechsel) stabil ist
    setTimeout(function(){
      var hl = step.highlight ? step.highlight() : null;
      setHighlight(hl);
    }, 200);
  }

  // Reposition Spotlight bei Resize/Scroll
  window.addEventListener('resize', function(){
    if(spotlight && spotlight.classList.contains('active')){
      var step = STEPS[curStepId];
      var hl = step && step.highlight ? step.highlight() : null;
      if(hl) setHighlight(hl);
    }
  });
  window.addEventListener('scroll', function(){
    if(spotlight && spotlight.classList.contains('active')){
      var step = STEPS[curStepId];
      var hl = step && step.highlight ? step.highlight() : null;
      if(hl){
        var r = hl.getBoundingClientRect();
        if(r.width){
          spotlight.style.left = (r.left - 8) + 'px';
          spotlight.style.top = (r.top - 8) + 'px';
        }
      }
    }
  }, {passive:true});

  // ─── Styles ────────────────────────────────────────────────────
  var css = document.createElement('style');
  css.textContent = '\
    #ec-overlay { position:fixed; bottom:20px; right:20px; z-index:100001; display:flex; flex-direction:column; align-items:flex-end; pointer-events:none; }\
    #ec-overlay.hidden { display:none; }\
    #ec-fig { height:240px; width:380px; flex-shrink:0; transform-origin:bottom right; align-self:flex-end; margin-right:-10px; }\
    #ec-img { height:240px; width:380px; object-fit:contain; object-position:center bottom; display:block; filter:drop-shadow(0 6px 14px rgba(0,0,0,0.5)); mix-blend-mode:lighten; }\
    #ec-bubble { background: linear-gradient(145deg,#0d1f2d 0%,#081420 100%); border:2.5px solid #3a8aaa; border-radius:18px 18px 18px 4px; padding:14px 16px 12px; width:300px; box-shadow:0 0 0 1px rgba(58,138,170,0.3),0 0 24px rgba(58,138,170,0.35),0 8px 28px rgba(0,0,0,0.7); font-size:13.5px; line-height:1.6; color:#e0eaf0; position:relative; pointer-events:all; }\
    #ec-bubble::after { content:""; position:absolute; bottom:-13px; right:28px; width:0; height:0; border-left:10px solid transparent; border-right:6px solid transparent; border-top:13px solid #0d1f2d; filter:drop-shadow(0 3px 0px #3a8aaa); }\
    #ec-name-tag { position:absolute; top:-12px; left:14px; background:#3a8aaa; color:#fff; padding:2px 10px; border-radius:6px; font-size:11px; font-weight:700; letter-spacing:1px; }\
    #ec-text { margin-top:4px; margin-bottom:10px; }\
    #ec-text a { color:#3a8aaa; }\
    #ec-btns { display:flex; gap:7px; flex-wrap:wrap; justify-content:flex-end; }\
    .ec-btn { font-family:inherit; font-size:12px; padding:7px 14px; border-radius:6px; cursor:pointer; border:1.5px solid transparent; font-weight:600; transition:transform 0.15s,filter 0.15s,background 0.15s; }\
    .ec-btn:hover { transform:translateY(-1px); }\
    .ec-btn.primary { background:#3a8aaa; color:#0d1f2d; border-color:#3a8aaa; }\
    .ec-btn.primary:hover { filter:brightness(1.15); }\
    .ec-btn.ghost { background:transparent; color:#3a8aaa; border-color:#3a8aaa; }\
    .ec-btn.ghost:hover { background:rgba(58,138,170,0.12); }\
    #ec-close { position:absolute; top:-9px; right:-9px; background:#0d1f2d; border:1.5px solid #3a8aaa; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:12px; cursor:pointer; color:#9ab; }\
    #ec-close:hover { color:#fff; background:#1a2f3d; }\
    #ec-reopen { position:fixed; bottom:24px; right:24px; width:44px; height:44px; border-radius:50%; background:linear-gradient(145deg,#3a8aaa,#2a6a8a); color:#fff; font-size:22px; font-weight:700; display:none; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 16px rgba(0,0,0,0.5),0 0 0 2px rgba(58,138,170,0.3); z-index:100001; transition:transform 0.2s; }\
    #ec-reopen.visible { display:flex; }\
    #ec-reopen:hover { transform:scale(1.1); }\
    #ec-spotlight { position:fixed; pointer-events:none; z-index:100000; border:2px solid #3a8aaa; border-radius:8px; box-shadow:0 0 0 9999px rgba(0,0,0,0.55), 0 0 20px rgba(58,138,170,0.6); transition:all 0.3s ease; opacity:0; }\
    #ec-spotlight.active { opacity:1; }\
    .ec-highlighted { position:relative; z-index:100000 !important; }\
    #ec-mini { display:none; }\
    @media(max-width:768px){\
      #ec-fig { display:none; }\
      #ec-overlay { bottom:80px; right:12px; left:12px; align-items:flex-end; padding-right:10px; }\
      #ec-bubble { width:calc(100vw - 30px); max-width:320px; font-size:13px; border-radius:18px; padding:20px 70px 12px 16px; }\
      #ec-bubble::after { display:none; }\
      #ec-mini { display:block; position:absolute; top:-20px; right:14px; width:46px; height:46px; border-radius:50%; border:2.5px solid #4aaa6a; object-fit:cover; object-position:center 15%; background:#0d2218; box-shadow:0 3px 10px rgba(0,0,0,0.6); }\
      #ec-name-tag { top:-12px; left:14px; right:auto; }\
      #ec-reopen { bottom:90px; right:15px; width:42px; height:42px; font-size:20px; }\
    }\
  ';
  document.head.appendChild(css);

  // ─── Auto-Start ────────────────────────────────────────────────
  // - Wenn noch nie gesehen → Auto-Popup mit intro
  // - Wenn schon gesehen (localStorage) ODER in dieser Session geschlossen → nur Reopen-Button
  function init(){
    appendDom();
    var seen = false;
    var closedSession = false;
    try { seen = !!localStorage.getItem(DONE_KEY); } catch(e){}
    try { closedSession = !!sessionStorage.getItem(CLOSED_KEY); } catch(e){}

    // Auf dem Char-Bogen IMMER nur das Fragezeichen — kein Auto-Popup.
    // Der Bogen laeuft auf GitHub Pages, wir koennen User nicht zuverlaessig als
    // "neu" identifizieren. Statt zu raten lassen wir den User entscheiden.
    overlay.classList.add('hidden');
    reopen.classList.add('visible');
  }

  // Warten bis Bogen-DOM gerendert ist (draw() laeuft am Ende)
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(init, 600);
  } else {
    window.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 600); });
  }

  // Debug-Helfer
  window._eveReset = function(){
    try { localStorage.removeItem(DONE_KEY); sessionStorage.removeItem(CLOSED_KEY); } catch(e){}
    if(overlay) overlay.classList.remove('hidden');
    if(reopen) reopen.classList.remove('visible');
    render('intro');
  };
})();
