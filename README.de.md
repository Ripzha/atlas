# Projekt ATLAS

**Deutsch** · [English](README.md)

Interaktiver Community-Hub für [simsforumrpg.de](https://www.simsforumrpg.de).
Statische Seite auf GitHub Pages, per iframe ins Forum eingebettet.

**Neue Adresse (Testbetrieb):** https://ripzha.github.io/atlas/
**Live im Forum (bis zur Umstellung):** https://ripzha.github.io/simswelt/

---

## Seiten

| Datei | URL | Zweck |
|---|---|---|
| `index.html` | `/` | ATLAS Weltkarte |
| `news.html` | `/news.html` | SimsWelt News Kiosk |
| `simstagram.html` | `/simstagram.html` | Charakter-Feed |
| `metaverse.html` | `/metaverse.html` | Blog für Interviews & OOC |
| `character-sheet.html` | `/character-sheet.html` | Charakterbogen-Generator |

---

## Aufbau

```
src/
  atlas/      Weltkarte (config.js, data/, core.js, ui/, features/)
  news/       Kiosk
styles/       CSS, gespiegelt zu src/
docs/         Architektur, Regeln, Umstellung
tools/        Hilfsskripte (kein Build-Schritt)
```

Ausführlich: [docs/ARCHITECTURE.de.md](docs/ARCHITECTURE.de.md) ·
Regeln für allen Code: [docs/CONVENTIONS.de.md](docs/CONVENTIONS.de.md) ·
Forum umstellen: [docs/MIGRATION.de.md](docs/MIGRATION.de.md)

---

## Häufige Aufgaben

**Neue SWN-Ausgabe eintragen** → `src/news/issues.js`, oben eine Zeile ergänzen.
Aus dem FlipHTML5-Link braucht es nur den Pfad-Teil, z.B. `idohu/ztbc`.

**Grundstück oder Charakter ändern** → im Google Sheet, nicht im Code.

**Koordinaten anpassen** → Punkte der Kontinentkarte in `src/atlas/data/worlds.js`,
Grundstücke pro Welt in `src/atlas/data/world-lots.js`, Gebäude-Etagen in
`src/atlas/data/buildings.js`. Die Werte liefert der Kalibrier-Modus im Admin-Panel.

---

## Deployen

Kein Build-Schritt. Dateien ändern, committen, pushen — GitHub Pages übernimmt.

**Vor jedem Commit, der CSS oder JS ändert**, eine neue Version setzen:

```bash
sh tools/bump-version.sh
```

GitHub Pages hält jede Datei rund zehn Minuten im Zwischenspeicher. Das
Anhängsel `?v=` an jeder CSS-/JS-Einbindung sorgt dafür, dass Seite und Scripts
immer als zusammengehöriger Satz ankommen. Ohne es kann eine neue `index.html`
auf eine alte `core.js` treffen, und die Karte bleibt leer. Wirkt eine Seite
trotzdem alt, mit Cmd+Shift+R neu laden.

**Wichtig:** Nicht per Doppelklick öffnen. Externe Dateien und ES-Module
funktionieren nicht über `file://`. Getestet wird auf GitHub Pages.

---

## Zurücksetzen

Solange das Forum auf `simswelt` zeigt, ist der Live-Stand von diesem Repo
nicht betroffen.

`index_alt.html` ist der letzte Single-File-Stand vor der Aufteilung.
Bei Problemen in `index.html` umbenennen und pushen.
