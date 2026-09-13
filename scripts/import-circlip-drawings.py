#!/usr/bin/env python3
"""Parse the ordinary DIN 471/472 tables from supplier PDF text exports.

Use pdftotext -layout on the linked 060-440-001.pdf and 060-450-001.pdf
supplier drawings first. Later PDF pages describe thicker variants and must
not overwrite the ordinary stock dimensions with the same nominal diameter.
"""
import argparse
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
parser.add_argument('--output', type=Path, default=Path('src/catalog/data/circlip-dimensions.json'))
args = parser.parse_args()


def values(text):
    return [float(value.replace(',', '.').rstrip('*')) for value in text.split()]


def parse(filename, page_count, header, fields):
    rows = {}
    columns = []
    text = '\n'.join((args.directory / filename).read_text().split('\f')[:page_count])
    for line in text.splitlines():
        line = line.strip()
        match = re.match(header, line)
        if match:
            columns = values(match.group(1))
            for diameter in columns:
                if str(diameter) in rows:
                    raise ValueError(f'Duplicate nominal size in ordinary table: {diameter}')
                rows[str(diameter)] = {}
            continue
        for label, pattern in fields.items():
            match = re.match(pattern, line)
            if not match:
                continue
            dimensions = values(match.group(1))
            if len(dimensions) != len(columns):
                raise ValueError(f'{filename}: {label} has {len(dimensions)} values for {len(columns)} sizes')
            for diameter, dimension in zip(columns, dimensions):
                rows[str(diameter)][label] = dimension
    for diameter, row in rows.items():
        if set(row) != set(fields):
            raise ValueError(f'{filename}: incomplete size {diameter}: {row}')
    return rows


output = {
    'external': parse('060-440-001.txt', 2, r'^d\s+([\d,\s.*]+)$', {
        'a': r'^a\s+([\d,\s.]+)$', 'b': r'^b\s+([\d,\s.]+)$',
        'd3': r'^d3\s+([\d,\s.]+)$', 's': r'^s\s+([\d,\s.]+)$',
    }),
    'internal': parse('060-450-001.txt', 4, r'^dnom\s*=\s*d\s*1\s+(.+)$', {
        's': r'^s\s+([\d,\s.]+)$', 'd3': r'^d3\s*(?:1\))?\s+([\d,\s.]+)$',
        'd5 min': r'^d5 min\s+([\d,\s.]+)$', '~b': r'^~b\s+([\d,\s.]+)$',
    }),
}
args.output.write_text(json.dumps(output, indent=2) + '\n')
print({key: len(rows) for key, rows in output.items()})
