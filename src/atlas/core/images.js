/* PROJECT ATLAS - Image sizes.
   Xobor serves resized copies of every uploaded image: the size is part of the
   address (.../resize/1920x1200/<file>). Most images in ATLAS are shown much
   smaller than 1920 px — tokens, sidebar portraits, hover cards, tooltips — so
   they are requested in a matching size. Big views (continent map, world and
   building backgrounds) keep the full size because they can be zoomed.

   The width is doubled or tripled compared to the size on screen, so images
   stay sharp on high-resolution displays. "x9999" keeps the aspect ratio and
   limits only the width, so portraits are not cut down to a landscape box.

   This file must not import anything (see core/events.js for the reason). */

export const IMG_THUMB = 96;   // tokens, sidebar portraits, avatars (18–32 px on screen)
export const IMG_CARD  = 400;  // hover cards, tooltips, character cards (≤ 200 px)
export const IMG_TILE  = 640;  // "Andere Welten" tiles (≈ 300 px)

// Returns the address of a smaller copy. Addresses without a Xobor size
// segment are returned unchanged.
export function imageUrl(url, width){
  if(!url || typeof url !== 'string') return url;
  return url.replace(/\/resize\/\d+x\d+\//, '/resize/' + width + 'x9999/');
}
