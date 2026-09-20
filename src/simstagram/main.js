/* PROJECT ATLAS - Simstagram: Charakter-Feed.
   Aus simstagram.html herausgeloest (Etappe 5). Die Seite hatte zwei
   script-Bloecke; sie stehen hier hintereinander in derselben Reihenfolge.
   Der Code ist unveraendert; neu ist nur, dass er als ES-Modul laeuft. Die
   Funktionen, die von Inline-Handlern aufgerufen werden, haengt
   window-bridge.js an window. */

// ╔══════════════════════════════════════════════════════════╗
//   CONFIG
//   APPSSCRIPT = URL des NEUEN, separaten Simstagram-Scripts
//                (nicht das Atlas-Script!)
//   Nach dem Deploy des neuen Scripts diese URL eintragen.
// ╚══════════════════════════════════════════════════════════╝
const _params    = new URLSearchParams(location.search);
const IS_TEST    = _params.has('test');
const IS_DEBUG   = _params.has('debug');

const XOBOR      = IS_TEST
  ? 'https://simsspielwiesetest.xobor.de'
  : 'https://simsforumrpg.de';

const BLOG_URL   = XOBOR + '/blog_new.php';
const BLOG_CAT   = '1386';

// ← HIER die URL des neuen Simstagram-Apps-Scripts eintragen:
const APPSSCRIPT     = 'https://script.google.com/macros/s/AKfycbz-lPAoQBklJ6pbvgF0qp40GE-gl4PdIYkJfFnHWA2kl07VaslLwSlFOk-LaoMB5_fJSw/exec';
const APPSSCRIPT_FEED = APPSSCRIPT + '?action=feed';

// ╔══════════════════════════════════════════════════════════╗
//   STATE
// ╚══════════════════════════════════════════════════════════╝
let posts    = [];
const PER_PAGE = 5;
let curPage  = 0; // 0-indexed
let liked    = JSON.parse(localStorage.getItem('sim_liked') || '{}');
let curPost  = null;   // currently open post in modal
let imgFile  = null;   // selected image file
let xPopup   = null;   // reference to Xobor popup window
let pwTimer  = null;   // popup-watch interval

// ╔══════════════════════════════════════════════════════════╗
//   LOAD FEED
// ╚══════════════════════════════════════════════════════════╝
//   Strategie:
//   1. localStorage-Cache vom letzten Mal sofort anzeigen (instant)
//   2. Page 1 frisch holen, rendern (~1 Sek)
//   3. Pages 2-6 parallel im Hintergrund, an posts[] anhängen, einmal re-rendern
// ╚══════════════════════════════════════════════════════════╝
export async function loadFeed(showSpinner = true) {
  const feed = $('feed');
  const TOTAL_PAGES = 6;

  // ── Phase 1: localStorage zeigen (Stale-While-Revalidate) ──
  let hadCache = false;
  try {
    const cached = localStorage.getItem('simsta_feed_cache_v1');
    if (cached) {
      const data = JSON.parse(cached);
      if (data && Array.isArray(data.posts) && data.posts.length) {
        posts = data.posts;
        curPage = 0;
        buildStories();
        buildFeed();
        checkHashRoute(); // wenn #post-XXXX → öffnen
        hadCache = true;
        showSpinner = false;
      }
    }
  } catch(_) {}

  if (showSpinner) feed.innerHTML = `<div class="status"><div class="spin"></div><span>Posts laden…</span></div>`;

  // ── Phase 2: Page 1 frisch holen ──
  let page1Posts = [];
  try {
    const res  = await fetch(APPSSCRIPT_FEED + '&page=1');
    const raw  = await res.text();
    let data;
    try { data = JSON.parse(raw); }
    catch(e) { throw new Error('Apps Script gibt kein gültiges JSON zurück.\n\nAntwort:\n' + raw.slice(0,300)); }

    page1Posts = Array.isArray(data) ? data : (data.posts || data.items || data.data || []);

    // Debug-Mode (nur bei Page 1 sinnvoll)
    if (IS_DEBUG) { showDebug(data, page1Posts); return; }

    if (!page1Posts.length && !hadCache) {
      throw new Error('Keine Posts gefunden. Das Apps Script gibt ein leeres Array zurück.');
    }

    posts = page1Posts;
    curPage = 0;
    buildStories();
    buildFeed();
    checkHashRoute();
  } catch(e) {
    if (!hadCache) {
      feed.innerHTML = `<div class="status">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
        <span style="max-width:300px">${X(e.message)}</span>
        <a href="${APPSSCRIPT}" target="_blank" style="color:var(--acc);font-size:12px">Apps Script direkt öffnen →</a>
      </div>`;
    }
    console.error('[Simstagram] Feed page 1 error:', e);
    return;
  }

  // ── Phase 3: Pages 2-6 parallel im Hintergrund ──
  const seen = new Set(posts.map(p => F(p, 'id')));
  const promises = [];
  for (let pg = 2; pg <= TOTAL_PAGES; pg++) {
    promises.push(
      fetch(APPSSCRIPT_FEED + '&page=' + pg)
        .then(r => r.json())
        .then(data => {
          const more = Array.isArray(data) ? data : (data.posts || []);
          more.forEach(p => {
            const id = F(p, 'id');
            if (id && !seen.has(id)) {
              seen.add(id);
              posts.push(p);
            }
          });
        })
        .catch(err => console.warn('[Simstagram] Page ' + pg + ':', err.message))
    );
  }
  await Promise.all(promises);

  // Einmal am Ende re-rendern — Pagination expandiert sich, aktuelle Seite bleibt sichtbar
  buildStories();
  buildFeed();

  // Cache speichern
  try { localStorage.setItem('simsta_feed_cache_v1', JSON.stringify({posts: posts, ts: Date.now()})); } catch(_) {}
}

