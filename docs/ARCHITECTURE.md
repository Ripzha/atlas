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
  shared/      Used by more than one page (config, API, helpers) — empty so far
  atlas/       ATLAS application
    config.js  Global constants (BASE, IMG, SCRIPT_URL, ADMIN_PASS)
    data/      Static data: buildings, worlds, lot coordinates, road network
    core/      Shared state, sheet data access, start-up (boot.js)
    ui/        Cross-cutting UI building blocks (tooltips, sheets, zoom …)
    features/  One folder per domain area:
      map/           continent map, world view, world search, lot helpers
      characters/    character view, tokens on the map
      activity/      "Zuletzt gesehen", sidebar feeds
      otherworlds/   "Andere Welten" portal and view
      buildings/     floor plans, building calibration
      routing/       route planner, route editor
      admin/         admin panel, calibration, lot assignment
      forum-bridge/  messages from/to the forum header
      events/        event pill
  news/        Kiosk
  simstagram/  Feed (still a single file in the root)
  metaverse/   Blog (still a single file in the root)

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
5. `src/atlas/core/state.js`, `core/sheet-data.js` — shared state, sheet access
6. `src/atlas/ui/*.js` — UI building blocks
7. `src/atlas/features/*/*.js` — features; within `map/`: `lot-helpers.js`,
   `continent-map.js`, `world-view.js`, then `world-search.js` (it wraps
   `enterWorld()` and must come after `world-view.js`)
8. `src/atlas/core/boot.js` — **always last** of the ATLAS scripts
9. `src/atlas/features/events/event-pill.js`
10. Loading screen markup, then `src/atlas/ui/loading.js`

Until stage 3b, all ATLAS scripts are classic scripts that share the global
scope. The rule that keeps this safe: **files only define things when they
load; `core/boot.js` comes last and starts the page.** A file may register
event listeners at load time, but must not call into files loaded after it.
This also means that no timer or early click can hit a function that is not
loaded yet.

### Why `viewport.js` must not be a module

The Galaxy fix rewrites media queries in the CSSOM and has to run **before**
the first render. Browsers always defer modules (like `defer`) — the fix would
come too late and phones would briefly see the desktop layout. As a classic
script, the browser also waits until the preceding stylesheet is loaded,
which is exactly what we need.

---

## Stage 3a is complete — next: stage 3b

The former `core.js` is fully split into `core/`, `ui/` and `features/`.
All comments in these files are English. The code itself was only moved,
never changed.

Stage 3b converts the files to ES modules (`import`/`export`). Two things to
watch:

- **76 inline handlers** in the markup and in generated HTML
  (`onclick="goBack()"` etc.) call about 48 functions. Modules have their own scope, so these functions must
  be attached to `window` explicitly — otherwise the handlers break.
- The functions call each other across files. Every file needs matching
  `import` lines.

---

## Cleanup after stage 3a

Done, each as its own commit:

- **Start-up:** the two `load` handlers in `core/boot.js` are merged into one,
  the duplicated `ENTRY_MODE` and `_prioritizeInitialImages()` removed. At
  start, forum stats and the sheet CSV are now fetched once instead of twice,
  and the character view opens once instead of twice.
- **World image fallback:** `enterWorld()` shows the gradient again when a
  world image fails to load (the inline `onerror` handler was broken).
- **Unreachable admin tools removed:** lots tab, export tab, characters tab,
  the position mode, and the unused functions `getCharsAtLot()` and
  `getAgeGroup()`.

Still applied, but no longer editable: lot overrides in `localStorage`
(`sw_custom_lots`, `sw_hidden_lots`, `sw_renamed_lots`), read by `getLots()`.
They only exist in browsers where the former lot editor was used.

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
hardcoded data in `src/atlas/data/` contains only coordinates and `nr:` fields.
