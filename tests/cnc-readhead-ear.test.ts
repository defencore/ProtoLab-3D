import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Euler, Mesh, Vector3 } from 'three';
import machine, { millingComponents, millingLayout } from '../src/parts/cnc-milling-machine/part';
import { millingLibraries } from '../src/parts/cnc-milling-machine/lib/composition';
import {
  linearEncoderStations,
  linearEncoderEar,
  linearReadheadEar,
} from '../src/parts/cnc-milling-machine/lib/encoders';
import { encoderSpec } from '../src/parts/cnc-linear-encoder/part';
import frame, { frameReadheadEar, frameBounds, frameHoles } from '../src/parts/cnc-frame-part/part';
import { validateParameters } from '../src/core/validation';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';
import type { Vec, Shape } from '../src/core/assembly/boundary/shapes';
import type { Parameters } from '../src/core/types';
import { frameShape } from '../src/parts/cnc-frame-part/part';

function transform(point: Vec, translation: Vec, rotation: Vec) {
  return new Vector3(...point)
    .applyEuler(new Euler(...(rotation.map((n) => (n * Math.PI) / 180) as Vec), 'ZYX'))
    .add(new Vector3(...translation));
}
function threads(shape: Shape): unknown[] {
  if (shape.kind === 'cylinder' && shape.thread) return [shape];
  if ('children' in shape) return shape.children.flatMap(threads);
  if (shape.kind === 'transform') return threads(shape.child);
  return [];
}

test('all three integral front ears preserve the source face, full tap recipe and disclosed clearance/ligament stack', () => {
  const pieces = millingComponents(machine.defaults);
  for (const station of linearEncoderStations(machine.defaults, millingLayout(machine.defaults))) {
    const spec = encoderSpec(station.model),
      row = pieces.find((p) => p.component.id === station.axis + '-linear-readhead-adapter')!,
      p = row.component.parameters,
      ear = frameReadheadEar(p)!,
      old = { ...p, readheadEar: '{}' },
      localFront = ear.origin.map((n, i) => n + ear.size[i] / 2) as Vec,
      installed = transform(localFront, station.adapterOrigin, station.adapterRotation),
      expected = transform(
        [
          -12.5,
          spec.readheadRearY - linearReadheadEar.thickness / 2,
          (linearReadheadEar.topZ + linearReadheadEar.bottomZ) / 2,
        ],
        station.origin,
        station.rotation,
      );
    assert.ok(installed.distanceTo(expected) < 1e-7);
    assert.deepEqual(ear, linearEncoderEar(station));
    assert.deepEqual(validateParameters(frame, p, 'default'), []);
    assert.deepEqual(threads(frameShape(p)), threads(frameShape(old)));
    assert.equal(frameHoles(p).filter((h) => h.diameter === 4).length, 2);
    for (const hole of frameHoles(p).filter((h) => h.diameter === 4)) assert.equal(hole.depth, 6);
    const gap =
      spec.readheadRearY - linearReadheadEar.thickness - (spec.sparBackY + spec.sparDepth);
    assert.ok(Math.abs(gap - 0.5) < 1e-9);
    assert.ok(
      Math.abs(
        gap - linearReadheadEar.matingPlaneTolerance - linearReadheadEar.sparDepthTolerance - 0.1,
      ) < 1e-9,
    );
    assert.ok(
      Math.abs(linearReadheadEar.topZ - (-4 + 2 + Number(p.threadFitAllowance)) - 1.65) < 1e-9,
    );
    const bounds = frameBounds(p)!;
    assert.ok(bounds && frameBounds(old));
    assert.match(row.component.manufacturing!.blank!, /including integral front ear/);
    assert.match(
      row.component.manufacturing!.requirements.join(' '),
      /rear 4.2 mm and 1.65 mm in the front 1.8 mm/,
    );
  }
});

