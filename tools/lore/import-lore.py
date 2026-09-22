#!/usr/bin/env python3
"""PROJECT ATLAS - Imports the occult lore from the Word document into
src/atlas/data/lore/lore.json.

The Word document stays the only source: never edit lore.json by hand, change
the document and run this again. Needs pandoc.

    python3 tools/lore/import-lore.py <Okkult-Lore.docx> src/atlas/data/lore/lore.json

Structure it expects (as in "Okkult-Lore_Gesamtfassung_geprueft.docx"):
  # 6. Vampire                  -> chapter
  **Enthaltene Punkte** + table -> skipped (the chapter's own table of contents)
  ## 6.3 Sonnenlicht ...        -> section, optional intro paragraphs
  ### 6.3.1 Sonnenempfindlichkeit -> point: the small building block shown as a card
  **Regel:** text               -> paragraph with a label (Regel, Gesichert, Offen,
                                   Überlieferung, Wichtig, Theorie)
  -   item                      -> list item
Everything before "# 1." (title page, overall table of contents) is skipped.
"""
import json, re, subprocess, sys, datetime, os

LABELS = {'gesichert':'gesichert','theorie':'theorie','offen':'offen','regel':'regel',
          'überlieferung':'ueberlieferung','wichtig':'wichtig'}
H1 = re.compile(r'^# (\d+)\.\s+(.+)$')
H2 = re.compile(r'^## (\d+\.\d+)\s+(.+)$')
H3 = re.compile(r'^### (\d+\.\d+\.\d+)\s+(.+)$')
H4 = re.compile(r'^#### (.+)$')
BULLET = re.compile(r'^\s*[-*+]\s{1,4}(.+)$')
MARK = re.compile(r'^\*\*([A-Za-zÄÖÜäöü ]{2,30}):\*\*\s*(.*)$')

def unescape(s):
    s = re.sub(r'\\([\\`*_{}\[\]()#+\-.!\'"<>|~^])', r'\1', s)
    return s.replace('\u00a0', ' ').strip()

def para(text):
    m = MARK.match(text)
    if m and m.group(1).strip().lower() in LABELS:
        return {'art': LABELS[m.group(1).strip().lower()], 'text': unescape(m.group(2))}
    return {'art': 'text', 'text': unescape(text)}

def main(src, dst):
    md = subprocess.run(['pandoc', '-t', 'markdown', '--wrap=none', src],
                        capture_output=True, text=True, check=True).stdout.split('\n')
    kapitel, k, a, p = [], None, None, None
    in_toc = False
    started = False
    heading_count = {'h1': 0, 'h2': 0, 'h3': 0}

    def target():
        # where a paragraph belongs: the current point, else section intro, else chapter intro
        if p is not None: return p['bloecke']
        if a is not None: return a['intro']
        if k is not None: return k['intro']
        return None

    for raw in md:
        line = raw.rstrip()
        m1, m2, m3 = H1.match(line), H2.match(line), H3.match(line)
        if m1:
            started = True; in_toc = False
            heading_count['h1'] += 1
            k = {'nr': m1.group(1), 'id': 'k' + m1.group(1), 'titel': unescape(m1.group(2)), 'intro': [], 'abschnitte': []}
            kapitel.append(k); a = None; p = None
            continue
        if not started:
            continue
        if line.strip() == '**Enthaltene Punkte**':
            in_toc = True; continue
        if m2:
            in_toc = False; heading_count['h2'] += 1
            a = {'nr': m2.group(1), 'id': 's' + m2.group(1).replace('.', '-'), 'titel': unescape(m2.group(2)), 'intro': [], 'punkte': []}
            k['abschnitte'].append(a); p = None
            continue
        if m3:
            in_toc = False; heading_count['h3'] += 1
            p = {'nr': m3.group(1), 'id': 'p' + m3.group(1).replace('.', '-'), 'titel': unescape(m3.group(2)), 'bloecke': []}
            a['punkte'].append(p)
            continue
        if in_toc or not line.strip():
            continue
        if H4.match(line):
            t = target()
            if t is not None: t.append({'art': 'zwischentitel', 'text': unescape(H4.match(line).group(1))})
            continue
        if re.match(r'^[+|]', line.strip()):   # stray table rows
            continue
        t = target()
        if t is None:
            continue
        b = BULLET.match(line)
        if b:
            item = unescape(b.group(1))
            if t and t[-1]['art'] == 'liste':
                t[-1]['punkte'].append(item)
            else:
                t.append({'art': 'liste', 'punkte': [item]})
            continue
        t.append(para(line.strip()))

    data = {
        'meta': {
            'quelle': os.path.basename(src),
            'importiert': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'hinweis': 'Automatisch erzeugt aus dem Word-Dokument. Nicht von Hand ändern.'
        },
        'kapitel': kapitel
    }
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    return data, heading_count

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    data, hc = main(sys.argv[1], sys.argv[2])
    n_a = sum(len(k['abschnitte']) for k in data['kapitel'])
    n_p = sum(len(a['punkte']) for k in data['kapitel'] for a in k['abschnitte'])
    print('Kapitel %d (Überschriften %d), Abschnitte %d (%d), Punkte %d (%d)'
          % (len(data['kapitel']), hc['h1'], n_a, hc['h2'], n_p, hc['h3']))
