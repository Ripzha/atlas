/* PROJECT ATLAS - Metaverse: blog for interviews and OOC.
   Split out of metaverse.html (stage 5). The code is unchanged; it only runs
   as an ES module now. window-bridge.js attaches the functions that inline
   handlers in the markup call to window. */

const APPSSCRIPT = 'https://script.google.com/macros/s/AKfycbxqLQvuPPdcu4zoLakqtRzKjx7Z2FUf69lwqhzmvoiKuIXMCtXVZHCGfKGFkVLW2JScOw/exec';
const XOBOR = 'https://www.simsforumrpg.de';

// Fallback — wird durch Script-Daten überschrieben
let SERIES_CONFIG = [
  {id:'hinter-den-pixeln',    label:'Hinter den Pixeln',     desc:'Comics und Einblicke hinter die Kulissen.',                 icon:'◈', slideshow:true},
  {id:'interview-mit',        label:'Interview mit…',        desc:'Persönliche Gespräche mit Spielern der Community.',         icon:'◎'},
  {id:'wir-sprechen-klartext',label:'Wir sprechen Klartext', desc:'Offene Gespräche hinter den Kulissen.',                     icon:'◉'},
  {id:'nael-spatz',           label:'Nael & Spatz',          desc:'Die Enthüllungs-Serie — Nael und Spatz decken auf.',        icon:'◇'},
  {id:'simswelt-news-alt',    label:'SimsWelt News (Archiv)',desc:'Das Archiv der alten SimsWelt-News.',                       icon:'·'},
];

let allPosts=[], curPost=null, slideIdx=0, slideImages=[], xPopup=null, pwTimer=null;

// ── LOAD ──
export async function loadFeed(spinner=true) {
  if(spinner){$('series-grid').innerHTML='<div class="status" style="grid-column:1/-1"><div class="spin"></div></div>';$('latest-list').innerHTML='';}
  try {
    try {
      const sr=await fetch(APPSSCRIPT+'?action=series');
      const sd=await sr.json();
      if(Array.isArray(sd)&&sd.length&&sd[0].id&&sd[0].label) SERIES_CONFIG=sd;
    } catch(_){}

    const feedRes=await fetch(APPSSCRIPT+'?action=feed');
    const feedRaw=await feedRes.text();
    let data;
    try{data=JSON.parse(feedRaw);}catch(e){throw new Error('Kein gültiges JSON: '+feedRaw.slice(0,100));}
    if(data&&data.error) throw new Error('Script-Fehler: '+data.error);
    allPosts=Array.isArray(data)?data:(data.posts||data.items||[]);
    if(!allPosts.length) throw new Error('Keine Posts gefunden.');
    buildHome();
  } catch(e) {
    $('series-grid').innerHTML=`<div class="status" style="grid-column:1/-1"><span style="max-width:340px;font-size:13px">${X(e.message)}</span><a href="${XOBOR}/blog-c1375-Metaverse.html" target="_blank" style="color:var(--acc);font-size:12px">Direkt im Forum →</a></div>`;
  }
}

