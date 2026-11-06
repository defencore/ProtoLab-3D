import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { DoubleSide, Mesh, Raycaster, Vector3, type Object3D } from 'three';
import nose, { configuredPieces, libraries } from '../src/parts/rocket-camera-nose/part';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { disposeModel } from '../src/core/mechanical';
import { physicalProductState, eskdIdentity } from '../src/core/eskd';
import { availableModelState } from '../src/core/part-selection';
import { validateParameters } from '../src/core/validation';
import {
  guidedSupportDatums,
  guidedSupportSeatContact,
} from '../src/parts/rocket-camera-nose/lib/guided-supports';
import type { AssemblyComponent } from '../src/core/product-types';

const original = nose.presets.find((preset) => preset.id === 'structural-90-86')!;
const ov = nose.presets.find((preset) => preset.id === 'ov9281-90-86')!;
const p = original.parameters;
const supports = guidedSupportDatums(p);
const supportedIds = ['outer-shell', 'cassette-cage-base', 'cassette-cage-cover'];
const commonPrintIds = [
  ...supportedIds,
  'pi-pocket',
  'pi-pressure',
  'power-carrier',
  'adapter-cushion',
  'ups-cell-cover',
  'aux-bed',
  'aux-clamp',
  'aux-pressure-plate',
  'rear-retainer',
];
let model: ReturnType<typeof componentGeometry>;
let units: Map<string, Object3D>;

before(async () => {
  await nose.initializeGeometry?.(p, 'assembled');
  const pieces = configuredPieces(p).filter((piece) => supportedIds.includes(piece.component.id));
  assert.equal(pieces.length, supportedIds.length);
  model = componentGeometry(libraries, pieces);
  model.updateMatrixWorld(true);
  model.traverse((node) => {
    if (node instanceof Mesh)
      for (const material of Array.isArray(node.material) ? node.material : [node.material])
        material.side = DoubleSide;
  });
  units = new Map(pieces.map((piece, index) => [piece.component.id, model.children[index]]));
});
after(() => {
  if (model) disposeModel(model);
});

function crossings(id: string, origin: Vector3, direction: Vector3, far: number) {
  return new Raycaster(origin, direction, 0, far)
    .intersectObject(units.get(id)!, true)
    .filter((hit, index, hits) => index === 0 || hit.distance - hits[index - 1].distance > 1e-4)
    .map((hit) => hit.point);
}
const near = (actual: number, expected: number, message: string) =>
  assert.ok(Math.abs(actual - expected) < 0.002, `${message}: ${actual} vs ${expected}`);
const printed = (component: AssemblyComponent) =>
  component.manufacturing?.processes.includes('printing');

test('housing supports retain twelve common prints, source board poses, hardware and canonical states', () => {
  assert.ok(original && ov);
  const originalParts = nose.composition!(p).components;
  const ovParts = nose.composition!(ov.parameters).components;
  for (const id of commonPrintIds) {
    const first = originalParts.find((component) => component.id === id);
    const second = ovParts.find((component) => component.id === id);
    assert.ok(first && second, id);
    assert.deepEqual(second, first, id + ' is the same common manufactured definition and pose');
  }
  for (const [preset, parts, count, screws] of [
    [original, originalParts, 45, 10],
    [ov, ovParts, 39, 8],
  ] as const) {
    assert.equal(new Set(parts.map((component) => component.id)).size, parts.length);
    assert.equal(parts.length, count);
    assert.equal(parts.filter(printed).length, 14);
    assert.equal(parts.filter((component) => component.libraryId === 'bolt-screw').length, screws);
    assert.equal(parts.filter((component) => /^body-anchor-screw-/.test(component.id)).length, 4);
    assert.equal(parts.filter((component) => component.libraryId === 'nyloc-nut').length, 7);
    assert.deepEqual(
      parts
        .filter(printed)
        .map((component) => component.id)
        .sort(),
      [...commonPrintIds, 'camera-pocket', 'camera-front-liner'].sort(),
      'supports and guide are integrated stock, without a loose support or extra fastener',
    );
    for (const [id, libraryId, presetId, translation] of [
      ['pi5', 'raspberry-pi', 'raspberry-pi-5', [4.5, -2, 46]],
      ['ups3s', 'waveshare-ups-3s', 'ups-module-3s', [2, 0, -44]],
      ['nvme-adapter', 'waveshare-pcie-m2-d', 'pcie-m2-d', [-9, 3, -40]],
      ['nvme-ssd', 'm2-ssd', '2280-reference', [-13, 12.95, -42.5]],
    ] as const) {
      const component = parts.find((item) => item.id === id)!;
      assert.equal(component.libraryId, libraryId);
      assert.equal(component.presetId, presetId);
      assert.deepEqual(component.placement.translation, translation);
      assert.deepEqual(component.placement.rotation, [0, -90, 0]);
    }
    assert.equal(nose.dimensions(preset.parameters, 'assembled')[2], 240);
    const identity = eskdIdentity(nose, preset.parameters, 'assembled');
    for (const state of ['assembled', 'cutaway', 'extracted', 'print-layout']) {
      assert.equal(availableModelState(nose, preset.parameters, state), state);
      assert.equal(physicalProductState(nose, state), 'assembled');
      assert.deepEqual(eskdIdentity(nose, preset.parameters, state), identity);
      assert.deepEqual(validateParameters(nose, preset.parameters, state), []);
    }
  }
});

