# Forum scripts

*Deutsch: [FORUM.de.md](FORUM.de.md)*

ATLAS features that run inside the Xobor forum itself, not in the ATLAS page:

| File | What it does | Where it appears |
|---|---|---|
| `src/forum/last-seen-tracker.js` | "Standort aktualisieren" popup after a new RPG post: which characters are in this post? (Apps Script `updateLastSeen`) | world threads, own newest post, right after writing |
| `src/forum/character-editor.js` | "ATLAS" gear tab: edit own characters; offers to add a new sheet; offers to remove an archived one (`updateChar`, `addChar`, `deleteChar`) | character-sheet forums |
| `src/forum/lot-assignment.js` | "Grundstück zuweisen" popup for a new world thread; preview picture after editing post 1; new outer world (`updateLot`) | world forums, "Orte ausserhalb von Simswelt" |
| `src/forum/event-pill.js` | Pill with the running event in the forum header, panel with the summary (`events`) | start page and portal |

Shared: `src/forum/main.js` (entry), `page.js` (reading the forum page),
`worlds.js` (forum id → world), `src/shared/backend.js` (Apps Script and
sheet addresses), `src/shared/csv.js` (CSV reader), `src/shared/html.js`
(escaping text for markup), `src/shared/event-pill/event-pill.js` (the pill
itself, shared with the map), `styles/forum/forum.css`.

## How they are loaded

The Xobor field **Administration → Design → Eigenes JavaScript** contains the
forum's particles and donation box scripts and one small loader, which adds
`src/forum/main.js` as an ES module. Nothing else from ATLAS lives in Xobor.

`main.js` is loaded **without** a version marker. A change therefore reaches the
forum within about ten minutes (GitHub Pages cache) without editing Xobor. All
files it loads carry the version marker that `tools/bump-version.sh` sets, so
they always arrive as a matching set.

## Changing a forum feature

1. Edit the file in `src/forum/` (or the styles in `styles/forum/forum.css`).
2. `sh tools/bump-version.sh`, commit, push.
3. After about ten minutes the forum uses the new version.

The Xobor field only needs to change if the ATLAS address changes.

## Known limits

- Character names containing a comma are sent to the Apps Script as a comma
  separated list (`updateLastSeen`); such a name would be split in two.
- A thread whose address ends in `-2.html`, `-3.html` … looks like page 2, 3 …
  of a thread to Xobor and to these scripts; the lot popup does not appear there.