// ── HOME ──
function buildHome() {
  // Serie-Kacheln
  const cards = SERIES_CONFIG.map(s => {
    const posts = allPosts.filter(p => p.series===s.id);
    if(!posts.length) return '';
    const coverImg = posts.find(p=>G(p,'image'))?.image||'';
    return `<div class="series-card" data-series="${s.id}" onclick="showSeries('${s.id}')">
      ${coverImg?`<div class="sc-bg" style="background-image:url('${X(coverImg)}')"></div>`:''}
      <div class="sc-overlay"></div>
      <div class="sc-body">
        <span class="sc-icon">${s.icon||'◇'}</span>
        <div>
          <div class="sc-label">Serie · ${posts.length} Posts</div>
          <div class="sc-title">${s.label}</div>
          ${s.desc?`<div class="sc-desc">${s.desc}</div>`:''}
          <div class="sc-foot"><span class="sc-count"></span><span class="sc-arrow">→</span></div>
        </div>
      </div>
    </div>`;
  }).join('');

  const misc=allPosts.filter(p=>!p.series);
  const miscCard=misc.length?`<div class="series-card" data-series="__misc__" onclick="showSeries('__misc__')">
    <div class="sc-overlay"></div>
    <div class="sc-body">
      <span class="sc-icon">·</span>
      <div>
        <div class="sc-label">Sonstiges · ${misc.length} Posts</div>
        <div class="sc-title">Weitere Beiträge</div>
        <div class="sc-desc">Einzelne Posts ausserhalb der grossen Serien.</div>
        <div class="sc-foot"><span></span><span class="sc-arrow">→</span></div>
      </div>
    </div>
  </div>`:'';
  $('series-grid').innerHTML=cards+miscCard;

  // Neueste Posts — 12 im Grid
  const latest=allPosts.slice(0,12);
  $('latest-list').innerHTML=latest.map((p,i)=>{
    const s=SERIES_CONFIG.find(s=>s.id===p.series);
    const isSlide=s?.slideshow;
    const ava=G(p,'avatar'),auth=G(p,'author'),date=G(p,'date'),title=G(p,'title');
    return `<div class="latest-item" onclick="openPost(${i})">
      <div class="li-series">${s?s.label:'—'}</div>
      <div class="li-title">${X(title)}</div>
      <div class="li-meta">
        <div class="li-av">${ava?`<img src="${X(ava)}" onerror="this.outerHTML='${IC(auth)}'">`:IC(auth)}</div>
        <span class="li-author">${X(auth)}</span>
        ${date?`<span class="li-dot">·</span><span class="li-date">${X(date)}`:''}
        ${isSlide?'<span class="li-badge">Comic</span>':''}
      </div>
    </div>`;
  }).join('');
}

// ── SERIES VIEW ──
export function showSeries(id) {
  const isMisc=id==='__misc__';
  const cfg=SERIES_CONFIG.find(s=>s.id===id);
  const posts=isMisc?allPosts.filter(p=>!p.series):allPosts.filter(p=>p.series===id);
  $('sv-eye').textContent='Serie';
  $('sv-title').textContent=isMisc?'Weitere Beiträge':(cfg?.label||id);
  $('sv-desc').textContent=isMisc?'Einzelne Posts ausserhalb der grossen Serien.':(cfg?.desc||'');
  $('post-list').innerHTML=posts.map(p=>{
    const idx=allPosts.indexOf(p);
    const title=G(p,'title'),author=G(p,'author'),date=G(p,'date');
    const exc=G(p,'content'),img=G(p,'image'),ava=G(p,'avatar');
    const short=exc.length>130?exc.slice(0,130)+'…':exc;
    const isSlide=cfg?.slideshow;
    return `<div class="post-row" onclick="openPost(${idx})">
      <div>
        ${isSlide?'<span class="pr-series-badge">Comic</span>':''}
        <div class="pr-title">${X(title)}</div>
        ${exc?`<div class="pr-excerpt">${X(short)}</div>`:''}
        <div class="pr-meta">
          <div class="pr-av">${ava?`<img src="${X(ava)}" onerror="this.outerHTML='${IC(author)}'">`:IC(author)}</div>
          <span class="pr-author">${X(author)}</span>
          ${date?`<span class="pr-date">· ${X(date)}</span>`:''}
        </div>
      </div>
      ${img?`<div class="pr-thumb"><img src="${X(img)}" loading="lazy" onerror="this.closest('.pr-thumb').style.display='none'" alt=""></div>`:''}
    </div>`;
  }).join('');
  $('view-home').style.display='none';
  $('view-series').style.display='block';
  window.scrollTo({top:0,behavior:'smooth'});
}

export function showHome(){$('view-series').style.display='none';$('view-home').style.display='block';window.scrollTo({top:0,behavior:'smooth'});}

