import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Euler, Vector3 } from 'three';
import machine, {
  millingComponents,
  millingPieces,
  millingLayout,
} from '../src/parts/cnc-milling-machine/part';
import { millingLibraries } from '../src/parts/cnc-milling-machine/lib/composition';
import {
  linearEncoderStations,
  linearEncoderRequirements,
} from '../src/parts/cnc-milling-machine/lib/encoders';
import encoder, { encoderSpec } from '../src/parts/cnc-linear-encoder/part';
import frame, { frameHoles } from '../src/parts/cnc-frame-part/part';
import { componentPython } from '../src/core/assembly/detail-instances';
import { validateParameters } from '../src/core/validation';
import { withGeometryMode } from '../src/core/geometry-mode';
import type { Vec } from '../src/core/assembly/boundary/shapes';
import type { Parameters } from '../src/core/types';
import type { MillingPiece } from '../src/parts/cnc-milling-machine/lib/composition';

const isEncoder = (id: string) => /^[xyz]-linear-/.test(id);
const nativeAxis = process.env.ENCODER_NATIVE_AXIS ?? '';
if (nativeAxis && !['x', 'y', 'z'].includes(nativeAxis))
  throw new Error('ENCODER_NATIVE_AXIS must be x, y or z.');
const isNativeEncoder = (id: string) =>
  isEncoder(id) && (!nativeAxis || id.startsWith(nativeAxis + '-'));
const encoderHostIds = new Set([
  'fixed-bed-side-1',
  'gantry-foot-1',
  'gantry-box-beam',
  'x-saddle-bridge-1',
  'x-z-fixed-saddle',
  'moving-z-saddle',
]);
function rotate(value: Vec, angles: Vec) {
  return new Vector3(...value).applyEuler(
    new Euler(...(angles.map((angle) => (angle * Math.PI) / 180) as Vec), 'ZYX'),
  );
}
function installed(value: Vec, placement: MillingPiece['component']['placement']) {
  return rotate(value, placement.rotation).add(new Vector3(...placement.translation));
}
function position(piece: ReturnType<typeof millingPieces>[number]) {
  return new Vector3(...piece.component.placement.translation).add(
    new Vector3(...(piece.position ?? [0, 0, 0])),
  );
}
function boltJoint(
  pieces: MillingPiece[],
  boltId: string,
  hostId: string,
  grip: number,
  depth: number,
) {
  const bolt = pieces.find((piece) => piece.component.id === boltId)!,
    host = pieces.find((piece) => piece.component.id === hostId)!,
    p = bolt.component.parameters,
    diameter = Number(p.diameter),
    length = Number(p.length),
    head = Number(p.headHeight),
    normal = rotate([0, 0, 1], bolt.component.placement.rotation),
    seat = new Vector3(...bolt.component.placement.translation).addScaledVector(
      normal,
      (length - head) / 2,
    ),
    shaft = normal.clone().negate();
  const candidates = frameHoles(host.component.parameters).filter(
    (hole) => hole.threadPitch && hole.diameter === diameter,
  );
  const hole = candidates.find((hole) => {
    const start = installed(hole.at, host.component.placement),
      axis = rotate(
        ['x', 'y', 'z'].map((name) => Number(name === hole.axis)) as Vec,
        host.component.placement.rotation,
      ),
      endpoints = [start, start.clone().addScaledVector(axis, hole.depth)],
      distances = endpoints
        .map((point) => point.clone().sub(seat).dot(shaft))
        .sort((a, b) => a - b);
    return (
      Math.abs(distances[0] - grip) < 1e-6 &&
      Math.abs(distances[1] - grip - depth) < 1e-6 &&
      endpoints.every((point) => point.clone().sub(seat).cross(shaft).length() < 1e-6)
    );
  });
  assert.ok(hole, boltId + ' must meet its real installed host tap.');
  const engagement = length - grip;
  assert.ok(engagement >= diameter, boltId + ' has at least one diameter nominal engagement.');
  assert.ok(depth - engagement >= 1 - 1e-6, boltId + ' must retain actual tip reserve.');
  return {
    boltId,
    hostId,
    seat: seat.toArray(),
    normal: normal.toArray(),
    grip,
    depth,
    length,
    reserve: depth - engagement,
  };
}

