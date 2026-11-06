import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import actuator, { actuatorPieces } from '../src/parts/sfk-rotary-actuator/part';
import { libraries } from '../src/parts/sfk-rotary-actuator/lib/components';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';

test(
  'native compact opposed-flange bearings retain the captured shaft through their real load path',
  { skip: !process.env.FREECAD_PYTHON, timeout: 120_000 },
  () => {
    const ids = [
      'output-front-housing',
      'output-rear-housing',
      'output-bearing-0',
      'output-bearing-1',
      'output-front-inner-spacer',
      'output-front-spacer',
      'output-rear-inner-spacer',
      'output-rear-spacer',
      'output-circlip-0',
      'output-circlip-1',
      'output-circlip-2',
      'output-circlip-3',
      'output-shaft',
      'output-end-cap',
      'base',
      'floating-bearing-housing',
      'screw-bearing-0',
      'screw-bearing-1',
    ];
    const all = actuatorPieces(actuator.defaults);
    assert.ok(
      all.every((piece) => !piece.component.id.startsWith('housing-retainer-')),
      'Opposed bearing flanges and the captured shaft replace housing clips.',
    );
    const pieces = ids.map((id) => {
      const piece = all.find((candidate) => candidate.component.id === id);
      assert.ok(piece, id);
      return piece;
    });
    const source = withGeometryMode('simple', () => componentPython(libraries, pieces));
    const script = `import FreeCAD as App,Part,math,json
${source}
ids=json.loads(${JSON.stringify(JSON.stringify(ids))})
by_id=dict(zip(ids,components))
for identity,shape in by_id.items():
 assert shape.isValid() and shape.isClosed() and shape.Volume>0,identity
installed=[]
for first in range(len(components)):
 for second in range(first+1,len(components)):
  a,b=components[first],components[second]
  if not a.BoundBox.intersect(b.BoundBox):continue
  overlap=a.common(b).Volume
  assert math.isfinite(overlap) and abs(overlap)<=1e-6,('Installed retention parts must fit',ids[first],ids[second],overlap)
  installed.append(dict(occurrenceIds=[ids[first],ids[second]],overlapMm3=overlap))
bearing_labels=next(record[2] for record in _pl_component_cache.values() if record[2] and 'Inner ring' in record[2] and 'Flanged outer ring' in record[2])
results=[]
internal_contacts=[]
for side,bearing_id,housing_id,inner_id,outer_id in [(-1,'output-bearing-0','output-front-housing','output-front-inner-spacer','output-front-spacer'),(1,'output-bearing-1','output-rear-housing','output-rear-inner-spacer','output-rear-spacer')]:
 bearing,housing=by_id[bearing_id],by_id[housing_id]
 children=bearing.childShapes()
 assert len(children)==len(bearing_labels)
 balls=Part.makeCompound([child for child,label in zip(children,bearing_labels) if label.startswith('Ball ')])
 for race_label in ['Inner ring','Flanged outer ring']:
  race=children[bearing_labels.index(race_label)]
  for direction in [-1,1]:
   shifted=race.copy();shifted.translate(App.Vector(0,direction*.5,0))
   contact=shifted.common(balls).Volume
   assert contact>.001,('Rolling elements must transmit axial displacement between both races',side,race_label,direction,contact)
   internal_contacts.append(dict(side=side,race=race_label,direction=direction,attemptedShiftMm=.5,rollingElementInterferenceMm3=contact))
 inward=bearing.copy();inward.translate(App.Vector(0,-side*.5,0))
 flange_stop=inward.common(housing).Volume
 inner_stop=inward.common(by_id[inner_id]).Volume
 outward=bearing.copy();outward.translate(App.Vector(0,side*.5,0))
 outer_stop=outward.common(by_id[outer_id]).Volume
 assert min(flange_stop,inner_stop,outer_stop)>.001,('Bearing flange and inner-race spacers must supply their actual stops',side,flange_stop,inner_stop,outer_stop)
 results.append(dict(side=side,attemptedShiftMm=.5,flangeStopMm3=flange_stop,innerSpacerStopMm3=inner_stop,outerSpacerStopMm3=outer_stop))
shaft=by_id['output-shaft'];cap=by_id['output-end-cap']
clip_stops=[]
for identity in [name for name in ids if name.startswith('output-circlip-')]:
 ring=by_id[identity]
 for direction in [-1,1]:
  moved=ring.copy();moved.translate(App.Vector(0,direction*.5,0))
  overlap=moved.common(shaft).Volume
  assert overlap>.001,('A removable ring must be stopped by both groove shoulders',identity,direction,overlap)
  clip_stops.append(dict(ring=identity,direction=direction,interferenceMm3=overlap))
cartridge=[shape for identity,shape in by_id.items() if identity.startswith('output-') and not identity.endswith('-housing')]
cartridge_stops=[]
for direction,housing_id in [(1,'output-front-housing'),(-1,'output-rear-housing')]:
 overlap=0
 for shape in cartridge:
  moved=shape.copy();moved.translate(App.Vector(0,direction*.5,0))
  overlap+=moved.common(by_id[housing_id]).Volume
 assert overlap>.001,('The opposing flange must restrain the complete captured cartridge',direction,overlap)
 cartridge_stops.append(dict(direction=direction,opposingHousing=housing_id,attemptedShiftMm=.5,interferenceMm3=overlap))
screw_stops=[]
for direction,support_id in [(1,'base'),(-1,'floating-bearing-housing')]:
 overlap=0
 for identity in ['screw-bearing-0','screw-bearing-1']:
  moved=by_id[identity].copy();moved.translate(App.Vector(direction*.5,0,0))
  overlap+=moved.common(by_id[support_id]).Volume
 assert overlap>.001,('The opposed screw-bearing flange must be stopped by its compact plate',direction,support_id,overlap)
 screw_stops.append(dict(direction=direction,opposingSupport=support_id,attemptedShiftMm=.5,flangeInterferenceMm3=overlap))
assert abs(shaft.BoundBox.YMin+26)<1e-6 and abs(shaft.BoundBox.YMax-46)<1e-6
assert cap.isInside(App.Vector(19.5,-26.6,15),1e-7,False),('The short shaft end must have a closed cap wall')
assert not cap.isInside(App.Vector(19.5,-26,15),1e-7,False),('The blind cap cavity must clear the short shaft tip')
print('SFK_FLANGED_RETENTION '+json.dumps(dict(bearingStops=results,rollingElementContacts=internal_contacts,grooveStops=clip_stops,cartridgeStops=cartridge_stops,screwBearingPairStops=screw_stops,installedContacts=installed,loadPath='Shaft groove shoulders → removable rings → inner-race spacers → inner race → rolling elements → outer race → opposing flange → fixed plate. The shaft end cap is not a bearing retainer.',screwSeatScope='Actual opposed flange stops and installed fit of both screw bearings in their compact plates; the existing screw shoulder/locknut/support-ring stack is unchanged.',shortShaftEnd=-26,longOutputEnd=46,blindCapClosed=True)),flush=True)
`;
    const path = '/tmp/protolab-sfk-flanged-retention.py';
    writeFileSync(path, script);
    const run = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      env: process.env,
      timeout: 110_000,
      maxBuffer: 2_000_000,
    });
    assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
    const line = run.stdout.split('\n').find((value) => value.startsWith('SFK_FLANGED_RETENTION '));
    assert.ok(line);
    if (process.env.SFK_FLANGED_RETENTION_PROOF) {
      mkdirSync(dirname(process.env.SFK_FLANGED_RETENTION_PROOF), { recursive: true });
      writeFileSync(
        process.env.SFK_FLANGED_RETENTION_PROOF,
        JSON.stringify(
          {
            schemaVersion: 1,
            sourceSha256: createHash('sha256').update(script).digest('hex'),
            runtimeSha256: createHash('sha256')
              .update(readFileSync(process.env.FREECAD_PYTHON!))
              .digest('hex'),
            ...JSON.parse(line.slice('SFK_FLANGED_RETENTION '.length)),
          },
          null,
          2,
        ) + '\n',
      );
    }
  },
);
