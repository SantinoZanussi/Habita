"""Exporta la guía de QA a PDF y DOCX con las bibliotecas del runtime local."""
from pathlib import Path
import html
import re

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'docs/GUIA_QA_GRUPO.md'
OUT = ROOT / 'docs/entrega'
OUT.mkdir(parents=True, exist_ok=True)
TEXT = SOURCE.read_text(encoding='utf-8')
NAVY = '#102E46'
TEAL = '#087E8B'
GRAY = '#475569'

pdfmetrics.registerFont(TTFont('Habita', 'C:/Windows/Fonts/segoeui.ttf'))
pdfmetrics.registerFont(TTFont('HabitaBold', 'C:/Windows/Fonts/segoeuib.ttf'))
pdfmetrics.registerFontFamily('Habita', normal='Habita', bold='HabitaBold', italic='Habita', boldItalic='HabitaBold')

styles = {
    'title': ParagraphStyle('title', fontName='HabitaBold', fontSize=22, leading=26, textColor=colors.HexColor(NAVY), spaceAfter=6),
    'meta': ParagraphStyle('meta', fontName='Habita', fontSize=9, leading=12, textColor=colors.HexColor(TEAL), spaceAfter=12),
    'h2': ParagraphStyle('h2', fontName='HabitaBold', fontSize=12, leading=15, textColor=colors.HexColor(NAVY), spaceBefore=9, spaceAfter=5, keepWithNext=True),
    'h3': ParagraphStyle('h3', fontName='HabitaBold', fontSize=10.5, leading=13, textColor=colors.HexColor(TEAL), spaceBefore=7, spaceAfter=4, keepWithNext=True),
    'body': ParagraphStyle('body', fontName='Habita', fontSize=9.5, leading=12.5, textColor=colors.HexColor(NAVY), spaceAfter=6, alignment=TA_LEFT),
    'bullet': ParagraphStyle('bullet', fontName='Habita', fontSize=9.5, leading=12.5, textColor=colors.HexColor(NAVY), leftIndent=10, firstLineIndent=-8, spaceAfter=5),
    'cell': ParagraphStyle('cell', fontName='Habita', fontSize=9, leading=11.5, textColor=colors.HexColor(NAVY)),
    'headcell': ParagraphStyle('headcell', fontName='HabitaBold', fontSize=9, leading=11.5, textColor=colors.white),
}

def clean(s):
    return s.replace('`', '')

def rich(s):
    s = html.escape(clean(s))
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'https://[^\s<)]+', lambda m: '<a href="' + m[0] + '" color="' + TEAL + '">' + m[0] + '</a>', s)
    return s

def blocks():
    lines = TEXT.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1
        if not line:
            continue
        if line.startswith('|'):
            rows = []
            while True:
                if not re.match(r'^\|[\s|:-]+\|$', line):
                    rows.append([x.strip() for x in line.strip('|').split('|')])
                if i >= len(lines) or not lines[i].strip().startswith('|'):
                    break
                line = lines[i].strip()
                i += 1
            yield 'table', rows
        elif line.startswith('### '):
            yield 'h3', line[4:]
        elif line.startswith('## '):
            if line.startswith('## 4.'):
                yield 'break', ''
            yield 'h2', line[3:]
        elif line.startswith('# '):
            yield 'title', line[2:]
        elif line.startswith('- '):
            yield 'bullet', '• ' + line[2:]
        elif re.match(r'^\d+\. ', line):
            yield 'bullet', line
        elif line.startswith('Entrega de prueba'):
            yield 'meta', line
        else:
            yield 'body', line

def footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(colors.HexColor(TEAL))
    canvas.setLineWidth(1)
    canvas.line(18 * mm, 15 * mm, w - 18 * mm, 15 * mm)
    canvas.setFont('Habita', 8)
    canvas.setFillColor(colors.HexColor(GRAY))
    canvas.drawString(18 * mm, 10 * mm, 'HABITA  ·  Guía para QA cruzado  ·  06/11/2026')
    canvas.drawRightString(w - 18 * mm, 10 * mm, str(doc.page))
    canvas.restoreState()

