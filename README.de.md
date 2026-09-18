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

Noch im alten Repo `simswelt`, ziehen mit Etappe 5 hierher um:
`simstagram.html`, `metaverse.html`, `rpg_char_html.html`.
Die Links darauf in `index.html` zeigen bis dahin bewusst auf `simswelt`.

---

## Aufbau

```
src/
  atlas/      Weltkarte (core.js, ui/, features/)
  news/       Kiosk
styles/       CSS, gespiegelt zu src/
docs/         Architektur und Regeln
```

Ausführlich: [docs/ARCHITECTURE.de.md](docs/ARCHITECTURE.de.md) ·
Regeln für allen Code: [docs/CONVENTIONS.de.md](docs/CONVENTIONS.de.md)

---

## Häufige Aufgaben

**Neue SWN-Ausgabe eintragen** → `src/news/issues.js`, oben eine Zeile ergänzen.
Aus dem FlipHTML5-Link braucht es nur den Pfad-Teil, z.B. `idohu/ztbc`.

**Grundstück oder Charakter ändern** → im Google Sheet, nicht im Code.

**Welt-Koordinaten anpassen** → `src/atlas/core.js` (Kalibrier-Modus im Admin-Panel).

---

## Deployen

Kein Build-Schritt. Dateien ändern, committen, pushen — GitHub Pages übernimmt.

GitHub Pages liefert mit rund zehn Minuten Zwischenspeicher aus. Wer sofort
den neuen Stand sehen will: `?v=2` an die URL hängen oder Ctrl+Shift+R.

**Wichtig:** Nicht per Doppelklick öffnen. Externe Dateien und ES-Module
funktionieren nicht über `file://`. Getestet wird auf GitHub Pages.

---

## Zurücksetzen

Solange das Forum auf `simswelt` zeigt, ist der Live-Stand von diesem Repo
nicht betroffen.

`index_alt.html` ist der letzte Single-File-Stand vor der Aufteilung.
Bei Problemen in `index.html` umbenennen und pushen.
