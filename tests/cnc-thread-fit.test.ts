import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import test from 'node:test';
import type { Parameters, PartDefinition } from '../src/core/types';
import { componentPython, type ConfiguredPiece } from '../src/core/assembly/detail-instances';
import type { Vec } from '../src/core/assembly/boundary/shapes';
import { withGeometryMode } from '../src/core/geometry-mode';
import { validateParameters } from '../src/core/validation';
import frame from '../src/parts/cnc-frame-part/part';
import bolt from '../src/parts/bolt-screw/part';
import carriage, { carriageParameters, carriageMountingHoles } from '../src/parts/cnc-guide-carriage/part';
import { alignMatingFasteners } from '../src/parts/cnc-milling-machine/lib/thread-mating';

function piece(
  id: string,
  part: PartDefinition,
  parameters: Parameters,
  translation: Vec,
  rotation: Vec = [0, 0, 0],
  state = 'default',
): ConfiguredPiece {
  assert.deepEqual(validateParameters(part, parameters, state), [], id);
  return {
    label: id,
    color: 0x939da4,
    component: {
      id,
      name: id,
      libraryId: part.id,
      parameters,
      state,
      quantity: 1,
      supply: part.product.supply,
      placement: { translation, rotation },
    },
  };
}

test('HGH20CA inspection allowance is bounded and explicitly separate from its sourced M5 nominal', () => {
  assert.equal(carriage.defaults.threadFitAllowance, 0);
  assert.deepEqual(validateParameters(carriage, carriageParameters(0.05), 'assembled'), []);
  for (const invalid of [-0.01, 0.201, Number.NaN, Number.POSITIVE_INFINITY])
    assert.ok(validateParameters(carriage, carriageParameters(invalid), 'assembled').length);
  const field = carriage.parameters.find((entry) => entry.key === 'threadFitAllowance')!;
  assert.equal(field.filterable, false);
  assert.equal(field.visibleWhen?.(carriage.defaults), false);
  assert.ok(carriage.presets.every((row) => !row.catalog?.verifiedParameters.includes(field.key)));
  for (const mode of ['simple', 'full'] as const) {
    const source = withGeometryMode(mode, () => carriage.python(carriageParameters(0.05), 'assembled'));
    const line = source.split('\n').reverse().find((row) => row.startsWith('component_metadata = '))!;
    const metadata = JSON.parse(line.slice('component_metadata = '.length)) as Record<string, string>[];
    const body = metadata.find((row) => row.ThreadFitAllowance)!;
    const features = JSON.parse(body.ThreadFeaturesJSON) as { nominalDiameter: number; length: number; internal: boolean }[];
    assert.equal(features.length, 4);
    assert.ok(features.every((feature) => feature.nominalDiameter === 5 && feature.length === 6 && feature.internal));
    assert.ok(body.ThreadFitAllowance.includes('0.05 mm'));
    assert.ok(body.ThreadFitAllowance.includes('5.1 mm'));
    assert.ok(body.ThreadFitAllowance.includes('supplier tolerance/fit class is unverified'));
  }
});

