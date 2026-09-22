# Okkult-Lore

**Deutsch** · [English](LORE.md)

Die Okkult-Lore ist eine eigene Ansicht in ATLAS. Sie öffnet sich über
„🔮 Okkult-Lore" in der linken Leiste und im Handy-Menü.

## Grundsatz: keine Textwand

Die Lore ist lang, aber sie besteht aus vielen kleinen Einheiten — im Mittel
rund 20 Wörter pro Unterpunkt. Die Ansicht zeigt deshalb nie alles auf einmal:

1. **Übersicht:** das Rad der Wesen und die Bibliothek. Ein Wesen zeigt seine
   Kurzbeschreibung und seine Themen als Kacheln.
2. **Thema:** nur die Wissenskarten des gewählten Themas. Links die Themenliste
   zum Wechseln, darüber „Alle Themen" für das ganze Kapitel, oben ein Filter
   nach Markierungen (Regeln, Gesichert, Offen …).

„← Zurück" geht eine Stufe hoch: vom Thema zur Übersicht, von der Übersicht
zurück zur Karte.

## Woher die Inhalte kommen

Einzige Quelle ist das **Word-Dokument der Lore**:
`src/atlas/data/lore/Okkult-Lore.docx`. Daraus erzeugt
`tools/lore/import-lore.py` die Datei `src/atlas/data/lore/lore.json`, die
ATLAS liest.

Farbige Markierungen im Word-Dokument (etwa gelb hinterlegte Ergänzungen zur
Prüfung) stören den Import nicht: Der Text wird mit oder ohne Farbe gleich
gelesen. `lore.json` wird **nie von Hand geändert** — beim nächsten Import
wäre die Änderung weg.

ATLAS lädt die Lore erst, wenn jemand die Ansicht öffnet. Die Karte startet
dadurch nicht langsamer.

## Eine neue Fassung einspielen

1. Neue Fassung des Word-Dokuments bereitstellen.
2. Import ausführen (braucht `pandoc`):

   ```bash
   python3 tools/lore/import-lore.py src/atlas/data/lore/Okkult-Lore.docx src/atlas/data/lore/lore.json
   ```

   Der Importer liest auch Kapitel-Entwürfe in BBCode aus dem Forum
   (`[big][b]6.1 …[/b][/big]`, eine oder mehrere Dateien, Reihenfolge egal):

   ```bash
   python3 tools/lore/import-lore.py kapitel-06.bbcode kapitel-07.bbcode src/atlas/data/lore/lore.json
   ```

   Das Skript meldet, wie viele Kapitel, Abschnitte und Punkte es gefunden
   hat, und vergleicht sie mit den Überschriften im Dokument. Die Zahlen
   müssen paarweise gleich sein.
3. `sh tools/bump-version.sh`, committen, pushen.

## Was das Dokument einhalten muss

Der Importer erkennt den Aufbau an der Nummerierung der Überschriften:

| Im Dokument | Wird in ATLAS zu |
|---|---|
| `# 6. Vampire` (Überschrift 1) | Kapitel |
| `## 6.3 Sonnenlicht …` (Überschrift 2) | Thema |
| `### 6.3.1 Sonnenempfindlichkeit` (Überschrift 3) | Wissenskarte |
| Thema ohne Unterpunkte | eine einzelne Karte |
| „**Enthaltene Punkte**" mit Tabelle | wird übersprungen (Inhaltsverzeichnis) |
| Alles vor `# 1.` | wird übersprungen (Titelseite, Gesamtverzeichnis) |

Markierungen am Absatzanfang werden zu Abzeichen und füttern den Filter:
`**Regel:**`, `**Gesichert:**`, `**Wichtig:**`, `**Theorie:**`,
`**Überlieferung:**`, `**Offen:**`. Aufzählungen bleiben Aufzählungen,
**fett** und *kursiv* bleiben erhalten.

**Kurzbeschreibung eines Wesens:** Die Übersicht zeigt den ersten Satz des
Kapitels als Kurzbeschreibung. Ein kurzer Einleitungssatz direkt unter der
Kapitelüberschrift wird dafür bevorzugt.

## Welche Kapitel wo stehen

`src/atlas/features/lore/families.js` legt fest, welches Kapitel ins Rad
kommt (Wesen, mit Farbe und Symbol) und welches in die Bibliothek (Wissen).
Das Rad beantwortet „wer", die Bibliothek „wo, wie, was". Im Rad stehen darum
immer Wesen („Waldwesen", nicht „Zauberwald"), und ist ein Bibliothekskapitel
gewählt, bleibt die Mitte des Rads neutral.
Bekommt das Dokument neue Kapitel oder andere Nummern, wird nur diese Datei
angepasst.

## Dateien

| Datei | Aufgabe |
|---|---|
| `src/atlas/data/lore/Okkult-Lore.docx` | die Lore als Word-Dokument, einzige Quelle |
| `tools/lore/import-lore.py` | Word-Dokument oder BBCode-Entwürfe → `lore.json` |
| `src/atlas/data/lore/lore.json` | die Lore als Daten, erzeugt |
| `src/atlas/features/lore/lore-view.js` | Ansicht: Rad, Themen, Karten, Filter |
| `src/atlas/features/lore/lore-data.js` | Laden und Aufbereiten der Daten |
| `src/atlas/features/lore/families.js` | Kapitel → Rad oder Bibliothek, Farben, Symbole |
| `src/atlas/features/lore/texts.js` | deutsche Oberflächentexte, Namen der Markierungen |
| `styles/atlas/lore.css` | Aussehen, alles unter `#lore-container` |
