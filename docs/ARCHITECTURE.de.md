# Architektur

**Deutsch** · [English](ARCHITECTURE.md)

## Überblick

Statisches Frontend auf GitHub Pages, Repo `ripzha/atlas`. Kein Build-Schritt:
was im Repo liegt, wird ausgeliefert.

Die Einstiegs-Seiten liegen bewusst im Wurzelverzeichnis, damit Forum-Links
kurz und stabil bleiben.

| Seite | URL | Zweck | Stand |
|---|---|---|---|
| `index.html` | `/` | ATLAS — interaktive Weltkarte | in Dateien aufgeteilt (Etappe 1–2) |
| `news.html` | `/news.html` | SimsWelt News Kiosk | modular (Etappe 2) |
| `simstagram.html` | `/simstagram.html` | Charakter-Feed | Single-File, Aufräumen in Etappe 5 |
| `metaverse.html` | `/metaverse.html` | Blog für Interviews & OOC | Single-File, Aufräumen in Etappe 5 |
| `character-sheet.html` | `/character-sheet.html` | Charakterbogen-Generator | Single-File, Aufräumen in Etappe 5 (hiess `rpg_char_html.html`) |

Links zwischen den Seiten sind relativ (`simstagram.html`, keine volle Adresse).
Sie funktionieren dadurch unabhängig davon, unter welcher Adresse das Repo läuft.

---

## Verzeichnisse

Zielbild. Ordner entstehen erst, wenn Dateien darin landen — Git speichert
keine leeren Verzeichnisse.

```
src/
  shared/      Von mehreren Seiten genutzt (Konfiguration, API, Hilfen) — noch leer
  atlas/       ATLAS-Anwendung
    config.js  Globale Konstanten (BASE, IMG, SCRIPT_URL, ADMIN_PASS)
    data/      Feste Daten: Gebäude, Welten, Grundstücks-Koordinaten, Strassennetz
    core/      Gemeinsamer Zustand, Zugriff auf Sheet-Daten, Start (boot.js)
    ui/        Übergreifende Oberflächen-Bausteine (Tooltips, Sheets, Zoom …)
    features/  Ein Ordner pro Fachbereich:
      map/           Kontinentkarte, Welt-Ansicht, Welten-Suche, Grundstücks-Hilfen
      characters/    Charakter-Ansicht, Portraits auf der Karte
      activity/      „Zuletzt gesehen", Seitenleisten
      otherworlds/   Portal und Ansicht „Andere Welten"
      buildings/     Etagenpläne, Gebäude-Kalibrierung
      routing/       Routenplaner, Routen-Editor
      admin/         Admin-Panel, Kalibrierung, Zuweisung, Alt-Tabs
      forum-bridge/  Nachrichten von/zur Forum-Kopfzeile
      events/        Event-Pille
  news/        Kiosk
  simstagram/  Feed (noch Single-File im Wurzelverzeichnis)
  metaverse/   Blog (noch Single-File im Wurzelverzeichnis)

styles/        CSS, gespiegelt zur src-Struktur
docs/          Diese Unterlagen
tools/         Hilfsskripte, z.B. bump-version.sh (kein Build-Schritt)
assets/        Bilder und Statisches
```

Ein Feature-Ordner ist die Antwort auf „wo liegt X". Dijkstra-Routing kommt
nach `src/atlas/features/routing/`, die Charakter-Ansicht nach
`features/characters/`.

---

## Ladereihenfolge in `index.html`

Die Reihenfolge ist bindend:

1. `styles/atlas/atlas.css`
2. `src/atlas/ui/viewport.js` — **klassisches Script, kein Modul**
3. Markup
4. `src/atlas/config.js` und `src/atlas/data/*.js` — Konfiguration und feste Daten
5. `src/atlas/core/state.js`, `core/sheet-data.js` — gemeinsamer Zustand, Sheet-Zugriff
6. `src/atlas/ui/*.js` — UI-Bausteine
7. `src/atlas/features/*/*.js` — Features; innerhalb von `map/`: `lot-helpers.js`,
   `continent-map.js`, `world-view.js`, dann `world-search.js` (umhüllt
   `enterWorld()` und muss nach `world-view.js` kommen)
8. `src/atlas/core/boot.js` — **immer als letztes** der ATLAS-Scripts
9. `src/atlas/features/events/event-pill.js`
10. Loading-Screen-Markup, danach `src/atlas/ui/loading.js`

Bis Etappe 3b sind alle ATLAS-Scripts klassische Scripts, die sich den globalen
Raum teilen. Die Regel, die das sicher macht: **Dateien definieren beim Laden
nur; `core/boot.js` kommt zuletzt und startet die Seite.** Eine Datei darf beim
Laden Ereignis-Listener anmelden, aber nichts aus später geladenen Dateien
aufrufen. Dadurch kann auch kein Timer und kein früher Klick eine Funktion
treffen, die noch nicht geladen ist.

