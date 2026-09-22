/* PROJECT ATLAS - Occult lore: which chapter is shown where.

   The lore document has two kinds of chapters:
   - chapters about beings: shown on the wheel, each with a colour and an icon
   - chapters of general knowledge: shown as the "Bibliothek" below the wheel

   `chapter` is the chapter number in the lore document ("# 6. Vampire").
   If the document gets new chapters or new numbers, this is the only place
   to adjust. The wheel order follows the colours around the circle and puts
   related beings next to each other (vampires, underworld and werewolves
   share their history). */

export const WHEEL = [
  { chapter: '6',  name: 'Vampire',     color: '#e0676d', icon: 'vampire' },
  { chapter: '11', name: 'Unterwelt',   color: '#e0874d', icon: 'underworld' },
  { chapter: '7',  name: 'Werwölfe',    color: '#dba25a', icon: 'werewolf' },
  { chapter: '10', name: 'Goblins',     color: '#c9c05a', icon: 'goblin' },
  { chapter: '9',  name: 'Zauberwald',  color: '#7fcf7a', icon: 'forest' },
  { chapter: '12', name: 'Erschaffene', color: '#5ccf9f', icon: 'created' },
  { chapter: '8',  name: 'Meersims',    color: '#57c2b9', icon: 'mermaid' },
  { chapter: '15', name: 'Aliens',      color: '#6ab4e0', icon: 'alien' },
  { chapter: '13', name: 'Geister',     color: '#b8c6d9', icon: 'ghost' },
  { chapter: '4',  name: 'Magier',      color: '#a58ff0', icon: 'mage' },
  { chapter: '14', name: 'Loa',         color: '#c77ee0', icon: 'loa' },
  { chapter: '16', name: 'Hybriden',    color: '#e894c2', icon: 'hybrid' }
];

export const LIBRARY = [
  { chapter: '1',  name: 'Grundlagen' },
  { chapter: '2',  name: 'Welten' },
  { chapter: '3',  name: 'Ordnung' },
  { chapter: '5',  name: 'Artefakte' },
  { chapter: '17', name: 'Geschichte' },
  { chapter: '18', name: 'Begriffe' }
];

/* Colour for library chapters, which have no colour of their own. */
export const LIBRARY_COLOR = '#8fb3a0';

/* Stroke icons, 24×24, drawn with currentColor. */
export const ICONS = {
  vampire:    '<path d="M12 3.2c3.2 4.8 6 8 6 11.6a6 6 0 0 1-12 0c0-3.6 2.8-6.8 6-11.6z"/><path d="M9.5 15.5l1 2.2 1-2.2"/><path d="M12.5 15.5l1 2.2 1-2.2"/>',
  underworld: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1.2-3.6 2.4-4.8.3 1.6 1.2 2.6 2.1 2.9C11 8.6 11.5 5.6 12 3z"/>',
  werewolf:   '<path d="M19.5 14.2A8 8 0 1 1 9.8 4.5a6.4 6.4 0 0 0 9.7 9.7z"/><path d="M8 13l1.2-3"/><path d="M10.6 14l1.2-3"/><path d="M13.2 15l1.2-3"/>',
  goblin:     '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/>',
  forest:     '<path d="M12 21v-7"/><path d="M12 14c-4 0-6.5-2.6-6.5-5.8C5.5 5.4 8.4 3 12 3s6.5 2.4 6.5 5.2C18.5 11.4 16 14 12 14z"/>',
  created:    '<path d="M12 21v-8"/><path d="M12 13c0-3.5-2.5-6-6.5-6 0 3.6 2.5 6 6.5 6z"/><path d="M12 11c0-3.5 2.5-6 6.5-6 0 3.6-2.5 6-6.5 6z"/>',
  mermaid:    '<path d="M3 14c2 0 3-1.8 4.5-1.8S10 14 12 14s3-1.8 4.5-1.8S19 14 21 14"/><path d="M3 18.5c2 0 3-1.8 4.5-1.8s2.5 1.8 4.5 1.8 3-1.8 4.5-1.8 2.5 1.8 4.5 1.8"/><path d="M12 10V3.5c2.2.8 3.6 2.3 4 4.3"/>',
  alien:      '<ellipse cx="12" cy="13" rx="9" ry="3"/><path d="M7.5 11.5a4.5 4.5 0 0 1 9 0"/><path d="M8 17l-1.5 3"/><path d="M16 17l1.5 3"/>',
  ghost:      '<path d="M6 20.5V11a6 6 0 0 1 12 0v9.5l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z"/><circle cx="10" cy="11" r="1"/><circle cx="14" cy="11" r="1"/>',
  mage:       '<path d="M12 3l1.7 4.9L18.6 9.6l-4.9 1.7L12 16.2l-1.7-4.9L5.4 9.6l4.9-1.7z"/><path d="M5 20l4.5-4.5"/><path d="M18 17.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>',
  loa:        '<path d="M9 10h6v11H9z"/><path d="M12 10V8"/><path d="M12 3.5c1.2 1.4 1.6 2.4 1 3.5-.4.7-1.6.7-2 0-.6-1.1-.2-2.1 1-3.5z"/>',
  hybrid:     '<circle cx="9.5" cy="12" r="5.5"/><circle cx="14.5" cy="12" r="5.5"/>',
  book:       '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'
};

export function iconSvg(name, size){
  var s = size || 24;
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + (ICONS[name] || ICONS.book) + '</svg>';
}

/* Look up the display settings of a chapter, wheel or library. */
export function chapterInfo(nr){
  for (var i = 0; i < WHEEL.length; i++) if (WHEEL[i].chapter === nr) return WHEEL[i];
  for (var j = 0; j < LIBRARY.length; j++) {
    if (LIBRARY[j].chapter === nr) return { chapter: nr, name: LIBRARY[j].name, color: LIBRARY_COLOR, icon: 'book' };
  }
  return null;
}
