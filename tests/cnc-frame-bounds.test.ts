import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import frame from '../src/parts/cnc-frame-part/part';
import { frameBounds, frameDimensions, frameShape } from '../src/parts/cnc-frame-part/lib/model';
import { frameRoles } from '../src/parts/cnc-frame-part/configurator';
import mount from '../src/parts/cnc-spindle-mount/part';
import machine, { millingComponents } from '../src/parts/cnc-milling-machine/part';
import detail from '../src/parts/manufactured-detail/part';
import { withGeometryMode } from '../src/core/geometry-mode';
import type { Parameters } from '../src/core/types';

const boss: Parameters = {
  ...frame.defaults,
  role: 'z-moving-box',
  sizeX: 160,
  sizeY: 30,
  sizeZ: 100,
  ribCenterX: 60,
  ribThickness: 10,
  ribDepth: 20,
  internalFillet: 0,
  bossCenterX: 0,
  bossCenterY: -30,
  bossCenterZ: 0,
  bossWidth: 20,
  bossDepth: 40,
  bossThickness: 20,
  holes: '[]',
};
const canonicalDimensions = (p: Parameters) =>
  withGeometryMode('simple', () =>
    detail.dimensions(
      {
        ...detail.defaults,
        recipe: JSON.stringify(frameShape(p)),
        meshEdgeTolerance: 1e-6,
        meshMinimumTriangleArea: 1e-10,
        meshConform: true,
        nativeRefine: false,
      },
      'default',
    ),
  );

test('every frame role retains certified real stock extrema, including sleeves and integral additions', () => {
  for (const role of frameRoles) {
    const p = {
      ...frame.defaults,
      role,
      sizeX: 260,
      sizeY: 30,
      sizeZ: 320,
      holes: '[]',
      ...(role === 'rail-pad' ? { shoulderHeight: 4 } : {}),
      ...(role === 'gantry-drive-link'
        ? { ribDepth: 10, rearWebHeight: 50, internalFillet: 3 }
        : {}),
      ...(role === 'encoder-offset-angle'
        ? { sizeY: 50, shoulderWidth: 16, rearWebHeight: 14.5 }
        : {}),
    };
    assert.deepEqual(frame.validate(p, 'default'), [], role);
    const expected =
      role === 'crush-sleeve'
        ? [18, 18, 320]
        : role === 'z-fixed-box'
          ? [260, 110, 320]
          : role === 'z-moving-box'
            ? [360, 110, 320]
            : role === 'rail-pad'
              ? [260, 30, 324]
              : role === 'encoder-offset-angle'
                ? [260, 50, 320]
                : [260, 30, 320];
    assert.deepEqual(frameDimensions(p), expected, role);
  }
});

test('asymmetric integral platforms include negative X/Y stock and rear ribs in local bounds', () => {
  assert.deepEqual(frameBounds(boss), { min: [-80, -50, -50], max: [80, 35, 50] });
  const p = { ...boss, bossCenterX: -90, bossWidth: 40 };
  assert.deepEqual(frame.validate(p, 'default'), []);
  assert.deepEqual(frameBounds(p), { min: [-110, -50, -50], max: [80, 35, 50] });
  assert.deepEqual(frameDimensions(p), [190, 85, 100]);
});

test('the actual rounded hollow front datum is shortened by its authored planar trim', () => {
  const p = {
    ...frame.defaults,
    role: 'gantry-beam',
    sizeX: 100,
    sizeY: 200,
    sizeZ: 120,
    tubeAxis: 'x',
    wall: 10,
    cornerRadius: 25,
    frontDatumTrim: 5,
    holes: '[]',
  };
  assert.deepEqual(frame.validate(p, 'default'), []);
  assert.deepEqual(frameBounds(p), { min: [-50, -100, -60], max: [50, 95, 60] });
  assert.deepEqual(frameDimensions(p), [100, 195, 120]);
});