// ╔══════════════════════════════════════════════════════════╗
//   HASH-ROUTING (#post-XXXX öffnet einen Post direkt)
// ╚══════════════════════════════════════════════════════════╝
function checkHashRoute() {
  const m = location.hash.match(/^#post-(\d+)$/);
  if (!m) return;
  const targetId = m[1];
  for (let i = 0; i < posts.length; i++) {
    const pid = F(posts[i], 'id');
    if (String(pid) === targetId) {
      openPost(i);
      return;
    }
  }
  console.warn('[Simstagram] Post mit ID ' + targetId + ' nicht im aktuellen Feed gefunden');
}
window.addEventListener('hashchange', checkHashRoute);

// ╔══════════════════════════════════════════════════════════╗
//   STORIES
// ╚══════════════════════════════════════════════════════════╝
function buildStories() {
  const seen = new Map();
  posts.forEach(p => { const n=F(p,'author'); if(!seen.has(n)) seen.set(n,p); });
  let i=0;
  $('stories').innerHTML = [...seen.entries()].map(([name,p]) => {
    const ava = F(p,'avatar');
    const cls = (i++ > 1) ? 'seen' : '';
    return `<div class="story" onclick="jumpTo(${Q(name)})">
      <div class="s-ring ${cls}">
        <div class="s-av">${ava ? `<img src="${X(ava)}" onerror="this.outerHTML='${IC(name)}'">` : IC(name)}</div>
      </div>
      <span class="s-nm">${X(name)}</span>
    </div>`;
  }).join('');
}

export function jumpTo(name) {
  const el = document.querySelector(`.card[data-a="${CSS.escape(name)}"]`);
  if (el) {
    el.scrollIntoView({behavior:'smooth',block:'start'});
    el.style.outline = '2px solid var(--acc)';
    setTimeout(() => el.style.outline = '', 1100);
  }
}

// ╔══════════════════════════════════════════════════════════╗
//   BUILD FEED
// ╚══════════════════════════════════════════════════════════╝
function buildFeed() {
  const start = curPage * PER_PAGE;
  const pagePosts = posts.slice(start, start + PER_PAGE);
  const totalPages = Math.ceil(posts.length / PER_PAGE);

  $('feed').innerHTML = pagePosts.map((p, i) => buildCard(p, start + i)).join('') + buildPager(totalPages);
}

function buildPager(totalPages) {
  if (totalPages <= 1) return '';
  const btns = [];
  for (let p = 0; p < totalPages; p++) {
    btns.push(`<button onclick="goPage(${p})" style="
      padding:8px 14px;border-radius:8px;font-size:13px;
      background:${p===curPage?'var(--acc)':'var(--s2)'};
      color:${p===curPage?'#fff':'var(--sub)'};
      border:1px solid var(--bdr);cursor:pointer;
    ">${p + 1}</button>`);
  }
  return `<div style="display:flex;gap:8px;justify-content:center;padding:20px 12px;flex-wrap:wrap">${btns.join('')}</div>`;
}

export function goPage(p) {
  curPage = p;
  buildFeed();
  document.querySelector('.scroll-area').scrollTo({top:0, behavior:'smooth'});
  // Lazy-load images for posts on this page that don't have images yet
  lazyLoadImages();
}

async function lazyLoadImages() {
  const start = curPage * PER_PAGE;
  const pagePosts = posts.slice(start, start + PER_PAGE);
  for (let i = 0; i < pagePosts.length; i++) {
    const p = pagePosts[i];
    if (F(p,'image')) continue; // already has image
    const url = F(p,'url');
    if (!url) continue;
    try {
      const r = await fetch(`${APPSSCRIPT}?action=post&url=${encodeURIComponent(url)}`);
      const d = await r.json();
      if (d.image) {
        p.image = d.image;
        // Update the card's image without full rebuild
        const card = document.querySelector(`.card[data-i="${start+i}"]`);
        if (card && !card.querySelector('.ci')) {
          const actDiv = card.querySelector('.ca');
          if (actDiv) {
            const imgDiv = document.createElement('div');
            imgDiv.className = 'ci';
            imgDiv.onclick = () => openPost(start+i);
            imgDiv.innerHTML = `<img src="${X(d.image)}" loading="lazy" alt="">`;
            card.insertBefore(imgDiv, actDiv);
          }
        }
      }
      if (d.content && !F(p,'content')) p.content = d.content;
    } catch(_) {}
  }
}

function buildCard(p, i) {
  const id    = F(p,'id') || i;
  const title = F(p,'title');
  const auth  = F(p,'author');
  const date  = F(p,'date');
  const cont  = F(p,'content');
  const img   = F(p,'image');
  const cmts  = parseInt(F(p,'comments') || 0, 10);
  const ava   = F(p,'avatar');
  const on    = !!liked[id];
  const short = cont.length > 160 ? cont.slice(0, 160) + '…' : cont;

  return `<article class="card" data-id="${X(id)}" data-a="${X(auth)}" data-i="${i}">
    <div class="ch">
      <div class="av">${ava ? `<img src="${X(ava)}" onerror="this.outerHTML='${IC(auth)}'">` : IC(auth)}</div>
      <div>
        <div class="cn">${X(auth)}</div>
        <div class="cd">${X(date)}</div>
      </div>
      <button onclick="openPost(${i})" title="Post öffnen">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    </div>

    ${img ? `<div class="ci" onclick="openPost(${i})">
      <img src="${X(img)}" loading="lazy" alt="${X(title)}"
           onerror="this.closest('.ci').style.display='none'">
    </div>` : ''}

    <div class="ca">
      <button class="lk-btn" onclick="openLikePopup(${i})" title="Gefällt mir – auf Xobor liken">
        <svg width="22" height="22" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
      <button onclick="openPost(${i})" title="Kommentare">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        ${cmts > 0 ? `<span style="font-size:13px">${cmts}</span>` : ''}
      </button>
    </div>

    <div class="cc">
      <strong>${X(title)}</strong>
      <span class="an">${X(auth)}</span><span class="ct">${X(short)}</span>
    </div>
    ${cont.length > 160 ? `<div class="cm-link" onclick="openPost(${i})">Alles anzeigen</div>` : '<div style="height:10px"></div>'}
  </article>`;
}

// ╔══════════════════════════════════════════════════════════╗
//   LIKE  –  öffnet Xobor-Post als kleines Popup zum echten Liken
// ╚══════════════════════════════════════════════════════════╝
export function openLikePopup(i) {
  const p = posts[i]; if (!p) return;
  const url = F(p,'url');
  if (!url) return;

  // Herz kurz aufleuchten lassen als visuelles Feedback
  const card = document.querySelector(`.card[data-i="${i}"]`);
  const btn  = card?.querySelector('.lk-btn');
  if (btn) {
    btn.style.color = 'var(--red)';
    btn.querySelector('svg').setAttribute('fill', 'var(--red)');
    btn.querySelector('svg').setAttribute('stroke', 'var(--red)');
    btn.style.transform = 'scale(1.4)';
    setTimeout(() => {
      btn.style.transform = '';
      // Farbe bleibt kurz, wird beim nächsten Feed-Load zurückgesetzt
    }, 300);
  }

  // Kleines Popup mit dem Xobor-Post öffnen
  openXoborPopup(url, 'like');
  showPopupWait(
    'Klick auf <strong>Gefällt mir</strong> im Xobor-Fenster.<br>Danach schließt es sich automatisch.',
    () => {
      // Nach dem Schließen: Herz rot lassen als Indikator
      if (btn) {
        btn.style.color = 'var(--red)';
        btn.querySelector('svg').setAttribute('fill', 'var(--red)');
      }
    }
  );
}

// ╔══════════════════════════════════════════════════════════╗
//   POST DETAIL MODAL
// ╚══════════════════════════════════════════════════════════╝
export async function openPost(i) {
  const p = posts[i]; if (!p) return;
  const img   = F(p,'image'), title = F(p,'title'), auth = F(p,'author');
  const date  = F(p,'date'),  cont  = F(p,'content'), ava = F(p,'avatar');
  const url   = F(p,'url');
  curPost = { p, i, url };

  const ic = $('pm-img'), ie = $('pm-img-el');
  if (img) { ic.style.display=''; ie.src=img; ie.alt=title; } else { ic.style.display='none'; }

  $('pm-av').innerHTML     = ava ? `<img src="${X(ava)}" onerror="this.outerHTML='${IC(auth)}'">` : IC(auth);
  $('pm-name').textContent = auth;
  $('pm-date').textContent = date;
  $('pm-cap').innerHTML    = `<strong>${X(title)}</strong><span class="an">${X(auth)}</span>${Xnl(cont || '')}`;
  $('pm-cmts').innerHTML   = '<span style="color:var(--dim);font-size:12px">Lade Kommentare…</span>';

  $('pm-ov').classList.add('open');
  document.body.style.overflow = 'hidden';

  if (url) {
    // Vollständigen Text nachladen wenn leer
    if (!cont) {
      fetch(`${APPSSCRIPT}?action=post&url=${encodeURIComponent(url)}`)
        .then(r => r.json())
        .then(d => {
          if (d.content) $('pm-cap').innerHTML = `<strong>${X(title)}</strong><span class="an">${X(auth)}</span>${Xnl(d.content)}`;
          if (d.image && !img) { $('pm-img-el').src = d.image; $('pm-img').style.display = ''; }
        }).catch(() => {});
    }
    fetchComments(url);
  }
}

async function fetchComments(url) {
  const div = $('pm-cmts');
  if (!url) { div.innerHTML = '<span style="color:var(--dim);font-size:12px">Kein Link verfügbar.</span>'; return; }
  try {
    // Apps Script als Proxy – fetcht Xobor serverseitig (kein CORS-Problem)
    const proxyUrl = `${APPSSCRIPT}?action=comments&url=${encodeURIComponent(url)}`;
    const r = await fetch(proxyUrl);
    const d = await r.json();

    if (d.error) throw new Error(d.error);
    if (!d.comments || !d.comments.length) {
      div.innerHTML = '<span style="color:var(--dim);font-size:12px">Noch keine Kommentare.</span>';
      return;
    }
    renderComments(d.comments, div);
  } catch(e) {
    div.innerHTML = `<span style="color:var(--dim);font-size:12px">
      Kommentare nicht geladen.
      <a href="${X(url)}#com" target="_blank" style="color:var(--acc);display:block;margin-top:4px">Auf Xobor kommentieren →</a>
    </span>`;
    console.warn('[Simstagram] Comments error:', e);
  }
}

function renderComments(cmts, div) {
  if (!cmts.length) { div.innerHTML = '<span style="color:var(--dim);font-size:12px">Noch keine Kommentare.</span>'; return; }
  div.innerHTML = cmts.map(c => {
    const ava = c.avatar
      ? `<img src="${X(c.avatar)}" onerror="this.outerHTML='${IC(c.author||'?')}'" style="width:100%;height:100%;object-fit:cover">`
      : IC(c.author||'?');
    return `<div class="cmt">
      <div class="av" style="font-size:11px;flex-shrink:0">${ava}</div>
      <div class="cmt-body">
        ${c.time ? `<span style="color:var(--dim);font-size:11px;display:block;margin-bottom:2px">${X(c.time)}</span>` : ''}${c.author ? `<span class="an">${X(c.author)}</span>` : ''}${Xnl(c.text)}
      </div>
    </div>`;
  }).join('');
}

export function refreshCmts() {
  if (curPost?.url) {
    $('pm-cmts').innerHTML = '<span style="color:var(--dim);font-size:12px">Lade…</span>';
    fetchComments(curPost.url);
  }
}

export function closePM() {
  $('pm-ov').classList.remove('open');
  document.body.style.overflow = '';
  curPost = null;
}

// ╔══════════════════════════════════════════════════════════╗
//   COMMENT via Xobor popup  –  Text vorausgefüllt via URL param
// ╚══════════════════════════════════════════════════════════╝
export function openCommentPopup() {
  if (!curPost?.url) return;
  const text = $('cmtIn').value.trim();
  const url  = curPost.url + '#com';

  // Auto-copy comment text to clipboard → user just Ctrl+V in Xobor editor
  if (text && navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => toast('📋 Kommentar kopiert — Ctrl+V im Fenster einfügen', 'ok'))
      .catch(() => {});
  }

  // Open popup positioned beside our UI (not on top)
  const w = 540, h = 480;
  const left = Math.min(screen.width - w - 10, window.screenX + window.outerWidth + 10);
  const top  = Math.max(10, window.screenY + 80);
  xPopup = window.open(url, 'xobor-comment',
    `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);

  // No blocking overlay — just watch for popup close
  clearInterval(pwTimer);
  pwTimer = setInterval(() => {
    if (!xPopup || xPopup.closed) {
      clearInterval(pwTimer);
      xPopup = null;
      $('cmtIn').value = '';
      autoH($('cmtIn'));
      setTimeout(() => refreshCmts(), 800);
      toast('Kommentare aktualisiert ✓', 'ok');
    }
  }, 1000);
}

// ╔══════════════════════════════════════════════════════════╗
//   COMPOSE
// ╚══════════════════════════════════════════════════════════╝
export function openCompose() {
  $('co-ov').classList.add('open');
  document.body.style.overflow = 'hidden';
}
export function closeCompose() {
  $('co-ov').classList.remove('open');
  document.body.style.overflow = '';
}

function onFileSelect(e) {} // legacy stub — compose modal no longer has file upload
function onDrop(e) { e.preventDefault(); }
function previewImg(file) {} // legacy stub
function clearImg() {} // legacy stub

// ╔══════════════════════════════════════════════════════════╗
//   GO TO FORUM POST → öffnet Xobor-Popup zum Posten
// ╚══════════════════════════════════════════════════════════╝
export function goToForumPost() {
  closeCompose();
  const blogUrl = XOBOR + '/blog_new.php';
  openXoborPopup(blogUrl, 'neuer-post');

  showPopupWait(
    `📝 <strong>Im Forum-Editor:</strong><br>
     1. Bild hochladen (📎 Datei anhängen)<br>
     2. Titel + Caption eintragen<br>
     3. Kategorie <strong>„Simstagram"</strong> wählen<br>
     4. <strong>Jetzt veröffentlichen</strong> klicken<br><br>
     <em style="color:var(--dim);font-size:11px">Siehst du Simstagram nicht im Dropdown? Du bist im falschen Account — Fenster schliessen, Account wechseln, neu versuchen.</em>`,
    () => {
      setTimeout(() => loadFeed(true), 1500);
      toast('Feed wird aktualisiert…', 'ok');
    }
  );
}

// ╔══════════════════════════════════════════════════════════╗
//   XOBOR POPUP MANAGEMENT
// ╚══════════════════════════════════════════════════════════╝
function openXoborPopup(url, name) {
  // Size & position: centered, 680×720
  const w = 680, h = 720;
  const left = Math.max(0, (screen.width  - w) / 2);
  const top  = Math.max(0, (screen.height - h) / 2);
  xPopup = window.open(url, `xobor-${name}`,
    `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
}

function showPopupWait(message, onClose) {
  const pw = $('pw');
  $('pw-txt').innerHTML = message;
  pw.classList.add('open');

  // Poll for popup closed
  clearInterval(pwTimer);
  pwTimer = setInterval(() => {
    if (!xPopup || xPopup.closed) {
      clearInterval(pwTimer);
      pw.classList.remove('open');
      xPopup = null;
      if (onClose) onClose();
    }
  }, 800);
}

export function cancelPopupWait() {
  clearInterval(pwTimer);
  $('pw').classList.remove('open');
  if (xPopup && !xPopup.closed) xPopup.close();
  xPopup = null;
}

// ╔══════════════════════════════════════════════════════════╗
//   UTILS
// ╚══════════════════════════════════════════════════════════╝

// Flexible field getter – handles different Apps Script naming conventions
const ALIASES = {
  id:       ['id','blogId','blog_id','postId','post_id','nr','entryId'],
  title:    ['title','subject','betreff','headline','name'],
  author:   ['author','user','username','autor','by','name'],
  date:     ['date','created','datum','time','timestamp','created_at','posted'],
  content:  ['content','text','body','message','summary','excerpt','inhalt','teaser','description'],
  image:    ['image','img','imageUrl','image_url','thumbnail','photo','bild','src','picture','cover'],
  avatar:   ['avatar','avatarUrl','avatar_url','profilePic','profile_pic','userAvatar','authorAvatar'],
  url:      ['url','link','href','postUrl','post_url','blogUrl','blog_url','permalink'],
  comments: ['comments','commentCount','comment_count','kommentare','replies','numComments'],
};
function F(obj, field) {
  for (const k of (ALIASES[field] || [field])) {
    if (obj[k] != null && obj[k] !== '') return String(obj[k]);
  }
  return '';
}

const EMOJIS = ['🌸','🎮','✨','🦋','🌙','🌻','⚡','🎀','🌊','🎭','🍀','💫','🦄','🌈','⭐','🎪'];
function IC(name) {
  const idx = [...(name||'')].reduce((a,c) => a + c.charCodeAt(0), 0) % EMOJIS.length;
  return `<span style='font-size:17px'>${EMOJIS[idx]}</span>`;
}
function X(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// Like X() but also converts \n → <br> for multi-line text display
function Xnl(s) {
  return X(s).replace(/\n/g,'<br>');
}
function Q(s) { return JSON.stringify(s); }
function $(id) { return document.getElementById(id); }

let _tt;
function toast(msg, type = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('show'), 3000);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePM(); closeCompose(); cancelPopupWait(); }
});

