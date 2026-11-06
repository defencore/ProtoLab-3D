import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Euler, Matrix4, Vector3 } from 'three';
import type { ConfiguredPiece } from '../src/core/assembly/detail-instances';
import type { Shape } from '../src/core/assembly/boundary/shapes';
import type { PartDefinition } from '../src/core/types';
import coplanar, {
  cncPieces, cncLayout, cncFramePieces, cncMachiningSchedule,
  outerPlateBlankShape, type CncVariant,
} from '../src/parts/tr8-quad-cnc-actuator/part';
import staggered from '../src/parts/tr8-quad-staggered-actuator/part';
import coplanarPackage from '../src/parts/tr8-quad-cnc-actuator';
import staggeredPackage from '../src/parts/tr8-quad-staggered-actuator';
import { preservedStudySource } from './helpers/study-source-baselines';

const close = (actual: number, expected: number, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const letters = ['a', 'b', 'c', 'd'];
const axis = (name: 'x' | 'y' | 'z') => new Vector3(...({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[name] as [number, number, number]));
const recipe = (piece: ConfiguredPiece): Shape => JSON.parse(String(piece.component.parameters.recipe)) as Shape;
const occurrence = (piece: ConfiguredPiece) => new Matrix4()
  .makeRotationFromEuler(new Euler(...piece.component.placement.rotation.map(v => v * Math.PI / 180) as [number, number, number], 'ZYX'))
  .setPosition(...piece.component.placement.translation);

type Cylinder = { source: Extract<Shape, { kind: 'cylinder' }>; from: Vector3; to: Vector3; direction: Vector3 };
function cylinders(shape: Shape, frame = new Matrix4(), positiveOnly = false): Cylinder[] {
  if (shape.kind === 'cylinder') {
    const from = new Vector3(...shape.origin).applyMatrix4(frame);
    const direction = axis(shape.axis).transformDirection(frame);
    return [{ source: shape, from, to: from.clone().addScaledVector(direction, shape.height), direction }];
  }
  if (shape.kind === 'transform') {
    const local = new Matrix4().makeRotationFromEuler(new Euler(...shape.rotation.map(v => v * Math.PI / 180) as [number, number, number], 'ZYX')).setPosition(...shape.translation);
    return cylinders(shape.child, frame.clone().multiply(local), positiveOnly);
  }
  if ('children' in shape) {
    const children = positiveOnly && (shape.kind === 'subtract' || shape.kind === 'intersect') ? shape.children.slice(0, 1) : shape.children;
    return children.flatMap(child => cylinders(child, frame, positiveOnly));
  }
  return [];
}
const pieceById = (pieces: ConfiguredPiece[], id: string) => {
  const found = pieces.find(piece => piece.component.id === id);
  assert.ok(found, id);
  return found;
};
const worldCylinders = (piece: ConfiguredPiece, positiveOnly = false) => cylinders(recipe(piece), occurrence(piece), positiveOnly);

function dxfCircles(content: string): { x: number; y: number; radius: number }[] {
  const lines = content.trim().split(/\r?\n/), result: { x: number; y: number; radius: number }[] = [];
  let current: { x: number; y: number; radius: number } | undefined;
  for (let i = 0; i < lines.length; i += 2) {
    const code = Number(lines[i]), value = lines[i + 1];
    if (code === 0) {
      if (current) result.push(current);
      current = value === 'CIRCLE' ? { x: NaN, y: NaN, radius: NaN } : undefined;
    } else if (current && code === 10) current.x = Number(value);
    else if (current && code === 20) current.y = Number(value);
    else if (current && code === 40) current.radius = Number(value);
  }
  if (current) result.push(current);
  assert.ok(result.every(c => [c.x, c.y, c.radius].every(Number.isFinite)));
  return result;
}

const variants: { variant: CncVariant; part: PartDefinition; diameter: number; stations: number[]; length: number; thread: number }[] = [
  { variant: 'coplanar-64', part: coplanar, diameter: 64, stations: [0, 0, 0, 0], length: 50, thread: 26 },
  { variant: 'staggered-56', part: staggered, diameter: 56, stations: [-8.5, 8.5, -8.5, 8.5], length: 68, thread: 44 },
];

test('CNC variants are separate public packages with complete dependency identities', () => {
  assert.equal(coplanarPackage.apiVersion, 2);
  assert.equal(staggeredPackage.apiVersion, 2);
  assert.equal(coplanarPackage.part.id, 'tr8-quad-cnc-actuator');
  assert.equal(staggeredPackage.part.id, 'tr8-quad-staggered-actuator');
  assert.equal(coplanar.id, coplanarPackage.part.id);
  assert.equal(staggered.id, staggeredPackage.part.id);
  assert.deepEqual(staggeredPackage.dependencies, ['tr8-quad-cnc-actuator']);
  const dependencyClosure = new Set<string>(coplanarPackage.dependencies);
  for (const { part, variant } of variants) {
    assert.ok(part.name.includes(variant === 'coplanar-64' ? '64' : '56'));
    for (const { component } of cncPieces(part.defaults, 'assembled', variant)) {
      assert.ok(dependencyClosure.has(component.libraryId), component.libraryId);
    }
  }
});

for (const { variant, part, diameter, stations, length, thread } of variants) {
  test(`${variant}: each command affects only its own channel and leaves the frame fixed`, () => {
    const neutral = cncPieces(part.defaults, 'assembled', variant);
    assert.equal(new Set(neutral.map(p => p.component.id)).size, neutral.length);
    for (const letter of letters) {
      const changed = cncPieces({ ...part.defaults, ['angle' + letter.toUpperCase()]: 13 }, 'assembled', variant);
      assert.deepEqual(changed.filter(p => !p.component.id.startsWith(letter + '-')), neutral.filter(p => !p.component.id.startsWith(letter + '-')));
      assert.notDeepEqual(pieceById(changed, letter + '-lead-nut').component.placement, pieceById(neutral, letter + '-lead-nut').component.placement);
      assert.notDeepEqual(pieceById(changed, letter + '-output-shaft').component.placement, pieceById(neutral, letter + '-output-shaft').component.placement);
    }
    assert.deepEqual(cncPieces({ ...part.defaults, angleA: -20, angleB: 20 }, 'assembled', variant).filter(p => !/^[abcd]-/.test(p.component.id)), cncFramePieces(cncLayout(variant)));
    assert.deepEqual(part.composition!({ ...part.defaults, angleA: 17, angleC: -14 }), part.composition!(part.defaults));
  });

  test(`${variant}: actual drive axes lie at D/4 and outward shafts form the specified X`, () => {
    const layout = cncLayout(variant);
    const pieces = cncPieces({ ...part.defaults, angleA: -20, angleB: 7, angleC: 20, angleD: -3 }, 'assembled', variant);
    const directions: Vector3[] = [];
    for (const [index, letter] of letters.entries()) {
      for (const id of ['gearmotor', 'coupling', 'screw-bearing-0', 'screw-bearing-1']) {
        const piece = pieceById(pieces, letter + '-' + id), [x, y, z] = piece.component.placement.translation;
        close(Math.hypot(y, z), diameter / 4);
        close(diameter / 2 - Math.hypot(y, z), Math.hypot(y, z));
        close(Math.abs(axis('z').transformDirection(occurrence(piece)).x), 1);
        assert.ok(Number.isFinite(x));
      }
      const shaft = worldCylinders(pieceById(pieces, letter + '-output-shaft'), true)[0];
      close(shaft.source.radius, 3);
      close(shaft.from.x, stations[index]);
      close(shaft.to.x, stations[index]);
      close(shaft.direction.x, 0);
      close(Math.abs(shaft.direction.y), Math.SQRT1_2);
      close(Math.abs(shaft.direction.z), Math.SQRT1_2);
      const radial = new Vector3(0, shaft.from.y, shaft.from.z);
      close(radial.clone().cross(shaft.direction).length(), 0);
      close(radial.dot(shaft.direction), layout.outputRadial + 6.55);
      close(new Vector3(0, shaft.to.y, shaft.to.z).dot(shaft.direction), layout.outputRadial + layout.outputTail);
      assert.ok(shaft.to.clone().sub(shaft.from).dot(radial) > 0);
      directions.push(shaft.direction);
    }
    directions.forEach((direction, i) => close(direction.dot(directions[(i + 1) % 4]), 0));
    close(directions[0].dot(directions[2]), -1);
    assert.deepEqual(layout.outputStations, stations);
  });

  test(`${variant}: exactly three main discs include one integrated body and eight end bolts`, () => {
    const frame = cncPieces(part.defaults, 'assembled', variant).filter(p => !/^[abcd]-/.test(p.component.id));
    const details = frame.filter(p => p.component.libraryId === 'manufactured-detail');
    const bolts = frame.filter(p => p.component.libraryId === 'bolt-screw');
    assert.equal(frame.length, 11);
    assert.deepEqual(details.map(p => p.component.id), ['cnc-middle-body', 'cnc-motor-disc', 'cnc-end-disc']);
    assert.equal(bolts.length, 8);
    assert.ok(bolts.every(p => p.component.parameters.diameter === 3 && p.component.parameters.length === 8));
    assert.ok(!frame.some(p => p.component.libraryId === 'pcb-standoff' || /cheek|brace/.test(p.component.id)));
    const mainDiscs = details.flatMap(p => worldCylinders(p, true)).filter(c => Math.abs(c.source.radius - diameter / 2) < 1e-8);
    assert.equal(mainDiscs.length, 3, 'No extra annular brace bands act as additional circular plates.');
    assert.deepEqual(mainDiscs.map(c => c.source.height).sort((a, b) => a - b), [3, 3, 5]);
    const middle = pieceById(frame, 'cnc-middle-body');
    assert.equal(worldCylinders(middle, true).filter(c => c.source.radius === 7.1).length, 4);
    const taps = worldCylinders(middle).filter(c => c.source.thread?.internal);
    assert.equal(taps.length, 8);
    assert.ok(taps.every(c => c.source.radius === 1.5 && c.source.thread?.pitch === .5 && c.source.height >= 8));
  });

  test(`${variant}: physical nut envelopes remain on the working thread throughout travel`, () => {
    const pieces = cncPieces({ ...part.defaults, angleA: -20, angleB: 20, angleC: 20, angleD: -20 }, 'assembled', variant);
    const schedule = cncMachiningSchedule(cncLayout(variant));
    let minimum = Infinity;
    for (const [index, letter] of letters.entries()) {
      const stocks = worldCylinders(pieceById(pieces, letter + '-lead-screw'), true);
      const working = stocks.find(c => c.source.radius === 4)!;
      assert.ok(working);
      close(working.source.height, thread);
      const ends = stocks.flatMap(c => [c.from.x, c.to.x]);
      close(Math.max(...ends) - Math.min(...ends), length);
      assert.ok(length < schedule.screw.stockLength);
      const nut = worldCylinders(pieceById(pieces, letter + '-lead-nut'), true).find(c => c.source.radius === 5 && c.source.height === 15)!;
      assert.ok(nut);
      const nutCentre = (nut.from.x + nut.to.x) / 2;
      const command = index === 0 || index === 3 ? -20 : 20;
      close(nutCentre - stations[index], cncLayout(variant).lever * Math.tan(command * Math.PI / 180));
      const left = nut.from.x - working.from.x, right = working.to.x - nut.to.x;
      assert.ok(left > 1.8 && right > 1.8, `${letter}: ${left}, ${right}`);
      minimum = Math.min(minimum, left, right);
    }
    close(schedule.screw.fullNutEndMargin, minimum);
    assert.equal(schedule.screw.finishedLength, length);
    assert.equal(schedule.screw.threadLength, thread);
    assert.equal(schedule.screw.starts, 4);
    assert.equal(schedule.screw.pitch, 2);
    assert.equal(schedule.screw.lead, 8);
  });

  test(`${variant}: fabrication package pilots differ from installed finished seats`, () => {
    const files = part.fabricationFiles!(part.defaults), layout = cncLayout(variant);
    const prefix = diameter === 64 ? 'TR8-CNC64-' : 'TR8-CNC56-';
    assert.ok(files.every(f => f.name.startsWith(prefix)));
    assert.equal(new Set(files.map(f => f.name)).size, files.length);
    const manifest = JSON.parse(files.find(f => f.id === 'cut-manifest')!.content);
    assert.equal(manifest.mainOuterDiscs, 2);
    assert.equal(manifest.integralMiddleBodies, 1);
    assert.equal(manifest.forks, 4);
    assert.equal(manifest.laserStockThickness, 3);
    assert.equal(manifest.scale, '1:1');
    assert.ok(files.some(f => f.id === 'cnc-body-native') && files.some(f => f.id === 'laser-blanks-native'));
    const frame = cncFramePieces(layout);
    for (const motor of [true, false]) {
      const role = motor ? 'motor' : 'end';
      const drawing = dxfCircles(files.find(f => f.id === role + '-disc-dxf')!.content);
      const actual = worldCylinders(pieceById(frame, 'cnc-' + role + '-disc'));
      assert.equal(drawing.length, actual.length);
      for (const drawn of drawing) {
        const expectedRadius = !motor && drawn.radius === 6.4 ? 6.51 : drawn.radius;
        assert.ok(actual.some(c => Math.abs(c.source.radius - expectedRadius) < 1e-8 && Math.hypot(c.from.y - drawn.x, c.from.z - drawn.y) < 1e-8));
      }
      close(drawing[0].radius, diameter / 2);
    }
    assert.equal(cylinders(outerPlateBlankShape(layout, false)).filter(c => c.source.radius === 6.4).length, 4);
    const forkPilot = dxfCircles(files.find(f => f.id === 'fork-dxf')!.content);
    assert.equal(forkPilot.length, 1);
    close(forkPilot[0].radius, 2.9);
    const fork = pieceById(cncPieces(part.defaults, 'assembled', variant), 'a-output-rear-crank');
    assert.equal(worldCylinders(fork).filter(c => c.source.radius === 3.025).length, 1);
    const bom = files.find(f => f.id === 'bom')!.content;
    assert.ok(bom.includes('cnc-middle-body') && bom.includes('frame-front-bolt-4'));
    assert.ok(!bom.includes('pcb-standoff'));
  });

  test(`${variant}: presets validate and unsupported models or output angles are rejected`, () => {
    assert.equal(part.presets.length, 4);
    assert.equal(new Set(part.presets.map(p => p.id)).size, 4);
    for (const preset of part.presets) {
      assert.ok(preset.id.startsWith(part.id + '-'));
      assert.deepEqual(part.validate(preset.parameters, 'assembled'), []);
    }
    for (const letter of letters) {
      for (const invalid of [-20.01, 20.01, Infinity, NaN]) {
        assert.ok(part.validate({ ...part.defaults, ['angle' + letter.toUpperCase()]: invalid }, 'assembled').length);
      }
    }
    assert.ok(part.validate({ ...part.defaults, motorModel: 'unsupported' }, 'assembled').length);
    for (const [state, angle] of [['negative-limit', -20], ['positive-limit', 20]] as const) {
      assert.deepEqual(cncPieces(part.defaults, state, variant), cncPieces({ ...part.defaults, angleA: angle, angleB: angle, angleC: angle, angleD: angle }, 'assembled', variant));
    }
  });
}

test('D64 and D56 deliver independently named fabrication packages', () => {
  const names = new Set(coplanar.fabricationFiles!(coplanar.defaults).map(file => file.name));
  assert.ok(staggered.fabricationFiles!(staggered.defaults).every(file => !names.has(file.name)));
});

test('released D82 and D72 source files retain every preserved study hash', () => {
  const preserved = JSON.parse(readFileSync(new URL('./fixtures/tr8-previous-library-sha256.json', import.meta.url), 'utf8')) as Record<string, Record<string, string>>;
  assert.deepEqual(Object.keys(preserved).sort(), ['tr8-quad-actuator', 'tr8-quad-mini-actuator']);
  for (const [family, files] of Object.entries(preserved)) {
    assert.ok(Object.keys(files).length >= 19);
    for (const [file, expected] of Object.entries(files)) {
      const content = readFileSync(new URL(`../src/parts/${family}/${file}`, import.meta.url));
      assert.equal(createHash('sha256').update(preservedStudySource(family + '/' + file, content)).digest('hex'), expected, family + '/' + file);
    }
  }
});
