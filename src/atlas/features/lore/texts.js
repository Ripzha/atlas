/* PROJECT ATLAS - Occult lore: German UI text. */

export const TEXT = {
  navLabel: 'Okkult-Lore',
  title: 'Okkult-Lore',
  kicker: 'Okkult-Kompendium',
  heading: 'Wer lebt in Simswelt?',
  back: '← Zurück',
  library: 'Bibliothek',
  libraryHint: 'Wissen über Welten, Ordnung, Artefakte und Geschichte',
  pickBeing: 'Wähle ein Wesen',
  topics: 'Themen',
  allTopics: 'Alle Themen',
  loading: 'Lore wird geladen …',
  loadError: 'Die Lore konnte nicht geladen werden. Bitte später nochmal versuchen.',
  noCards: 'Keine Karten mit dieser Markierung in diesem Thema.',
  previous: '← Vorheriges Thema',
  next: 'Nächstes Thema →',
  cards: function(n){ return n === 1 ? '1 Karte' : n + ' Karten'; },
  topicsCount: function(n){ return n === 1 ? '1 Thema' : n + ' Themen'; },
  filterAll: 'Alle'
};

/* Labels of the markings in the document ("**Regel:**" …), in filter order. */
export const MARKS = [
  { key: 'regel',          label: 'Regel',         plural: 'Regeln',         color: '#6acc8a' },
  { key: 'gesichert',      label: 'Gesichert',     plural: 'Gesichert',      color: '#6ab4e0' },
  { key: 'wichtig',        label: 'Wichtig',       plural: 'Wichtig',        color: '#dba25a' },
  { key: 'theorie',        label: 'Theorie',       plural: 'Theorien',       color: '#5ccf9f' },
  { key: 'ueberlieferung', label: 'Überlieferung', plural: 'Überlieferungen', color: '#e894c2' },
  { key: 'offen',          label: 'Offen',         plural: 'Offen',          color: '#b3a6d9' }
];
