#!/usr/bin/env python3
"""Check the independent preserved fairing with FreeCAD, without opening a document."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='test-results/jcg108-tube-fairing')
parser.add_argument('--prepare-only', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = (root / args.output).resolve()
out.mkdir(parents=True, exist_ok=True)

prepare = r'''
import fs from 'node:fs';
import part from './src/parts/jcg108-tube-fairing/part.ts';
import {fairingSpec,fairingOuterEnvelope} from './src/parts/jcg108-tube-fairing/lib/fairing.ts';
import {pythonShape} from './src/core/assembly/boundary/shapes.ts';
import {libraries,antennaOccurrence,anchorOccurrences,configuredPieces} from './src/parts/jcg108-tube-fairing/lib/model.ts';
import {componentPython} from './src/core/assembly/detail-instances.ts';
const p=part.defaults;
const variants=[
  ['nominal',p],
  ['reverse-flow',{...p,airflowDirection:'negative-x'}],
  ['minimum-fit',{...p,antennaDepth:7.6,antennaBondline:0}],
  ['maximum-fit',{...p,antennaDepth:9.6,antennaBondline:1}],
];
const result={partId:part.id,cases:variants.map(([id,p])=>({id,parameters:p,spec:fairingSpec(p),python:part.python(p,'fairing-only')})),
  printPython:part.python(p,'print-only'),
  antennaPython:componentPython(libraries,[antennaOccurrence(p)]),
  tubePython:componentPython(libraries,configuredPieces(p,'assembled').filter(v=>v.component.id==='host-pipe-reference')),
  anchorsPython:componentPython(libraries,anchorOccurrences(p)),
  outerPython:'shape = '+pythonShape(fairingOuterEnvelope(p)),
};
console.log(JSON.stringify(result));
'''
prepared = subprocess.run(['node', '--import', 'tsx', '--input-type=module', '-e', prepare], cwd=root, text=True, capture_output=True, check=True)
data = json.loads(prepared.stdout)
source_files = sorted((root / 'src/parts/jcg108-tube-fairing').rglob('*'))
data['sourceHashes'] = {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest() for path in source_files if path.is_file()}
(out / 'native-input.json').write_text(json.dumps(data, indent=2) + '\n')
if args.prepare_only:
    print('Prepared', out / 'native-input.json')
    sys.exit(0)

sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
import math

started = time.monotonic()
documents = set(App.listDocuments())
active = App.ActiveDocument.Name if App.ActiveDocument else None
report = {'partId': data['partId'], 'sourceHashes': data['sourceHashes'], 'checks': [], 'errors': [], 'geometry': {}}

def check(value, label, **details):
    report['checks'].append({'label': label, 'passed': bool(value), **details})
    if not value:
        report['errors'].append(label)

def evaluate(source):
    scope = {'App': App, 'Part': Part, 'math': math}
    exec(compile(source, '<standalone-fairing>', 'exec'), scope)
    return scope['shape']

def bounds(shape):
    # A B-spline face's ordinary box can contain untrimmed control poles.
    # Ask OCC for the tight box of the trimmed BRep, without tessellation.
    b = shape.optimalBoundingBox(False, False)
    return {'min': [b.XMin,b.YMin,b.ZMin], 'max': [b.XMax,b.YMax,b.ZMax], 'size': [b.XLength,b.YLength,b.ZLength]}

def describe(shape):
    return {'valid': shape.isValid(), 'closed': shape.isClosed(), 'solids': len(shape.Solids), 'faces': len(shape.Faces), 'volume': shape.Volume, 'bounds': bounds(shape), 'surfaces': sorted(set(type(f.Surface).__name__ for f in shape.Faces))}

def skin_distances(source, target):
    # A solid distance can be zero for an incorrectly displaced interior point.
    # Compare actual face skins instead of treating the target as a volume.
    skin = Part.makeCompound(target.Faces)
    vertices = [Part.Vertex(vertex.Point).distToShape(skin)[0] for vertex in source.Vertexes]
    samples = []
    for face in source.Faces:
        u0,u1,v0,v1 = face.ParameterRange
        for fu in [.2,.5,.8]:
            for fv in [.2,.5,.8]:
                point = face.valueAt(u0+(u1-u0)*fu,v0+(v1-v0)*fv)
                if face.isInside(point,1e-6,True):
                    samples.append(Part.Vertex(point).distToShape(skin)[0])
    return {'vertexCount': len(vertices), 'maximumVertexToSkinMm': max(vertices), 'skinSampleCount': len(samples), 'maximumSkinDistanceMm': max(samples)}

try:
    shapes = {}
    for case in data['cases']:
        shape = evaluate(case['python'])
        shapes[case['id']] = shape
        info = describe(shape)
        report['geometry'][case['id']] = info
        check(info['valid'] and info['closed'] and info['solids'] == 1 and info['volume'] > 0, case['id'] + ': actual canonical cap is one valid closed native solid', **info)
        check('BSplineSurface' in info['surfaces'] and 'Cylinder' in info['surfaces'], case['id'] + ': freeform skin and analytic host contact remain native', surfaces=info['surfaces'])
    cap = shapes['nominal']
    outer = evaluate(data['outerPython'])
    roof = min(outer.Faces, key=lambda face: face.CenterOfMass.z)
    u0,u1,v0,v1 = roof.ParameterRange
    heights = []
    for i in range(101):
        for j in range(81):
            point = roof.valueAt(u0+(u1-u0)*i/100, v0+(v1-v0)*j/80)
            heights.append(math.hypot(point.y, point.z)-45)
    report['geometry']['sampledOuterRadialHeight'] = {'minimumMm': min(heights), 'maximumMm': max(heights), 'samples': len(heights), 'scope': 'Finite native surface sampling, not a proof of every B-spline extremum.'}
    check(min(heights) >= .8, 'actual sampled native backed termination retains at least 0.8 mm stock', minimumMm=min(heights))
    contact = data['cases'][0]['spec']['contactPlaneRadius']
    roof_stocks = []
    for x in [-64.4,-64,-60,-36,0,36,60,64,64.4]:
        for y in [-8.2,-4,0,4,8.2]:
            roof_stocks.append(roof.distToShape(Part.Vertex(App.Vector(x,y,-contact)))[0])
    report['geometry']['sampledNormalRoofStock'] = {'minimumMm': min(roof_stocks), 'samples': len(roof_stocks), 'scope': 'Finite cavity-roof samples. Not a fabrication tolerance or load qualification.'}
    check(min(roof_stocks) >= 2.98, 'sampled normal stock over the mounting cavity retains the nominal three-millimetre roof', minimumMm=min(roof_stocks))
    for anchor in data['cases'][0]['spec']['anchors']:
        cone = Part.makeCone(1.5,6,4.5,App.Vector(anchor['x'],0,-anchor['underHeadRadius']),App.Vector(0,0,-1))
        # The containing sharp box gives a conservative distance to the rounded cavity.
        cavity = Part.makeBox(128.8,18,contact+1,App.Vector(-64.4,-9,-contact))
        gap = cone.distToShape(cavity)[0]
        check(gap >= 3, 'closed anchor land clears the mounting cavity by three millimetres', anchorX=anchor['x'], minimumMm=gap)
    for key in ['antennaPython', 'tubePython', 'anchorsPython']:
        other = evaluate(data[key])
        volume = cap.common(other).Volume
        check(volume < 1e-5, 'default cap clears ' + key, intersectionMm3=volume)
    printable = evaluate(data['printPython'])
    p = describe(printable)
    report['geometry']['print-only'] = p
    check(p['valid'] and p['closed'] and p['solids'] == 1, 'printing pose preserves one valid native cap', **p)
    check(max(p['bounds']['size']) <= 246 and abs(p['bounds']['min'][2]) < .03, 'actual native printing bounds fit a 256 mm bed with five-millimetre margins and contact Z0', **p['bounds'])
    check(abs(printable.Volume - cap.Volume) < cap.Volume * 1e-8, 'printing transform preserves native cap volume')
    cap.exportStep(str(out / 'jcg108-tube-fairing.step'))
    restored = Part.Shape()
    restored.read(str(out / 'jcg108-tube-fairing.step'))
    check(restored.isValid() and restored.isClosed() and len(restored.Solids) == 1, 'STEP round-trip preserves a valid closed solid')
    native_to_step, step_to_native = skin_distances(cap,restored), skin_distances(restored,cap)
    report['geometry']['stepRoundTrip'] = {
        'nativeToStep': native_to_step, 'stepToNative': step_to_native,
        'signedMassPropertyDifferenceMm3': restored.Volume-cap.Volume,
        'massPropertyScope': 'Report the integration result independently. Boundary fidelity is checked directly; volume integration alone is sensitive to B-spline reparameterization.',
        'scope': 'Finite bidirectional vertex and face-skin sampling, not a mathematical proof of every surface point.',
    }
    for label, result in [('native-to-STEP',native_to_step),('STEP-to-native',step_to_native)]:
        check(result['maximumVertexToSkinMm'] < 1e-5 and result['maximumSkinDistanceMm'] < 1e-5, label + ': retained boundary matches within 0.00001 mm at all checked vertices and face-skin samples', **result)
    a,b=bounds(cap),bounds(restored)
    bounding_delta=max(abs(a[key][i]-b[key][i]) for key in ['min','max'] for i in range(3))
    check(bounding_delta < 1e-5, 'STEP retains tight trimmed native bounds within 0.00001 mm', maximumBoundDifferenceMm=bounding_delta)
    check(set(App.listDocuments()) == documents and (App.ActiveDocument.Name if App.ActiveDocument else None) == active, 'existing FreeCAD documents and active document remain unchanged')
except Exception as error:
    report['errors'].append(str(error))
finally:
    report['elapsedSeconds'] = time.monotonic() - started
    (out / 'native-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'checks': len(report['checks']), 'errors': report['errors'], 'elapsedSeconds': report['elapsedSeconds'], 'report': str(out / 'native-report.json')}))
sys.exit(bool(report['errors']))
