#!/usr/bin/env python3
"""Verify generated ball-screw solids, envelopes, race clearances and STEP round trips.

Generate inputs with node --import tsx scripts/verify-ball-screws.ts. Execute this
script using an installed FreeCAD Python runtime; no GUI document is opened.
"""
import argparse
import hashlib
import json
import sys
import tempfile
import time
import traceback
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('cases')
parser.add_argument('--output', required=True)
parser.add_argument('--freecad-lib', default='/Applications/FreeCAD.app/Contents/Resources/lib')
args = parser.parse_args()
sys.path.insert(0, args.freecad_lib)
import FreeCAD as App
import Part

cases = json.loads(Path(args.cases).read_text())
results = []
with tempfile.TemporaryDirectory(prefix='protolab-ball-native-') as folder:
    step = str(Path(folder) / 'round-trip.step')
    for case in cases:
        started = time.time()
        report = {'name': case['name'], 'codeSha256': hashlib.sha256(case['python'].encode()).hexdigest()}
        try:
            scope = {'App': App, 'Part': Part}
            exec(case['python'], scope)
            shape = scope['shape']
            vertices, _ = shape.tessellate(.025)
            bounds = [max(getattr(v, key) for v in vertices) - min(getattr(v, key) for v in vertices) for key in ['x', 'y', 'z']]
            report.update(valid=shape.isValid(), closed=all(s.isClosed() for s in shape.Solids), solids=len(shape.Solids),
                          componentValid=all(len(c.Solids) == 1 and c.Volume > 0 and c.isValid() and c.Solids[0].isClosed() for c in scope['components']),
                          bounds=bounds, expectedBounds=case['bounds'], boundsValid=all(abs(a - b) <= max(.05, .002 * b) for a, b in zip(bounds, case['bounds'])))
            spheres = [c for c in scope['components'] if len(c.Faces) == 1 and c.Faces[0].Surface.__class__.__name__ == 'Sphere']
            housing_count = 2 if case['name'].startswith(('dfu', 'dfi', 'left-machined')) else 1
            housings = sorted([c for c in scope['components'] if c not in spheres], key=lambda c: c.Volume, reverse=True)[:housing_count]
            samples = [spheres[i] for i in sorted(set([0, len(spheres) // 3, 2 * len(spheres) // 3, len(spheres) - 1]))] if spheres else []
            race = [housing.common(ball).Volume for housing in housings for ball in samples]
            report['raceClear'] = all(v < 1e-5 for v in race)
            if not report['raceClear']:
                report['raceOverlapVolumes'] = race
            if case.get('contact'):
                overlaps = []
                for i, a in enumerate(shape.Solids):
                    for j, b in enumerate(shape.Solids[i + 1:], i + 1):
                        if a.BoundBox.intersect(b.BoundBox):
                            volume = a.common(b).Volume
                            if volume > 1e-5:
                                overlaps.append([i, j, volume])
                report['overlaps'] = overlaps
            if case.get('volume') is not None:
                report['volume'] = shape.Volume
                report['previewVolume'] = case['volume']
                report['relativeVolumeError'] = abs(shape.Volume - case['volume']) / shape.Volume
            shape.exportStep(step)
            imported = Part.read(step)
            report['stepValid'] = imported.isValid() and len(imported.Solids) == len(shape.Solids)
        except Exception as error:
            report.update(error=str(error), trace=traceback.format_exc())
        report['seconds'] = round(time.time() - started, 2)
        results.append(report)
        print(json.dumps(report), flush=True)
        Path(args.output).write_text(json.dumps({'freecadVersion': App.Version(), 'cases': results}, indent=2))
required = ['valid', 'closed', 'componentValid', 'boundsValid', 'raceClear', 'stepValid']
failed = [r for r in results if not all(r.get(k, False) for k in required) or r.get('overlaps')]
print(json.dumps({'checked': len(results), 'failures': len(failed)}), flush=True)
sys.exit(bool(failed))
