"""Read-only audit of temporal fields available in the configured snapshots."""
import json
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
config = json.loads((ROOT / 'data/sources.json').read_text())

for quarter, filename in config['sales'].items():
    with zipfile.ZipFile(filename) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            with archive.open('xl/sharedStrings.xml') as source:
                for _, element in ET.iterparse(source, events=('end',)):
                    if element.tag == NS + 'si':
                        strings.append(''.join(t.text or '' for t in element.iter(NS + 't')))
                        element.clear()
        for sheet in archive.namelist():
            if not sheet.startswith('xl/worksheets/sheet') or not sheet.endswith('.xml'):
                continue
            with archive.open(sheet) as source:
                headers = {}
                counts = Counter()
                sample = []
                for _, row in ET.iterparse(source, events=('end',)):
                    if row.tag != NS + 'row':
                        continue
                    cells = {}
                    for cell in row.findall(NS + 'c'):
                        text = cell.findtext(NS + 'v')
                        if cell.get('t') == 's' and text is not None:
                            text = strings[int(text)]
                        elif cell.get('t') == 'inlineStr':
                            text = ''.join(t.text or '' for t in cell.iter(NS + 't'))
                        if text:
                            cells[''.join(c for c in cell.get('r') if c.isalpha())] = text
                    if not headers:
                        headers = cells
                    else:
                        counts['rows'] += 1
                        temporal = {name: cells.get(col) for col, name in headers.items()
                                    if name.startswith('Дата') or name.startswith('Количество дней')}
                        for name, v in temporal.items():
                            if v is not None: counts[name + ':filled'] += 1
                        if len(sample) < 2: sample.append(temporal)
                    row.clear()
                print(json.dumps({'quarter': quarter, 'file': Path(filename).name,
                                  'sheet': sheet, 'headers': headers, 'counts': counts,
                                  'temporalSample': sample}, ensure_ascii=False), flush=True)