test('installed encoder roles retain exact purchased identities, motion ownership and all separate mounting bolts', () => {
  const pieces = millingComponents(machine.defaults),
    selected = pieces.filter((piece) => isEncoder(piece.component.id));
  assert.equal(selected.length, 37);
  assert.equal(selected.filter((piece) => piece.component.libraryId === encoder.id).length, 9);
  assert.equal(selected.filter((piece) => piece.component.libraryId === frame.id).length, 4);
  assert.equal(selected.filter((piece) => piece.component.libraryId === 'bolt-screw').length, 24);
  for (const station of linearEncoderStations(machine.defaults, millingLayout(machine.defaults))) {
    const prefix = station.axis + '-linear';
    for (const role of ['scale', 'readhead', 'spar'] as const) {
      const piece = pieces.find((row) => row.component.id === prefix + '-' + role)!;
      assert.equal(
        piece.component.parameters.model,
        role === 'spar' ? station.sparModel : station.model,
      );
      assert.equal(piece.motion, role === 'readhead' ? station.headMotion : station.scaleMotion);
      assert.equal(piece.component.supply, 'purchased');
      assert.ok(piece.component.procurement?.source?.includes('heidenhain'));
      assert.deepEqual(validateParameters(encoder, piece.component.parameters, 'default'), []);
    }
    const adapter = pieces.find((row) => row.component.id === prefix + '-readhead-adapter')!;
    assert.equal(adapter.motion, station.headMotion);
    assert.equal(adapter.component.parameters.material, 'steel');
    assert.deepEqual(validateParameters(frame, adapter.component.parameters, 'default'), []);
    assert.match(adapter.component.manufacturing!.requirements.join(' '), /ligament/);
    assert.match(adapter.component.manufacturing!.requirements.join(' '), /counterbore seating/);
  }
  assert.match(linearEncoderRequirements.join(' '), /not verified factory fit/);
});

test('compact Z installation preserves the supplier spar envelope and the authored rear adapter floor', () => {
  const layout = millingLayout(machine.defaults),
    station = linearEncoderStations(machine.defaults, layout).find((row) => row.axis === 'z')!,
    spec = encoderSpec(station.model),
    leftFinInner = -layout.fixedRibCenterX + layout.fixedRibThickness / 2,
    sourceSparLeft = station.origin[0] - (spec.sparBottomZ + spec.sparHeight),
    placement = { translation: station.origin, rotation: station.rotation },
    supplierHeadRear = installed([0, spec.readheadRearY, 0], placement),
    adapterRear = station.adapterOrigin[1] - station.adapterSize[1] / 2,
    adapterLeft = station.adapterOrigin[0] - station.adapterSize[2] / 2,
    lowerArmTop = station.adapterOrigin[2] - station.adapterSize[0] / 2 + station.adapterWall,
    sourceHeadBottom = station.origin[2] + spec.readheadLeftX;
  // The 5 mm authored fin fillet is included in the conservative clearance envelope.
  assert.ok(sourceSparLeft - (leftFinInner + 5) >= 1.9 - 1e-7);
  assert.equal(station.origin[0], -135);
  assert.deepEqual(station.adapterSize, [83.5, 68, -layout.movingPlateWidth / 2 + 133.5]);
  assert.equal(station.adapterWall, 8);
  assert.ok(Math.abs(adapterRear + station.adapterWall - supplierHeadRear.y) < 1e-7);
  assert.equal(station.adapterOrigin[0] + station.adapterSize[2] / 2, -layout.movingPlateWidth / 2);
  assert.ok(sourceHeadBottom - lowerArmTop >= 3.5 - 1e-7);
  for (const hole of spec.readheadMounts) {
    const world = installed(hole.position, placement);
    assert.ok(Math.abs(world.x - adapterLeft - 2.5) < 1e-7);
    assert.ok(station.adapterWall - 6 >= 2);
  }
});

