# Occult lore

[Deutsch](LORE.de.md) · **English**

The occult lore is a view of its own in ATLAS. It opens from
"🔮 Okkult-Lore" in the left sidebar and in the phone menu.

## Principle: no wall of text

The lore is long, but it is made of many small units — about 20 words per
point on average. The view therefore never shows everything at once:

1. **Overview:** the wheel of beings and the library. A being shows its short
   description and its topics as tiles.
2. **Topic:** only the knowledge cards of the chosen topic. On the left the
   list of topics to switch, with "Alle Themen" for the whole chapter on top;
   above the cards a filter by marking (Regeln, Gesichert, Offen …).

"← Zurück" goes one level up: from a topic to the overview, from the overview
back to the map.

## Where the content comes from

The only source is the **lore Word document**. `tools/lore/import-lore.py`
turns it into `src/atlas/data/lore/lore.json`, which ATLAS reads.
`lore.json` is **never edited by hand** — the next import would undo it.

ATLAS only loads the lore when someone opens the view, so the map does not
get slower to start.

## Importing a new version

1. Provide the new version of the Word document.
2. Run the import (needs `pandoc`):

   ```bash
   python3 tools/lore/import-lore.py Okkult-Lore.docx src/atlas/data/lore/lore.json
   ```

   The script reports how many chapters, sections and points it found and
   compares them with the headings in the document. Each pair must match.
3. `sh tools/bump-version.sh`, commit, push.

## What the document must follow

The importer reads the structure from the heading numbers:

| In the document | Becomes in ATLAS |
|---|---|
| `# 6. Vampire` (heading 1) | chapter |
| `## 6.3 Sonnenlicht …` (heading 2) | topic |
| `### 6.3.1 Sonnenempfindlichkeit` (heading 3) | knowledge card |
| topic without points | a single card |
| "**Enthaltene Punkte**" with a table | skipped (table of contents) |
| everything before `# 1.` | skipped (title page, overall contents) |

Markings at the start of a paragraph become badges and feed the filter:
`**Regel:**`, `**Gesichert:**`, `**Wichtig:**`, `**Theorie:**`,
`**Überlieferung:**`, `**Offen:**`. Lists stay lists, **bold** and *italic*
are kept.

**Short description of a being:** the overview shows the chapter's first
sentence as its short description. A short introductory sentence right below
the chapter heading is preferred for this.

## Which chapter goes where

`src/atlas/features/lore/families.js` decides which chapter goes on the wheel
(beings, with colour and icon) and which into the library (knowledge). If the
document gets new chapters or other numbers, only this file changes.

## Files

| File | Purpose |
|---|---|
| `tools/lore/import-lore.py` | Word document → `lore.json` |
| `src/atlas/data/lore/lore.json` | the lore as data, generated |
| `src/atlas/features/lore/lore-view.js` | view: wheel, topics, cards, filter |
| `src/atlas/features/lore/lore-data.js` | loading and shaping the data |
| `src/atlas/features/lore/families.js` | chapter → wheel or library, colours, icons |
| `src/atlas/features/lore/texts.js` | German UI text, names of the markings |
| `styles/atlas/lore.css` | look, all scoped to `#lore-container` |
