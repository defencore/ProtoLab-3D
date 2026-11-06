"""Compare an existing native actuator and STEP without regenerating geometry.

Arguments: native.FCStd assembly.step [report.json]. Reports every imported solid,
matching its physical bounds to the native component; no tolerance is relaxed.
"""
import json
import math
import os
from pathlib import Path
import sys

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part


def features(root):
    result = []
    for child in root.Group:
        if child.TypeId == 'App::Part':
            result.extend(features(child))
        elif hasattr(child, 'Shape') and hasattr(child, 'AssemblyOccurrenceId'):
            result.append(child)
    return result


def box(shape):
    value = shape.BoundBox
    return [value.XMin,value.YMin,value.ZMin,value.XMax,value.YMax,value.ZMax]


native_path, step_path = Path(sys.argv[1]), Path(sys.argv[2])
output_path = Path(sys.argv[3]) if len(sys.argv)>3 else step_path.with_name('step-diagnostic.json')
doc = App.openDocument(str(native_path.resolve()))
root = next(item for item in doc.RootObjects if hasattr(item,'PartId') and item.PartId=='sfk-rotary-actuator')
native = []
for child in features(root):
    shape = child.Shape.copy()
    shape.Placement = child.getGlobalPlacement()
    assert len(shape.Solids)==1
    native.append({'item':child,'shape':shape,'bounds':box(shape),'volume':shape.Volume})
print(json.dumps({'stage':'native-loaded','components':len(native)}),flush=True)
restored = Part.read(str(step_path.resolve()))
imported = [{'shape':shape,'bounds':box(shape),'volume':shape.Volume} for shape in restored.Solids]
print(json.dumps({'stage':'step-loaded','solids':len(imported)}),flush=True)
assert len(native)==len(imported)
available = set(range(len(imported)))
rows = []
for index, source in enumerate(native):
    candidates = [(sum((a-b)**2 for a,b in zip(source['bounds'],target['bounds'])),j)
                  for j,target in enumerate(imported) if j in available]
    _,match = min(candidates)
    available.remove(match)
    target = imported[match]
    delta = target['volume']-source['volume']
    rows.append({'id':source['item'].AssemblyOccurrenceId,'label':source['item'].Label,
                 'nativeIndex':index,'stepSolidIndex':match,
                 'nativeVolume':source['volume'],'stepVolume':target['volume'],
                 'volumeChange':delta,'relativeVolumeChange':abs(delta)/source['volume'],
                 'maxBoundsChange':max(abs(a-b) for a,b in zip(source['bounds'],target['bounds'])),
                 'stepValid':target['shape'].isValid(),'stepClosed':target['shape'].isClosed(),
                 'nativeMaxTolerance':source['shape'].getTolerance(1),
                 'stepMaxTolerance':target['shape'].getTolerance(1)})
    if abs(delta)>0.001:
        print(json.dumps(rows[-1]),flush=True)
native_volume=sum(row['nativeVolume'] for row in rows)
step_volume=restored.Volume
report={'freecad':'.'.join(App.Version()[:3]),'nativeFile':str(native_path),'stepFile':str(step_path),
        'nativeVolume':native_volume,'stepVolume':step_volume,'sumStepSolidVolumes':sum(row['stepVolume'] for row in rows),
        'volumeChange':step_volume-native_volume,'relativeVolumeChange':abs(step_volume-native_volume)/native_volume,
        'nativeSolids':len(native),'stepSolids':len(imported),
        'changedParts':sum(abs(row['volumeChange'])>0.001 for row in rows),
        'maxBoundsChange':max(row['maxBoundsChange'] for row in rows),
        'components':sorted(rows,key=lambda row:abs(row['volumeChange']),reverse=True)}
output_path.write_text(json.dumps(report,indent=2))
print(json.dumps({key:value for key,value in report.items() if key!='components'}),flush=True)
