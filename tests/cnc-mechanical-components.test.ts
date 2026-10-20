import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import rail, {
  railParameters,
  railLayout,
  railMountingHoles,
} from '../src/parts/cnc-guide-rail/part';
import carriage, { HGH20CA, carriageMountingHoles } from '../src/parts/cnc-guide-carriage/part';
import support, {
  screwSupportParameters,
  screwSupportLayout,
  supportMountingHoles,
} from '../src/parts/cnc-screw-support/part';
import drive, { driveScrewParameters, driveScrewLayout } from '../src/parts/cnc-drive-screw/part';
import sourceScrew from '../src/parts/ball-screw/part';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { withGeometryMode } from '../src/core/geometry-mode';
import { generateScript } from '../src/core/freecad';
import type { GeometryMode } from '../src/core/geometry-mode';

test('HGR20 cut geometry keeps sourced mounting dimensions and valid symmetric edge distances across long rails', () => {
  for (const [length, endOffset] of [
    [100, 20],
    [1000, 20],
    [1800, 30],
    [1900, 20],
    [2000, 10],
    [4000, 20],
  ]) {
    const parameters = railParameters(length),
      layout = railLayout(parameters),
      holes = railMountingHoles(parameters);
    assert.deepEqual(validateParameters(rail, parameters, 'default'), []);
    assert.equal(layout.endOffset, endOffset);
    assert.equal(holes.length, layout.count);
    assert.equal(holes[0][0], -length / 2 + endOffset);
    assert.equal(holes.at(-1)![0], length / 2 - endOffset);
    assert.ok(
      holes.every(([x, y, z], i) => y === 0 && z === 0 && (!i || x - holes[i - 1][0] === 60)),
    );
  }
  assert.ok(validateParameters(rail, railParameters(1982), 'default').length);
  assert.ok(validateParameters(rail, railParameters(4001), 'default').length);
});

test('independent HGH20CA uses the rail base datum and source mounting pattern rather than shifting its base to zero', () => {
  assert.deepEqual(carriageMountingHoles(), [
    [-18, -16, 30],
    [-18, 16, 30],
    [18, -16, 30],
    [18, 16, 30],
  ]);
  const model = carriage.buildGeometry(carriage.defaults, 'assembled');
  try {
    const bounds = new Box3().setFromObject(model, true);
    assert.ok(Math.abs(bounds.min.z - 4.6) < 0.001, 'preview retains the source rail-base datum');
    assert.ok(Math.abs(bounds.max.z - 30) < 0.001);
    assert.ok(Math.abs(bounds.getSize(new Vector3()).x - HGH20CA.length) < 0.001);
  } finally {
    disposeModel(model);
  }
});

test('BK12 and BF12 expose distinct real journal bores, bolt patterns and screw retention interfaces', () => {
  const fixed = screwSupportLayout(screwSupportParameters('bk12')),
    free = screwSupportLayout(screwSupportParameters('bf12'));
  assert.equal(fixed.bearingBore, 12);
  assert.equal(free.bearingBore, 10);
  assert.equal(fixed.bearingCount, 2);
  assert.equal(free.bearingCount, 1);
  assert.equal(fixed.bearingOutside, 28);
  assert.equal(free.bearingOutside, 26);
  for (const v of [fixed, free]) {
    const holes = supportMountingHoles(screwSupportParameters(v.model));
    assert.equal(holes.length, v.fixed ? 4 : 2);
    assert.ok(
      holes.every(
        ([x, y, z]) => Math.abs(x) === v.mountingPitchX / 2 && Math.abs(y) === 23 && z === -25,
      ),
    );
  }
  const v = driveScrewLayout(driveScrewParameters(1800));
  assert.equal(v.overallLength, 1862);
  assert.equal(v.fixedSupportCenter + fixed.shoulderContact, v.fixedShoulder);
  assert.equal(v.freeSupportCenter + free.shoulderContact, v.freeShoulder);
  assert.equal(v.fixedJournal.end - v.fixedJournal.start, 36);
  assert.equal(v.driveJournal.end - v.driveJournal.start, 15);
  assert.equal(v.freeJournal.end - v.freeJournal.start, 11);
  assert.equal(v.thread.end - v.thread.start, 12);
  assert.equal(v.groove.start - v.freeShoulder, 8);
  assert.ok(Math.abs(v.groove.end - v.groove.start - 1.15) < 1e-8);
  assert.deepEqual(validateParameters(drive, driveScrewParameters(1800), 'default'), []);
});

