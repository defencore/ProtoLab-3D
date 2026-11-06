"""Import public enclosure-family facts; do not infer internal geometry or supplier variants.

Run with Python 3.11+: python3 scripts/import-enclosure-catalog.py
The cache is outside the repository. Product dimensions use the supplier's A/B/C axes.
"""
from __future__ import annotations
import argparse
import concurrent.futures
import html
import json
import pathlib
import re
import tempfile
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://www.altinkaya.com'
arguments = argparse.ArgumentParser(description=__doc__)
arguments.add_argument('--cache', type=pathlib.Path, default=pathlib.Path(tempfile.gettempdir()) / 'altinkaya-catalog')
CACHE = arguments.parse_args().cache
GRANDADO = 'https://gbr.grandado.com/products/2pcs-83x58x35-mm-waterproof-clear-cover-plastic-electronic-cable-project-box-instrument-enclosure-case-white'
GROUP_IDS = {124, 125, 126, 127, 132, 185}
# Display profile sections, supports and panels are components rather than complete boxes.
COMPONENT_CATEGORY_IDS = {35, 36, 187}
CACHE.mkdir(exist_ok=True)


def fetch(path: str, base: str = BASE) -> str:
    file = CACHE / (path.strip('/').replace('/', '-').replace('?', '-').replace('=', '-') + '.html')
    if file.exists():
        return file.read_text()
    for attempt in range(3):
        try:
            request = urllib.request.Request(base + path, headers={'User-Agent': 'ProtoLab enclosure catalog importer'})
            with urllib.request.urlopen(request, timeout=45) as response:
                content = response.read().decode()
            file.write_text(content)
            return content
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1)
    raise RuntimeError('Unreachable fetch state')


def react_data(content: str) -> str:
    chunks = []
    for script in re.findall(r'<script[^>]*>(.*?)</script>', content):
        match = re.match(r'self\.__next_f\.push\((.*)\)', script)
        if match:
            value = json.loads(match[1])
            if value[0] == 1:
                chunks.append(value[1])
    return ''.join(chunks)


def field(data: str, key: str, array: bool = False):
    match = re.search('"' + key + '":' + (r'(?=\[)' if array else ''), data)
    if not match:
        return None
    return json.JSONDecoder().raw_decode(data[match.end():])[0]


