#!/usr/bin/env python3
"""Audit the Grandado reference model with FreeCAD's native geometry kernel.

Run with a FreeCAD-enabled Python. --prepare-only writes the exact current
TypeScript recipes without importing FreeCAD. All output is kept in the chosen
artifact directory; existing GUI documents are never opened or modified.
"""
from datetime import datetime, timezone
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'test-results/grandado-model')
parser.add_argument('--fixture', type=Path)
parser.add_argument('--prepare-only', action='store_true')
args = parser.parse_args()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=True)
fixture_path = args.fixture.resolve() if args.fixture else output / 'cases.json'

if not args.fixture:
    javascript = r"""
import assert from 'node:assert/strict';
import {grandadoSpec,grandadoPython,grandadoDimensions,grandadoPieces,grandadoRaisedRim,grandadoSupportLedge,grandadoBodyMeasurements} from './src/parts/catalog-enclosure/lib/grandado.ts';
import {grandadoRimPath} from './src/parts/catalog-enclosure/lib/grandado-rim.ts';
import {python as piecesPython} from './src/core/assembly/boundary/assembly.ts';
import part from './src/parts/catalog-enclosure/part.ts';
const parameters={model:'grandado-83-58-35-clear'};
const closed=grandadoPython('assembled');
assert.equal(part.python(parameters,'assembled'),closed);
assert.equal(part.python(parameters,'open'),closed);
assert.deepEqual(part.exportDimensions(parameters,'open'),[110,58,35]);
process.stdout.write(JSON.stringify({
  spec:grandadoSpec,
  measurements:grandadoBodyMeasurements,
  rimPath:grandadoRimPath(),
  rimPython:piecesPython([{shape:grandadoRaisedRim(),label:'Delivered-body raised rim',color:0xffffff}]),
  supportPython:piecesPython([{shape:grandadoSupportLedge(),label:'Inferred support ledge',color:0xffffff}]),
  physicalExportAlwaysClosed:true,
  cases:['assembled','open'].map(state=>({
    state,python:grandadoPython(state),expectedDimensions:grandadoDimensions(state),
    labels:grandadoPieces(state).map(piece=>piece.label),
  })),
}));
"""
    prepared = subprocess.run(
        ['node', '--import', 'tsx', '--input-type=module', '-e', javascript],
        cwd=ROOT, text=True, capture_output=True, check=True,
    )
    fixture_path.write_text(json.dumps(json.loads(prepared.stdout), indent=2) + '\n')

fixture = json.loads(fixture_path.read_text())
if args.prepare_only:
    print(json.dumps({'fixture': str(fixture_path), 'cases': len(fixture['cases'])}))
    sys.exit(0)

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

started = time.perf_counter()
spec = fixture['spec']
report = {
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'freecad': '.'.join(App.Version()[:3]),
    'physicalExportAlwaysClosed': fixture['physicalExportAlwaysClosed'],
    'sourceScope': 'Published closed envelope and 4 mm holes; user-measured22 mm hard body,1.8 mm raised rim,23.8 mm body including rim and6 mm ears. Remaining corner, ledge, deeper cavity and hardware morphology is qualified reconstruction.',
    'cases': [],
}


def inside(shape, x, y, z):
    return shape.isInside(App.Vector(x, y, z), 1e-7, False)


def cylinders_at(shape, x, y, radius):
    return [face for face in shape.Faces
            if isinstance(face.Surface, Part.Cylinder)
            and abs(face.Surface.Radius - radius) < 1e-7
            and abs(face.Surface.Center.x - x) < 1e-7
            and abs(face.Surface.Center.y - y) < 1e-7
            and abs(abs(face.Surface.Axis.z) - 1) < 1e-7]


def require_solid(shape, label):
    assert not shape.isNull() and shape.isValid(), (label, 'invalid native shape')
    assert shape.isClosed(), (label, 'open native shell')
    assert len(shape.Solids) == 1 and shape.Volume > 0, (label, 'expected one positive-volume solid')


