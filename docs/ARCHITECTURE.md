# Architecture

[Deutsch](ARCHITECTURE.de.md) · **English**

## Overview

Static frontend on GitHub Pages, repo `ripzha/atlas`. No build step:
what is in the repo is what gets served.

Entry pages live in the root on purpose, so forum links stay short and stable.

| Page | URL | Purpose | Status |
|---|---|---|---|
| `index.html` | `/` | ATLAS — interactive world map | split into files (stages 1–2) |
| `news.html` | `/news.html` | SimsWelt News kiosk | modular (stage 2) |
| `simstagram.html` | `/simstagram.html` | Character feed | single file, cleanup in stage 5 |
| `metaverse.html` | `/metaverse.html` | Blog for interviews & OOC | single file, cleanup in stage 5 |
| `character-sheet.html` | `/character-sheet.html` | Character sheet generator | single file, cleanup in stage 5 (was `rpg_char_html.html`) |

Links between the pages are relative (`simstagram.html`, not a full URL), so
they keep working wherever the repo is served from.

---

## Directories

Target layout. Folders only appear once files land in them — Git does not
store empty directories.

```
src/
  shared/      Used by more than one page (config, API, helpers)
  atlas/       ATLAS application
    core/      State, data access
    data/      Static data (buildings, portal worlds, routes, colors)
    features/  One folder per domain area
    ui/        Cross-cutting UI building blocks
  news/        Kiosk
  simstagram/  Feed
  metaverse/   Blog

styles/        CSS, mirrors the src/ layout
docs/          This documentation
tools/         Helper scripts, e.g. bump-version.sh (no build step)
assets/        Images and static files
```

A feature folder answers "where is X". Dijkstra routing goes to
`src/atlas/features/routing/`, the character view to `features/characters/`.

---

## Load order in `index.html`

The order is binding:

1. `styles/atlas/atlas.css`
2. `src/atlas/ui/viewport.js` — **classic script, not a module**
3. Markup
4. `src/atlas/config.js` and `src/atlas/data/*.js` — configuration and static data
5. `src/atlas/ui/*.js` — UI building blocks
6. `src/atlas/features/*/*.js` — features
7. `src/atlas/core.js` — **always last** of the ATLAS scripts
8. `src/atlas/features/events/event-pill.js`
9. Loading screen markup, then `src/atlas/ui/loading.js`

Until stage 3b, all ATLAS scripts are classic scripts that share the global
scope. The rule that keeps this safe: **files only define things when they
load; `core.js` comes last and starts the page.** A file may register event
listeners at load time, but must not call into files loaded after it. This
also means that no timer or early click can hit a function that is not
loaded yet.

### Why `viewport.js` must not be a module

The Galaxy fix rewrites media queries in the CSSOM and has to run **before**
the first render. Browsers always defer modules (like `defer`) — the fix would
come too late and phones would briefly see the desktop layout. As a classic
script, the browser also waits until the preceding stylesheet is loaded,
which is exactly what we need.

---

## State of `core.js`

`core.js` now holds about 1000 lines: shared state, loading the sheet data
(`fetchSheetLots`, `getLots`), the continent map, the world view with lots and
clusters, the world search, and start-up. Comments are still German.
Moving the map and world view into `features/map/` and the rest into
`core/` is the last cut of stage 3a; converting to ES modules is stage 3b.

Two things to watch for stage 3b:

- **96 inline handlers** in the markup (`onclick="goBack()"` etc.) call
  about 55 functions. Modules have their own scope, so these functions must
  be attached to `window` explicitly — otherwise the handlers break.
- The functions call each other across areas. Every file needs matching
  `import` lines.

---

## Cleanup candidates

Found while splitting; left untouched on purpose (moving and changing are
separate commits):

- `core.js` contains `ENTRY_MODE` and `_prioritizeInitialImages()` twice, and
  two start-up handlers on `load` that both run (`updateSidebarStats()` runs
  twice at start).
- `enterWorld()`: the fallback when a world image fails to load builds a broken
  inline `onerror` handler — a JS error instead of the gradient.
- Not reachable from the admin panel: `renderLotsTab()`, `renderExportTab()`
  (`features/admin/lot-editor.js`) and `renderCharsTab()`
  (`features/admin/character-admin.js`).
- Never called: `getCharsAtLot()` (`features/characters/tokens.js`),
  `getAgeGroup()` (`features/characters/character-view.js`).

---

## Known dependencies

Things that break silently if they are changed on one side only:

- **Character sheet → data files.** `character-sheet.html` fetches
  `src/atlas/data/buildings.js` and `src/atlas/data/world-lots.js` as text and
  finds `BUILDINGS` and `worldLots` by pattern (keyword `const`, name, equals
  sign, opening brace). That pattern must not appear anywhere else in those
  files, not even in a comment. If the objects move or are renamed, the paths
  in `loadAtlasJsData_()` must follow — to be replaced by a shared data module
  in stage 3b.
- **Apps Script → Simstagram.** The Apps Script builds links to
  `simstagram.html#post-…` with a full URL. When the address changes, the
  script must be updated and redeployed (see [MIGRATION.md](MIGRATION.md)).

---

## What does *not* live here

These tools run in the forum, not on GitHub Pages. They sit in the Xobor
fields "Eigenes JavaScript" and header, and are unaffected by this repo:

- Last-seen tracker
- Lot assignment tool
- Character editor
- Event pill (forum version — to be merged with the ATLAS version later)
- Eve and Delsyn guides (forum header)

---

## Backend

Unchanged, on purpose:

- **Google Sheet** `1PmIvQOMLqO-54h3Xwi24MD2IHNrlycg_7-H7O51BRUc` holds
  characters, lots and events. It is also the editing interface for the
  team — that is why there is no database.
  Tabs: characters `474514580`, lots `306313316`, events `1218058837`.
  Column names are German and are part of the data contract. Do not rename.
- **Apps Script** works around CORS and serves the data.
  Changes there require a new deployment.
- **Images** are hosted by Xobor at `files.homepagemodules.de`.

The sheet is the source of truth for names, addresses and images. The
hardcoded data in `core.js` contains only coordinates and `nr:` fields.