test('Full exposes purchased bearings and declared retention threads without changing support identity or source claims', () => {
  for (const mode of ['simple', 'full'] as const)
    for (const model of ['bk12', 'bf12'] as const) {
      const parameters = screwSupportParameters(model),
        geometry = withGeometryMode(mode, () => support.buildGeometry(parameters, 'cutaway'));
      try {
        const meshes: Mesh[] = [];
        geometry.traverse((obj) => {
          if (obj instanceof Mesh) meshes.push(obj);
        });
        assert.ok(meshes.length > 2);
        assert.ok(meshes.every((mesh) => mesh.geometry.getAttribute('position').count > 0));
        if (mode === 'full') assert.ok(meshes.some((mesh) => mesh.name.includes('rolling ball')));
      } finally {
        disposeModel(geometry);
      }
    }
  const simple = generateScript(
    support,
    support.defaults,
    'assembled',
    'bk12',
    undefined,
    'simple',
  );
  const full = generateScript(support, support.defaults, 'assembled', 'bk12', undefined, 'full');
  assert.ok(simple.includes('M12x1') && full.includes('M12x1'));
  assert.ok(!simple.includes('def _protolab_thread('));
  assert.ok(full.includes('def _protolab_thread('));
  assert.equal(support.product.supply, 'purchased');
  assert.equal(support.composition, undefined);
  assert.ok(support.notes?.includes('reconstruction assumptions'));
});

test('BK retention metadata preserves source thread nominals independently of illustrative female cutting tools', () => {
  for (const mode of ['simple', 'full'] as const) {
    const script = withGeometryMode(mode, () => support.python(support.defaults, 'assembled'));
    const record = script.split('\n').reverse().find((line) => line.startsWith('component_metadata = '));
    assert.ok(record);
    const metadata = JSON.parse(record.slice('component_metadata = '.length)) as Record<string, string>[];
    const locknut = metadata.find((row) => row.ThreadFitAllowance?.includes('M12x1'));
    assert.ok(locknut);
    const features = JSON.parse(locknut.ThreadFeaturesJSON) as {
      designation: string;
      internal: boolean;
      nominalDiameter: number;
      representation: string;
    }[];
    assert.deepEqual(
      features.map(({ designation, nominalDiameter }) => [designation, nominalDiameter]),
      [['M12x1', 12], ['M4', 4], ['M4', 4]],
    );
    assert.ok(features.every((row) => row.internal));
    assert.ok(features.every((row) => row.representation === (mode === 'full' ? 'machined-helix' : 'nominal-cylinder')));
    assert.ok(locknut.ThreadFitAllowance.includes('12.1 mm'));
    assert.ok(locknut.ThreadFitAllowance.includes('4.1 mm'));
    assert.ok(locknut.ThreadFitAllowance.includes('no production fit class'));
  }
});

