"""Read complete uniform-solid AP214 surface colors without touching geometry.

Only direct solid/face surface styles are accepted. Curve colors are ignored.
The solid ordering must be evidenced by a single STEP shape representation;
otherwise callers retain an explicitly illustrative fallback color.
"""
import hashlib
import re


def source_solid_colors(text, expected_count):
    entities = {int(n): value.strip() for n, value in re.findall(r'#(\d+)\s*=\s*(.*?);', text, re.S)}
    refs = lambda value: [int(n) for n in re.findall(r'#(\d+)', value)]
    kind = lambda n: entities.get(n, '').split('(')[0].strip()
    solid_ids = [n for n in entities if kind(n) == 'MANIFOLD_SOLID_BREP']
    unknown = lambda reason: [dict(kind='illustrative', reason=reason) for _ in range(expected_count)]
    if len(solid_ids) != expected_count:
        return unknown('STEP manifold solid count does not match the native asset.')
    solid_set = set(solid_ids)
    orders = [
        [n for n in refs(value) if n in solid_set]
        for entity, value in entities.items()
        if kind(entity) in ('SHAPE_REPRESENTATION', 'ADVANCED_BREP_SHAPE_REPRESENTATION')
    ]
    order = next((items for items in orders if len(items) == expected_count and set(items) == solid_set), None)
    if order is None or order != solid_ids:
        return unknown('Native solid order is not established by one direct STEP shape representation.')

    def surface_color(entity, seen=None):
        seen = set() if seen is None else seen
        if entity in seen or entity not in entities:
            return None
        seen.add(entity)
        value = entities[entity]
        if kind(entity) == 'COLOUR_RGB':
            try:
                rgb = tuple(float(v) for v in value[value.find('(') + 1:-1].split(',')[1:])
                return rgb if len(rgb) == 3 and all(0 <= v <= 1 for v in rgb) else None
            except ValueError:
                return None
        if kind(entity) in ('CURVE_STYLE', 'POINT_STYLE'):
            return None
        for target in refs(value):
            rgb = surface_color(target, seen)
            if rgb is not None:
                return rgb
        return None

    styles = {}
    # The target is parsed separately from the style list, which can have more
    # than one assignment. This avoids mistaking a second style for the target.
    for value in entities.values():
        match = re.match(r"(?:OVER_RIDING_)?STYLED_ITEM\('[^']*',\((.*?)\),\s*#(\d+)", value, re.S)
        if not match:
            continue
        candidates = [surface_color(n) for n in refs(match.group(1))]
        colors = {rgb for rgb in candidates if rgb is not None}
        if len(colors) == 1:
            styles[int(match.group(2))] = next(iter(colors))

    result = []
    for solid in solid_ids:
        shells = refs(entities[solid])
        if len(shells) != 1 or kind(shells[0]) != 'CLOSED_SHELL':
            result.append(dict(kind='illustrative', reason='The STEP solid has no single direct closed shell.'))
            continue
        shell = shells[0]
        faces = refs(entities[shell])
        inherited = styles.get(solid, styles.get(shell))
        face_colors = [styles.get(face, inherited) for face in faces]
        colors = set(face_colors)
        if faces and len(colors) == 1 and None not in colors:
            rgb = next(iter(colors))
            result.append(dict(kind='source-step', rgb=list(rgb), stepSolidEntity=solid, faceCount=len(faces)))
        else:
            result.append(dict(kind='illustrative', reason='Source faces have mixed or incomplete surface colors; a uniform color cannot preserve them.', stepSolidEntity=solid, faceCount=len(faces)))
    return result


def packed_color(rgb):
    return sum(round(channel * 255) << (8 * (2 - i)) for i, channel in enumerate(rgb))


def geometry_fingerprint(asset):
    parts = [asset['sourceSha256'], asset['sourceFile']]
    for component in asset['components']:
        parts.extend(component[key] for key in ('id', 'brep', 'vertices', 'triangles'))
    return hashlib.sha256('\n'.join(parts).encode('utf-8')).hexdigest()
