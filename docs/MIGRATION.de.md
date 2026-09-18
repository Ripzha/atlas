# Umstellung: Forum von `simswelt` auf `atlas`

**Deutsch** · [English](MIGRATION.md)

Das Forum lädt ATLAS heute von `https://ripzha.github.io/simswelt/`.
Diese Checkliste stellt auf `https://ripzha.github.io/atlas/` um, ohne tote Links.

Erst ausführen, wenn das neue Repo getestet und stabil ist. Die Adressfrage
(eigene Unteradresse nach der Forum-Umbenennung) ist davon getrennt und kommt später.

---

## Vor dem Start

- Den kompletten aktuellen Inhalt beider Xobor-Felder (Kopfzeile und
  „Eigenes JavaScript") und der Fusszeile in Dateien sichern.
  Zurücksetzen = wieder einfügen.
- Eine Stelle ändern, testen, dann die nächste.

---

## Stellen mit der alten Adresse

Die Zeilennummern beziehen sich auf die Dateien aus der Übergabe. Vor dem
Ändern in Xobor prüfen, welche Fassung wirklich live ist.

| Wo | Was | Neu |
|---|---|---|
| Xobor-Kopfzeile (`atlas_header.html`, Zeile 85) | iframe `frame.src` | `https://ripzha.github.io/atlas/` |
| Xobor-Kopfzeile, Eve-Variante (`atlas_eve_header.html`, Zeile 46) — nur falls live | iframe `f.src` | `https://ripzha.github.io/atlas/` |
| Xobor-Fusszeile (Zeile 219) | Link „Charakterbogen öffnen" | `…/atlas/character-sheet.html` |
| ATLAS-Guides (`Pre_Atlas_Guide.html` Zeile 711, `Release_Atlas_Guide.html` Zeile 840) | Link „Charakterbogen öffnen" | `…/atlas/character-sheet.html` |
| Forum-Fussblock (`blaze_komplett.html`, Zeile 178) | Link „Charakterbogen öffnen" | `…/atlas/character-sheet.html` |
| Apps Script (`Code.gs`, Zeile 336) | Link auf Simstagram-Beitrag | `…/atlas/simstagram.html#post-` — danach **neu bereitstellen** |

Danach die Xobor-Felder nach `simswelt` durchsuchen — ausser Links auf alte
Forum-Threads darf nichts übrig bleiben.

---

## Reihenfolge

1. Xobor-Felder sichern.
2. iframe in der Kopfzeile umstellen. ATLAS im Forum testen.
3. Charakterbogen-Links umstellen. Testen.
4. Apps Script anpassen und neu bereitstellen. Einen neuen Simstagram-Link testen.
5. **Zuletzt:** die Seiten in `simswelt` durch Weiterleitungen ersetzen (unten).

Bis Schritt 5 heisst Zurücksetzen nur: die Zeile in der Kopfzeile zurückstellen.

---

## Weiterleitungen in `simswelt`

Das alte Repo wird **nicht gelöscht** — alte Forum-Beiträge verlinken darauf.
Jede alte Seite wird durch eine kleine Seite ersetzt, die auf die neue Adresse
weiterleitet und dabei `?Parameter` und `#Anker` mitnimmt (Simstagram-Links
nutzen `#post-…`):

| Alt | Neu |
|---|---|
| `simswelt/` und `simswelt/index.html` | `atlas/` |
| `simswelt/news.html` | `atlas/news.html` |
| `simswelt/simstagram.html` | `atlas/simstagram.html` |
| `simswelt/metaverse.html` | `atlas/metaverse.html` |
| `simswelt/rpg_char_html.html` | `atlas/character-sheet.html` |

Die Weiterleitungs-Seiten werden als eigener Schritt gebaut, wenn es so weit ist.