test(
  'native CNC components retain mounting bores, closed solids and zero interference at the matched shaft/support interfaces',
  { skip: !process.env.FREECAD_PYTHON, timeout: 600_000 },
  () => {
    const cases = (['simple', 'full'] as GeometryMode[]).map((mode) => ({
      mode,
      rail: withGeometryMode(mode, () => rail.python(railParameters(1900), 'default')),
      carriage: withGeometryMode(mode, () => carriage.python(carriage.defaults, 'assembled')),
      bk: withGeometryMode(mode, () => support.python(screwSupportParameters('bk12'), 'assembled')),
      bf: withGeometryMode(mode, () => support.python(screwSupportParameters('bf12'), 'assembled')),
      drive: withGeometryMode(mode, () => drive.python(driveScrewParameters(1800), 'default')),
    }));
    const source = `import FreeCAD as App, Part, math, json
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
proof=[]
for case in cases:
    shapes={}
    for key in ['rail','carriage','bk','bf','drive']:
        scope={'App':App,'Part':Part,'math':math}
        exec(case[key],scope)
        components=scope['components']
        assert all(s.isValid() and s.isClosed() and s.Volume>0 and len(s.Solids)==1 for s in components),(case['mode'],key,'invalid physical component')
        if key=='bk':
            metadata=next(row for row in scope['component_metadata'] if 'M12x1' in row.get('ThreadFitAllowance',''))
            assert [f['nominalDiameter'] for f in json.loads(metadata['ThreadFeaturesJSON'])]==[12,4,4],'source nominal must not become the clearance-tool diameter'
        if key=='drive': assert len(scope['shape'].Solids)==1,'machined screw must be one physical solid'
        for index,shape in enumerate(components):
            for other in components[index+1:]:
                if shape.BoundBox.intersect(other.BoundBox): assert shape.common(other).Volume<1e-6,(case['mode'],key,'supplier internal overlap',shape.common(other).Volume)
        shapes[key]=scope['shape']
        if ${process.env.CNC_MECHANICAL_NATIVE_PROOF ? 'True' : 'False'}: scope['shape'].exportBrep('/tmp/protolab-cnc-'+case['mode']+'-'+key+'.brep')
    rail_bounds=shapes['rail'].optimalBoundingBox(True,False)
    carriage_bounds=shapes['carriage'].optimalBoundingBox(True,False)
    assert abs(rail_bounds.ZMin)<1e-5 and abs(rail_bounds.ZMax-17.5)<1e-5
    assert abs(carriage_bounds.ZMin-4.6)<1e-5 and abs(carriage_bounds.ZMax-30)<1e-5,('source carriage datum',case['mode'],carriage_bounds)
    assert shapes['rail'].common(shapes['carriage']).Volume<1e-6,'rail and carriage must clear'
    for x in [-18,18]:
        for y in [-16,16]: assert not shapes['carriage'].isInside(App.Vector(x,y,27),1e-7,True),'M5 mount must stay open'
    for key,pitch in [('bk',13),('bf',0)]:
        for x in ([-pitch/2,pitch/2] if pitch else [0]):
            for y in [-23,23]: assert not shapes[key].isInside(App.Vector(x,y,-20),1e-7,True),'mounting bore must stay open'
    shapes['bk'].translate(App.Vector(-913,0,0));shapes['bf'].translate(App.Vector(904,0,0))
    fixed_overlap=shapes['drive'].common(shapes['bk'])
    if fixed_overlap.Volume>=1e-6:
        print('FIXED_INTERFERENCE '+json.dumps({'mode':case['mode'],'volume':fixed_overlap.Volume,'bounds':str(fixed_overlap.BoundBox),'solids':[shapes['drive'].common(s).Volume for s in shapes['bk'].Solids]}),flush=True)
    assert fixed_overlap.Volume<1e-6,('fixed interface collision',case['mode'],fixed_overlap.Volume)
    assert shapes['drive'].common(shapes['bf']).Volume<1e-6,('free interface collision',case['mode'],shapes['drive'].common(shapes['bf']).Volume)
    assert not shapes['drive'].isInside(App.Vector(908.5,4.9,0),1e-7,True),'groove must reduce the free journal'
    proof.append({'mode':case['mode'],'components':{key:len(shape.Solids) for key,shape in shapes.items()},'freecad':App.Version()})
print('CNC_MECHANICAL_NATIVE '+json.dumps(proof))
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: source,
      encoding: 'utf8',
      timeout: 580_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    const proof = result.stdout
      .split('\n')
      .find((line) => line.startsWith('CNC_MECHANICAL_NATIVE '));
    assert.ok(proof);
    if (process.env.CNC_MECHANICAL_NATIVE_PROOF)
      writeFileSync(
        process.env.CNC_MECHANICAL_NATIVE_PROOF,
        JSON.stringify(
          {
            results: JSON.parse(proof.slice(22)),
            scripts: cases.map((row) => ({
              mode: row.mode,
              sha256: Object.fromEntries(
                ['rail', 'carriage', 'bk', 'bf', 'drive'].map((key) => [
                  key,
                  createHash('sha256')
                    .update(row[key as keyof typeof row])
                    .digest('hex'),
                ]),
              ),
            })),
          },
          null,
          2,
        ) + '\n',
      );
  },
);

test(
  'native Full partial source periods preserve the original SFU helix phase across internal joins',
  { skip: !process.env.FREECAD_PYTHON, timeout: 300_000 },
  () => {
    const selected = sourceScrew.presets.find((row) => row.id === 'sfu1610-3-200');
    assert.ok(selected);
    const scripts = withGeometryMode('full', () => ({
      reference: sourceScrew.python({
        ...sourceScrew.defaults,
        ...selected.parameters,
        length: 200,
        endMachining: 'none',
        rotation: 0,
        nutPosition: 50,
      }, 'screw'),
      partial: drive.python(driveScrewParameters(451), 'default'),
      maximum: drive.python(driveScrewParameters(1938), 'default'),
      support: support.python(support.defaults, 'assembled'),
    }));
    const source = `import FreeCAD as App,Part,math,json
scripts=json.loads(${JSON.stringify(JSON.stringify(scripts))})
shapes={}
for key in ['reference','partial','maximum','support']:
    scope={'App':App,'Part':Part,'math':math}
    exec(scripts[key],scope)
    shapes[key]=scope['shape']
    if key!='support': assert shapes[key].isValid() and shapes[key].isClosed() and len(shapes[key].Solids)==1,(key,'one physical shaft')
shapes['reference'].rotate(App.Vector(),App.Vector(0,1,0),90)
# Actual groove-surface witnesses cross the partial shaft's join at X=-25.5.
# A distance check avoids subtracting coincident periodic surfaces with different parameter domains.
distances=[]
for source_key,target_key in [('reference','partial'),('partial','reference')]:
    vertices,_=shapes[source_key].tessellate(0.2)
    candidates=sorted([point for point in vertices if abs(point.x)<65 and math.hypot(point.y,point.z)<7.9],key=lambda point:point.x)
    assert len(candidates)>=16,(source_key,'groove surface witnesses')
    witnesses=[candidates[round(index*(len(candidates)-1)/15)] for index in range(16)]
    assert any(point.x<-25.5 for point in witnesses) and any(point.x>-25.5 for point in witnesses),'witnesses must cover both sides of the join'
    target_surface=Part.makeCompound(shapes[target_key].Faces)
    distances.extend(target_surface.distToShape(Part.Vertex(point))[0] for point in witnesses)
assert max(distances)<1e-4,('source groove-surface phase/continuity',distances)
for key,length in [('partial',451),('maximum',1938)]:
    fixed=shapes['support'].copy()
    fixed.translate(App.Vector(-length/2-13,0,0))
    overlap=shapes[key].common(fixed).Volume
    assert overlap<1e-6,(key,'unrestricted fixed support interface',overlap)
    # tessellate installs a mesh with deflection padding; dimensional checks use the actual CAD surfaces.
    bounds=shapes[key].optimalBoundingBox(False,False)
    assert abs(bounds.XMin-(-length/2-51))<1e-5 and abs(bounds.XMax-(length/2+11))<1e-5,(key,'source end spans',bounds)
print('CNC_PARTIAL_NATIVE '+json.dumps({'maximumSurfaceDistance':max(distances),'surfaceWitnessCount':len(distances),'lengths':[451,1938]}))
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: source,
      encoding: 'utf8',
      timeout: 280_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.ok(result.stdout.includes('CNC_PARTIAL_NATIVE '));
    if (process.env.CNC_MECHANICAL_NATIVE_PROOF)
      writeFileSync(
        process.env.CNC_MECHANICAL_NATIVE_PROOF.replace(/\.json$/, '-partial.json'),
        JSON.stringify({
          results: JSON.parse(result.stdout.split('\n').find((line) => line.startsWith('CNC_PARTIAL_NATIVE '))!.slice(19)),
          sha256: Object.fromEntries(Object.entries(scripts).map(([key, script]) => [key, createHash('sha256').update(script).digest('hex')])),
        }, null, 2) + '\n',
      );
  },
);
