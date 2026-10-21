"""Bake explicitly authored nominal XH-style 2.54 mm connector references.

FreeCAD Python: scripts/bake-xh254-connectors.py
The user explicitly specifies 2.54 mm pitch and supplies the two pinned photos.
Every other dimension is an authored nominal mechanical envelope. These assets
are not manufacturer CAD, measured product dimensions or rescaled JST 2.50 mm
geometry. The proposed paired guides prevent reversal in this authored pair;
the actual delivered header and cable housing must be measured and verified.
"""
import argparse
import base64
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import zlib

sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import MeshPart
import Part

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'src/parts/signal-connector'
HEADER_SOURCE = PACKAGE / 'lib/reference-images/xh254-pitch-reference.png'
MATE_SOURCE = PACKAGE / 'lib/reference-images/xh254-pair-reference.png'
STYLE_URL = 'https://www.hanbodianzi.com/shows/103/41.html'


def box(x, y, z, dx, dy, dz):
    return Part.makeBox(dx, dy, dz, App.Vector(x, y, z))


def joined(parts):
    return parts[0].multiFuse(parts[1:]).removeSplitter() if len(parts) > 1 else parts[0]


def header(poles):
    span = (poles - 1) * 2.54
    body = box(-2.9, -span - 2.45, 0, 5.8, span + 4.9, 7)
    cavity = box(-1.95, -span - 1.75, 1.4, 3.9, span + 3.5, 5.8)
    # Asymmetric guides are authored from the photographed XH-style pair.
    # Opposite-face wall stays intact, so a reversed rib stops above the pins.
    keys = [box(1.8, y - .55, 1.4, .8, 1.1, 5.8)
            for y in [-.75, -span + .75]]
    windows = [box(2.5, y - .55, 2.2, .6, 1.1, 1.4)
               for y in [-.75, -span + .75]]
    body = body.cut(joined([cavity, *keys, *windows]))
    pins = []
    for i in range(poles):
        y = -i * 2.54
        body = body.cut(box(-.34, y - .34, -.1, .68, .68, 1.6))
        pins.append(box(-.32, y - .32, -3.4, .64, .64, 8.6))
    body = body.removeSplitter()
    return [('White XH-style keyed shroud / authored nominal envelope', body, 0xeee9db), *[
        (f'Contact {i + 1} / 0.64 mm square pin', pin, 0xc8ac63)
        for i, pin in enumerate(pins)]]


def mate(poles):
    span = (poles - 1) * 2.54
    body = box(-1.65, -span - 1.45, 0, 3.3, span + 2.9, 6.7)
    ribs = [box(1.6, y - .4, 0, .8, .8, 4.6)
            for y in [-.75, -span + .75]]
    # The photographed wire-entry end has a broad grip/friction shoulder.
    shoulder = box(1.6, -span - 1.45, 5.0, 1.2, span + 2.9, .7)
    body = joined([body, *ribs, shoulder])
    for i in range(poles):
        body = body.cut(box(-.50, -i * 2.54 - .50, -.1, 1, 1, 6.9))
        # Small contact-retention windows match the supplied style photograph.
        body = body.cut(box(-1.8, -i * 2.54 - .4, 3.1, 1.6, .8, 1.3))
    return [('White XH-style mating housing / authored reference / contacts omitted', body.removeSplitter(), 0xeee9db)]


def side_facing(shape, translation=(0, 0, 0)):
    result = shape.copy()
    result.rotate(App.Vector(), App.Vector(0, 1, 0), -90)
    result.translate(App.Vector(*translation))
    return result