// ── POST MODAL ──
export async function openPost(idx) {
  const p=allPosts[idx]; if(!p) return;
  curPost={p,idx,url:G(p,'url')};
  const title=G(p,'title'),auth=G(p,'author'),date=G(p,'date'),ava=G(p,'avatar'),img=G(p,'image'),cont=G(p,'content'),url=G(p,'url');
  const s=SERIES_CONFIG.find(s=>s.id===p.series);
  const isSlideshow=s?.slideshow===true;

  $('pm-series-tag').textContent=s?s.label:'';
  $('pm-forum-link').href=url||'#';
  $('pm-title').textContent=title;
  $('pm-av').innerHTML=ava?`<img src="${X(ava)}" onerror="this.outerHTML='${IC(auth)}'">`:IC(auth);
  $('pm-author').textContent=auth;
  $('pm-date').textContent=date;
  $('pm-cmts').innerHTML='<span style="color:var(--dim);font-size:12px">Lade Kommentare…</span>';

  if(img&&!isSlideshow){$('pm-cover').style.display='';$('pm-cover-img').src=img;}
  else $('pm-cover').style.display='none';

  if(isSlideshow&&p.images?.length){buildSlideshow(p.images);$('pm-slideshow').style.display='';}
  else $('pm-slideshow').style.display='none';
  renderContent(cont,isSlideshow?[]:(p.images||[]));

  $('pm-ov').classList.add('open');
  document.body.style.overflow='hidden';

  if(url){
    fetch(`${APPSSCRIPT}?action=post&url=${encodeURIComponent(url)}`).then(r=>r.json()).then(d=>{
      if(isSlideshow&&d.images?.length){buildSlideshow(d.images);$('pm-slideshow').style.display='';}
      renderContent(d.content||cont,isSlideshow?[]:(d.images||[]));
      if(d.image&&!isSlideshow){$('pm-cover-img').src=d.image;$('pm-cover').style.display='';}
    }).catch(()=>{});
    fetchComments(url);
  }
}

function renderContent(text,images){
  if(!text){$('pm-content').innerHTML='';return;}
  let idx=0;
  const parts=text.split('\n[IMG]\n');
  let html='';
  parts.forEach((part,i)=>{
    if(part.trim()) html+=`<p>${X(part).replace(/\n/g,'<br>')}</p>`;
    if(i<parts.length-1&&images[idx]){
      html+=`<div class="inline-img"><img src="${X(images[idx])}" loading="lazy" alt=""></div>`;
      idx++;
    }
  });
  $('pm-content').innerHTML=html;
}

// ── SLIDESHOW ──
let slideZoomed=false;
function buildSlideshow(imgs){slideImages=imgs;slideIdx=0;slideZoomed=false;updateSlide();}
function updateSlide(){
  $('slide-img').src=slideImages[slideIdx]||'';
  $('slide-counter').textContent=`${slideIdx+1} / ${slideImages.length}`;
  $('slide-prev').disabled=slideIdx===0;
  $('slide-next').disabled=slideIdx===slideImages.length-1;
  if(slideZoomed){$('slide-wrap').classList.add('zoomed');}else{$('slide-wrap').classList.remove('zoomed');}
}
export function slideNav(dir){slideIdx=Math.max(0,Math.min(slideImages.length-1,slideIdx+dir));slideZoomed=false;updateSlide();}
export function toggleZoom(){slideZoomed=!slideZoomed;$('slide-wrap').classList.toggle('zoomed',slideZoomed);}

export function closePM(){$('pm-ov').classList.remove('open');document.body.style.overflow='';curPost=null;slideImages=[];}

// ── KOMMENTARE ──
async function fetchComments(url){
  const div=$('pm-cmts');
  try{
    const r=await fetch(`${APPSSCRIPT}?action=comments&url=${encodeURIComponent(url)}`);
    const d=await r.json();
    if(!d.comments?.length){div.innerHTML='<span style="color:var(--dim);font-size:12px">Noch keine Kommentare.</span>';return;}
    div.innerHTML=d.comments.map(c=>{
      const av=c.avatar?`<img src="${X(c.avatar)}" onerror="this.outerHTML='${IC(c.author||'?')}'" style="width:100%;height:100%;object-fit:cover">`:IC(c.author||'?');
      return `<div class="cmt"><div class="cmt-av">${av}</div><div class="cmt-body">${c.time?`<span class="cmt-time">${X(c.time)}</span>`:''}<span class="cmt-author">${X(c.author)}</span><span class="cmt-text">${X(c.text)}</span></div></div>`;
    }).join('');
  }catch(e){
    div.innerHTML=`<span style="color:var(--dim);font-size:12px">Kommentare nicht geladen. <a href="${X(url)}#com" target="_blank" style="color:var(--acc)">Auf Xobor →</a></span>`;
  }
}
export function refreshCmts(){if(curPost?.url){$('pm-cmts').innerHTML='<span style="color:var(--dim);font-size:12px">Lade…</span>';fetchComments(curPost.url);}}

