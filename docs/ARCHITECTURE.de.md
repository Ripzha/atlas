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
  shared/      Von mehreren Teilen genutzt: Backend-Adressen, CSV-Leser
  forum/       Scripts, die im Xobor-Forum laufen (siehe FORUM.de.md)
  atlas/       ATLAS-Anwendung (ES-Module)
    main.js    Einstieg: bindet alle Module ein
    window-bridge.js  Funktionen für Inline-Handler, an window gehängt
    config.js  Globale Konstanten (BASE, IMG, SCRIPT_URL, ADMIN_PASS)
    data/      Feste Daten: Gebäude, Welten, Grundstücks-Koordinaten, Strassennetz
    core/      Gemeinsamer Zustand, Sheet-Zugriff, Daten-Zwischenspeicher, Ereignisse, Bildgrössen, Start (boot.js)
    ui/        Übergreifende Oberflächen-Bausteine (Tooltips, Sheets, Zoom …)
    features/  Ein Ordner pro Fachbereich:
      map/           Kontinentkarte, Welt-Ansicht, Welten-Suche, Grundstücks-Hilfen
      characters/    Charakter-Ansicht, Portraits auf der Karte
      activity/      „Zuletzt gesehen", Seitenleisten
      otherworlds/   Portal und Ansicht „Andere Welten"
      buildings/     Etagenpläne, Gebäude-Kalibrierung
      routing/       Routenplaner, Routen-Editor
      admin/         Admin-Panel, Kalibrierung, Zuweisung
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

## Laden in `index.html`

1. `styles/atlas/atlas.css`
2. `src/atlas/ui/viewport.js` — **klassisches Script, kein Modul** (siehe unten)
3. `<link rel="modulepreload">` für jedes ATLAS-Modul — der Browser holt alle
   sofort parallel, statt sie Import für Import zu entdecken. Gemessen mit
   120 ms Verzögerung pro Datei: Module ohne Vorladen zeigten die Karte rund
   12 % später als die alten klassischen Scripts; mit Vorladen gleich schnell.
4. Markup
5. `<script type="module" src="src/atlas/main.js">` — der einzige ATLAS-Einstieg.
   Module laufen nach dem Einlesen des Dokuments, vor `DOMContentLoaded`.
6. `src/atlas/features/events/event-pill.js`, Loading-Screen-Markup und
   `src/atlas/ui/loading.js` — klassische Scripts, in sich geschlossen.

### Wie die Module zusammenspielen

- Jede Datei **importiert**, was sie braucht, und **exportiert**, was andere
  brauchen. Import-Pfade tragen dasselbe `?v=` wie die Seiten (siehe `tools/`).
- **Gemeinsamer, veränderlicher Zustand** liegt in einem Objekt, `state` in
  `core/state.js` (`state.currentWorld = w`). Importierte Variablen sind
  schreibgeschützt.
- **Inline-Handler** (`onclick="goBack()"`) laufen im globalen Raum. Die
  Funktionen, die sie aufrufen, hängt `window-bridge.js` an `window` — eine
  Liste, leicht zu prüfen.
- `main.js` führt alle Module auf; `core/boot.js` kommt zuletzt und startet
  die Seite bei `load`. Dateien definieren beim Laden nur und melden Listener an.
- Ereignisse statt Überschreiben: `on(name, fn)` / `emit(name, arg)` aus
  `core/events.js`. Im Einsatz: `'enter-world'` (die Suche merkt sich besuchte
  Welten) und `'sheet-lots-updated'` (offene Ansichten zeichnen nach einer
  Hintergrund-Aktualisierung neu). `core/events.js` importiert bewusst nichts:
  Module, die sich im Kreis importieren, wertet der Browser in selbst gewählter
  Reihenfolge aus — ein Modul ohne Importe ist immer zuerst bereit.

### Schneller Start: Daten-Zwischenspeicher

Die zuletzt geladenen Daten aus Google Sheet und Apps Script (Charaktere,
Grundstücke, Forum-Statistik, Forum-Aktivität) liegen im `localStorage`
(`core/cache.js`, Schlüssel `atlas_cache_v1:*`). Ab dem zweiten Besuch zeigt
ATLAS diese Daten sofort und lädt im Hintergrund frische nach
(„stale-while-revalidate"); Ansichten aktualisieren sich, wenn sich etwas
geändert hat. Der Ladebildschirm erscheint nur noch beim allerersten Besuch.

Der Start läuft bei `DOMContentLoaded`, nicht bei `load` — `load` würde auch auf
jedes Bild warten, auch auf die grosse Kontinentkarte.

Gemessen mit 1,5 s Verzögerung bei Apps Script und Sheet (zweiter Besuch):
Charakter-Portraits und „Zuletzt gesehen" erscheinen nach rund 0,4 s statt
4,9 s, die Forum-Aktivität nach 0,4 s statt 6,4 s, ohne Ladebildschirm.

### Bildgrössen

Xobor liefert jedes hochgeladene Bild in beliebiger Grösse; die Grösse steht in
der Adresse (`.../resize/1920x1200/<Datei>`). `core/images.js` ändert diesen
Teil, damit kleine Bilder klein angefragt werden: Portraits auf der Karte und
in den Seitenleisten mit 96 px Breite, Hover-Karten, Tooltips und
Charakter-Karten mit 400 px, Kacheln „Andere Welten" mit 640 px (etwa das
Zwei- bis Dreifache der Anzeige, damit es auf hochauflösenden Bildschirmen
scharf bleibt; `x9999` begrenzt nur die Breite und behält das Seitenverhältnis).
Kontinentkarte sowie Welt- und Gebäude-Hintergründe bleiben in voller Grösse,
weil man in sie hineinzoomen kann.

Gemessen auf Kontinentkarte, einer Welt und der Charakter-Ansicht: Von 50
Bild-Anfragen waren vorher 48 in voller Grösse (1920×1200), jetzt 2 — die
Karte und der Welt-Hintergrund.

### Warum `viewport.js` kein Modul sein darf

Der Galaxy-Fix schreibt Media-Queries im CSSOM um und muss **vor** dem ersten
Rendern laufen. Module werden vom Browser grundsätzlich verzögert ausgeführt
(wie `defer`) — der Fix käme zu spät und das Handy bekäme kurz das
Desktop-Layout zu sehen. Als klassisches Script wartet der Browser zusätzlich,
bis das vorangehende Stylesheet geladen ist. Genau das brauchen wir.

---

## Etappe 3 ist abgeschlossen

- 3a: die frühere `core.js` ist auf `core/`, `ui/` und `features/` aufgeteilt,
  alle Kommentare englisch.
- Aufräumen: doppelter Start zusammengeführt, Bild-Ersatz repariert, nicht
  erreichbare Admin-Werkzeuge entfernt.
- 3b: ES-Module mit ausdrücklichen Importen/Exporten, Zustands-Objekt,
  Window-Brücke, Vorladen der Module.

Weiterhin wirksam, aber nicht mehr bearbeitbar: Grundstücks-Anpassungen im
`localStorage` (`sw_custom_lots`, `sw_hidden_lots`, `sw_renamed_lots`), die
`getLots()` liest. Sie existieren nur in Browsern, in denen der frühere
Grundstücks-Editor benutzt wurde.

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
