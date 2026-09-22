/* PROJECT ATLAS - Reading the current forum page.
   Small helpers for Xobor pages: who is logged in, which thread and post this
   is, and which pictures a post contains. */

// Forum id of the current page ("51782"), or null.
export function forumId(url = location.href){
  return (url.match(/f(\d+)/) || [])[1] || null;
}

// Thread id of the current page ("900" in /t900f51782-…), or null.
export function threadId(url = location.href){
  return (url.match(/\/t(\d+)f/) || [])[1] || null;
}

// Name of the logged-in user: the first link to a user profile (/u123_Name.html)
// on the page is the user's own profile link in the navigation.
export function loggedInUser(){
  for(const a of document.querySelectorAll('a[href]')){
    const m = a.href.match(/\/u(\d+)_([A-Za-z0-9_]+)\.html/);
    if(m) return m[2];
  }
  return null;
}

// Numbers of all posts on the page (from the msg anchors).
export function postNumbersOnPage(){
  return [...document.querySelectorAll('a[name], [id^="msg"]')]
    .map(el => parseInt((el.name || el.id || '').replace('msg', ''), 10))
    .filter(Boolean);
}

// True if a post header on the page says it was written just now.
export function hasFreshPostTime(pattern){
  return [...document.querySelectorAll('span.float-right, span.nobreak, .card-header span')]
    .some(el => pattern.test(el.textContent.trim()));
}

// Pictures in the first post of the page (without smileys, avatars, signatures).
export function firstPostImages(){
  const post = document.querySelector('[id^="post_"], [id^="xquoteable_p_"], .xquoteable, .post-content');
  if(!post) return [];
  const result = [];
  post.querySelectorAll('img').forEach(img => {
    const src = img.src || img.getAttribute('src') || '';
    if(!src || /smile|emoticon|emoji|avatar|signature/i.test(src)) return;
    if(!result.includes(src)) result.push(src);
  });
  return result;
}

// Address without "#…", always https (the forum can switch between http and
// https, the sheet stores https).
export function cleanPageUrl(url = location.href){
  return url.split('#')[0].replace(/^http:\/\//, 'https://');
}

// Copies text to the clipboard; falls back to a hidden text field when the
// Clipboard API is missing or refuses. Resolves true on success.
export function copyText(text){
  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch(e){ return false; }
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text).then(() => true, () => fallback());
  }
  return Promise.resolve(fallback());
}

// Escapes text for use inside HTML.
/* Kept here so the existing imports in src/forum/ keep working; the function
   itself lives in src/shared/html.js, because the map needs it too. */
export { escapeHtml } from '../shared/html.js?v=202609221331';