export function openCommentPopup(){
  if(!curPost?.url)return;
  const text=$('cmtIn').value.trim();
  if(text&&navigator.clipboard)navigator.clipboard.writeText(text).then(()=>toast('📋 Kommentar kopiert — Ctrl+V im Fenster','ok')).catch(()=>{});
  const w=560,h=500,left=Math.min(screen.width-w-10,window.screenX+window.outerWidth+10),top=Math.max(10,window.screenY+80);
  xPopup=window.open(curPost.url+'#com','xobor-comment',`width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
  clearInterval(pwTimer);
  pwTimer=setInterval(()=>{if(!xPopup||xPopup.closed){clearInterval(pwTimer);xPopup=null;$('cmtIn').value='';autoH($('cmtIn'));setTimeout(()=>refreshCmts(),800);toast('Kommentare aktualisiert ✓','ok');}},900);
}
export function cancelPopupWait(){clearInterval(pwTimer);$('pw').classList.remove('open');if(xPopup&&!xPopup.closed)xPopup.close();xPopup=null;}

// ── UTILS ──
const ALIASES={title:['title','subject'],author:['author','user','username','autor'],date:['date','created','datum','time'],content:['content','text','body','message','summary','excerpt','inhalt'],image:['image','img','imageUrl','image_url','thumbnail','bild'],avatar:['avatar','avatarUrl','avatar_url','profilePic','userAvatar'],url:['url','link','href','postUrl','blogUrl'],comments:['comments','commentCount']};
function G(obj,field){for(const k of(ALIASES[field]||[field])){if(obj[k]!=null&&obj[k]!=='')return String(obj[k]);}return '';}
const EMO=['🌙','✨','🌊','🎮','🦋','🌸','⚡','🎭','🍀','💫','🦄','🌈','⭐','🎪','🌻','🔮'];
function IC(name){const i=[...(name||'')].reduce((a,c)=>a+c.charCodeAt(0),0)%EMO.length;return `<span style="font-size:11px">${EMO[i]}</span>`;}
function X(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function $(id){return document.getElementById(id);}
export function autoH(el){el.style.height='auto';el.style.height=el.scrollHeight+'px';}
let _tt;
function toast(msg,type=''){const el=$('toast');el.textContent=msg;el.className='toast show '+type;clearTimeout(_tt);_tt=setTimeout(()=>el.classList.remove('show'),2800);}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePM();}});
document.addEventListener('keydown',e=>{
  if(!$('pm-ov').classList.contains('open')||!slideImages.length) return;
  if(e.key==='ArrowRight')slideNav(1);
  if(e.key==='ArrowLeft')slideNav(-1);
});

export function openNewPost() {
  const w=720,h=680;
  const left=Math.max(0,(screen.width-w)/2);
  const top=Math.max(0,(screen.height-h)/2);
  xPopup=window.open(
    XOBOR+'/blog_new.php',
    'metaverse-new-post',
    `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );
  // Nach Schliessen Feed neu laden
  clearInterval(pwTimer);
  pwTimer=setInterval(()=>{
    if(!xPopup||xPopup.closed){
      clearInterval(pwTimer);xPopup=null;
      setTimeout(()=>loadFeed(false),1200);
      toast('Feed wird aktualisiert…');
    }
  },900);
}

export function toggleInfo(){$('info-pop').classList.toggle('open');}
document.addEventListener('click',e=>{
  const pop=$('info-pop');
  if(pop?.classList.contains('open')&&!e.target.closest('.info-wrap')) pop.classList.remove('open');
});

loadFeed();