test(
  'native Full M6/M8 mating clears in all six axial orientations and retains actual M5 carriage blind-thread fit',
  { skip: !process.env.FREECAD_PYTHON, timeout: 300_000 },
  () => {
    const orientations: { name: string; axis: 'x' | 'y' | 'z'; normal: Vec; rotation: Vec }[] = [
      { name: '+X', axis: 'x', normal: [1, 0, 0], rotation: [0, 90, 0] },
      { name: '-X', axis: 'x', normal: [-1, 0, 0], rotation: [0, -90, 0] },
      { name: '+Y', axis: 'y', normal: [0, 1, 0], rotation: [-90, 0, 0] },
      { name: '-Y', axis: 'y', normal: [0, -1, 0], rotation: [90, 0, 0] },
      { name: '+Z', axis: 'z', normal: [0, 0, 1], rotation: [0, 0, 0] },
      { name: '-Z', axis: 'z', normal: [0, 0, -1], rotation: [0, 180, 0] },
    ];
    const pieces: ConfiguredPiece[] = [];
    const pairs: { name: string; female: number; male: number; nominal: number; span: number }[] = [];
    for (const [diameter, pitch] of [[6, 1], [8, 1.25]]) {
      for (const orientation of orientations) {
        const at: Vec = [pairs.length * 80, 0, 0];
        const start: Vec = [0, 0, 0];
        start['xyz'.indexOf(orientation.axis)] = -15;
        const female = pieces.length;
        pieces.push(piece(`M${diameter}-${orientation.name}-coupon`, frame, {
          ...frame.defaults,
          role: 'motor-bracket',
          sizeX: 30,
          sizeY: 30,
          sizeZ: 30,
          threadFitAllowance: 0.05,
          holes: JSON.stringify([{ axis: orientation.axis, at: start, diameter, depth: 30, threadPitch: pitch, threadDesignation: `M${diameter}` }]),
        }, at));
        const height = diameter;
        const male = pieces.length;
        pieces.push(piece(`M${diameter}-${orientation.name}-bolt`, bolt, {
          ...bolt.defaults,
          diameter,
          shankDiameter: diameter,
          length: 25,
          head: 'socket-cap',
          headSize: diameter === 6 ? 10 : 13,
          headHeight: height,
          drive: 'hex',
          driveWidth: diameter === 6 ? 5 : 6,
          driveDepth: 3,
          pitch,
          threadLength: 25,
          tipDiameter: diameter * 0.65,
        }, at.map((value, axis) => value + orientation.normal[axis] * (15 + (height - 25) / 2)) as Vec, orientation.rotation));
        pairs.push({ name: `M${diameter} ${orientation.name}`, female, male, nominal: diameter, span: 30 });
      }
    }
    const carriageIndex = pieces.length;
    pieces.push(piece('configured-HGH20CA', carriage, carriageParameters(0.05), [1300, 0, 0], [0, 0, 0], 'assembled'));
    for (const [index, [x, y, z]] of carriageMountingHoles().entries()) {
      const male = pieces.length;
      pieces.push(piece(`M5-carriage-bolt-${index}`, bolt, {
        ...bolt.defaults,
        diameter: 5,
        shankDiameter: 5,
        length: 5,
        head: 'socket-cap',
        headSize: 8.5,
        headHeight: 5,
        drive: 'hex',
        driveWidth: 4,
        driveDepth: 2.5,
        pitch: 0.8,
        threadLength: 5,
        tipDiameter: 3.2,
        tipLength: 0.5,
      }, [1300 + x, y, z]));
      pairs.push({ name: `M5 blind carriage ${index}`, female: carriageIndex, male, nominal: 5, span: 6 });
    }
    const source = withGeometryMode('full', () => componentPython([frame, bolt, carriage], alignMatingFasteners(pieces)));
    const native = `import FreeCAD as App,Part,math,json
${source}
pairs=json.loads(${JSON.stringify(JSON.stringify(pairs))})
assert all(s.isValid() and s.isClosed() and s.Volume>0 for s in components),'all installed products must be valid closed geometry'
results=[]
for pair in pairs:
    female,male=components[pair['female']],components[pair['male']]
    common=female.common(male)
    volume=common.Volume
    assert abs(volume)<1e-6,(pair['name'],'physical thread interference',volume)
    features=json.loads(component_metadata[pair['female']]['ThreadFeaturesJSON'])
    assert all(f['nominalDiameter']==pair['nominal'] and f['length']==pair['span'] and f['internal'] for f in features),(pair['name'],'nominal source drawing callout')
    assert all(f['representation']=='machined-helix' for f in features),'coupon must exercise real Full flanks'
    results.append({'name':pair['name'],'overlapMm3':volume,'nominalDiameter':pair['nominal']})
print('CNC_THREAD_FIT '+json.dumps(results),flush=True)
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], { input: native, encoding: 'utf8', timeout: 280_000, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    const line = result.stdout.split('\n').find((row) => row.startsWith('CNC_THREAD_FIT '));
    assert.ok(line);
    if (process.env.CNC_THREAD_FIT_PROOF)
      writeFileSync(process.env.CNC_THREAD_FIT_PROOF, JSON.stringify({ results: JSON.parse(line.slice(15)), sourceSha256: createHash('sha256').update(native).digest('hex') }, null, 2) + '\n');
  },
);