def bent_pin(y):
    # Constant 0.64 mm square section, with a 0.6 mm centreline bend radius.
    cx, cz, outer, inner = -.6, 2.3, .92, .28
    point = lambda x, z: App.Vector(x, y - .32, z)
    top_outer, right_outer = point(cx, cz + outer), point(cx + outer, cz)
    top_inner, right_inner = point(cx, cz + inner), point(cx + inner, cz)
    outer_mid = point(cx + outer / math.sqrt(2), cz + outer / math.sqrt(2))
    inner_mid = point(cx + inner / math.sqrt(2), cz + inner / math.sqrt(2))
    wire = Part.Wire([
        Part.Arc(top_outer, outer_mid, right_outer).toShape(),
        Part.makeLine(right_outer, right_inner),
        Part.Arc(right_inner, inner_mid, top_inner).toShape(),
        Part.makeLine(top_inner, top_outer),
    ])
    bend = Part.Face(wire).extrude(App.Vector(0, .64, 0))
    return joined([
        box(-7.7, y - .32, 2.58, 7.1, .64, .64),
        bend,
        box(-.32, y - .32, -3.4, .64, .64, 5.7),
    ])


def right_angle_header(poles):
    housing = side_facing(header(poles)[0][1], (-2.5, 0, 2.9))
    return [
        ('White side-facing XH-style shroud / authored nominal envelope', housing, 0xeee9db),
        *[(f'Bent contact {i + 1} / 0.64 mm square / nominal R0.6',
           bent_pin(-i * 2.54), 0xc8ac63) for i in range(poles)],
    ]


def b64(data):
    return base64.b64encode(zlib.compress(data, 9)).decode('ascii')


def bounds(shape):
    b = shape.BoundBox
    return [b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax]


def bake(id, pieces, source, url):
    sha = hashlib.sha256(source.read_bytes()).hexdigest()
    components = []
    for i, (label, solid, color) in enumerate(pieces):
        assert solid.isValid() and solid.isClosed() and len(solid.Solids) == 1 and solid.Volume > 0, (id, label)
        mesh = MeshPart.meshFromShape(Shape=solid, LinearDeflection=.025,
                                      AngularDeflection=.15, Relative=False)
        vertices, triangles = mesh.Topology
        triangles = [tuple(t) for t in triangles]
        edges = Counter(tuple(sorted((t[j], t[(j + 1) % 3]))) for t in triangles for j in range(3))
        assert all(count == 2 for count in edges.values()), (id, label, 'non-closed mesh')
        volume = sum(vertices[a].dot(vertices[b].cross(vertices[c])) / 6 for a, b, c in triangles)
        if volume < 0:
            triangles = [(a, c, b) for a, b, c in triangles]
            volume = -volume
        assert abs(volume - solid.Volume) < max(.001, solid.Volume * .001)
        raw = solid.exportBrepToString().encode('utf-8')
        points = struct.pack('<%sf' % (len(vertices) * 3), *[v for p in vertices for v in (p.x, p.y, p.z)])
        indices = struct.pack('<%sI' % (len(triangles) * 3), *[v for t in triangles for v in t])
        components.append(dict(id=f'authored-component-{i + 1}', label=label,
                               sourceSolid=i + 1, sourceSolids=1, color=color,
                               bounds=bounds(solid), volume=solid.Volume,
                               brep=b64(raw), brepSha256=hashlib.sha256(raw).hexdigest(),
                               vertices=b64(points), triangles=b64(indices),
                               vertexCount=len(vertices), triangleCount=len(triangles)))
    shape = Part.makeCompound([piece[1] for piece in pieces])
    return dict(id=id, sourceFile=source.name, sourceUrl=url, sourceSha256=sha,
                origin='Authored photo reconstruction with user-specified nominal 2.54 mm pitch. PCB Z=0; pin 1 X0/Y0; row -Y; polarization guides +X. Every remaining dimension needs delivered-pair verification. Not JST 2.50 mm or manufacturer CAD.',
                sourceKind='Authored user-photo reconstruction / nominal 2.54 mm',
                brepCompression='zlib', linearDeflection=.025,
                sourceSolids=len(components), bounds=bounds(shape),
                dimensions=[shape.BoundBox.XLength, shape.BoundBox.YLength, shape.BoundBox.ZLength],
                components=components)


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--right-angle-only', action='store_true',
                    help='Bake only the new side-facing variants; preserve straight assets.')