test('integral ear stock rejects disconnected, invalid and unsupported-role definitions', () => {
  const parameters = millingComponents(machine.defaults).find(
    (p) => p.component.id === 'x-linear-readhead-adapter',
  )!.component.parameters;
  const patches: Parameters[] = [
    { readheadEar: JSON.stringify({ origin: [10000, 10000, 10000], size: [10, 10, 10] }) },
    { readheadEar: JSON.stringify({ origin: [0, 0, 0], size: [0, 1, 1] }) },
    { readheadEar: JSON.stringify({ origin: [0, 0, 0], size: [1, 1, 1], invented: true }) },
    { role: 'sensor-bracket' },
  ];
  for (const patch of patches)
    assert.ok(validateParameters(frame, { ...parameters, ...patch }, 'default').length);
});

test('the actual stepped angle preview has finite nondegenerate faces and a closed consistently wound shell', () => {
  const adapters = millingComponents(machine.defaults).filter((row) =>
    /^[xyz]-linear-readhead-adapter$/.test(row.component.id),
  );
  for (const row of adapters) {
    const model = withGeometryMode('simple', () =>
      frame.buildExportGeometry!(row.component.parameters, 'default'),
    );
    try {
      let shells = 0;
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        shells++;
        const position = object.geometry.getAttribute('position'),
          index = object.geometry.index,
          count = index?.count ?? position.count,
          edges = new Map<string, { count: number; winding: number }>();
        const key = (i: number) =>
          [position.getX(i), position.getY(i), position.getZ(i)]
            .map((n) => {
              assert.ok(Number.isFinite(n));
              return Math.round(n / 1e-4);
            })
            .join(',');
        for (let i = 0; i < count; i += 3) {
          const triangle = [0, 1, 2].map((corner) => (index ? index.getX(i + corner) : i + corner)),
            vertices = triangle.map((n) => new Vector3().fromBufferAttribute(position, n));
          assert.ok(
            vertices[1]
              .clone()
              .sub(vertices[0])
              .cross(vertices[2].clone().sub(vertices[0]))
              .lengthSq() > 1e-18,
          );
          for (let side = 0; side < 3; side++) {
            const a = key(triangle[side]),
              b = key(triangle[(side + 1) % 3]),
              id = [a, b].sort().join(':'),
              edge = edges.get(id) ?? { count: 0, winding: 0 };
            edge.count++;
            edge.winding += a < b ? 1 : -1;
            edges.set(id, edge);
          }
        }
        assert.ok(edges.size);
        for (const [edge, value] of edges)
          assert.deepEqual(value, { count: 2, winding: 0 }, row.component.id + ': ' + edge);
      });
      assert.equal(shells, 1);
    } finally {
      disposeModel(model);
    }
  }
});