// ╔══════════════════════════════════════════════════════════╗
//   DEBUG MODE  –  zeigt was das Apps Script zurückgibt
// ╚══════════════════════════════════════════════════════════╝
function showDebug(rawData, parsedPosts) {
  const panel = $('debug-panel');
  const content = $('debug-content');
  panel.style.display = 'block';

  const firstPost = parsedPosts[0] || rawData;
  const keys = firstPost ? Object.keys(firstPost) : [];

  // Check which fields we can find
  const checks = {
    title:    ['title','subject','betreff','headline','name'],
    author:   ['author','user','username','autor','by'],
    date:     ['date','created','datum','time','timestamp'],
    content:  ['content','text','body','message','summary','excerpt','inhalt','teaser'],
    image:    ['image','img','imageUrl','image_url','thumbnail','photo','bild','src','picture'],
    avatar:   ['avatar','avatarUrl','avatar_url','profilePic','userAvatar','authorAvatar'],
    url:      ['url','link','href','postUrl','blogUrl'],
    comments: ['comments','commentCount','comment_count','kommentare','replies'],
  };

  let report = `<h3>📊 Apps Script gibt ${parsedPosts.length} Posts zurück</h3>`;

  if (firstPost) {
    report += `<h3>🔑 Felder im ersten Post-Objekt:</h3><pre>`;
    keys.forEach(k => {
      const val = String(firstPost[k] ?? '').slice(0, 80);
      report += `  "${k}": "${val}"\n`;
    });
    report += `</pre>`;

    report += `<h3>🔍 Feld-Mapping Analyse:</h3><pre>`;
    for (const [field, aliases] of Object.entries(checks)) {
      const found = aliases.find(a => firstPost[a] != null && firstPost[a] !== '');
      if (found) {
        const val = String(firstPost[found]).slice(0, 60);
        report += `<span class="field-ok">  ✓ ${field.padEnd(10)} → "${found}" = "${val}"</span>\n`;
      } else {
        report += `<span class="field-miss">  ✗ ${field.padEnd(10)} → NICHT GEFUNDEN (gesucht: ${aliases.join(', ')})</span>\n`;
      }
    }
    report += `</pre>`;
  }

  report += `<h3>📦 Rohe JSON-Daten (erste 3 Posts):</h3>`;
  report += `<pre>${X(JSON.stringify(parsedPosts.slice(0,3), null, 2))}</pre>`;

  report += `<h3>💡 Was du tun musst:</h3>
  <p style="color:#ccc;line-height:1.7;margin-top:8px">
    1. Schau dir die Felder oben an<br>
    2. Welches Feld ist der <strong style="color:#ff0">Bild-URL</strong>? → Sag mir den Feldnamen<br>
    3. Welches Feld ist der <strong style="color:#ff0">Text/Caption</strong>? → Sag mir den Feldnamen<br>
    4. Welches Feld ist der <strong style="color:#ff0">Link zum Post</strong>? → Sag mir den Feldnamen<br>
    Dann passe ich das Mapping an.
  </p>`;

  content.innerHTML = report;

  // Also build normal feed behind debug panel
  if (parsedPosts.length) { buildStories(); buildFeed(); }
}

