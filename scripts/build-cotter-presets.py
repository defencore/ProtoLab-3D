"""Build DIN 94 presets from the saved Gvyntok inventory and supplier drawing."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src/catalog/data/gvyntok-shplinty-i-strubtsiny.json'
DRAWING = 'https://gvyntok.com/wp-content/uploads/2024/06/080-010-001.pdf'

# Nominal size: maximum shank diameter, approximate eye length, maximum eye width,
# minimum unequal-leg projection. Values are transcribed from the linked drawing.
DIMENSIONS = {
    1: (0.9, 3, 1.8, 0.8),
    1.2: (1, 3, 2, 1.25),
    1.6: (1.4, 3.2, 2.8, 1.25),
    2: (1.8, 4, 3.6, 1.25),
    2.5: (2.3, 5, 4.6, 1.25),
    3.2: (2.9, 6.4, 5.8, 1.6),
    4: (3.7, 8, 7.4, 2),
    5: (4.6, 10, 9.2, 2),
    6.3: (5.9, 12.6, 11.8, 2),
    8: (7.5, 16, 15, 2),
    10: (9.5, 20, 19, 3.15),
    13: (12.4, 26, 25.8, 3.15),
}


def build():
    snapshot = json.loads(SOURCE.read_text())
    records = [row for row in snapshot['products'] if row['standard'] == 'DIN 94']
    presets = []
    for row in records:
        nominal, length = row['diameter'], row['length']
        if nominal not in DIMENSIONS or not length:
            raise ValueError(f"Missing DIN 94 dimensional mapping for {row['sku']}")
        shank, eye_length, eye_width, tail = DIMENSIONS[nominal]
        designation = f'DIN 94 {nominal:g} × {length:g}'
        presets.append({
            'id': f"gvyntok-{row['sku']}",
            'name': designation,
            'description': 'Supplier size with maximum shank/eye width, approximate eye length and minimum leg projection from the drawing. Eye transitions and installation bends are prototype geometry.',
            'parameters': {
                'diameter': nominal,
                'length': length,
                'shankDiameter': shank,
                'eyeLength': eye_length,
                'eyeWidth': eye_width,
                'tailExtension': tail,
                'splitGap': round(shank * 0.015, 6),
                'bendAngle': 65,
                'bendPosition': 65,
                'bendRadius': round(shank * 0.7, 6),
            },
            'catalog': {
                'designation': designation,
                'standard': 'DIN 94 / ISO 1234 reference',
                'sourceName': 'Gvyntok',
                'sourceUrl': row['url'],
                'verifiedParameters': ['diameter', 'length', 'shankDiameter', 'eyeLength', 'eyeWidth', 'tailExtension'],
                'productCodes': [row['sku']],
                'alternateSourceUrls': [DRAWING],
            },
        })
    target = ROOT / 'src/catalog/generated/gvyntok-cotter-presets.json'
    target.write_text(json.dumps(presets, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Imported {len(presets)} DIN 94 presets representing {len(records)} supplier SKUs.')


if __name__ == '__main__':
    build()
