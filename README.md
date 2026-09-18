# Project ATLAS

[Deutsch](README.de.md) · **English**

Interactive community hub for [simsforumrpg.de](https://www.simsforumrpg.de).
Static site on GitHub Pages, embedded into the forum via iframe.

**New address (testing):** https://ripzha.github.io/atlas/
**Live in the forum (until the switch):** https://ripzha.github.io/simswelt/

---

## Pages

| File | URL | Purpose |
|---|---|---|
| `index.html` | `/` | ATLAS world map |
| `news.html` | `/news.html` | SimsWelt News kiosk |
| `simstagram.html` | `/simstagram.html` | Character feed |
| `metaverse.html` | `/metaverse.html` | Blog for interviews & OOC |
| `character-sheet.html` | `/character-sheet.html` | Character sheet generator |

---

## Layout

```
src/
  atlas/      World map (config.js, data/, core/, ui/, features/)
  news/       Kiosk
styles/       CSS, mirrors src/
docs/         Architecture, conventions, migration
tools/        Helper scripts (no build step)
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
Rules for all code: [docs/CONVENTIONS.md](docs/CONVENTIONS.md) ·
Switching the forum over: [docs/MIGRATION.md](docs/MIGRATION.md)

---

## Common tasks

**Add a new SWN issue** → `src/news/issues.js`, add one line at the top.

**Change a lot or character** → in the Google Sheet, not in the code.

**Update the road network** → draw routes in the route editor (admin panel),
"JSON kopieren", and replace the contents of `window.ATLAS_ROUTES` in
`src/atlas/data/routes.js`.

**Adjust coordinates** → continent dots in `src/atlas/data/worlds.js`, lots per
world in `src/atlas/data/world-lots.js`, building floors in
`src/atlas/data/buildings.js`. The calibration mode in the admin panel produces
the values.

---

## Deploy

No build step. Change files, commit, push — GitHub Pages does the rest.

**Before every commit that changes CSS or JS**, stamp a new version:

```bash
sh tools/bump-version.sh
```

GitHub Pages caches every file for about ten minutes. The `?v=` marker on each
CSS/JS reference makes sure a page and its scripts always arrive as a matching
set. Without it, a new `index.html` can meet an old script and the map
stays empty. If a page still looks old, reload with Cmd+Shift+R.

**Important:** Do not open files by double-clicking. External files and
ES modules do not work over `file://`. Test on GitHub Pages.

---

## Rollback

As long as the forum points to `simswelt`, the live site is not affected by
this repo.

`index_alt.html` is the last single-file version before the split.
If something breaks: rename it to `index.html` and push.