test('the complete X spar seats on an actual backing plate while its lower bearing strip and adapter meet the real beam and bridge', () => {
  const layout = millingLayout(machine.defaults),
    station = linearEncoderStations(machine.defaults, layout).find((row) => row.axis === 'x')!,
    spec = encoderSpec(station.model),
    placement = { translation: station.origin, rotation: station.rotation },
    bottom = installed([0, spec.sparBackY, spec.sparBottomZ + spec.sparHeight], placement),
    top = installed([0, spec.sparBackY, spec.sparBottomZ], placement),
    flatTop = layout.beamCenter + layout.beamHeight / 2 - layout.beamCornerRadius,
    pieces = millingComponents(machine.defaults),
    plate = pieces.find((row) => row.component.id === 'x-linear-backing-plate')!,
    pp = plate.component.parameters;
  assert.equal(station.scaleHost, 'x-linear-backing-plate');
  assert.equal(pp.sizeY, 12);
  assert.equal(pp.sizeZ, 60);
  assert.equal(pp.sizeX, spec.sparLength + 80);
  assert.ok(Math.abs(bottom.y + layout.beamDepth / 2 + 12) < 1e-7);
  assert.ok(Math.abs(top.y + layout.beamDepth / 2 + 12) < 1e-7);
  assert.ok(bottom.z >= layout.beamCenter + 30 && top.z <= layout.beamCenter + 90);
  assert.equal(flatTop - (plate.component.placement.translation[2] - 30), 32.5);
  assert.equal(station.adapterSize[0], 30.5);
  assert.equal(station.adapterOrigin[2] + station.adapterSize[0] / 2, layout.beamCenter + 110);
  assert.ok(Math.abs(station.adapterOrigin[2] - station.adapterSize[0] / 2 - top.z - 0.5) < 1e-7);
  for (const seat of station.adapterSeats) assert.equal(seat[2], layout.beamCenter + 102);
  assert.match(plate.component.manufacturing!.requirements.join(' '), /lower 32.5 mm/);
  assert.match(plate.component.manufacturing!.requirements.join(' '), /Qualify/);
  for (let i = 1; i <= 4; i++)
    boltJoint(pieces, 'x-linear-backing-bolt-' + i, 'gantry-box-beam', 12, 10);
  for (const hole of frameHoles(pp).filter((hole) => hole.diameter === 8.8)) {
    assert.ok(Math.abs(hole.at[0]) - 6.5 - spec.sparLength / 2 >= 8.5);
    assert.ok(Number(pp.sizeX) / 2 - Math.abs(hole.at[0]) - hole.diameter / 2 >= 5.6 - 1e-8);
  }
});

test('the under-head Z adapter and standard bolts follow the actual machined host width without invented recesses', () => {
  const base = millingLayout(machine.defaults);
  for (const [width, grip, length] of [
    [240, 13.5, 25],
    [226, 20.5, 30],
    [220, 23.5, 35],
  ]) {
    const station = linearEncoderStations(machine.defaults, {
      ...base,
      movingPlateWidth: width,
    }).find((row) => row.axis === 'z')!;
    assert.equal(station.origin[0], -135);
    assert.equal(station.adapterGrip, grip);
    assert.equal(station.adapterBoltLength, length);
    assert.equal(station.adapterSize[2], grip);
    assert.equal(station.adapterOrigin[0] + grip / 2, -width / 2);
    for (const seat of station.adapterSeats) assert.equal(seat[0], -133.5);
    const engagement = length - grip;
    assert.ok(engagement >= 5 && engagement <= 13);
    assert.ok(14 - engagement >= 1);
  }
});