args = parser.parse_args()
assert HEADER_SOURCE.exists() and MATE_SOURCE.exists(), 'Both pinned user reference photos are required.'
evidence_path = PACKAGE / 'lib/color-evidence.json'
evidence = json.loads(evidence_path.read_text())
mate_path = PACKAGE / 'lib/xh254-mating.json'
mates = json.loads(mate_path.read_text()) if mate_path.exists() else []
for poles in [4, 5]:
    suffix = f'ra-{poles}' if args.right_angle_only else str(poles)
    asset = bake(f'xh254-balance-header-{suffix}',
                 right_angle_header(poles) if args.right_angle_only else header(poles),
                 HEADER_SOURCE, STYLE_URL)
    if args.right_angle_only:
        asset.update(
            origin='Authored side-facing 90-degree variant. PCB Z=0; vertical tail pin 1 X0/Y0; row -Y; mating opening faces -X. Body and pin-bend dimensions are inferred nominal interfaces, not manufacturer CAD or measured dimensions.',
            derivedFrom=f'xh254-balance-header-{poles}', pinTipX=-7.7,
            pinAxis=[-1, 0, 0], housingTransform=dict(rotationY=-90, translation=[-2.5, 0, 2.9]))
    target = PACKAGE / f'lib/native/{asset["id"]}.json'
    encoded = json.dumps(asset, separators=(',', ':')) + '\n'
    if not args.right_angle_only and target.exists():
        assert target.read_text() == encoded, f'Refusing to replace changed straight asset: {target.name}'
    else:
        target.write_text(encoded)
    fingerprint = '\n'.join([asset['sourceSha256'], asset['sourceFile'], *[
        value for c in asset['components'] for value in [c['id'], c['brep'], c['vertices'], c['triangles']]]]).encode()
    evidence['models'][asset['id']] = dict(sourceSha256=asset['sourceSha256'],
        geometryFingerprint=hashlib.sha256(fingerprint).hexdigest(),
        components=[dict(kind='illustrative', reason='Authored user-photo reconstruction has no source STEP surface colors.') for _ in asset['components']])
    mate_pieces = mate(poles)
    if args.right_angle_only:
        mate_pieces = [(label, side_facing(solid), color) for label, solid, color in mate_pieces]
    reference = bake(f'xh254-balance-mate-{suffix}', mate_pieces, MATE_SOURCE, STYLE_URL)
    reference.update(headerId=asset['id'], designation=f'Nominal XH-style 2.54 mm / {poles}-way cable housing',
        fullyMatedTranslation=[0, 0, 2.1], insertionAxis=[0, 0, -1],
        approachTravel=10, keyRibCentresY=[-.75, -(poles - 1) * 2.54 + .75],
        limitations='Authored mechanical housing envelope from user photos. Only nominal 2.54 mm pitch is specified by the user; shell, contacts, guides and friction fit are not supplier-verified. Contacts and wires omitted. Reverse-blocking proof applies to this authored pair only; verify the delivered matched pair.')
    if args.right_angle_only:
        reference.update(
            origin='Authored cable housing rotated -90 degrees about Y; row -Y. Apply fullyMatedTranslation relative to the right-angle header tail datum. Insertion is +X; withdrawal is -X. Dimensions require delivered-pair verification.',
            derivedFrom=f'xh254-balance-mate-{poles}',
            fullyMatedTranslation=[-4.6, 0, 2.9], insertionAxis=[1, 0, 0],
            outwardAxis=[-1, 0, 0], pinTipX=-7.7, pinAxis=[-1, 0, 0])
    mates = [old for old in mates if old['id'] != reference['id']] + [reference]
    print(asset['id'], asset['dimensions'], len(asset['components']), 'valid authored solids', flush=True)
evidence_path.write_text(json.dumps(evidence, indent=2) + '\n')
mate_path.write_text(json.dumps(mates, separators=(',', ':')) + '\n')