story = []
for kind, value in blocks():
    if kind == 'break':
        story.append(PageBreak())
    elif kind == 'table':
        rows = [[Paragraph(rich(v), styles['headcell' if i == 0 else 'cell']) for v in row] for i, row in enumerate(value)]
        table = Table(rows, colWidths=[29 * mm, 44 * mm, 101 * mm], hAlign='LEFT')
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(NAVY)),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#F0F6F8'), colors.white]),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story += [table, Spacer(1, 7)]
    else:
        story.append(Paragraph(rich(value), styles[kind]))

pdf_path = OUT / 'Habita-Guia-para-testers.pdf'
SimpleDocTemplate(str(pdf_path), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm,
                  topMargin=15*mm, bottomMargin=21*mm,
                  title='Habita - Guía rápida para el equipo de QA', author='Equipo Habita').build(story, onFirstPage=footer, onLaterPages=footer)

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.2677), Inches(11.6929)
sec.top_margin = sec.bottom_margin = Inches(0.62)
sec.left_margin = sec.right_margin = Inches(0.7)
normal = doc.styles['Normal']
normal.font.name, normal.font.size = 'Calibri', Pt(10)
normal.font.color.rgb = RGBColor.from_string(NAVY[1:])
normal.paragraph_format.space_after = Pt(5)
normal.paragraph_format.line_spacing = 1.02
for name, size, color in [('Title', 22, NAVY), ('Heading 1', 12, NAVY), ('Heading 2', 10.5, TEAL)]:
    style = doc.styles[name]
    style.font.name = 'Calibri'
    style.font.size = Pt(size)
    style.font.color.rgb = RGBColor.from_string(color[1:])
    style.paragraph_format.space_before = Pt(8)
    style.paragraph_format.space_after = Pt(4)

def add_runs(p, s):
    for part in re.split(r'(\*\*.*?\*\*)', clean(s)):
        if part.startswith('**') and part.endswith('**'):
            p.add_run(part[2:-2]).bold = True
        else:
            # Word detecta los enlaces al abrir el documento; se agregan además como relaciones.
            chunks = re.split(r'(https://[^\s)]+)', part)
            for chunk in chunks:
                if chunk.startswith('https://'):
                    link = OxmlElement('w:hyperlink')
                    link.set(qn('r:id'), p.part.relate_to(chunk, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', is_external=True))
                    run = OxmlElement('w:r')
                    props = OxmlElement('w:rPr')
                    col = OxmlElement('w:color')
                    col.set(qn('w:val'), TEAL[1:])
                    props.append(col)
                    run.append(props)
                    text = OxmlElement('w:t')
                    text.text = chunk
                    run.append(text)
                    link.append(run)
                    p._p.append(link)
                else:
                    p.add_run(chunk)

for kind, value in blocks():
    if kind == 'break':
        doc.add_page_break()
    elif kind == 'table':
        table = doc.add_table(rows=0, cols=3)
        table.style = 'Light Shading Accent 1'
        for idx, row in enumerate(value):
            cells = table.add_row().cells
            for cell, s in zip(cells, row):
                p = cell.paragraphs[0]
                add_runs(p, s)
                p.paragraph_format.space_after = Pt(3)
                if idx == 0:
                    for run in p.runs:
                        run.bold = True
        for row in table.rows:
            row.cells[0].width, row.cells[1].width, row.cells[2].width = Inches(1.0), Inches(1.55), Inches(4.0)
    else:
        p = doc.add_paragraph(style={'title':'Title', 'h2':'Heading 1', 'h3':'Heading 2'}.get(kind, 'Normal'))
        add_runs(p, value)
        if kind == 'bullet':
            p.paragraph_format.left_indent = Inches(0.12)
            p.paragraph_format.first_line_indent = Inches(-0.12)
        if kind == 'meta':
            p.paragraph_format.space_after = Pt(10)
            for run in p.runs:
                run.font.color.rgb = RGBColor.from_string(TEAL[1:])
                run.font.size = Pt(9)

foot = sec.footer.paragraphs[0]
foot.add_run('HABITA  ·  Guía para QA cruzado  ·  06/11/2026  |  ')
field = OxmlElement('w:fldSimple')
field.set(qn('w:instr'), 'PAGE')
foot._p.append(field)
for run in foot.runs:
    run.font.size = Pt(8)
doc.core_properties.title = 'Habita - Guía rápida para el equipo de QA'
doc.core_properties.author = 'Equipo Habita'
doc.save(OUT / 'Habita-Guia-para-testers.docx')
print('Generados: PDF y DOCX en docs/entrega')
