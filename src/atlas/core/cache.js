/* PROJECT ATLAS - Data cache.
   Keeps the last data from the Google Sheet and the Apps Script in
   localStorage, so ATLAS can show it immediately on the next visit and refresh
   it in the background ("stale-while-revalidate"). Only the very first visit
   has to wait for the network. */

const PREFIX = 'atlas_cache_v1:';

// Returns the cached value, or null if there is none (or storage is blocked).
export function readCache(key){
  try{
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw).data : null;
  }catch(e){ return null; }
}

// Stores a value together with the time it was saved.
export function writeCache(key, data){
  try{ localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), data: data })); }catch(e){}
}