test(
  'actual reinforced readhead angles remain closed, contact their source heads and clear spar hardware through travel in both modes',
  { skip: !process.env.FREECAD_PYTHON, timeout: 240_000 },
  () => {
    const p = millingComponents(machine.defaults).filter((piece) =>
        /^[xyz]-linear-(readhead|spar|readhead-adapter|readhead-bolt-[12])$/.test(
          piece.component.id,
        ),
      ),
      stations = linearEncoderStations(machine.defaults, millingLayout(machine.defaults));
    assert.equal(p.length, 15);
    const cases = (['simple', 'full'] as const).map((mode) => ({
      mode,
      source: withGeometryMode(mode, () => componentPython(millingLibraries, p)),
    }));
    const rows = p.map((piece) => ({ id: piece.component.id, motion: piece.motion }));
    const witnesses = stations.flatMap((station) =>
      encoderSpec(station.model).readheadMounts.map((hole) => ({
        id: station.axis + '-linear-readhead-adapter',
        head: station.axis + '-linear-readhead',
        frontStock: transform(
          [hole.position[0], -0.75, -1],
          station.origin,
          station.rotation,
        ).toArray(),
        rearGap: transform(
          [hole.position[0], -5, -1.3],
          station.origin,
          station.rotation,
        ).toArray(),
        bore: [-6, -4.5, -2.8, -0.5].map((y) =>
          transform([hole.position[0], y, -4], station.origin, station.rotation).toArray(),
        ),
      })),
    );
    const source = `import FreeCAD as App, Part, math, json, hashlib
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
rows=json.loads(${JSON.stringify(JSON.stringify(rows))})
witnesses=json.loads(${JSON.stringify(JSON.stringify(witnesses))})
proof=[]
for case in cases:
    scope={'App':App,'Part':Part,'math':math}
    exec(compile(case['source'],'actual-installed-readhead-ear','exec'),scope)
    shapes=scope['components']; assert len(shapes)==15
    byid={row['id']:shape for row,shape in zip(rows,shapes)}
    for row,shape in zip(rows,shapes):
        assert not shape.isNull() and shape.isValid() and shape.isClosed() and shape.Solids and math.isfinite(shape.Volume) and shape.Volume>0,row
        if row['id'].endswith('-adapter'): assert len(shape.Solids)==1,row
    for w in witnesses:
        adapter=byid[w['id']]; head=byid[w['head']]
        assert adapter.isInside(App.Vector(*w['frontStock']),1e-7,False),('Missing actual added stock',w)
        assert not adapter.isInside(App.Vector(*w['rearGap']),1e-7,False),('Do not hide the depth-dependent rear limit',w)
        assert adapter.distToShape(head)[0]<1e-6,('Actual head/adapter face no longer contacts',w)
        for point in w['bore']: assert not adapter.isInside(App.Vector(*point),1e-7,False),('Full six-mm tap bore obstructed',w,point)
    pairs=0;overlaps=[]
    poses=[(0,0,0)]+[(x,y,z) for x in [-400,400] for y in [-750,750] for z in [-100,100]]
    for pose in poses:
        placed=[]
        for row,shape in zip(rows,shapes):
            value=shape.copy();value.translate(App.Vector(pose[0] if row['motion'] in ['x','z'] else 0,pose[1] if row['motion']!='fixed' else 0,pose[2] if row['motion']=='z' else 0));placed.append(value)
        for i,a in enumerate(placed):
            for j in range(i+1,len(placed)):
                if not(rows[i]['id'].endswith('-adapter') or rows[j]['id'].endswith('-adapter')):continue
                b=placed[j];ab=a.BoundBox;bb=b.BoundBox
                if min(ab.XMax,bb.XMax)-max(ab.XMin,bb.XMin)<1e-7 or min(ab.YMax,bb.YMax)-max(ab.YMin,bb.YMin)<1e-7 or min(ab.ZMax,bb.ZMax)-max(ab.ZMin,bb.ZMin)<1e-7:continue
                common=a.common(b); volume=common.Volume
                assert math.isfinite(volume),(rows[i],rows[j],pose)
                if common.Solids:assert common.isValid() and common.isClosed(),(rows[i],rows[j],pose)
                if abs(volume)>0.001:overlaps.append({'a':rows[i]['id'],'b':rows[j]['id'],'pose':pose,'volumeMm3':volume})
                pairs+=1
    proof.append({'mode':case['mode'],'geometrySourceSha256':hashlib.sha256(case['source'].encode()).hexdigest(),'components':len(rows),'poses':poses,'nativePairs':pairs,'stockAndContactWitnesses':witnesses,'overlaps':overlaps})
    open('/tmp/protolab-cnc-readhead-ear-native.json','w').write(json.dumps(proof,indent=2))
    assert not overlaps,overlaps
print('READHEAD_EAR_NATIVE_PASSED')
`;
    const path = '/tmp/protolab-cnc-readhead-ear-native.py';
    writeFileSync(path, source);
    writeFileSync(
      '/tmp/protolab-cnc-readhead-ear-source-hashes.json',
      JSON.stringify(
        cases.map((c) => ({
          mode: c.mode,
          sha256: createHash('sha256').update(c.source).digest('hex'),
        })),
        null,
        2,
      ),
    );
    const result = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      timeout: 230_000,
      maxBuffer: 2_000_000,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /READHEAD_EAR_NATIVE_PASSED/);
  },
);
