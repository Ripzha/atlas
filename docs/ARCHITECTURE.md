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
4. `src/atlas/config.js` — `BASE`, `IMG`, `ADMIN_PASS`
5. `src/atlas/data/buildings.js`, `worlds.js`, `world-lots.js`, `routes.js` — static data
6. `src/atlas/core.js`
7. UI building blocks: `src/atlas/ui/tooltips.js`, `mobile-sheets.js`,
   `pinch-zoom.js`, `mobile-dot-bar.js`, `draggable.js`
8. Features: `src/atlas/features/forum-bridge/forum-bridge.js`,
   `features/routing/navigator.js`, `features/routing/route-editor.js`
9. `src/atlas/features/events/event-pill.js`
10. Loading screen markup, then `src/atlas/ui/loading.js`

Until stage 3b, all ATLAS scripts are classic scripts that share the global
scope. Each file must load after the files whose values it uses at load time.

### Why `viewport.js` must not be a module

The Galaxy fix rewrites media queries in the CSSOM and has to run **before**
the first render. Browsers always defer modules (like `defer`) — the fix would
come too late and phones would briefly see the desktop layout. As a classic
script, the browser also waits until the preceding stylesheet is loaded,
which is exactly what we need.

---

## State of `core.js`

`core.js` is still the core logic from the former single file (about 2900
lines, functions in the global scope, comments still in German).
Already moved out in stage 3a: configuration and static data (cut 1), the
UI building blocks in `src/atlas/ui/` (cut 2), and the forum bridge, route
planner, route editor and road network (cut 3).
Splitting the rest into `features/` folders continues in stage 3a; converting
to ES modules is stage 3b.

Two things to watch:

- **96 inline handlers** in the markup (`onclick="goBack()"` etc.) call
  52 different functions. Modules have their own scope, so these functions
  must be attached to `window` explicitly — otherwise the handlers break.
- The functions call each other across areas. Every cut needs matching
  `import` lines.

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