test('the Y encoder support is a connected authored offset blank with valid lower-wall and spine limits', () => {
  const piece = millingComponents(machine.defaults).find(
      (row) => row.component.id === 'y-linear-readhead-adapter',
    )!,
    parameters = piece.component.parameters;
  assert.equal(parameters.role, 'encoder-offset-angle');
  assert.equal(parameters.shoulderWidth, 16);
  assert.equal(parameters.rearWebHeight, 14.5);
  assert.deepEqual(validateParameters(frame, parameters, 'default'), []);
  const invalidDefinitions: Parameters[] = [
    { shoulderWidth: 7 },
    { rearWebHeight: 8 },
    { sizeY: 30 },
  ];
  for (const invalid of invalidDefinitions)
    assert.ok(validateParameters(frame, { ...parameters, ...invalid }, 'default').length);
  assert.match(piece.component.manufacturing!.requirements.join(' '), /one billet/);
});

test('all spindle and table-height executions retain real host taps, nominal engagement and at least one-millimetre tip reserve', () => {
  for (const option of machine.parameters.find((definition) => definition.key === 'spindle')!
    .options!)
    for (const tableHeight of [700, 950]) {
      const parameters = { ...machine.defaults, spindle: option.value, tableHeight },
        pieces = millingComponents(parameters);
      for (const station of linearEncoderStations(parameters, millingLayout(parameters))) {
        const s = encoderSpec(station.model),
          prefix = station.axis + '-linear';
        for (let i = 0; i < s.sparMounts.length; i++)
          boltJoint(pieces, prefix + '-spar-bolt-' + (i + 1), station.scaleHost, 1.7, 10);
        for (let i = 0; i < 2; i++) {
          boltJoint(
            pieces,
            prefix + '-adapter-host-bolt-' + (i + 1),
            station.adapterHost,
            station.adapterGrip,
            14,
          );
          boltJoint(
            pieces,
            prefix + '-readhead-bolt-' + (i + 1),
            prefix + '-readhead-adapter',
            15.5,
            6,
          );
        }
      }
    }
});

test('fixed housings and supplied readheads follow separate actual travel through all eight corners', () => {
  const origin = millingPieces(machine.defaults, 'assembled');
  for (const xPosition of [0, 100])
    for (const yPosition of [0, 100])
      for (const zPosition of [0, 100]) {
        const pieces = millingPieces(
          { ...machine.defaults, xPosition, yPosition, zPosition },
          'assembled',
        );
        const movements: Record<string, Vec> = {
          y: [0, 1500 * (yPosition / 100 - 0.5), 0],
          x: [800 * (xPosition / 100 - 0.5), 1500 * (yPosition / 100 - 0.5), 0],
          z: [
            800 * (xPosition / 100 - 0.5),
            1500 * (yPosition / 100 - 0.5),
            200 * (zPosition / 100 - 0.5),
          ],
        };
        for (const axis of ['x', 'y', 'z']) {
          const prefix = axis + '-linear',
            scale = pieces.find((piece) => piece.component.id === prefix + '-scale')!,
            head = pieces.find((piece) => piece.component.id === prefix + '-readhead')!,
            baseScale = origin.find((piece) => piece.component.id === prefix + '-scale')!,
            baseHead = origin.find((piece) => piece.component.id === prefix + '-readhead')!;
          assert.ok(
            position(head)
              .sub(position(baseHead))
              .distanceTo(new Vector3(...movements[axis])) < 1e-7,
          );
          const expected: Vec =
            axis === 'y'
              ? [0, 0, 0]
              : axis === 'x'
                ? [0, movements.x[1], 0]
                : [movements.z[0], movements.z[1], 0];
          assert.ok(
            position(scale)
              .sub(position(baseScale))
              .distanceTo(new Vector3(...expected)) < 1e-7,
          );
          const relative = position(head).sub(position(scale)),
            motion = relative.sub(position(baseHead).sub(position(baseScale)));
          assert.ok(
            motion.length() <=
              encoderSpec(String(head.component.parameters.model)).measuringLength / 2,
          );
        }
      }
});

