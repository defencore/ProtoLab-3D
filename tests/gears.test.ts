import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import spur from "../src/parts/spur-gear/part";
import helical from "../src/parts/helical-gear/part";
import bevel from "../src/parts/bevel-gear/part";
import rack, { rackProfile } from "../src/parts/gear-rack/part";
import { gearValues, helicalLayers, involuteProfile } from "../src/parts/spur-gear/lib/core/gears";
import { validateParameters } from '../src/core/validation';

function dispose(group: THREE.Group) {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.dispose();
  });
}

for (const part of [spur, helical, bevel, rack]) {
  test(`${part.id}: every preset produces a closed outward shell with the declared dimensions`, () => {
    const configurations = [part.defaults, ...part.presets.map((preset) => preset.parameters)];
    if (part !== rack) configurations.push({ ...part.defaults, bore: 0 });
    if (part === helical)
      configurations.push({ ...part.defaults, hub: true, style: 'herringbone', hand: 'left' });
    for (const p of configurations) {
      assert.deepEqual(validateParameters(part, p, 'default'), []);
      const model = part.buildGeometry(p, 'default');
      try {
        const bounds = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).toArray();
        part
          .dimensions(p, 'default')
          .forEach((length, axis) => assert.ok(Math.abs(bounds[axis] - length) < 0.001));
        assert.equal(model.children.length, 1);
        const geometry = (model.children[0] as THREE.Mesh).geometry;
        const position = geometry.getAttribute('position');
        const index = geometry.getIndex();
        const edges = new Map<string, number>();
        let volume = 0;
        const count = index?.count ?? position.count;
        for (let i = 0; i < count; i += 3) {
          const vertices = [i, i + 1, i + 2].map((j) =>
            new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(j) : j),
          );
          assert.ok(vertices.every((point) => point.toArray().every(Number.isFinite)));
          const area = vertices[1]
            .clone()
            .sub(vertices[0])
            .cross(vertices[2].clone().sub(vertices[0]))
            .length();
          assert.ok(area > 1e-9, `${part.id}: no zero-area triangles`);
          volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
          const keys = vertices.map((point) =>
            point
              .toArray()
              .map((value) => Math.round(value * 10000))
              .join(','),
          );
          for (let side = 0; side < 3; side++) {
            const key = [keys[side], keys[(side + 1) % 3]].sort().join('|');
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0, 'Outward winding gives positive volume.');
        for (const [edge, uses] of edges) assert.equal(uses, 2, `${part.id}: closed edge ${edge}`);
      } finally {
        dispose(model);
      }
    }
  });
}

test('involute tooth flank samples satisfy the base-circle involute equation', () => {
  const v = gearValues(spur.defaults);
  const profile = involuteProfile(v);
  const flank = profile.segments.find((segment) => segment.kind === 'spline')!;
  for (const [x, y] of flank.points) {
    const t = Math.sqrt(Math.max(0, (Math.hypot(x, y) / v.baseRadius) ** 2 - 1));
    const expectedAngle = -(v.halfThickness + Math.tan(v.angle) - v.angle - (t - Math.atan(t)));
    assert.ok(Math.abs(Math.atan2(y, x) - expectedAngle) < 1e-10);
  }
  const nominalThickness = 2 * v.pitchRadius * v.halfThickness;
  assert.ok(
    Math.abs(nominalThickness - ((Math.PI * v.module) / 2 - Number(spur.defaults.backlash) / 2)) <
      1e-10,
  );
  assert.equal(
    profile.segments.filter((segment) => segment.kind === 'spline').length,
    2 * Number(spur.defaults.teeth),
  );
});

test('helical normal-module conversion, hand and herringbone continuity use the pitch cylinder', () => {
  const v = gearValues(helical.defaults, true);
  assert.ok(
    Math.abs(
      v.pitchRadius * 2 -
        (Number(helical.defaults.module) * Number(helical.defaults.teeth)) / Math.cos(v.beta),
    ) < 1e-10,
  );
  const right = helicalLayers(helical.defaults, v);
  const left = helicalLayers({ ...helical.defaults, hand: 'left' }, v);
  assert.ok(
    Math.abs(right.at(-1)!.angle - right[0].angle - (v.width * Math.tan(v.beta)) / v.pitchRadius) <
      1e-10,
  );
  right.forEach((layer, i) => assert.equal(layer.angle, -left[i].angle));
  const double = helicalLayers({ ...helical.defaults, style: 'herringbone' }, v);
  assert.equal(double[0].angle, double.at(-1)!.angle);
  assert.equal(double[(double.length - 1) / 2].z, 0);
  double.forEach((layer, i) =>
    assert.ok(Math.abs(layer.angle - double[double.length - i - 1].angle) < 1e-10),
  );
});

test('rack flank slope and pitch match a spur gear of equal module and pressure angle', () => {
  const p = rack.defaults;
  const profile = rackProfile(p);
  const root = profile[3];
  const tip = profile[4];
  assert.ok(
    Math.abs(
      (root.x - tip.x) / (tip.y - root.y) - Math.tan((Number(p.pressureAngle) * Math.PI) / 180),
    ) < 1e-10,
  );
  assert.ok(Math.abs(profile[3].x - profile[7].x - Math.PI * Number(p.module)) < 1e-10);
});

test('gear validation rejects noninteger teeth, undercut, bore breakout, narrow teeth and excessive taper / twist', () => {
  const invalid = [
    [spur, { teeth: 24.2 }],
    [spur, { teeth: 12 }],
    [spur, { bore: 35 }],
    [spur, { hubDiameter: 3 }],
    [spur, { hubLength: 5 }],
    [spur, { module: 0.2, backlash: 1 }],
    [helical, { faceWidth: 80, helixAngle: 40 }],
    [bevel, { faceWidth: 40 }],
    [rack, { teeth: 20.2 }],
    [rack, { module: 0.2, backlash: 1 }],
  ] as const;
  for (const [part, changes] of invalid)
    assert.ok(
      validateParameters(part, { ...part.defaults, ...changes }, 'default').length > 0,
      `${part.id} ${JSON.stringify(changes)}`,
    );
});
