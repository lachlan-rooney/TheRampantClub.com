# Converts the EXECUTED Membership Agreement .docx to markdown for the portal.
#
# THE GOVERNING RULE: the portal copy must be THE SAME TEXT that was signed. This
# does STRUCTURE ONLY — headings, bullets, paragraph breaks. It never rewrites,
# tidies or corrects wording, so the known defects ("Vientmaese", the blank
# Pioneer/Corporate VND fields) are carried through deliberately. If the portal
# showed a corrected version, the portal copy is the one a member would point at.
#
# THE SHAPE OF THE DOCUMENT, which is not obvious: the whole agreement is ONE
# two-column table, English in column 1 and Vietnamese in column 2. So the
# sections are table ROWS, not paragraphs — a first pass that looked for a
# paragraph called "APPLICATION FORM" cut nothing and would have published the
# signature blocks.
#
# REMOVED: every row from the first "APPLICATION FORM" onward — the blank
# application form and the club's countersignature block. On a web page those are
# rows of empty underscores, and the second carries the club signatory's name,
# which has no business on a read-only copy shown to all members.
import re, sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
zf = zipfile.ZipFile(sys.argv[1])
body = ET.fromstring(zf.read('word/document.xml')).find(f'{W}body')

def cell_lines(tc):
    """Cell paragraphs as SEPARATE lines — joining them with a space runs every
       bullet in a benefits list together into one unreadable sentence."""
    out = []
    for p in tc.findall(f'{W}p'):
        t = ''.join(n.text or '' for n in p.iter(f'{W}t')).strip()
        if t: out.append(t)
    return out

tbl = body.find(f'{W}tbl')
if tbl is None: sys.exit('no table found — document shape has changed')

rows = []
for tr in tbl.findall(f'{W}tr'):
    cells = [cell_lines(tc) for tc in tr.findall(f'{W}tc')]
    if cells: rows.append(cells)

cut = next((i for i, r in enumerate(rows)
            if r and r[0] and r[0][0].strip().upper().startswith('APPLICATION FORM')), len(rows))
removed = len(rows) - cut
rows = rows[:cut]

HEAD = re.compile(r'^[^a-z]{6,}$')

# The table's own column header ("ENGLISH" / "TIẾNG VIỆT") is a label on the
# layout, not a section of the agreement. It must not become a heading.
COLUMN_HEADER = {'ENGLISH', 'TIẾNG VIỆT', 'TIENG VIET'}

def to_md(lines_of_rows):
    out, in_list = [], False
    for lines in lines_of_rows:
        for t in lines:
            if t.strip().upper() in COLUMN_HEADER:
                continue
            bullet = t.startswith('–') or t.startswith('-')
            # A paragraph straight after a bullet run gets swallowed INTO the last
            # list item without a blank line between them.
            if in_list and not bullet:
                out.append('')
            if HEAD.match(t) and len(t) < 90:
                out += ['', f'## {t}', '']
            elif bullet:
                out.append('- ' + t.lstrip('–- ').strip())
            else:
                out += [t, '']
            in_list = bullet
    md = '\n'.join(out)
    return re.sub(r'\n{3,}', '\n\n', md).strip() + '\n'

TITLE = '# The Rampant Club — Membership Agreement\n\n*Bilingual Edition – Phiên bản Song ngữ*\n\n'
en = TITLE + to_md([r[0] for r in rows if len(r) > 0])
vn = TITLE + to_md([r[1] for r in rows if len(r) > 1])

open(sys.argv[2], 'w').write(en)
open(sys.argv[3], 'w').write(vn)
sys.stderr.write(f'rows kept: {cut} · signature rows removed: {removed}\n')
sys.stderr.write(f'EN {len(en)} chars → {sys.argv[2]}\nVN {len(vn)} chars → {sys.argv[3]}\n')
