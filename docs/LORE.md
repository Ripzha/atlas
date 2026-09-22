# Occult lore

[Deutsch](LORE.de.md) · **English**

The occult lore is a view of its own in ATLAS. It opens from
"🔮 Okkult-Lore" in the left sidebar and in the phone menu — or directly by
address: **https://ripzha.github.io/atlas/#lore** opens ATLAS on the lore.
As with the character view (`#chars-…`) the address follows the view: a
refresh keeps the lore open, closing it removes `#lore` again.

## Principle: no wall of text

The lore is long, but it is made of many small units — about 20 words per
point on average. The view therefore never shows everything at once:

1. **Overview:** the wheel of beings and the library. A being shows its short
   description and its topics as tiles.
2. **Topic:** only the knowledge cards of the chosen topic. On the left the
   list of topics to switch, with "Alle Themen" for the whole chapter on top;
   above the cards a filter by marking (Regeln, Gesichert, Offen …).

3. **Search:** the field at the top right searches the whole lore while
   typing — text, headings and sub-headings. Several words must all occur in
   the same card. Case does not matter, the start of a word is enough
   ("vampir" finds "Vampirblut"), umlauts may be typed out ("werwoelfe"), and
   the singular finds the plural ("werwolf" finds "Werwölfe"). A hit opens
   exactly its card, which lights up briefly.

4. **Links:** names like "Morpidianer", "Sinenima" or "Lupus Noctis" are
   clickable in the cards and open the topic explaining them. With a mouse,
   hovering shows that topic's first sentence. Each name is linked once per
   card and never inside its own topic. Which names lead where is listed in
   `src/atlas/features/lore/terms.js` — targets are found by title, not by
   number, so renumbering breaks nothing. A target that cannot be found
   leaves the word as plain text.

"← Zurück" goes one level up: from a topic to the overview, from the overview
back to the map. A card opened from the search goes back to the results, and
from the results back to where the search started.

## Where the content comes from

The only source is the **lore Word document**:
`src/atlas/data/lore/Okkult-Lore.docx`. `tools/lore/import-lore.py` turns it
into `src/atlas/data/lore/lore.json`, which ATLAS reads.

Coloured highlights in the Word document (such as additions marked yellow for
review) do not disturb the import: the text reads the same with or without
colour.
`lore.json` is **never edited by hand** — the next import would undo it.

ATLAS only loads the lore when someone opens the view, so the map does not
get slower to start.

## Importing a new version

1. Provide the new version of the Word document.
2. Run the import (needs `pandoc`):

   ```bash
   python3 tools/lore/import-lore.py src/atlas/data/lore/Okkult-Lore.docx src/atlas/data/lore/lore.json
   ```

   The importer also reads chapter drafts in forum BBCode
   (`[big][b]6.1 …[/b][/big]`, one or more files, any order):

   ```bash
   python3 tools/lore/import-lore.py chapter-06.bbcode chapter-07.bbcode src/atlas/data/lore/lore.json
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
(beings, with colour and icon) and which into the library (knowledge). The
wheel answers "who", the library "where, how, what". The wheel therefore
always names beings ("Waldwesen", not "Zauberwald"), and with a library
chapter chosen its centre stays neutral. If the
document gets new chapters or other numbers, only this file changes.

## Files

| File | Purpose |
|---|---|
| `src/atlas/data/lore/Okkult-Lore.docx` | the lore as a Word document, the only source |
| `tools/lore/import-lore.py` | Word document or BBCode drafts → `lore.json` |
| `src/atlas/data/lore/lore.json` | the lore as data, generated |
| `src/atlas/features/lore/lore-view.js` | view: wheel, topics, cards, filter |
| `src/atlas/features/lore/lore-data.js` | loading and shaping the data |
| `src/atlas/features/lore/lore-search.js` | search: hits, spellings, text snippets |
| `src/atlas/features/lore/terms.js` | list of linked names and their targets |
| `src/atlas/features/lore/lore-terms.js` | links: resolve targets, set links, hint window |
| `src/atlas/features/lore/families.js` | chapter → wheel or library, colours, icons |
| `src/atlas/features/lore/texts.js` | German UI text, names of the markings |
| `styles/atlas/lore.css` | look, all scoped to `#lore-container` |
