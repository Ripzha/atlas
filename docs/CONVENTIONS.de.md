# Regeln

**Deutsch** · [English](CONVENTIONS.md)

Diese Regeln gelten für jede Datei in diesem Repo. Im Zweifel gilt:
Ordnung und Lesbarkeit gehen vor Raffinesse.

---

## 1. Sprache

| Was | Sprache |
|---|---|
| Datei- und Ordnernamen, Funktionen, Variablen, CSS-Klassen, IDs | Englisch |
| Kommentare im Code | Englisch |
| Commit-Nachrichten | Englisch |
| Dokumentation | Beides — `NAME.md` englisch, `NAME.de.md` deutsch |
| Alles, was Nutzer sehen (Knöpfe, Meldungen, Beschriftungen) | Deutsch |
| Spaltennamen im Google Sheet (`welt`, `nr.`, `thread url` …) | Deutsch, unverändert |

Beide Sprachfassungen eines Dokuments werden **im selben Commit** angepasst.

Die Spaltennamen im Sheet sind eine Schnittstelle, auf die sich auch die
Forum-Werkzeuge verlassen. Umbenennen legt diese Werkzeuge lahm.

Deutsche Anzeige-Texte folgen der Schweizer Rechtschreibung (`ss` statt `ß`)
und verwenden immer echte Umlaute (ä, ö, ü — nie ae, oe, ue).

---

## 2. Struktur

- Einstiegs-Seiten (`index.html`, `news.html` …) liegen im Wurzelverzeichnis.
- Code liegt in `src/<app>/`, CSS in `styles/<app>/` mit gleichem Aufbau.
- Ein Fachbereich = ein Ordner unter `features/`. Auf die Frage „wo liegt X"
  muss der Ordnername die Antwort sein.
- In `src/shared/` kommt Code erst, wenn mindestens zwei Seiten ihn nutzen.
- Keine leeren Ordner, keine Platzhalter-Dateien, keine Ordner mit nur einer
  belanglosen Datei.
- Kein doppelter Code. Brauchen zwei Stellen dasselbe, wird es ein Modul.

---

## 3. Benennung

| Art | Schreibweise | Beispiel |
|---|---|---|
| Dateien und Ordner | kebab-case | `event-pill.js`, `features/routing/` |
| Funktionen, Variablen | camelCase | `enterWorld`, `charCount` |
| Konstanten | UPPER_SNAKE_CASE | `APPS_SCRIPT_URL` |
| CSS-Klassen und IDs | kebab-case | `.char-card`, `#world-container` |

Namen beschreiben, was etwas ist oder tut. Keine Abkürzungen, die man
erklären muss.

---

## 4. JavaScript

- ES-Module (`import` / `export`). Eine Datei importiert alles, was sie
  braucht, und exportiert nur, was andere Dateien brauchen. Neue Module kommen
  in `main.js` und bekommen ein `<link rel="modulepreload">` in `index.html`.
- **Ausnahme:** `src/atlas/ui/viewport.js` bleibt ein klassisches Script
  (siehe [ARCHITECTURE.de.md](ARCHITECTURE.de.md)).
- Gemeinsamer, veränderlicher Zustand gehört ins Objekt `state`
  (`core/state.js`), nie in exportierte `let`-Variablen, die andere Dateien
  neu zuweisen müssten.
- Funktionen für Inline-Handler (`onclick="…"`) stehen in
  `src/atlas/window-bridge.js`. Neuer Code nutzt stattdessen `addEventListener`.
- Auf andere Features über Haken reagieren (z.B. `onEnterWorld`), nie deren
  Funktionen überschreiben.
- Ab Etappe 3 liegen die deutschen Anzeige-Texte eines Features in dessen
  `texts.js`, nicht verstreut in der Logik.
- Kein Build-Schritt, kein npm, kein Framework. Neue externe Bibliotheken
  nur nach ausdrücklichem Entscheid.

---

## 5. Marke

- Copyright: **© SimsForumRPG**
- Badge-Text: „Ein Projekt Atlas Feature"

---

## 6. Arbeitsweise

- Eine Änderung pro Commit. Nie Struktur und Adresse gleichzeitig ändern.
- Jede lokale CSS-/JS-Einbindung und jeder `import`-Pfad trägt ein
  `?v=`-Anhängsel. Vor jedem Commit, der CSS oder JS ändert,
  `sh tools/bump-version.sh` ausführen; es setzt überall dieselbe Nummer. Eine
  neue Einbindung oder ein neuer Import bekommt ihr `?v=` einmal von Hand
  (beliebige Zahl).
- Commit-Nachrichten: `<bereich>: <was sich ändert>`, englisch, in Befehlsform —
  z.B. `news: add issue 36`, `atlas: move routing into features/routing`.
- Nach jedem Push auf GitHub Pages testen, in dieser Reihenfolge:
  Kontinentkarte → Welt betreten → zurück · Charakter-Ansicht, Filter,
  Sortierung · Routenplaner · Admin-Bereich, Kalibrierung · Kiosk ·
  Handy: untere Leiste, Sheets, Event-Pille · im Forum über das iframe.

---

## Altbestand

Hält sich noch nicht an diese Regeln, wird in seiner Etappe umgestellt:

- Inline-Handler im Markup und im erzeugten HTML — nach und nach durch
  `addEventListener` ersetzen; bis dahin in `window-bridge.js` aufgeführt
- `styles/atlas/atlas.css` — deutsche Kommentare, Themen gemischt (Etappe 4)
- `simstagram.html`, `metaverse.html`, `character-sheet.html` — Single-Files
  mit CSS/JS im Dokument und deutschen Kommentaren (Etappe 5)
- `index_alt.html` — alter Single-File, nur noch als Rettungsanker