test(
  'optional installed native Simple eight-corner audit checks every encoder solid against every actual nearby assembly partner',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const pieces = millingComponents(machine.defaults),
      stations = linearEncoderStations(machine.defaults, millingLayout(machine.defaults));
    const joints = stations.flatMap((station) => {
      const s = encoderSpec(station.model),
        prefix = station.axis + '-linear';
      return [
        ...s.sparMounts.map((_, i) =>
          boltJoint(pieces, prefix + '-spar-bolt-' + (i + 1), station.scaleHost, 1.7, 10),
        ),
        ...[0, 1].flatMap((i) => [
          boltJoint(
            pieces,
            prefix + '-adapter-host-bolt-' + (i + 1),
            station.adapterHost,
            station.adapterGrip,
            14,
          ),
          boltJoint(
            pieces,
            prefix + '-readhead-bolt-' + (i + 1),
            prefix + '-readhead-adapter',
            15.5,
            6,
          ),
        ]),
      ];
    });
    const source = withGeometryMode('simple', () => componentPython(millingLibraries, pieces)),
      rows = pieces.map((piece) => ({
        id: piece.component.id,
        libraryId: piece.component.libraryId,
        motion: piece.motion,
        new: isNativeEncoder(piece.component.id),
      }));
    const script = `import FreeCAD as App, Part, json, math, hashlib
source=json.loads(${JSON.stringify(JSON.stringify(source))})
rows=json.loads(${JSON.stringify(JSON.stringify(rows))})
joints=json.loads(${JSON.stringify(JSON.stringify(joints))})
exec(compile(source,'installed-linear-encoders','exec'),globals())
assert len(components)==len(rows)
for r,s in zip(rows,components):
    assert not s.isNull() and s.isValid() and s.isClosed() and s.Solids and s.Volume>0
    if r['new'] and r['libraryId']=='cnc-frame-part':assert len(s.Solids)==1,r
byid={r['id']:s for r,s in zip(rows,components)}
witness_ids=['rib-5-end-bolt-1','y-linear-readhead-adapter','z-linear-scale','z-linear-spar','z-linear-readhead','z-linear-readhead-adapter']
witness_bounds={key:[getattr(byid[key].BoundBox,name) for name in ['XMin','XMax','YMin','YMax','ZMin','ZMax']] for key in witness_ids}
for joint in joints:
    host=byid[joint['hostId']]
    seat=App.Vector(*joint['seat']); shaft=App.Vector(*joint['normal']).negative()
    assert not host.isInside(seat+shaft*(joint['grip']+0.1),1e-7,False),joint
    assert not host.isInside(seat+shaft*(joint['length']+0.1),1e-7,False),joint
poses=[];cases=0;overlaps=[]
for x in [-400,400]:
 for y in [-750,750]:
  for z in [-100,100]:
   placed=[]
   for r,s in zip(rows,components):
    t=s.copy();t.translate(App.Vector(x if r['motion'] in ['x','z'] else 0,y if r['motion']!='fixed' else 0,z if r['motion']=='z' else 0));placed.append(t)
   posecases=0
   for i,a in enumerate(placed):
    for j in range(i+1,len(placed)):
     if not(rows[i]['new'] or rows[j]['new']):continue
     b=placed[j];ab=a.BoundBox;bb=b.BoundBox
     if min(ab.XMax,bb.XMax)-max(ab.XMin,bb.XMin)<1e-7 or min(ab.YMax,bb.YMax)-max(ab.YMin,bb.YMin)<1e-7 or min(ab.ZMax,bb.ZMax)-max(ab.ZMin,bb.ZMin)<1e-7:continue
     common=a.common(b);volume=common.Volume
     assert math.isfinite(volume),(rows[i]['id'],rows[j]['id'])
     if common.Solids:assert common.isValid() and common.isClosed()
     if abs(volume)>0.001:overlaps.append({'a':rows[i]['id'],'b':rows[j]['id'],'pose':[x,y,z],'volume':volume})
     cases+=1;posecases+=1
   poses.append({'pose':[x,y,z],'pairs':posecases})
report={'status':'failed' if overlaps else 'passed','mode':'simple','axisScope':${JSON.stringify(nativeAxis || 'xyz')},'geometrySourceSha256':hashlib.sha256(source.encode()).hexdigest(),'actualAssemblyComponents':len(rows),'newOccurrences':sum(r['new'] for r in rows),'poses':poses,'nativePairs':cases,'joints':joints,'witnessBoundsXYZ':witness_bounds,'overlaps':overlaps,'limits':'Installation envelopes only; source MSL seat and bracket strength/positioning qualification remain pending.'}
with open('/tmp/protolab-installed-encoder-native.json','w') as f:json.dump(report,f,indent=2)
assert not overlaps,overlaps
print('INSTALLED_ENCODER_NATIVE='+str(cases))
`;
    writeFileSync('/tmp/protolab-installed-encoder-native.py', script);
    const r = spawnSync(
      process.env.FREECAD_PYTHON!,
      ['/tmp/protolab-installed-encoder-native.py'],
      { encoding: 'utf8', timeout: 300000, maxBuffer: 2000000 },
    );
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(r.stdout.includes('INSTALLED_ENCODER_NATIVE='));
  },
);

