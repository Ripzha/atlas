# Forum-Scripts

*English: [FORUM.md](FORUM.md)*

ATLAS-Funktionen, die im Xobor-Forum selbst laufen, nicht auf der ATLAS-Seite:

| Datei | Was sie tut | Wo sie erscheint |
|---|---|---|
| `src/forum/last-seen-tracker.js` | Popup „Standort aktualisieren" nach einem neuen RPG-Post: Welche Charaktere kommen vor? (Apps Script `updateLastSeen`) | Welt-Threads, eigener neuster Post, direkt nach dem Schreiben |
| `src/forum/character-editor.js` | Zahnrad „ATLAS": eigene Charaktere bearbeiten; neuen Bogen eintragen; archivierten entfernen (`updateChar`, `addChar`, `deleteChar`) | Charakterbogen-Foren |
| `src/forum/lot-assignment.js` | Popup „Grundstück zuweisen" für einen neuen Welt-Thread; Vorschaubild nach Bearbeiten von Post 1; neue Aussenwelt (`updateLot`) | Welt-Foren, „Orte ausserhalb von Simswelt" |
| `src/forum/event-pill.js` | Pille mit dem laufenden Event im Forum-Kopf, Panel mit Zusammenfassung (`events`) | Startseite und Portal |

Gemeinsam genutzt: `src/forum/main.js` (Einstieg), `page.js` (Forum-Seite
auslesen), `worlds.js` (Forum-Nummer → Welt), `src/shared/backend.js`
(Adressen von Apps Script und Sheet), `src/shared/csv.js` (CSV-Leser),
`src/shared/html.js` (Text fürs Markup entschärfen),
`src/shared/event-pill/event-pill.js` (die Pille selbst, gemeinsam mit der
Karte), `styles/forum/forum.css`.

## Wie sie geladen werden

Im Xobor-Feld **Administration → Design → Eigenes JavaScript** stehen die
Partikel- und Spendenbox-Scripts des Forums und ein kleiner Lader, der
`src/forum/main.js` als ES-Modul einbindet. Sonst liegt nichts von ATLAS in Xobor.

`main.js` wird **ohne** Versionsnummer geladen. Eine Änderung kommt darum nach
rund zehn Minuten im Forum an (Zwischenspeicher von GitHub Pages), ohne dass
Xobor angefasst wird. Alle Dateien, die es nachlädt, tragen die Versionsnummer
aus `tools/bump-version.sh` und kommen so immer als zusammengehöriger Satz an.

## Eine Forum-Funktion ändern

1. Datei in `src/forum/` ändern (oder die Styles in `styles/forum/forum.css`).
2. `sh tools/bump-version.sh`, committen, pushen.
3. Nach rund zehn Minuten nutzt das Forum die neue Fassung.

Das Xobor-Feld muss nur geändert werden, wenn sich die ATLAS-Adresse ändert.

## Bekannte Grenzen

- Charakternamen mit Komma gehen als kommagetrennte Liste ans Apps Script
  (`updateLastSeen`); so ein Name würde in zwei zerlegt.
- Ein Thread, dessen Adresse auf `-2.html`, `-3.html` … endet, sieht für Xobor
  und diese Scripts wie Seite 2, 3 … aus; dort erscheint das Grundstücks-Popup nicht.
