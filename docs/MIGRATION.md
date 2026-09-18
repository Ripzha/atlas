# Migration: switching the forum from `simswelt` to `atlas`

[Deutsch](MIGRATION.de.md) · **English**

The forum currently loads ATLAS from `https://ripzha.github.io/simswelt/`.
This checklist moves it to `https://ripzha.github.io/atlas/` without dead links.

Do this only when the new repo has been tested and is stable. The address
decision (own subdomain after the forum is renamed) is separate and comes later.

---

## Before you start

- Copy the complete current content of both Xobor fields (header and
  "Eigenes JavaScript") and the footer into files. Rollback = paste them back.
- Change one place, test, then the next.

---

## Places that contain the old address

Line numbers refer to the files from the handover. Check in Xobor which
version is actually live before editing.

| Where | What | Change to |
|---|---|---|
| Xobor header (`atlas_header.html`, line 85) | iframe `frame.src` | `https://ripzha.github.io/atlas/` |
| Xobor header, Eve variant (`atlas_eve_header.html`, line 46) — only if live | iframe `f.src` | `https://ripzha.github.io/atlas/` |
| Xobor footer (line 219) | "Charakterbogen öffnen" link | `…/atlas/character-sheet.html` |
| ATLAS guides (`Pre_Atlas_Guide.html` line 711, `Release_Atlas_Guide.html` line 840) | "Charakterbogen öffnen" link | `…/atlas/character-sheet.html` |
| Forum footer block (`blaze_komplett.html`, line 178) | "Charakterbogen öffnen" link | `…/atlas/character-sheet.html` |
| Apps Script (`Code.gs`, line 336) | Simstagram post link | `…/atlas/simstagram.html#post-` — then **redeploy** |

Search the live Xobor fields for `simswelt` afterwards — nothing may remain
except links to old forum threads.

---

## Order

1. Back up the Xobor fields.
2. Change the iframe in the header. Test ATLAS inside the forum.
3. Change the character sheet links. Test.
4. Update the Apps Script and redeploy. Test a new Simstagram link.
5. **Last:** replace the pages in `simswelt` with redirects (below).

Until step 5, rolling back only means restoring the header line.

---

## Redirects in `simswelt`

The old repo is **not deleted** — old forum posts link to it. Each old page
is replaced by a small page that forwards to the new address and keeps the
`?query` and `#hash` (Simstagram links use `#post-…`):

| Old | New |
|---|---|
| `simswelt/` and `simswelt/index.html` | `atlas/` |
| `simswelt/news.html` | `atlas/news.html` |
| `simswelt/simstagram.html` | `atlas/simstagram.html` |
| `simswelt/metaverse.html` | `atlas/metaverse.html` |
| `simswelt/rpg_char_html.html` | `atlas/character-sheet.html` |

The redirect pages are created as a separate step when this point is reached.