def category(path: str) -> dict:
    content = fetch(path)
    result = field(react_data(content), 'result')
    if result is None:
        raise ValueError(f'Category has no public result: {path}')
    for page in range(2, (result['estimatedTotalHits'] + 19) // 20 + 1):
        if len(result['hits']) >= result['estimatedTotalHits']:
            break
        more = field(react_data(fetch(path + '?page=' + str(page))), 'result')
        previous = {item['source_id'] for item in result['hits']}
        result['hits'].extend(item for item in more['hits'] if item['source_id'] not in previous)
    if len(result['hits']) != result['estimatedTotalHits']:
        raise ValueError(f'Incomplete public category: {path}')
    title = html.unescape(re.sub('<[^>]+>', '', re.search(r'<h1[^>]*>(.*?)</h1>', content)[1]))
    return {'path': path, 'title': title, 'result': result}


def detail(item: dict) -> dict:
    data = react_data(fetch('/en/products/' + item['slug']))
    return {'source_id': item['source_id'], 'features': field(data, 'features', True),
            'attributeLines': field(data, 'attributeLines'), 'defaultVariant': field(data, 'defaultVariant')}


def numbers(values: list[str]) -> list[float]:
    return sorted(set(float(n.replace(',', '.')) for value in values for n in re.findall(r'\d+(?:[.,]\d+)?', value)))


def is_loose_component(name: str) -> bool:
    # Some supplier enclosure categories also contain individually sold support/cover parts.
    return bool(re.search(
        r'\b(?:PCB(?:\s+Board)?\s+Holder|(?:Inner|Corner)\s+Support|'
        r'(?:End|Intermediate)\s+(?:Section|Part)|Mounting\s+(?:Adaptor|Adapter)|'
        r'(?:Flanged|Indicator)\s+(?:(?:Aluminium|Aluminum)\s+)?Cover|'
        r'(?:Aluminium|Aluminum)\s+End\s+Panels?|'
        r'Upper\s+Flanged\s+(?:(?:Aluminium|Aluminum)\s+)?Panel|'
        r'Panel\s+For\s+Metal\s+Cabinet)\b', name, re.I))


def designation(name: str) -> str:
    # Keep the source spelling and spacing (e.g PT 210-01, HH 006).
    model = re.match(r'^([A-Z]{1,5}[- ]?\d[A-Za-z0-9]*(?:-\d[A-Za-z0-9]*)*)(?:\s|$)', name)
    if model and not model[1].startswith('IP-'):
        return model[1]
    shield_model = re.search(r'\bRF-\d+\b', name)
    return shield_model[0] if shield_model else name


def family(item: dict, info: dict, categories: dict[int, dict]) -> dict | None:
    if is_loose_component(item['name']):
        return None
    category_id = next((n for n in item['category_ids'] if n in categories and n not in GROUP_IDS), None)
    if category_id is None or category_id in COMPONENT_CATEGORY_IDS:
        return None
    features = {feature['name']: feature['values'] for feature in info['features']}
    attributes = {line['attribute_name']: [value['name'] for value in line['values']] for line in info['attributeLines']}
    dimensions = [item.get('dim_' + str(axis), 0) for axis in range(1, 4)]
    source_dimensions = [features.get(axis + ' (mm)', []) for axis in 'ABC']
    # Type options contain the actual discrete C depths for the two EC families whose listing C is zero.
    depth_options = numbers([value for value in attributes.get('Type', []) if re.search(r'\bDepth\b', value)])
    if not dimensions[2]:
        outside_depths = numbers(source_dimensions[2])
        if outside_depths:
            dimensions[2] = min(outside_depths)
    if not all(value > 0 for value in dimensions):
        return None
    name = item['name'].strip()
    category_info = categories[category_id]
    record = {
        'id': 'altinkaya-' + str(item['source_id']), 'manufacturer': 'Altinkaya',
        'designation': designation(name),
        'name': name, 'category': category_info['path'].rsplit('/', 1)[-1],
        'categoryLabel': category_info['title'], 'length': dimensions[0], 'width': dimensions[1], 'height': dimensions[2],
        'sourceUrl': BASE + '/en/products/' + item['slug'], 'sourceName': 'Altinkaya official product catalog',
        'dimensionsSource': 'Supplier A / B / C (mm): ' + ' × '.join(' / '.join(values) or str(dimensions[i]) for i, values in enumerate(source_dimensions)),
    }
    ranges = {}
    choices = {}
    stock_lengths = numbers(attributes.get('Length', []))
    detailed_depths = numbers(features.get('D1', []))
    for i, key in enumerate(['length', 'width', 'height']):
        values = numbers(source_dimensions[i])
        # A nominal Type depth may differ from outside C (e.g EC-1722: 130 vs 128).
        # Extend C only when the source's detailed D1 corroborates both C and the extra option.
        if i == 2 and values and detailed_depths and set(values).issubset(detailed_depths):
            values = sorted(set(values + [value for value in depth_options if value in detailed_depths]))
        if len(values) > 1:
            # Length labels become outside choices only if the complete explicit source axis
            # list and its endpoints agree. Never add an offset to an extrusion option.
            if stock_lengths and set(values).issubset(stock_lengths) and min(values) == min(stock_lengths) and max(values) == max(stock_lengths):
                values = stock_lengths
            choices[key] = values
            ranges[key] = {'min': min(values), 'max': max(values)}
            record[key] = min(values)
    if ranges:
        record['dimensionRanges'] = ranges
        record['dimensionOptions'] = choices
        record['referenceEnvelopeNote'] = 'Reference envelope uses the source minimum on variable axes. Size filters use the explicitly published outside choices, not every value between the summary bounds. Confirm compatible supplier options before ordering.'
        if stock_lengths and not any(set(options).issubset(stock_lengths) for options in choices.values()):
            record['referenceEnvelopeNote'] += ' Only the published outside endpoints are known for exact size filtering; nominal extrusion Length options are not substituted for assembled outside dimensions.'
    material = ' / '.join(features.get('Material', [])).strip()
    if material and material != 'V0':
        material = material.replace('Aluminium', 'Aluminum').replace('Alüminyum Levha', 'Aluminum sheet').replace('Poliamid Nylon', 'Polyamide Nylon')
        record['material'] = material
        record['materialOptions'] = attributes.get('Material', [material])
        has_metal = bool(re.search(r'Aluminum|DKP|Tin', material, re.I))
        has_plastic = bool(re.search(r'ABS|PC|SAN|ASA|Nylon|Propylene|Pleksi', material, re.I))
        record['materialFamily'] = 'Mixed plastic / metal' if has_metal and has_plastic else 'Aluminum' if 'Aluminum' in material else 'Steel' if 'DKP' in material else 'Tin' if 'Tin' in material else 'Plastic' if has_plastic else 'Other'
    elif 'aluminium' in name.lower() or 'aluminum' in name.lower():
        record['material'] = 'Aluminum'
        record['materialFamily'] = 'Aluminum'
    elif 'plastic' in name.lower():
        record['material'] = 'Plastic (polymer not specified)'
        record['materialFamily'] = 'Plastic'
    rates = features.get('IP Rate', [])
    rate = next((re.sub(r'^(?:IP)?', 'IP', value.strip(), flags=re.I) for value in rates if re.fullmatch(r'(?:IP)?\d{2}', value.strip(), re.I)), None)
    if not rate:
        match = re.search(r'\bIP\d{2}\b', name)
        rate = match[0] if match else None
    if rate:
        record['ipRating'] = rate
        if int(rate[2:]) >= 65:
            record['waterproofClaim'] = True
    label = category_info['title'].lower()
    for phrase, mounting in [('din rail', 'DIN rail'), ('din panel', 'Panel'), ('wall mount', 'Wall'), ('handheld', 'Handheld'), ('pocket', 'Handheld'), ('rack', 'Rack'), ('flanged', 'Flanged / surface'), ('wall plug', 'Plug-in'), ('laboratory', 'Desktop'), ('desktop', 'Desktop'), ('operator', 'Panel')]:
        if phrase in label:
            record['mounting'] = mounting
            break
    covers = attributes.get('Top Cover', []) + attributes.get('Lid Type', [])
    if covers:
        clear = any(re.search(r'Transparent|Clear|Şeffaf', cover, re.I) for cover in covers)
        opaque = any(not re.search(r'Transparent|Clear|Şeffaf|No Lid', cover, re.I) for cover in covers)
        opened = any('No Lid' in cover for cover in covers)
        record['lidOptions'] = [label for condition, label in [(opened, 'Open'), (clear, 'Clear'), (opaque, 'Opaque')] if condition]
        record['lid'] = ' / '.join(record['lidOptions'])
    record['description'] = f"{category_info['title']}. Supplier A/B/C dimensions in millimeters; family options require supplier confirmation."
    codes = item.get('variant_codes', '').split()
    if codes:
        record['productCodes'] = codes
    return record


def main():
    content = fetch('/en/categories/enclosures')
    paths = sorted(set(re.findall(r'href="(/en/categories/[^\"]+-\d+)"', content)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as workers:
        groups = list(workers.map(category, paths))
    categories = {int(group['path'].rsplit('-', 1)[-1]): group for group in groups}
    items = {item['source_id']: item for group in groups for item in group['result']['hits']}
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as workers:
        details = {item['source_id']: item for item in workers.map(detail, items.values())}
    records = [record for item in items.values() if (record := family(item, details[item['source_id']], categories))]
    source = fetch('/products/' + GRANDADO.rsplit('/', 1)[-1], 'https://gbr.grandado.com')
    product = next(json.loads(script) for script in re.findall(r'<script[^>]*>(.*?)</script>', source) if script.startswith('{') and json.loads(script).get('@type') == 'Product')
    if '83x58x35' not in product['name'].lower() or 'pvc' not in product['description'].lower():
        raise ValueError('Grandado product facts changed; review the source before updating')
    records.append({
        'id': 'grandado-83-58-35-clear', 'designation': '83×58×35 mm flanged project box',
        'name': 'Grandado · 83×58×35 mm flanged box · white lid (pictured)', 'category': 'waterproof-project-boxes',
        'categoryLabel': 'Waterproof project boxes', 'length': 83, 'width': 58, 'height': 35,
        'material': 'PVC', 'materialOptions': ['PVC'], 'materialFamily': 'Plastic',
        'lid': 'Opaque white (pictured)', 'lidOptions': ['Opaque white (pictured)'],
        'mounting': 'Flanged / surface mount', 'dimensionScope': 'body-excludes-mounts', 'waterproofClaim': True,
        'sourceUrl': GRANDADO, 'sourceName': 'Grandado product listing and original gallery',
        'dimensionsSource': 'Gallery image05 (https://images.nexusapp.co/assets/ee/c0/37/75844489.jpg): body 83 × 58 × 35 mm, excluding mounting ears; 4 mm callouts at a lid clearance hole and an ear hole. Overall mounted length and hole spacing are not published.',
        'description': 'Photographs show a white body and opaque white lid, although the retailer title describes a clear cover. The 83 × 58 × 35 mm dimensions describe the body, excluding two integral mounting ears centered on opposite short ends. Four corner lid clearance holes align with tall body posts containing brass threaded inserts. Six short floor bosses with central holes form a perimeter hexagon: one near each short end and two along each long side. Gallery image05 includes 4 mm hole callouts; screw thread, hole spacing, post dimensions and the total length including ears are not published. Listed as a two-box pack; one configuration represents one box. Waterproofing is a retailer claim without a numeric IP rating.',
        'productCodes': [product['sku']],
    })
    records.sort(key=lambda item: (item.get('manufacturer', 'ZZ'), item['categoryLabel'], item['designation']))
    output = ROOT / 'src/parts/catalog-enclosure/lib/catalog-data.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(records, indent=2, ensure_ascii=False) + '\n')
    imported = {record['id'] for record in records}
    omitted = [{'id': item['source_id'], 'name': item['name']} for item in items.values() if 'altinkaya-' + str(item['source_id']) not in imported]
    (CACHE / 'omitted.json').write_text(json.dumps(omitted, indent=2))
    print(f'Imported {len(records) - 1} Altinkaya enclosure families + 1 Grandado box. Excluded {len(omitted)} accessory entries.')


if __name__ == '__main__':
    main()
