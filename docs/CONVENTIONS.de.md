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

- ES-Module (`<script type="module">`, `import` / `export`).
- **Ausnahme:** `src/atlas/ui/viewport.js` bleibt ein klassisches Script
  (siehe [ARCHITECTURE.de.md](ARCHITECTURE.de.md)).
- Funktionen, die aus Inline-Handlern im Markup (`onclick="…"`) aufgerufen
  werden, hängen ausdrücklich an `window` — an einer Stelle pro Feature-Modul,
  bis die Inline-Handler ersetzt sind.
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
- Jede lokale CSS-/JS-Einbindung trägt ein `?v=`-Anhängsel. Vor jedem Commit,
  der CSS oder JS ändert, `sh tools/bump-version.sh` ausführen. Eine neue
  Einbindung bekommt ihr `?v=` einmal von Hand; eine neue Datei mit solchen
  Einbindungen wird im Script bei `FILES` ergänzt.
- Commit-Nachrichten: `<bereich>: <was sich ändert>`, englisch, in Befehlsform —
  z.B. `news: add issue 36`, `atlas: move routing into features/routing`.
- Nach jedem Push auf GitHub Pages testen, in dieser Reihenfolge:
  Kontinentkarte → Welt betreten → zurück · Charakter-Ansicht, Filter,
  Sortierung · Routenplaner · Admin-Bereich, Kalibrierung · Kiosk ·
  Handy: untere Leiste, Sheets, Event-Pille · im Forum über das iframe.

---

## Altbestand

Hält sich noch nicht an diese Regeln, wird in seiner Etappe umgestellt:

- `src/atlas/` — globale Funktionen in klassischen Scripts statt ES-Modulen (Etappe 3b)
- `styles/atlas/atlas.css` — deutsche Kommentare, Themen gemischt (Etappe 4)
- `simstagram.html`, `metaverse.html`, `character-sheet.html` — Single-Files
  mit CSS/JS im Dokument und deutschen Kommentaren (Etappe 5)
- `index_alt.html` — alter Single-File, nur noch als Rettungsanker