original_documents = set(App.listDocuments())
original_active = App.ActiveDocument.Name if App.ActiveDocument else None
try:
    for case in fixture['cases']:
        row = {'state': case['state'], 'passed': False,
               'recipeSha256': hashlib.sha256(case['python'].encode()).hexdigest()}
        document = None
        try:
            scope = {'App': App, 'Part': Part}
            exec(compile(case['python'], f"Grandado-{case['state']}", 'exec'), scope)
            shape = scope['shape']
            components = scope['components']
            labels = scope['component_labels']
            assert labels == case['labels'] and len(components) == 10
            for component, label in zip(components, labels):
                require_solid(component, label)
            assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 10
            bounds = shape.BoundBox
            dimensions = [bounds.XLength, bounds.YLength, bounds.ZLength]
            assert max(abs(a-b) for a, b in zip(dimensions, case['expectedDimensions'])) < 1e-6, dimensions

            body, lid = components[:2]
            assert abs(spec['bodyTop']-spec['baseZ']-22) < 1e-9
            assert abs(spec['sealingRimTop']-spec['baseZ']-23.8) < 1e-9
            assert abs(spec['earTop']-spec['earZ']-6) < 1e-9
            assert abs(body.BoundBox.ZMax-spec['sealingRimTop']) < 1e-6
            rim_scope={'App':App,'Part':Part}
            exec(compile(fixture['rimPython'],'<measured-rim>','exec'),rim_scope)
            rim=rim_scope['shape']
            require_solid(rim,'measured raised rim')
            assert abs(rim.BoundBox.ZLength-1.8) < 1e-6
            assert len(rim.slice(App.Vector(0,0,1),spec['bodyTop']+.9)) == 2, 'rim must be one closed annular loop'
            assert rim.cut(body).Volume < 1e-6, 'complete raised rim belongs to source body'
            for segment in fixture['rimPath']:
                for x,y in segment['points']:
                    assert inside(body,x,y,spec['bodyTop']-.1), ('inferred ledge missing below raised rim',x,y)
            for x, y in spec['earCenters']:
                assert cylinders_at(body, x, y, 2), ('missing 4 mm ear bore', x, y)
                for z in [spec['earZ'] + .05, (spec['earZ'] + spec['earTop']) / 2, spec['earTop'] - .05]:
                    assert not inside(body, x, y, z), ('ear bore blocked', x, y, z)
                    assert inside(body, x, y + 2.7, z), ('ear annulus missing', x, y, z)

            for x, y in spec['pcbCenters']:
                assert cylinders_at(body, x, y, 1.3), ('missing PCB blind bore', x, y)
                assert cylinders_at(body, x, y, 3.5), ('missing PCB boss outside surface', x, y)
                assert inside(body, x, y, spec['pcbBossBoreBottom'] - .1), ('PCB bore penetrates blind web', x, y)
                assert not inside(body, x, y, spec['pcbBossTop'] - .1), ('PCB bore not open', x, y)
                assert inside(body, x + 2, y, spec['pcbBossTop'] - .2), ('PCB boss annulus missing', x, y)
                assert not inside(body, x + 2, y, spec['pcbBossTop'] + .1), ('PCB boss too tall', x, y)

            lift = spec['lidLift'] if case['state'] == 'open' else 0
            for index, (x, y) in enumerate(spec['screwCenters']):
                assert cylinders_at(body, x, y, 4.8), ('missing corner post', x, y)
                assert cylinders_at(body, x, y, 2.15), ('missing corner insert socket', x, y)
                assert inside(body, x, y, spec['screwBlindBottomZ']-.1), ('corner socket not blind', x, y)
                assert not inside(body, x, y, 0), ('corner socket obstructed', x, y)
                insert, screw = components[2 + index], components[6 + index]
                assert cylinders_at(insert, x, y, 2) and cylinders_at(insert, x, y, 1.4)
                assert inside(insert, x + 1.7, y, 4) and not inside(insert, x, y, 4)
                assert cylinders_at(lid, x, y, 2) and cylinders_at(lid, x, y, 3.4)
                assert cylinders_at(screw, x, y, 1.3) and cylinders_at(screw, x, y, 2.9)
                assert inside(screw, x, y, 10 + lift), ('screw shaft missing', index)
                assert not inside(screw, x, y, 16.8 + lift), ('screw cross recess missing', index)

            overlaps = []
            for index, first in enumerate(components):
                for other_index in range(index + 1, len(components)):
                    second = components[other_index]
                    if not first.BoundBox.intersect(second.BoundBox):
                        continue
                    common = first.common(second)
                    volume = 0 if common.isNull() else common.Volume
                    if volume > 1e-6:
                        overlaps.append({'first': labels[index], 'second': labels[other_index], 'volumeMm3': volume})
            assert not overlaps, ('unexpected physical-component interference', overlaps)

            artifact_stem = output / case['state']
            shape.exportBrep(str(artifact_stem) + '.brep')
            shape.exportStep(str(artifact_stem) + '.step')
            restored = Part.Shape()
            restored.read(str(artifact_stem) + '.step')
            assert restored.isValid() and len(restored.Solids) == 10
            assert abs(restored.Volume-shape.Volume) / shape.Volume < 1e-6

            document = App.newDocument('GrandadoNativeAudit')
            root = document.addObject('App::Part', 'GrandadoEnclosure')
            root.Label = 'Grandado enclosure · measured body and qualified reconstruction'
            for index, (component, label) in enumerate(zip(components, labels)):
                child = document.addObject('Part::Feature', f'Component{index + 1}')
                child.Label, child.Shape = label, component
                root.addObject(child)
            document.recompute()
            document.saveAs(str(artifact_stem) + '.FCStd')

            row.update(passed=True, components=len(components), solids=len(shape.Solids),
                       dimensionsMm=dimensions, volumeMm3=shape.Volume,
                       mountingEars=2, earHoleDiameterMm=4, blindPcbBosses=6,
                       cornerPosts=4, brassInserts=4, lidScrews=4,
                       interferences=overlaps, stepRoundtrip=True,
                       componentVolumesMm3=[component.Volume for component in components])
        except Exception as error:
            row['error'] = str(error)
        finally:
            if document and document.Name in App.listDocuments():
                App.closeDocument(document.Name)
        report['cases'].append(row)
        report.update(passed=sum(case['passed'] for case in report['cases']),
                      failed=sum(not case['passed'] for case in report['cases']),
                      elapsedSeconds=time.perf_counter() - started)
        (output / 'native-report.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(row), flush=True)
finally:
    assert set(App.listDocuments()) == original_documents, 'Existing FreeCAD documents changed'
    if original_active:
        App.setActiveDocument(original_active)

sys.exit(bool(report['failed']))
