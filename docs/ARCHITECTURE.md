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
  atlas/       ATLAS application (ES modules)
    main.js    Entry point: imports all modules
    window-bridge.js  Functions called from inline handlers, attached to window
    config.js  Global constants (BASE, IMG, SCRIPT_URL, ADMIN_PASS)
    data/      Static data: buildings, worlds, lot coordinates, road network
    core/      Shared state, sheet data access, data cache, events, start-up (boot.js)
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

## Loading in `index.html`

1. `styles/atlas/atlas.css`
2. `src/atlas/ui/viewport.js` — **classic script, not a module** (see below)
3. `<link rel="modulepreload">` for every ATLAS module — the browser fetches
   all of them in parallel right away instead of discovering them one
   `import` at a time. Measured with 120 ms delay per file: modules without
   preload were about 12 % slower to show the map than the old classic
   scripts; with preload they are as fast.
4. Markup
5. `<script type="module" src="src/atlas/main.js">` — the only ATLAS entry.
   Modules run after the document is parsed, before `DOMContentLoaded`.
6. `src/atlas/features/events/event-pill.js`, loading screen markup and
   `src/atlas/ui/loading.js` — classic scripts, self-contained.

### How the modules fit together

- Every file **imports** what it uses and **exports** what others use.
  Import paths carry the same `?v=` marker as the pages (see `tools/`).
- **Shared mutable state** lives in one object, `state` in `core/state.js`
  (`state.currentWorld = w`). Imported plain variables are read-only.
- **Inline handlers** (`onclick="goBack()"`) run in the global scope. The
  functions they call are attached to `window` in `window-bridge.js` — one
  list, easy to check.
- `main.js` lists all modules; `core/boot.js` is last and starts the page on
  `load`. Files only define things and register listeners while loading.
- Events instead of overriding: `on(name, fn)` / `emit(name, arg)` from
  `core/events.js`. In use: `'enter-world'` (the world search records recent
  worlds) and `'sheet-lots-updated'` (open views re-render after a background
  refresh). `core/events.js` has no imports on purpose: modules that import
  each other in a circle are evaluated in an order the browser decides, and a
  module without imports is always ready first.

### Fast start: data cache

The last data from the Google Sheet and the Apps Script (characters, lots,
forum stats, forum activity) is kept in `localStorage` (`core/cache.js`,
keys `atlas_cache_v1:*`). On every visit after the first, ATLAS shows that
data immediately and refreshes it in the background ("stale-while-revalidate");
views update when fresh data differs. The loading screen only appears on the
very first visit, when there is no cache yet.

Start-up runs on `DOMContentLoaded`, not on `load` — `load` would also wait
for every image, including the large continent map.

Measured with the Apps Script and the sheet answering 1.5 s late (second
visit): character tokens and "Zuletzt gesehen" appear after about 0.4 s
instead of 4.9 s, forum activity after 0.4 s instead of 6.4 s, no loading
screen.

### Why `viewport.js` must not be a module

The Galaxy fix rewrites media queries in the CSSOM and has to run **before**
the first render. Browsers always defer modules (like `defer`) — the fix would
come too late and phones would briefly see the desktop layout. As a classic
script, the browser also waits until the preceding stylesheet is loaded,
which is exactly what we need.

---

## Stage 3 is complete

- 3a: the former single `core.js` is split into `core/`, `ui/` and `features/`,
  all comments English.
- Cleanup: duplicated start-up merged, image fallback fixed, unreachable admin
  tools removed.
- 3b: ES modules with explicit imports/exports, shared state object, window
  bridge, module preloading.

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
