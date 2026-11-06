import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Euler, Vector3 } from 'three';
import single from '../src/parts/tr8-compact-actuator/part';
import { mechanismPieces, libraries } from '../src/parts/tr8-quad-actuator/lib/mechanism';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { disposeModel } from '../src/core/mechanical';
import { withGeometryMode } from '../src/core/geometry-mode';
import { validateParameters } from '../src/core/validation';

function occurrenceBounds(id: string, angle = 0) {
  return withGeometryMode('simple', () => {
    const piece = mechanismPieces(single.defaults, angle).find((item) => item.component.id === id);
    assert.ok(piece, id);
    const model = componentGeometry(libraries, [piece]);
    try {
      const box = new Box3().setFromObject(model, true);
      return {
        low: box.min.toArray(),
        high: box.max.toArray(),
        size: box.getSize(new Vector3()).toArray(),
      };
    } finally {
      disposeModel(model);
    }
  });
}
const close = (a: number, b: number, tolerance = 1e-4) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('quad channel rotates the purchased H flange and keeps structural frame occurrences separate', () => {
  const pieces = mechanismPieces(single.defaults, 0);
  assert.equal(pieces.length, 32);
  assert.ok(
    pieces.every(
      (piece) =>
        ![
          'motor-disc',
          'fixed-disc',
          'end-disc',
          'output-front-cheek',
          'output-rear-cheek',
        ].includes(piece.component.id),
    ),
  );
  assert.ok(pieces.every((piece) => !piece.component.id.startsWith('column-')));
  for (const piece of pieces) {
    const definition = libraries.find((library) => library.id === piece.component.libraryId)!;
    assert.deepEqual(
      validateParameters(definition, piece.component.parameters, piece.component.state),
      [],
    );
  }
  const nut = pieces.find((piece) => piece.component.id === 'lead-nut')!.component;
  assert.equal(nut.supply, 'purchased');
  assert.equal(nut.manufacturing, undefined);
  const bounds = occurrenceBounds('lead-nut');
  close(bounds.size[0], 15);
  close(bounds.size[1], 11);
  close(bounds.size[2], 22);
  close(bounds.low[2], 3.5);
});

test('centred pin carrier retains full nut engagement and clears the output shaft throughout travel', () => {
  for (let angle = -20; angle <= 20; angle += 0.25) {
    const travel = 14.5 * Math.tan((angle * Math.PI) / 180);
    assert.ok(-7.5 + travel - -14 > 1.22);
    assert.ok(14 - (7.5 + travel) > 1.22);
    const collarBottom = 14.5 - 11,
      shaftTop = 3;
    close(collarBottom - shaftTop, 0.5);
    assert.ok(16 - (7.5 + travel) > 3.22);
    const pin = new Vector3(travel, 0, 14.5).applyAxisAngle(
      new Vector3(0, 1, 0),
      (-angle * Math.PI) / 180,
    );
    close(pin.x, 0, 1e-8);
    close(pin.z, 14.5 / Math.cos((angle * Math.PI) / 180), 1e-8);
  }
  for (const angle of [-20, 0, 20]) {
    const shaft = occurrenceBounds('output-shaft', angle);
    const cover = occurrenceBounds('nut-yoke', angle);
    // This covers the real forward carrier, not merely the purchased nut envelope.
    // The integral head is farther inward along Y; only the Ø6 body crosses the carrier.
    assert.ok(cover.low[2] - 3 > 0.49);
    close((shaft.low[0] + shaft.high[0]) / 2, 0);
  }
});

test('pressed transverse pins centre in both flat forks and replace the clamp hardware', () => {
  const pieces = mechanismPieces(single.defaults, 0);
  const outputs = pieces.filter((p) => p.component.id.startsWith('output-bearing-'));
  assert.deepEqual(
    outputs.map((p) => p.component.placement.translation),
    [
      [0, -13, 0],
      [0, 13, 0],
    ],
  );
  const clips = pieces.filter((p) => p.component.id.startsWith('output-circlip-'));
  assert.equal(clips.length, 2);
  assert.deepEqual(
    clips.map((p) => p.component.placement.translation[1]),
    [-16.7, 16.7],
  );
  assert.ok(
    !pieces.some((p) => p.component.id.includes('clamp') || p.component.id === 'output-end-cap'),
  );
  for (const angle of [-20, 0, 20]) {
    const pins = mechanismPieces(single.defaults, angle).filter(
      (p) => p.component.libraryId === 'dowel-pin',
    );
    assert.equal(pins.length, 2);
    for (const { component: c } of pins) {
      assert.equal(c.supply, 'purchased');
      assert.equal(c.parameters.diameter, 2);
      assert.equal(c.parameters.length, 10);
      const centre = new Vector3(0, 0, 5)
        .applyEuler(
          new Euler(
            ...(c.placement.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
            'ZYX',
          ),
        )
        .add(new Vector3(...c.placement.translation));
      close(centre.x, 0);
      close(Math.abs(centre.y), 8.55);
      close(centre.z, 0);
    }
  }
  const fork = occurrenceBounds('output-front-crank');
  close(fork.size[1], 3);
  close(fork.low[2], -5);
  const end = pieces.find((p) => p.component.id === 'screw-bearing-1')!.component;
  assert.deepEqual(end.placement.translation, [18, 0, 14.5]);
  const screwClips = pieces.filter((p) => p.component.id.startsWith('screw-circlip-'));
  assert.deepEqual(
    screwClips.map((p) => p.component.placement.translation[0]),
    [-20.8, -15.2, 15.2, 20.8],
  );
  const screw = occurrenceBounds('lead-screw');
  close(screw.low[0], -30);
  close(screw.high[0], 22);
  close(screw.size[0], 52, 3e-4);
});