// ╔══════════════════════════════════════════════════════════╗
//   INIT
// ╚══════════════════════════════════════════════════════════╝

// Show which domain is active (for debugging)
if (IS_TEST) console.info('[Simstagram] TEST-Modus → ' + XOBOR);
else         console.info('[Simstagram] Produktion → ' + XOBOR);

loadFeed();

/* --- zweiter script-Block aus simstagram.html, Reihenfolge unveraendert --- */

(function(){
  var CLOSED_KEY = 'melissa_simstagram_closed';
  var STEP_KEY   = 'melissa_simstagram_step';

  var IMGS = [
    'https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1221_oNfArVhw.png',
    'https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1222_TQRmwSNz.png',
    'https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1224_wmIihCEL.png',
    'https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1225_cPMmylzs.png',
    'https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1226_xUeFjDEh.png'
  ];

  var STEPS = [
    {
      img: 0,
      text: 'Hi! Ich bin <strong>Melissa</strong> &#128247; Darf ich dir kurz erkl&auml;ren wie das hier l&auml;uft? Ist nicht ganz wie das Insta das du kennst.',
      btns: [
        { label: '&#128522; Ja gerne', act: 'next', cls: 'primary' },
        { label: 'Lieber nicht', act: 'close', cls: 'ghost' }
      ]
    },
    {
      img: 1,
      text: 'Willkommen auf Simstagram &mdash; das Instagram von uns Sims! Hier posten die Charaktere aus dem #SimsForumRPG Bilder aus ihrem Leben, kommentieren sich gegenseitig und liken Posts. Alles bleibt <strong>in der Story</strong> &mdash; also nicht ihr Spieler postet hier, sondern wir Sims selbst.',
      btns: [
        { label: 'Weiter &#8594;', act: 'next', cls: 'primary' },
        { label: 'Schliessen', act: 'close', cls: 'ghost' }
      ]
    },
    {
      img: 2,
      text: 'Du kannst hier alles <strong>lesen ohne Login</strong> &mdash; wie auf jedem normalen Insta-Account. Likes, Posts, Kommentare anschauen, alles offen. <strong>Posten und kommentieren</strong> geht nur wenn du im Forum eingeloggt bist als dein Charakter.',
      btns: [
        { label: 'Weiter &#8594;', act: 'next', cls: 'primary' },
        { label: 'Schliessen', act: 'close', cls: 'ghost' }
      ]
    },
    {
      img: 3,
      text: 'Auf Insta hast du einen Account, hier hast du <strong>so viele wie Charaktere</strong>. Daf&uuml;r gibt\'s den Account-Switcher &#128071; Erkl&auml;rung wie du als Charakter postest:',
      link: { url: 'https://www.simsforumrpg.de/t712f58855-Simstagram-fuers-Forum.html#msg6952', label: '&#8594; Anleitung im Forum', ext: true },
      btns: [
        { label: 'Weiter &#8594;', act: 'next', cls: 'primary' },
        { label: 'Schliessen', act: 'close', cls: 'ghost' }
      ]
    },
    {
      img: 4,
      text: 'Wenn du auf <strong>"Kommentieren"</strong> oder <strong>"Posten"</strong> klickst, &ouml;ffnet sich ein <strong>neues Forum-Fenster</strong>. Das ist Absicht &mdash; die Kommentare landen direkt im Forum, damit alles archiviert wird. Du kannst das Fenster nach dem Posten wieder schliessen, dein Beitrag erscheint dann automatisch hier auf Simstagram.',
      btns: [
        { label: 'Weiter &#8594;', act: 'next', cls: 'primary' },
        { label: 'Schliessen', act: 'close', cls: 'ghost' }
      ]
    },
    {
      img: 0,
      text: 'Falls du irgendwo h&auml;ngen bleibst oder Fragen hast &mdash; meld dich einfach auf unserem <strong>Discord</strong>! Dort sind die Spieler hinter den Sims unterwegs und helfen dir gern weiter.',
      link: { url: 'https://www.simsforumrpg.de/page-855163-1.html', label: '&#128172; Zum Discord', ext: true },
      btns: [
        { label: 'Weiter &#8594;', act: 'next', cls: 'primary' },
        { label: 'Schliessen', act: 'close', cls: 'ghost' }
      ]
    },
    {
      img: 1,
      text: 'Wenn du diesen Guide nochmal sehen willst &mdash; klick einfach auf den <strong>Hilfe-Button</strong> unten rechts &#127800;',
      btns: [
        { label: 'Los geht\'s!', act: 'close', cls: 'primary' }
      ]
    }
  ];

  var overlay   = document.getElementById('melissa-overlay');
  var bubble    = document.getElementById('melissa-bubble');
  var fig       = document.getElementById('melissa-fig');
  var imgEl     = document.getElementById('melissa-img');
  var textEl    = document.getElementById('melissa-text');
  var btnsEl    = document.getElementById('melissa-btns');
  var dotsEl    = document.getElementById('melissa-dots');
  var reopenBtn = document.getElementById('melissa-reopen');

  var curStep = 0;

  function hasClosed() {
    try { return localStorage.getItem(CLOSED_KEY) === '1'; } catch(e) { return false; }
  }
  function markClosed() {
    try { localStorage.setItem(CLOSED_KEY, '1'); } catch(e) {}
  }
  function clearClosed() {
    try { localStorage.removeItem(CLOSED_KEY); } catch(e) {}
  }
  function saveStep(s) {
    try { localStorage.setItem(STEP_KEY, String(s)); } catch(e) {}
  }
  function getSavedStep() {
    try { return parseInt(localStorage.getItem(STEP_KEY)); } catch(e) { return NaN; }
  }
  function clearStep() {
    try { localStorage.removeItem(STEP_KEY); } catch(e) {}
  }

  function pop() {
    bubble.classList.remove('pop');
    void bubble.offsetWidth;
    bubble.classList.add('pop');
    bubble.addEventListener('animationend', function() { bubble.classList.remove('pop'); }, {once:true});
  }

  function render(stepIdx) {
    if (stepIdx < 0 || stepIdx >= STEPS.length) { closeGuide(); return; }
    curStep = stepIdx;
    saveStep(stepIdx);

    var s = STEPS[stepIdx];
    var imgIdx = (s.img !== undefined) ? s.img : 0;
    if (imgIdx >= IMGS.length) imgIdx = IMGS.length - 1;
    imgEl.src = IMGS[imgIdx];
    var miniPortrait = document.getElementById('melissa-mini-portrait');
    if (miniPortrait) miniPortrait.src = IMGS[imgIdx];

    var html = '<p style="margin:0 0 6px">' + s.text + '</p>';
    if (s.link) {
      var t = s.link.ext ? ' target="_blank" rel="noopener"' : '';
      html += '<a href="' + s.link.url + '"' + t + '>' + s.link.label + '</a>';
    }
    textEl.innerHTML = html;

    // Dots
    dotsEl.innerHTML = '';
    for (var d = 0; d < STEPS.length; d++) {
      var dot = document.createElement('div');
      dot.className = 'md-dot' + (d === stepIdx ? ' on' : '');
      dotsEl.appendChild(dot);
    }

    // Buttons
    btnsEl.innerHTML = '';
    if (stepIdx > 0) {
      var back = document.createElement('button');
      back.className = 'mb-btn ghost';
      back.innerHTML = '&#8592;';
      back.style.padding = '7px 12px';
      back.onclick = function() { render(curStep - 1); };
      btnsEl.appendChild(back);
    }
    for (var b = 0; b < s.btns.length; b++) {
      (function(btn) {
        var el = document.createElement('button');
        el.className = 'mb-btn ' + (btn.cls || 'primary');
        el.innerHTML = btn.label;
        el.onclick = function() { handleAct(btn.act); };
        btnsEl.appendChild(el);
      })(s.btns[b]);
    }

    pop();
  }

  function handleAct(a) {
    if (a === 'next') {
      if (curStep + 1 >= STEPS.length) { closeGuide(); return; }
      render(curStep + 1);
    } else {
      closeGuide();
    }
  }

  function closeGuide() {
    markClosed();
    clearStep();
    overlay.classList.add('hidden');
    reopenBtn.classList.add('visible');
  }

  function openGuide() {
    clearClosed();
    overlay.classList.remove('hidden');
    reopenBtn.classList.remove('visible');
    fig.classList.remove('enter');
    void fig.offsetWidth;
    fig.classList.add('enter');
    fig.addEventListener('animationend', function() { fig.classList.remove('enter'); }, {once:true});
    render(0);
  }

  function init() {
    if (!document.body) return;
    reopenBtn.onclick = openGuide;
    document.getElementById('melissa-close').onclick = closeGuide;

    if (hasClosed()) {
      // Schon mal weggeklickt → nur Reopen-Button zeigen
      reopenBtn.classList.add('visible');
    } else {
      // Erstes Mal → Auto-Start
      setTimeout(openGuide, 1200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  // Manuelles Öffnen für Testing
  window.previewMelissa = function() {
    clearClosed();
    openGuide();
  };
})();
