#!/usr/bin/env python3
"""Check native board/host-fastener capture separately from TPU/frame capture.

Run with the FreeCAD bundled Python after the main native export. Interference
of the uncompressed TPU is a fitting/capture witness, not a force, damping or
strength result. Simple thread geometry is treated as a sourced threaded joint;
its actual engagement is checked separately from the complete rigid group.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import traceback

sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part

EPS = 1e-4
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--fixture', type=Path, default=Path('test-results/modular-tube-avionics/native-input.json'))
parser.add_argument('--assembly', type=Path, default=Path('test-results/modular-tube-avionics/assembly.FCStd'))
parser.add_argument('--output', type=Path, default=Path('test-results/modular-tube-avionics/full-assembly-audit/flight-retention-report.json'))
args = parser.parse_args()
fixture = json.loads(args.fixture.read_text())
report = {
    'fixtureSha256': hashlib.sha256(args.fixture.read_bytes()).hexdigest(),
    'assemblySha256': hashlib.sha256(args.assembly.read_bytes()).hexdigest(),
    'scope': 'Native geometric restraint and source-thread/bearing interfaces. TPU95A installation force, strain, damping, creep and clamp torque require physical qualification. The 0.5 mm probes are design reserves, not measured isolator travel.',
    'errors': [], 'groups': [],
}
root = Path(__file__).resolve().parents[1]
report['sourceSha256'] = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'src/parts/modular-tube-avionics/lib/flight.ts', Path(__file__).resolve()]}
doc = App.openDocument(str(args.assembly.resolve()))
shapes = {o.OccurrenceId: o.Shape.copy() for o in doc.Objects if hasattr(o, 'OccurrenceId') and hasattr(o, 'Shape')}
items = {i['id']: i for key in ['printed', 'payload', 'references'] for i in fixture.get(key, [])}
materials = {i['id']: i.get('material') for i in fixture['printed']}


def volume(shape):
    return sum(s.Volume for s in shape.Solids) if not shape.isNull() else 0.0


def common(a, b):
    return a.common(b) if not a.isNull() and not b.isNull() and a.Vertexes and b.Vertexes and a.BoundBox.intersect(b.BoundBox) else Part.Shape()


def hit(a, b):
    return volume(common(a, b))


def moved(shape, operation, axis, amount, center):
    s = shape.copy()
    vector = App.Vector(*[1 if i == axis else 0 for i in range(3)])
    if operation == 'translation':
        s.translate(vector * amount)
    else:
        s.rotate(App.Vector(*center), vector, amount)
    return s


def evaluate(item):
    scope = {'App': App, 'Part': Part, 'math': math}
    exec(compile(item['python'], item.get('id', 'reference'), 'exec'), scope)
    return scope['shape']


def pcb_and_holes(shape):
    # Purchased multi-board units stay one occurrence. Select their lowest thin
    # bare PCB by its actual native solid, rather than a populated envelope.
    candidates = [s for s in shape.Solids if .5 < s.BoundBox.ZLength < 1.8 and s.BoundBox.XLength > 15 and s.BoundBox.YLength > 15]
    if not candidates:
        raise ValueError('No native bare-PCB solid found')
    pcb = min(candidates, key=lambda s: s.BoundBox.ZMin)
    holes = []
    for face in pcb.Faces:
        surf = face.Surface
        if type(surf).__name__ != 'Cylinder' or abs(surf.Axis.z) < .999999:
            continue
        bb = face.BoundBox
        # Full internal cylinders, not quarter-cylinder rounded PCB corners.
        if not .8 <= surf.Radius <= 2.5 or abs(face.Area - 2*math.pi*surf.Radius*bb.ZLength) > .01:
            continue
        if abs(bb.ZLength - pcb.BoundBox.ZLength) > .01:
            continue
        x, y = surf.Center.x, surf.Center.y
        if any(abs(x-h['x']) < .01 and abs(y-h['y']) < .01 for h in holes):
            continue
        bottom = pcb.BoundBox.ZMin + .15
        height = pcb.BoundBox.ZLength - .3
        witness = Part.makeCylinder(surf.Radius + .6, height, App.Vector(x, y, bottom))
        holes.append({'x': x, 'y': y, 'radius': surf.Radius, 'bottom': bottom, 'height': height, 'shape': witness})
    return pcb, holes


def capture(moving, soft, center, holes=None, board_id=None):
    nominal = {name: hit(shape, soft) for name, shape in moving.items()}
    original_holes = [common(common(moving[board_id], soft), h['shape']) for h in holes or []]
    results = []
    for operation, travel in [('translation', .1), ('rotation', 1.0)]:
        for axis in range(3):
            for sign in [-1, 1]:
                delta, intrusion = {}, 0.0
                for name, shape in moving.items():
                    changed = moved(shape, operation, axis, sign*travel, center)
                    delta[name] = hit(changed, soft) - nominal[name]
                    if name == board_id:
                        for h, initial in zip(holes or [], original_holes):
                            current = common(common(changed, soft), h['shape'])
                            intrusion += volume(current.cut(initial)) if not current.isNull() else 0.0
                # A preloaded stem can have constant total overlap inside an
                # oversize hole. New intrusion at its actual source wall is the
                # relevant restraint, not an increase in a global volume sum.
                blocked = max([intrusion, *delta.values()]) > EPS
                results.append({'operation': operation, 'axis': 'XYZ'[axis], 'amount': sign*travel, 'memberOverlapDelta': delta, 'sourceHoleWallNewIntrusion': intrusion, 'blocked': blocked})
    return results


def source_joint(group, holes):
    results = []
    for name in group['rigidIds']:
        if 'screw' not in name:
            continue
        comp = items[name]['component']; par = comp['parameters']; pos = comp['placement']['translation']
        b = shapes[name].BoundBox; h = float(par['headHeight']); length = float(par['length']); r = float(par['diameter'])/2
        full = par.get('threadSpan') == 'full'
        # Native source shafts retain the catalog tip chamfer. Do not use the
        # inactive partial-thread length when the execution is full-threaded.
        tip_trim = min(.2*r, .65)
        if group['id'] == 'wing':
            # Actual source female-standoff cylindrical bore, coaxial with the
            # screw; its two-mm depth is distinct from the one-mm PCB hole.
            bores = []
            for face in shapes[group['boardId']].Faces:
                surf = face.Surface
                if type(surf).__name__ == 'Cylinder' and abs(surf.Axis.z) > .999 and abs(surf.Center.x-pos[0]) < .01 and abs(surf.Center.y-pos[1]) < .01 and r <= surf.Radius < r+.3 and face.BoundBox.ZLength > 1.5 and face.BoundBox.ZMin < b.ZMax and face.BoundBox.ZMax > b.ZMax-length:
                    bores.append(face.BoundBox)
            if not bores:
                raise ValueError('Source WING female standoff bore missing at '+name)
            bore = max(bores, key=lambda bb: bb.ZLength)
            full_end = b.ZMax-tip_trim
            engagement = max(0., min(full_end, bore.ZMax)-max(b.ZMax-length, bore.ZMin))
            gap = bore.ZMax-b.ZMax
            passed = full and engagement >= 1.4 and gap >= .25
            row = {'id': name, 'sourcePreset': comp['presetId'], 'femaleBoreSpan': [bore.ZMin,bore.ZMax], 'modeledFullDiameterEngagement': engagement, 'blindEndGap': gap, 'passed': passed}
        else:
            nut_id = name.replace('screw', 'nut'); nut = shapes[nut_id]
            # Distinguish source metal and nylon by their actual native solids.
            rings = sorted(nut.Solids, key=lambda s: s.Volume, reverse=True)
            nylon = min(rings, key=lambda s: s.Volume).BoundBox
            full_start = b.ZMin+tip_trim
            margin = nylon.ZMin-full_start
            passed = full and margin >= .5
            row = {'id': name, 'sourcePreset': comp['presetId'], 'nutId': nut_id, 'nylonSpan': [nylon.ZMin,nylon.ZMax], 'modeledFullDiameterTip': full_start, 'fullNylonEngagementMargin': margin, 'tipProtrusionPastNut': nut.BoundBox.ZMin-b.ZMin, 'passed': passed}
        results.append(row)
    return results

try:
    groups = fixture.get('flightMountGroups', [])
    if {g['id'] for g in groups} != {'wing', 'lch', 'usb'} or len(groups) != 3:
        raise ValueError('Fixture must declare exactly the three flightMountGroups')
    specs = fixture.get('flightContacts', [])
    if len(specs) != 3:
        raise ValueError('Fixture must declare exactly three flightContacts')
    tube = evaluate(fixture['tube'])
    for g in groups:
        soft = shapes[g['platformId']]; moving = {name: shapes[name] for name in g['rigidIds']}
        pcb, holes = pcb_and_holes(shapes[g['boardId']])
        spec = next(s for s in specs if set(s['ids']) == {g['platformId'],g['boardId']})
        nominal = hit(shapes[g['boardId']], soft)
        pcb_contact = hit(pcb, soft)
        row = {'id': g['id'], 'rigidIds': g['rigidIds'], 'platformId': g['platformId'], 'nativePlatformValid': soft.isValid() and len(soft.Solids)==1, 'nominalPreload': nominal, 'expectedPreload': spec['expectedVolume'], 'barePcbContact': pcb_contact, 'otherSourceContact': nominal-pcb_contact, 'sourceHoles': [{k:v for k,v in h.items() if k!='shape'} for h in holes]}
        row['nominalPassed'] = abs(nominal-spec['expectedVolume']) < .02 and nominal <= spec['maximumVolume'] and abs(nominal-pcb_contact) < EPS
        row['boardCapture'] = capture(moving, soft, g['center'], holes, g['boardId'])
        row['platformCapture'] = capture({g['platformId']:soft}, shapes['flight-frame'], g['center'])
        row['sourceJoints'] = source_joint(g, holes)
        # Rigid-only reserve against every installed hard neighbor and the tube.
        # Other soft pads can legitimately begin to deform; report separately.
        fixed = {name:s for name,s in shapes.items() if name not in g['rigidIds'] and materials.get(name) != 'TPU' and name not in {'flight-radio-receiver-reference','flight-radio-antenna-reference'}}
        fixed['cut-tube-reference'] = tube
        row['rigidReserves'] = []
        for axis in range(3):
            for sign in [-1,1]:
                hits = []
                for name,s in moving.items():
                    changed = moved(s,'translation',axis,sign*.5,g['center'])
                    for neighbor,obstacle in fixed.items():
                        v=hit(changed,obstacle)
                        if v > EPS: hits.append({'moving':name,'fixed':neighbor,'volume':v})
                row['rigidReserves'].append({'axis':'XYZ'[axis],'amount':sign*.5,'hits':hits})
        # Complete source+host hardware, assembled on the bench, passes the open
        # frame. These are sampled paths, not a strain simulation of TPU edges.
        excluded = set(g['rigidIds']) | {k for k in shapes if materials.get(k)=='TPU'} | {'grandado-drilled-body','grandado-through-cover','flight-lower-cover','flight-radio-receiver-reference','flight-radio-antenna-reference'}
        if g['id']=='usb': excluded |= {k for k in shapes if k.startswith('wing')}
        fixed = {name:s for name,s in shapes.items() if name not in excluded}
        row['loadedBenchEntry'] = {'directionZ':-1 if g['id']=='lch' else 1,'stroke':20,'samples':21,'hits':[],'scope':'External fairing/box and radio covers removed. USB precedes WING. Fold only TPU outer flanges; rigid source and hardware stay undeformed.'}
        dz=-20 if g['id']=='lch' else 20
        for sample in range(21):
            for name,s in moving.items():
                changed=moved(s,'translation',2,dz*sample/20,g['center'])
                for neighbor,obstacle in fixed.items():
                    v=hit(changed,obstacle)
                    if v > EPS: row['loadedBenchEntry']['hits'].append({'sample':sample,'moving':name,'fixed':neighbor,'volume':v})
        row['passed'] = row['nativePlatformValid'] and row['nominalPassed'] and all(x['blocked'] for key in ['boardCapture','platformCapture'] for x in row[key]) and all(x['passed'] for x in row['sourceJoints']) and all(not x['hits'] for x in row['rigidReserves']) and not row['loadedBenchEntry']['hits']
        report['groups'].append(row)
        if not row['passed']: report['errors'].append({'group':g['id'],'failure':'Native capture, source-thread, reserve or bench-entry gate failed'})
        args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({'group':g['id'],'passed':row['passed'],'nominal':nominal,'boardCaptureFailed':[x for x in row['boardCapture'] if not x['blocked']],'platformCaptureFailed':[x for x in row['platformCapture'] if not x['blocked']],'joint':row['sourceJoints'],'reserveHits':sum(len(x['hits']) for x in row['rigidReserves']),'entryHits':len(row['loadedBenchEntry']['hits'])}),flush=True)
except Exception as error:
    report['errors'].append({'failure':str(error), 'traceback':traceback.format_exc()})
finally:
    report['passed'] = not report['errors'] and len(report['groups'])==3
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2)+'\n')
    App.closeDocument(doc.Name)
print(json.dumps({'passed':report['passed'],'output':str(args.output),'errors':report['errors']}))
sys.exit(0 if report['passed'] else 1)
