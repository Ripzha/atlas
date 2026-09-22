#!/usr/bin/env python3
"""PROJECT ATLAS - Imports the occult lore into src/atlas/data/lore/lore.json.

Accepts the Word document (.docx, needs pandoc) and the forum drafts in BBCode
(.bbcode or .txt, one or more files; chapters may come in any order).

The Word document stays the only source: never edit lore.json by hand, change
the document and run this again. Needs pandoc.

    python3 tools/lore/import-lore.py <Okkult-Lore.docx> src/atlas/data/lore/lore.json
    python3 tools/lore/import-lore.py <k1.bbcode> <k2.bbcode> … src/atlas/data/lore/lore.json

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
SPAN = re.compile(r'\[([^\[\]]*)\]\{[^{}]*\}')   # pandoc's [text]{.mark} for highlighted Word text
MARK = re.compile(r'^\*\*([A-Za-zÄÖÜäöü ]{2,30}):\*\*\s*(.*)$')

def unescape(s):
    # pandoc writes highlighted or underlined Word text as [text]{.mark}; keep only the text
    s = re.sub(r'\[([^\[\]]*)\]\{[^{}]*\}', r'\1', s)
    s = re.sub(r'\\([\\`*_{}\[\]()#+\-.!\'"<>|~^])', r'\1', s)
    return s.replace('\u00a0', ' ').strip()

def para(text):
    m = MARK.match(text)
    if m and m.group(1).strip().lower() in LABELS:
        return {'art': LABELS[m.group(1).strip().lower()], 'text': unescape(m.group(2))}
    return {'art': 'text', 'text': unescape(text)}

# ---------- BBCode drafts -> the same lines the Word import produces ----------
BB_HEAD = re.compile(r'^\[big\]\[b\]\s*(\d+(?:\.\d+)*)\.?\s+(.+?)\s*\[/b\]\[/big\]\s*$')
BB_TOC_LINE = re.compile(r'^\d+(?:\.\d+)+\s+\S')
BB_MARK = re.compile(r'^\[b\]\s*([A-Za-zÄÖÜäöü ]{2,30}):\s*\[/b\]\s*(.*)$')
# Draft wording for markings that the Word version calls "Offen"
BB_MARK_ALIAS = {'nicht geklärt': 'Offen', 'nicht bewiesen': 'Offen', 'offen': 'Offen'}
BB_BOLD_LINE = re.compile(r'^\[b\](.+?)\[/b\]\s*$')

def bb_inline(s):
    s = re.sub(r'\[b\](.+?)\[/b\]', r'**\1**', s)
    s = re.sub(r'\[i\](.+?)\[/i\]', r'*\1*', s)
    return re.sub(r'\[/?(?:u|center|big|small|size[^\]]*|color[^\]]*)\]', '', s)

def bbcode_to_lines(text):
    """Turns a BBCode draft into heading/paragraph/list lines like pandoc's."""
    out, in_toc, in_list, pending_mark = [], False, False, None
    for raw in text.split('\n'):
        line = raw.strip()
        if not line:
            in_toc = False
            continue
        h = BB_HEAD.match(line)
        if h:
            in_toc = False
            depth = h.group(1).count('.') + 1
            nr = h.group(1) + ('.' if depth == 1 else '')
            out.append('#' * depth + ' ' + nr + ' ' + h.group(2).strip())
            continue
        if re.match(r'^\[b\]\s*Enthaltene Punkte:?\s*\[/b\]$', line):
            in_toc = True
            continue
        if in_toc and BB_TOC_LINE.match(line):
            continue
        in_toc = False
        if line == '[list]': in_list = True; continue
        if line == '[/list]': in_list = False; continue
        if in_list or line.startswith('[*]') or line.startswith('[]'):
            item = re.sub(r'^\[\*?\]', '', line).strip()
            if item: out.append('-   ' + bb_inline(item))
            continue
        m = BB_MARK.match(line)
        if m and m.group(1).strip().lower() in (set(LABELS) | set(BB_MARK_ALIAS)):
            label = BB_MARK_ALIAS.get(m.group(1).strip().lower(), m.group(1).strip())
            rest = m.group(2).strip()
            if rest: out.append('**' + label + ':** ' + bb_inline(rest))
            else: pending_mark = label       # the marking stands alone; it belongs to the next line
            continue
        b = BB_BOLD_LINE.match(line)
        if b and not pending_mark:
            out.append('#### ' + bb_inline(b.group(1)).strip())
            continue
        text_line = bb_inline(line)
        if pending_mark:
            text_line = '**' + pending_mark + ':** ' + text_line
            pending_mark = None
        out.append(text_line)
    return out

def read_source(paths):
    if len(paths) == 1 and paths[0].lower().endswith('.docx'):
        return subprocess.run(['pandoc', '-t', 'markdown', '--wrap=none', paths[0]],
                              capture_output=True, text=True, check=True).stdout.split('\n')
    lines = []
    for p in paths:
        with open(p, encoding='utf-8') as f:
            lines += bbcode_to_lines(f.read()) + ['']
    return lines

def main(srcs, dst):
    md = read_source(srcs)
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
        # Remove highlight wrappers first, so that "[**Regel:**]{.mark}" is still seen as a marking
        line = SPAN.sub(r'\1', raw.rstrip())
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

    kapitel.sort(key=lambda k: int(k['nr']))   # drafts may come in any order
    data = {
        'meta': {
            'quelle': ', '.join(os.path.basename(s) for s in srcs),
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
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    data, hc = main(sys.argv[1:-1], sys.argv[-1])
    n_a = sum(len(k['abschnitte']) for k in data['kapitel'])
    n_p = sum(len(a['punkte']) for k in data['kapitel'] for a in k['abschnitte'])
    print('Kapitel %d (Überschriften %d), Abschnitte %d (%d), Punkte %d (%d)'
          % (len(data['kapitel']), hc['h1'], n_a, hc['h2'], n_p, hc['h3']))
