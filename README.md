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

Still in the old `simswelt` repo, moving here in stage 5:
`simstagram.html`, `metaverse.html`, `rpg_char_html.html`.
Until then the links to them in `index.html` intentionally point to `simswelt`.

---

## Layout

```
src/
  atlas/      World map (core.js, ui/, features/)
  news/       Kiosk
styles/       CSS, mirrors src/
docs/         Architecture and conventions
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
Rules for all code: [docs/CONVENTIONS.md](docs/CONVENTIONS.md)

---

## Common tasks

**Add a new SWN issue** → `src/news/issues.js`, add one line at the top.

**Change a lot or character** → in the Google Sheet, not in the code.

**Adjust world coordinates** → `src/atlas/core.js` (calibration mode in the admin panel).

---

## Deploy

No build step. Change files, commit, push — GitHub Pages does the rest.

GitHub Pages caches for about ten minutes. To see the new version right away,
append `?v=2` to the URL or press Ctrl+Shift+R.

**Important:** Do not open files by double-clicking. External files and
ES modules do not work over `file://`. Test on GitHub Pages.

---

## Rollback

As long as the forum points to `simswelt`, the live site is not affected by
this repo.

`index_alt.html` is the last single-file version before the split.
If something breaks: rename it to `index.html` and push.
