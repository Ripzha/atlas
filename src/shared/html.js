/* PROJECT ATLAS - HTML helpers shared by the forum scripts and the map.
   Text from the sheet is written into markup in several places; it is escaped
   here so the same rules apply everywhere. */

/* Escapes text for use in markup, attribute values included. */
export function escapeHtml(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