test('the open keyway retains continuous broad floor and flanking material at both bearing stations', () => {
  const zStations = [
    (supports.rearBand[0] + supports.rearBand[1]) / 2,
    0,
    (supports.frontBand[0] + supports.frontBand[1]) / 2,
  ];
  for (const z of zStations)
    for (const y of [supports.keyY - 7.5, supports.keyY, supports.keyY + 7.5]) {
      const material = crossings(
        'cassette-cage-base',
        new Vector3(supports.backX - 4, y, z),
        new Vector3(1, 0, 0),
        60,
      );
      assert.ok(material.length >= 2, `a complete plate interval at Y${y}/Z${z}`);
      assert.ok(
        material[1].x - material[0].x >= (y === supports.keyY ? 4 : 7),
        'an open keyway must retain a broad floor and full-width flanking stock',
      );
    }
});

test('the open key has matching clearance and a groove that narrows continuously without retaining lips', () => {
  for (const z of [supports.rearBand[0] + 1, 0, supports.frontBand[1] - 1]) {
    const origin = new Vector3(supports.backX - 4, supports.keyY, z);
    const key = crossings('outer-shell', origin, new Vector3(1, 0, 0), 14);
    const floor = crossings('cassette-cage-base', origin, new Vector3(1, 0, 0), 14);
    assert.equal(key.length, 1, 'the key grows from the continuous housing wall');
    assert.equal(floor.length, 2);
    const floorGap = floor[0].x - key[0].x;
    assert.ok(floorGap >= 0.15 && floorGap <= 0.25, 'positive sliding gap without a loose key');
    const profileX = (supports.guideX + supports.keyTipX) / 2;
    const flankOrigin = new Vector3(profileX, supports.keyY - 8, z);
    const keyFlanks = crossings('outer-shell', flankOrigin, new Vector3(0, 1, 0), 16);
    const grooveFlanks = crossings('cassette-cage-base', flankOrigin, new Vector3(0, 1, 0), 16);
    assert.equal(keyFlanks.length, 2, 'one solid open-key cross-section');
    assert.equal(grooveFlanks.length, 2, 'one open groove bounded by two flanks');
    const before = grooveFlanks.filter((point) => point.y < keyFlanks[0].y).at(-1);
    const after = grooveFlanks.find((point) => point.y > keyFlanks[1].y);
    assert.ok(before && after, 'both open groove flanks clear the key');
    for (const gap of [keyFlanks[0].y - before.y, after.y - keyFlanks[1].y])
      assert.ok(
        gap >= 0.25 && gap <= 0.35,
        'matching broad flanks retain the selected 0.3 mm coordinate running fit',
      );
    let previousWidth = Infinity;
    for (const fraction of [0.03, 0.2, 0.4, 0.6, 0.8, 0.97]) {
      const x = supports.backX + fraction * (supports.grooveFloorX - supports.backX);
      const flanks = crossings(
        'cassette-cage-base',
        new Vector3(x, supports.keyY - 8, z),
        new Vector3(0, 1, 0),
        16,
      );
      assert.equal(
        flanks.length,
        2,
        'each depth has just two open flanks, without a reentrant lip',
      );
      const width = flanks[1].y - flanks[0].y;
      assert.ok(width < previousWidth - 0.5, 'the mouth is wider than every deeper groove section');
      assert.ok(width > 5.8, 'the narrow roof remains broad rather than ending in a knife edge');
      previousWidth = width;
    }
  }
});