test('a legal axial cut that removes an entire protrusion never reports the oversized billet', () => {
  const p = {
    ...boss,
    holes: JSON.stringify([{ axis: 'y', at: [0, -50, 0], diameter: 30, depth: 40 }]),
  };
  assert.deepEqual(frame.validate(p, 'default'), []);
  assert.equal(frameDimensions(p), undefined);
  const actual = canonicalDimensions(p);
  assert.ok(actual.every((n, i) => Math.abs(n - [160, 50, 100][i]) < 1e-6));
  assert.deepEqual(frame.dimensions(p, 'default'), actual);
});

test('Full-thread inspection allowance is part of the conservative cutter witness contract', () => {
  const holes = JSON.stringify([
    {
      axis: 'y',
      at: [0, -50, 0],
      diameter: 28.2,
      depth: 40,
      threadPitch: 1,
      threadDesignation: 'Authored 28.2 mm thread',
    },
  ]);
  const nominal = { ...boss, holes, threadFitAllowance: 0 };
  assert.deepEqual(frame.validate(nominal, 'default'), []);
  assert.deepEqual(frameDimensions(nominal), [160, 85, 100]);
  const relieved = { ...nominal, threadFitAllowance: 0.1 };
  assert.deepEqual(frame.validate(relieved, 'default'), []);
  for (const mode of ['simple', 'full'] as const)
    assert.equal(
      withGeometryMode(mode, () => frameDimensions(relieved)),
      undefined,
    );
});

test('every current manufactured frame execution is certified without constructing preview geometry', () => {
  const seen = new Set<string>();
  for (const piece of millingComponents(machine.defaults)) {
    if (piece.component.libraryId !== frame.id) continue;
    const p = piece.component.parameters,
      key = JSON.stringify(p);
    if (seen.has(key)) continue;
    seen.add(key);
    const dims = frameDimensions(p);
    assert.ok(dims, piece.component.id);
    assert.ok(
      dims.every((n) => Number.isFinite(n) && n > 0),
      piece.component.id,
    );
  }
  assert.ok(seen.size >= 60, 'The real authored execution matrix must be covered.');
});

const proofRoot = 'test-results/cnc-milling/reinforced-structure';
test(
  'cached baseline configurations retain exact native optimal bounds and unchanged raw geometry sources',
  { skip: !existsSync(proofRoot + '/frame-volume-native.json') },
  () => {
    const native = JSON.parse(readFileSync(proofRoot + '/frame-volume-native.json', 'utf8')),
      manifest = JSON.parse(readFileSync(proofRoot + '/frame-volume-manifest.json', 'utf8'));
    assert.equal(native.passed, true);
    assert.equal(
      native.manifestSha256,
      createHash('sha256')
        .update(readFileSync(proofRoot + '/frame-volume-manifest.json'))
        .digest('hex'),
    );
    const measurements = new Map<string, { boundsMm: number[] }>(
      native.sourceCases.map((r: any) => [r.sourceHash, r]),
    );
    const seen = new Set<string>();
    let frameCount = 0,
      mountCount = 0;
    for (const occurrence of manifest.occurrences) {
      if (seen.has(occurrence.sourceHash)) continue;
      seen.add(occurrence.sourceHash);
      const part = occurrence.libraryId === frame.id ? frame : mount,
        parameters = { ...part.defaults, ...occurrence.parameters },
        source = withGeometryMode('simple', () => part.python(parameters, occurrence.state));
      assert.equal(
        createHash('sha256').update(source).digest('hex'),
        occurrence.sourceHash,
        occurrence.id,
      );
      const actual = measurements.get(occurrence.sourceHash)!.boundsMm;
      if (part === frame) {
        frameCount++;
        const dimensions = frameDimensions(parameters)!;
        assert.ok(dimensions, occurrence.id);
        dimensions.forEach((n, i) =>
          assert.ok(Math.abs(n - actual[i]) < 1e-6, occurrence.id + ' axis' + i),
        );
      } else mountCount++;
    }
    assert.equal(seen.size, native.sourceCases.length);
    assert.ok(frameCount >= 60);
    assert.ok(mountCount > 0);
  },
);