test(
  'optional Full installed encoder bolts mate their actual threaded hosts without generating long drive shafts',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const pieces = millingComponents(machine.defaults).filter(
      (piece) =>
        isNativeEncoder(piece.component.id) ||
        (nativeAxis === 'z'
          ? ['x-z-fixed-saddle', 'moving-z-saddle'].includes(piece.component.id)
          : encoderHostIds.has(piece.component.id)),
    );
    const source = withGeometryMode('full', () => componentPython(millingLibraries, pieces)),
      rows = pieces.map((piece) => ({
        id: piece.component.id,
        libraryId: piece.component.libraryId,
        new: isNativeEncoder(piece.component.id),
      }));
    const script = `import FreeCAD as App, Part, json, math, hashlib
source=json.loads(${JSON.stringify(JSON.stringify(source))})
rows=json.loads(${JSON.stringify(JSON.stringify(rows))})
exec(compile(source,'installed-full-encoder-hosts','exec'),globals())
assert len(components)==len(rows)
for r,s in zip(rows,components):
    assert not s.isNull() and s.isValid() and s.isClosed() and s.Solids and s.Volume>0,r
    if r['new'] and r['libraryId']=='cnc-frame-part':assert len(s.Solids)==1,r
pairs=0;overlaps=[]
for i,a in enumerate(components):
 for j in range(i+1,len(components)):
  if not(rows[i]['new'] or rows[j]['new']):continue
  b=components[j];ab=a.BoundBox;bb=b.BoundBox
  if min(ab.XMax,bb.XMax)-max(ab.XMin,bb.XMin)<1e-7 or min(ab.YMax,bb.YMax)-max(ab.YMin,bb.YMin)<1e-7 or min(ab.ZMax,bb.ZMax)-max(ab.ZMin,bb.ZMin)<1e-7:continue
  common=a.common(b);volume=common.Volume
  assert math.isfinite(volume),(rows[i]['id'],rows[j]['id'])
  if common.Solids:assert common.isValid() and common.isClosed()
  if abs(volume)>0.001:overlaps.append({'a':rows[i]['id'],'b':rows[j]['id'],'volume':volume})
  pairs+=1
report={'status':'failed' if overlaps else 'passed','mode':'full','axisScope':${JSON.stringify(nativeAxis || 'xyz')},'scope':'Actual selected encoder occurrences and their threaded assembly hosts; long drive geometry is not generated.','geometrySourceSha256':hashlib.sha256(source.encode()).hexdigest(),'actualComponents':len(rows),'nativePairs':pairs,'overlaps':overlaps}
with open('/tmp/protolab-installed-encoder-full-native.json','w') as f:json.dump(report,f,indent=2)
assert not overlaps,overlaps
print('INSTALLED_ENCODER_FULL='+str(pairs))
`;
    writeFileSync('/tmp/protolab-installed-encoder-full-native.py', script);
    const result = spawnSync(
      process.env.FREECAD_PYTHON!,
      ['/tmp/protolab-installed-encoder-full-native.py'],
      { encoding: 'utf8', timeout: 300000, maxBuffer: 2000000 },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(result.stdout.includes('INSTALLED_ENCODER_FULL='));
  },
);
