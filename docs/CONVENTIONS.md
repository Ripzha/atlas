# Conventions

[Deutsch](CONVENTIONS.de.md) · **English**

These rules apply to every file in this repo. When in doubt: order and
readability come before cleverness.

---

## 1. Language

| What | Language |
|---|---|
| File and folder names, functions, variables, CSS classes, IDs | English |
| Code comments | English |
| Commit messages | English |
| Documentation | Both — `NAME.md` in English, `NAME.de.md` in German |
| Everything the user sees (buttons, messages, labels) | German |
| Google Sheet column names (`welt`, `nr.`, `thread url` …) | German, unchanged |

Both language versions of a document are updated **in the same commit**.

The sheet column names are a data contract shared with the forum tools.
Renaming them breaks those tools.

German UI text follows Swiss spelling (`ss` instead of `ß`) and always uses
real umlauts (ä, ö, ü — never ae, oe, ue).

---

## 2. Structure

- Entry pages (`index.html`, `news.html` …) live in the repo root.
- Code lives in `src/<app>/`, CSS in `styles/<app>/` with the same layout.
- One domain area = one folder under `features/`. If you ask "where is X",
  the folder name must answer it.
- Code goes into `src/shared/` only when at least two pages use it.
- No empty folders, no placeholder files, no folders with a single trivial file.
- No duplicated code. If two places need the same thing, it becomes one module.

---

## 3. Naming

| Kind | Style | Example |
|---|---|---|
| Files and folders | kebab-case | `event-pill.js`, `features/routing/` |
| Functions, variables | camelCase | `enterWorld`, `charCount` |
| Constants | UPPER_SNAKE_CASE | `APPS_SCRIPT_URL` |
| CSS classes and IDs | kebab-case | `.char-card`, `#world-container` |

Names describe what something is or does. No abbreviations that need
explaining.

---

## 4. JavaScript

- ES modules (`<script type="module">`, `import` / `export`).
- **Exception:** `src/atlas/ui/viewport.js` stays a classic script
  (see [ARCHITECTURE.md](ARCHITECTURE.md)).
- Functions called from inline handlers in the markup (`onclick="…"`) are
  attached to `window` explicitly, in one place per feature module, until the
  inline handlers are replaced.
- From stage 3 on, German UI text for a feature lives in that feature's
  `texts.js`, not scattered through the logic.
- No build step, no npm, no framework. New external libraries only after an
  explicit decision.

---

## 5. Brand

- Copyright: **© SimsForumRPG**
- Badge text: „Ein Projekt Atlas Feature"

---

## 6. Working

- One change per commit. Never change structure and address at the same time.
- Every local CSS/JS reference carries a `?v=` marker. Before every commit
  that changes CSS or JS, run `sh tools/bump-version.sh`. A new reference gets
  its `?v=` marker by hand once; a new file that contains such references is
  added to `FILES` in the script.
- Commit messages: `<area>: <what changed>`, imperative —
  e.g. `news: add issue 36`, `atlas: move routing into features/routing`.
- Test on GitHub Pages after every push, in this order:
  continent map → enter world → back · character view, filters, sorting ·
  route planner · admin panel, calibration · kiosk · phone: bottom bar,
  sheets, event pill · inside the forum iframe.

---

## Legacy

Not yet following these rules, converted in their stage:

- `src/atlas/` — global functions in classic scripts instead of ES modules (stage 3b)
- `styles/atlas/atlas.css` — German comments, mixed topics (stage 4)
- `simstagram.html`, `metaverse.html`, `character-sheet.html` — single files
  with inline CSS/JS and German comments (stage 5)
- `index_alt.html` — old single file, kept only as a rollback