test('front and rear side bearings and opposed X lands present matched broad running faces', () => {
  for (const band of [supports.rearBand, supports.frontBand])
    for (const z of [band[0] + 1, (band[0] + band[1]) / 2, band[1] - 1])
      for (const x of [7.5, 10, 13.5])
        for (const sign of [-1, 1]) {
          const origin = new Vector3(x, 0, z),
            direction = new Vector3(0, sign, 0),
            cage = crossings('cassette-cage-cover', origin, direction, 45),
            housing = crossings('outer-shell', origin, direction, 45);
          const cageFace = cage.find((point) => Math.abs(point.y - sign * 35.5) < 0.002);
          const housingFace = housing.find((point) => Math.abs(point.y - sign * 35.7) < 0.002);
          assert.ok(cageFace && housingFace, `paired bearing face at X${x}/Z${z}/${sign}Y`);
          const gap = (housingFace.y - cageFace.y) * sign;
          assert.ok(
            gap >= 0.15 && gap <= 0.25,
            'continuous bearing bands retain sliding clearance',
          );
        }
  for (const z of [-20, -32]) {
    for (const y of [-5, 5]) {
      const cage = crossings(
        'cassette-cage-cover',
        new Vector3(20, y, z),
        new Vector3(1, 0, 0),
        25,
      );
      const housing = crossings('outer-shell', new Vector3(20, y, z), new Vector3(1, 0, 0), 25);
      const cageFace = cage.find((point) => Math.abs(point.x - 30.5) < 0.002);
      const housingFace = housing.find((point) => Math.abs(point.x - 30.7) < 0.002);
      assert.ok(cageFace && housingFace, 'positive-X bearing exists beside the anchor bore');
      near(housingFace.x - cageFace.x, 0.2, 'positive-X bearing fit');
    }
    const origin = new Vector3(supports.backX - 4, supports.keyY + 12, z);
    const housing = crossings('outer-shell', origin, new Vector3(1, 0, 0), 14);
    const cage = crossings('cassette-cage-base', origin, new Vector3(1, 0, 0), 14);
    const housingFace = housing.find((point) => Math.abs(point.x - supports.guideX) < 0.002);
    const cageFace = cage.find((point) => Math.abs(point.x - supports.backX) < 0.002);
    assert.ok(housingFace && cageFace, 'negative-X bearing has broad stock outside the open key');
    near(cageFace.x - housingFace.x, 0.2, 'opposed negative-X bearing fit');
  }
});

type Point2 = [number, number];
const cross2 = (a: Point2, b: Point2, c: Point2) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function polygonArea(points: Point2[]) {
  return (
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2
  );
}
function overlapArea(first: Point2[], clip: Point2[]) {
  let polygon = [...first];
  for (let edge = 0; edge < clip.length && polygon.length; edge++) {
    const a = clip[edge],
      b = clip[(edge + 1) % clip.length],
      input = polygon;
    polygon = [];
    for (let index = 0; index < input.length; index++) {
      const previous = input[(index + input.length - 1) % input.length],
        current = input[index];
      const from = cross2(a, b, previous),
        to = cross2(a, b, current);
      if (from >= -1e-8 !== to >= -1e-8) {
        const fraction = from / (from - to);
        polygon.push([
          previous[0] + fraction * (current[0] - previous[0]),
          previous[1] + fraction * (current[1] - previous[1]),
        ]);
      }
      if (to >= -1e-8) polygon.push(current);
    }
  }
  return Math.abs(polygonArea(polygon));
}
function seatTriangles(id: string, normal: number, z: number) {
  const triangles: Point2[][] = [];
  units.get(id)!.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const position = node.geometry.getAttribute('position'),
      indices = node.geometry.index;
    for (let i = 0; i < (indices?.count ?? position.count); i += 3) {
      const vertices = [0, 1, 2].map((offset) =>
        new Vector3()
          .fromBufferAttribute(position, indices?.getX(i + offset) ?? i + offset)
          .applyMatrix4(node.matrixWorld),
      );
      if (vertices.some((point) => Math.abs(point.z - z) > 0.002)) continue;
      const points = vertices.map((point) => [point.x, point.y] as Point2);
      const signedArea = polygonArea(points);
      if (signedArea * normal > 1e-8) triangles.push(signedArea > 0 ? points : points.reverse());
    }
  });
  return triangles;
}

test('the axial seat has a real opposing bearing patch on the installed housing and cassette', () => {
  const contact = guidedSupportSeatContact(p);
  const cassette = seatTriangles(contact.first, 1, contact.planeCoordinate);
  const housing = seatTriangles(contact.second, -1, contact.planeCoordinate);
  assert.ok(
    cassette.length && housing.length,
    'both actual preview bodies contain opposing seat faces',
  );
  const area = cassette.reduce(
    (sum, first) =>
      sum + housing.reduce((subtotal, second) => subtotal + overlapArea(first, second), 0),
    0,
  );
  assert.ok(area >= contact.minArea, `actual matching seat area ${area} mm2 is substantial`);
  for (const [x, y] of [
    [supports.backX + 2, supports.keyY - 10],
    [supports.backX + 2, supports.keyY + 10],
    [supports.backX + 3, supports.keyY + 11],
  ]) {
    const origin = new Vector3(x, y, supports.seatZ - 1);
    const base = crossings(contact.first, origin, new Vector3(0, 0, 1), 2);
    const shell = crossings(contact.second, origin, new Vector3(0, 0, 1), 2);
    assert.equal(base.length, 1);
    assert.equal(shell.length, 1);
    near(base[0].z, shell[0].z, 'a seat closes on PETG bearing faces, without loading a board');
  }
});
