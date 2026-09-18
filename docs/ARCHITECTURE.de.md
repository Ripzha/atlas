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
  shared/      Von mehreren Seiten genutzt (Konfiguration, API, Hilfsfunktionen)
  atlas/       ATLAS-Anwendung
    core/      Zustand, Datenzugriff
    data/      Statische Daten (Gebäude, Portalwelten, Routen, Farben)
    features/  Fachliche Bereiche, je Ordner ein Thema
    ui/        Übergreifende Oberflächen-Bausteine
  news/        Kiosk
  simstagram/  Feed
  metaverse/   Blog

styles/        CSS, gespiegelt zur src-Struktur
docs/          Diese Unterlagen
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
4. `src/atlas/core.js`
5. `src/atlas/features/events/event-pill.js`
6. Loading-Screen-Markup, danach `src/atlas/ui/loading.js`

### Warum `viewport.js` kein Modul sein darf

Der Galaxy-Fix schreibt Media-Queries im CSSOM um und muss **vor** dem ersten
Rendern laufen. Module werden vom Browser grundsätzlich verzögert ausgeführt
(wie `defer`) — der Fix käme zu spät und das Handy bekäme kurz das
Desktop-Layout zu sehen. Als klassisches Script wartet der Browser zusätzlich,
bis das vorangehende Stylesheet geladen ist. Genau das brauchen wir.

---

## Zustand von `core.js`

`core.js` ist noch die ungeteilte Kern-Logik aus dem früheren Single-File
(4987 Zeilen, 111 Funktionen im globalen Namensraum, Kommentare noch deutsch).
Die Aufteilung in die `features/`-Ordner ist Etappe 3.

Zwei Dinge sind dabei zu beachten:

- **96 Inline-Handler** im Markup (`onclick="goBack()"` und ähnlich) rufen
  52 verschiedene Funktionen auf. Module haben einen eigenen Gültigkeitsbereich,
  also müssen diese Funktionen ausdrücklich an `window` gehängt werden —
  sonst greifen die Handler ins Leere.
- Die Funktionen rufen sich quer durcheinander auf. Jeder Schnitt braucht
  passende `import`-Zeilen.

---

## Bekannte Abhängigkeiten

Stellen, die lautlos brechen, wenn nur eine Seite geändert wird:

- **Charakterbogen → `core.js`.** `character-sheet.html` lädt
  `src/atlas/core.js` als Text und holt sich `worldLots` und `BUILDINGS`
  über die Suche nach `const worldLots = {` und `const BUILDINGS = {`.
  Wandern oder heissen diese Objekte anders (Etappe 3), müssen Ladepfad und
  Suchmuster in `loadAtlasJsData_()` mitziehen — am besten ersetzt durch ein
  gemeinsames Daten-Modul, das beide Seiten einbinden.
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
`core.js` enthält nur Koordinaten und `nr:`-Felder.
