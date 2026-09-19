"""Run with FreeCAD's Python: export-recovery-handoff.py assembly.FCStd output-dir.
Exports the actual document properties, never a separately maintained BOM.
"""
import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path
import FreeCAD as App
import Part

parser = argparse.ArgumentParser()
parser.add_argument('document', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
doc = App.openDocument(str(args.document.resolve()))
assembly = next(o for o in doc.RootObjects if o.TypeId == 'App::Part')
parts = list(assembly.Group)
assert parts and all(o.TypeId == 'Part::Feature' for o in parts)
assert all(o.Shape.isValid() and o.Shape.isClosed() and len(o.Shape.Solids) == 1 for o in parts)

def table(name, headers, rows):
    with (args.output / name).open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

keys = ['ComponentIndex', 'PartNumber', 'Procurement', 'Material', 'Standard', 'OrderDesignation',
        'ThreadCallouts', 'ManufacturingProcess', 'DrawingStatus', 'ProcurementNotes', 'SupplierSource', 'ShapeDigest']
table('components.csv', ['Label'] + keys,
      [[o.Label] + [getattr(o, key, '') for key in keys] for o in parts])
threads = []
for o in parts:
    for t in json.loads(o.ThreadFeaturesJSON):
        threads.append([o.ComponentIndex, o.Label, t['designation'], 'INTERNAL' if t['internal'] else 'EXTERNAL',
                        t['length'], *t['origin'], *t['axis']])
table('threads.csv', ['Component', 'Label', 'Thread', 'Side', 'Nominal tool length (not engagement)',
      'Origin X', 'Origin Y', 'Origin Z', 'Axis X', 'Axis Y', 'Axis Z'], threads)
orders = defaultdict(list)
for o in parts:
    if o.Procurement in ['BUY_STANDARD', 'BUY_VERIFY_INTERFACE', 'OEM_INCLUDED']:
        orders[(o.Procurement, o.Standard, o.OrderDesignation, o.SupplierSource, o.ProcurementNotes)].append(o)
table('fasteners.csv', ['Quantity', 'Procurement', 'Standard', 'Order designation', 'Supplier', 'Notes', 'Instances'],
      [[len(objects), *key, '; '.join(str(o.ComponentIndex) for o in objects)] for key, objects in sorted(orders.items())])

# Explicitly verify that moving a selected part does not move another part.
first, other = parts[:2]
a, b = first.Shape.Solids[0].CenterOfMass, other.Shape.Solids[0].CenterOfMass
original = first.Placement
first.Placement = App.Placement(App.Vector(0, 0, 15), App.Rotation()).multiply(original)
doc.recompute()
assert abs(first.Shape.Solids[0].CenterOfMass.z - a.z - 15) < 1e-7
assert (other.Shape.Solids[0].CenterOfMass - b).Length < 1e-7
first.Placement = original

# Native selected-part STEP round trip, retaining analytic BRep surfaces and threads.
sample = next(o for o in parts if o.Label.startswith('Threaded spring barrel 1 '))
step = args.output / 'threaded-spring-barrel-sample.step'
Part.export([sample], str(step))
restored = Part.read(str(step))
assert restored.isValid() and len(restored.Solids) == 1
step_volume_error = abs(restored.Volume - sample.Shape.Volume) / sample.Shape.Volume
# STEP reparameterizes trimmed helical faces; compare relative volume and size.
assert step_volume_error < 1e-6
before, after = sample.Shape.optimalBoundingBox(False, False), restored.optimalBoundingBox(False, False)
step_bounds_error = max(abs(getattr(before, k) - getattr(after, k)) for k in ['XMin', 'YMin', 'ZMin', 'XMax', 'YMax', 'ZMax'])
assert step_bounds_error < 1e-4
report = {'components': len(parts), 'independentMovement': True, 'validSeparateSolids': True,
          'threadFeatureRecords': len(threads), 'selectedPartStepRoundtrip': True, 'stepRelativeVolumeError': step_volume_error, 'stepBoundsErrorMM': step_bounds_error,
          'drawingStatus': 'DRAFT - dimensions, tolerances and load validation not released'}
(args.output / 'handoff-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
App.closeDocument(doc.Name)
