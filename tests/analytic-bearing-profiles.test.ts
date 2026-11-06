import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticProfileSegments, type MeridianPoint } from '../src/core/hardware/analytic-profile';

test('a densely sampled circular turning meridian becomes two exact semicircles', () => {
  const circle: MeridianPoint[] = Array.from({ length: 25 }, (_, i) => {
    const angle = (i * Math.PI) / 12;
    return [8 + 2 * Math.cos(angle), 3 + 2 * Math.sin(angle)];
  });
  const segments = analyticProfileSegments(circle);
  assert.equal(segments.length, 2);
  for (const segment of segments) {
    assert.equal(segment.kind, 'arc');
    if (segment.kind !== 'arc') continue;
    for (const [r, z] of [segment.from, segment.through, segment.to])
      assert.ok(Math.abs(Math.hypot(r - 8, z - 3) - 2) < 1e-12);
    assert.ok(
      Math.abs(Math.hypot(segment.from[0] - segment.to[0], segment.from[1] - segment.to[1]) - 4) <
        1e-12,
    );
  }
  assert.deepEqual(segments[0].from, segments.at(-1)!.to);
});

test('turning meridians retain real corners, reversals and noncircular curves', () => {
  const polygon: MeridianPoint[] = Array.from({ length: 6 }, (_, i) => [
    5 + Math.cos((i * Math.PI) / 3),
    Math.sin((i * Math.PI) / 3),
  ]);
  assert.ok(analyticProfileSegments(polygon).every((segment) => segment.kind === 'line'));
  const polynomial: MeridianPoint[] = [
    [0, -2],
    ...Array.from({ length: 25 }, (_, i): MeridianPoint => {
      const z = i / 6 - 2;
      return [3 - 0.2 * z ** 2 + 0.03 * z ** 3, z];
    }),
    [0, 2],
  ];
  assert.ok(analyticProfileSegments(polynomial).every((segment) => segment.kind === 'line'));
  const stepped: MeridianPoint[] = [
    [2, -3],
    [2, -2],
    [2, -1],
    [2, 0],
    [2, -0.5],
    [4, -0.5],
    [4, 3],
    [1, 3],
    [1, -3],
    [2, -3],
  ];
  const segments = analyticProfileSegments(stepped);
  assert.ok(segments.some((segment) => segment.to[0] === 2 && segment.to[1] === 0));
  assert.ok(
    segments.some(
      (segment) => segment.from[0] === 2 && segment.from[1] === 0 && segment.to[1] === -0.5,
    ),
  );
});

test('sampled spherical seats retain their endpoints and true circle instead of a chain of cones', () => {
  const radius = 10;
  const seat: MeridianPoint[] = [
    [2, -3],
    ...Array.from({ length: 33 }, (_, i): MeridianPoint => {
      const z = (i / 32) * 6 - 3;
      return [Math.sqrt(radius ** 2 - z ** 2), z];
    }),
    [2, 3],
    [2, -3],
  ];
  const segments = analyticProfileSegments(seat);
  const arcs = segments.filter((segment) => segment.kind === 'arc');
  assert.equal(arcs.length, 1);
  assert.equal(segments.length, 4);
  const arc = arcs[0];
  if (arc.kind !== 'arc') return;
  assert.deepEqual(arc.from, seat[1]);
  assert.deepEqual(arc.to, seat[33]);
  for (const point of [arc.from, arc.through, arc.to])
    assert.ok(Math.abs(Math.hypot(...point) - radius) < 1e-12);
});