### Warum `viewport.js` kein Modul sein darf

Der Galaxy-Fix schreibt Media-Queries im CSSOM um und muss **vor** dem ersten
Rendern laufen. Module werden vom Browser grundsätzlich verzögert ausgeführt
(wie `defer`) — der Fix käme zu spät und das Handy bekäme kurz das
Desktop-Layout zu sehen. Als klassisches Script wartet der Browser zusätzlich,
bis das vorangehende Stylesheet geladen ist. Genau das brauchen wir.

---

## Etappe 3a ist abgeschlossen — als Nächstes: Etappe 3b

Die frühere `core.js` ist vollständig auf `core/`, `ui/` und `features/`
aufgeteilt. Alle Kommentare in diesen Dateien sind englisch. Der Code selbst
wurde nur verschoben, nie verändert.

Etappe 3b stellt die Dateien auf ES-Module um (`import`/`export`). Zwei Dinge
sind dabei zu beachten:

- **96 Inline-Handler** im Markup (`onclick="goBack()"` und ähnlich) rufen
  rund 55 Funktionen auf. Module haben einen eigenen Gültigkeitsbereich,
  also müssen diese Funktionen ausdrücklich an `window` gehängt werden —
  sonst greifen die Handler ins Leere.
- Die Funktionen rufen sich quer über Dateien auf. Jede Datei braucht
  passende `import`-Zeilen.

---

## Aufräum-Kandidaten

Beim Aufteilen gefunden und bewusst nicht angefasst (Verschieben und Ändern
sind getrennte Commits):

- `core/boot.js` enthält `ENTRY_MODE` und `_prioritizeInitialImages()` doppelt,
  dazu zwei Start-Routinen auf `load`, die beide laufen
  (`updateSidebarStats()` läuft beim Start zweimal).
- `enterWorld()` (`features/map/world-view.js`): Der Ersatz bei einem nicht
  ladenden Weltbild baut einen fehlerhaften `onerror`-Handler — JS-Fehler statt
  Farbverlauf.
- Im Admin-Panel nicht erreichbar: `renderLotsTab()`, `renderExportTab()`
  (`features/admin/lot-editor.js`) und `renderCharsTab()`
  (`features/admin/character-admin.js`).
- Nie aufgerufen: `getCharsAtLot()` (`features/characters/tokens.js`),
  `getAgeGroup()` (`features/characters/character-view.js`).

---

## Bekannte Abhängigkeiten

Stellen, die lautlos brechen, wenn nur eine Seite geändert wird:

- **Charakterbogen → Daten-Dateien.** `character-sheet.html` lädt
  `src/atlas/data/buildings.js` und `src/atlas/data/world-lots.js` als Text und
  findet `BUILDINGS` und `worldLots` über ein Suchmuster (Schlüsselwort `const`,
  Name, Gleichheitszeichen, öffnende Klammer). Dieses Muster darf sonst nirgends
  in diesen Dateien vorkommen, auch nicht in einem Kommentar. Wandern oder
  heissen die Objekte anders, müssen die Pfade in `loadAtlasJsData_()`
  mitziehen — in Etappe 3b ersetzt durch ein gemeinsames Daten-Modul.
- **Apps Script → Simstagram.** Das Apps Script baut Links auf
  `simstagram.html#post-…` mit voller Adresse. Bei einem Adresswechsel muss
  das Script angepasst und neu bereitgestellt werden
  (siehe [MIGRATION.de.md](MIGRATION.de.md)).

---

## Was hier *nicht* liegt

Diese Werkzeuge laufen im Forum, nicht auf GitHub Pages. Sie stecken in den
Xobor-Feldern „Eigenes JavaScript" und Kopfzeile und sind von diesem Repo
unberührt:

- Last-Seen-Tracker
- Lot-Zuweisungs-Werkzeug
- Charakter-Editor
- Event-Pille (Forum-Fassung — wird später mit der ATLAS-Fassung zusammengeführt)
- Eve- und Delsyn-Begleiter (Forum-Kopfzeile)

---

## Backend

Unverändert und bewusst so:

- **Google Sheet** `1PmIvQOMLqO-54h3Xwi24MD2IHNrlycg_7-H7O51BRUc` hält
  Charaktere, Grundstücke und Events. Es ist zugleich die Pflege-Oberfläche —
  deshalb keine Datenbank.
  Tabellenblätter: Charaktere `474514580`, Grundstücke `306313316`,
  Events `1218058837`.
  Die Spaltennamen sind deutsch und Teil der Schnittstelle. Nicht umbenennen.
- **Apps Script** umgeht die CORS-Beschränkung und liefert die Daten aus.
  Änderungen dort brauchen ein erneutes Bereitstellen.
- **Bilder** liegen bei Xobor unter `files.homepagemodules.de`.

Das Sheet ist die Wahrheit für Namen, Adressen und Bilder. Der Hardcode in
`src/atlas/data/` enthält nur Koordinaten und `nr:`-Felder.
