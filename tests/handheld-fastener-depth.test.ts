import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Mesh, Vector3 } from 'three';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import type { Shape } from '../src/core/assembly/boundary/shapes';
import part from '../src/parts/handheld-lora-controller/part';
import { configuredPieces, libraries } from '../src/parts/handheld-lora-controller/lib/model';
import { screwMountCutouts } from '../src/parts/handheld-lora-controller/lib/details';
import { batteryPostSupports } from '../src/parts/handheld-lora-controller/lib/battery-supports';
import { roundedFloorEnvelope } from '../src/parts/handheld-lora-controller/lib/grip';
import {
  batteryBridge,
  batteryMount,
  batteryScrews,
  floorRootZ,
  lidMount,
  lidScrews,
  shell,
} from '../src/parts/handheld-lora-controller/lib/layout';
import { C, caseOutline, subtract, union } from '../src/parts/handheld-lora-controller/lib/shapes';
import { reinforcement } from '../src/parts/handheld-lora-controller/lib/reinforcement';

before(async () => initializeManifoldGeometry());

function volume(shape: Shape): number {
  const model = manifoldBoundaryComponent(shape, 'Screw-tip clearance control', 0xffffff);
  try {
    let result = 0;
    model.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const position = item.geometry.getAttribute('position'),
        index = item.geometry.index;
      for (let i = 0; i < (index?.count ?? position.count); i += 3) {
        const [a, b, c] = [0, 1, 2].map((j) =>
          new Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j),
        );
        result += a.dot(b.clone().cross(c)) / 6;
      }
    });
    return result;
  } finally {
    disposeModel(model);
  }
}

const mounts = [
  { label: 'lid', mount: lidMount, sites: lidScrews, diameter: 6.2, top: lidMount.bossBottom },
  {
    label: 'battery',
    mount: batteryMount,
    sites: batteryScrews,
    diameter: 5.6,
    top: batteryBridge.z,
  },
];
const postStock = (label: string, diameter: number, top: number, x: number, y: number) =>
  label === 'battery'
    ? union(batteryPostSupports(), C(diameter, floorRootZ, 0, x, y))
    : C(diameter, top, 0, x, y);

test('Declared short and long screws fully traverse their captive nuts', () => {
  assert.deepEqual(lidMount.supportedScrewLengths, [6, 8, 10, 12]);
  assert.deepEqual(batteryMount.supportedScrewLengths, [6, 8, 10]);
  for (const { label, mount } of mounts) {
    for (const length of mount.supportedScrewLengths) {
      const tip = mount.screwSeat - length;
      assert.ok(tip <= mount.nutBottom, `${label} M2 × ${length} must traverse the entire nut`);
      assert.ok(
        mount.screwSeat >= mount.nutBottom + mount.nutHeight,
        `${label} head must bear above the nut`,
      );
      assert.ok(tip - mount.boreBottom >= 1.2 - 1e-9, `${label} M2 × ${length} tip bottoms out`);
    }
    const shorter = mount.supportedScrewLengths[0] - 2;
    assert.ok(
      mount.screwSeat - shorter > mount.nutBottom,
      `${label} must not claim full nut engagement for an insufficiently short screw`,
    );
  }
});

test('Actual mounting cutters clear every declared screw shaft at all six posts', () => {
  const cuts = screwMountCutouts();
  for (const { label, mount, sites, diameter, top } of mounts)
    for (const [x, y] of sites) {
      // Use the real reinforced battery towers, rather than the obsolete thin cylinders.
      const remaining = subtract(postStock(label, diameter, top, x, y), ...cuts);
      for (const length of mount.supportedScrewLengths) {
        const shaft = C(2, length, mount.screwSeat - length, x, y),
          overlap = volume(shaft) - volume(subtract(shaft, remaining));
        assert.ok(overlap < 1e-7, `${label} ${x},${y}: M2 × ${length} hits ${overlap} mm³ stock`);
      }
    }
});

test('All mounting wells preserve a solid three millimetre cap and a closed axial bottom', () => {
  const cuts = screwMountCutouts();
  for (const { label, mount, sites, diameter, top } of mounts)
    for (const [x, y] of sites) {
      assert.equal(mount.boreBottom, 3.2);
      assert.ok(mount.boreBottom >= shell.floor + 1.2);
      const remaining = subtract(postStock(label, diameter, top, x, y), ...cuts),
        cap = C(2, mount.boreBottom - 0.2, 0.1, x, y),
        missing = volume(cap) - volume({ kind: 'intersect', children: [cap, remaining] });
      assert.ok(missing < 1e-7, `${label} ${x},${y}: blind well breaks through its floor cap`);
    }
});

test('The deeper battery well removes the stock that blocked an M2 × 10 screw', () => {
  const tip = batteryMount.screwSeat - 10;
  assert.ok(tip < 5.5, 'The old 5.5 mm blind bottom obstructed the longer screw');
  assert.ok(batteryMount.boreBottom < tip);
  for (const [x, y] of batteryScrews) {
    const previouslyBlocked = C(2, 5.5 - tip, tip, x, y),
      remaining = subtract(batteryPostSupports(), ...screwMountCutouts());
    assert.ok(volume(previouslyBlocked) - volume(subtract(previouslyBlocked, remaining)) < 1e-7);
  }
});

test('The raised lid nut retains the original screw head bearings and default lengths', () => {
  assert.equal(lidMount.screwSeat, 27);
  assert.equal(lidMount.screwSeat + 2, shell.height, 'The 2 mm socket head remains flush');
  assert.equal(lidMount.screwLength, 8);
  assert.equal(lidMount.nutBottom, 21.2);
  assert.equal(batteryMount.screwSeat, batteryBridge.top);
  assert.equal(batteryMount.screwLength, 6);
  assert.equal(batteryMount.nutBottom, 9.6);
  for (const { label, mount } of mounts) {
    assert.ok(
      Math.abs(mount.nutBottom - mount.nutPocketBottom - (label === 'battery' ? 0.4 : 0.2)) < 1e-9,
    );
    assert.equal(mount.nutHeight, 1.6);
    assert.equal(mount.boreDiameter, 2.2);
  }
});

test('Actual nut corners clear every side-entry pocket throughout continuous insertion', () => {
  const pieces = configuredPieces({ ...part.defaults, ...part.presets[0].parameters }, 'assembled'),
    cuts = screwMountCutouts(),
    supports = [...reinforcement.lidPosts, ...reinforcement.batteryPosts];
  assert.deepEqual(
    supports.map((site) => site.nutLoadingDirection),
    [
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 0],
      [0, -1, 0],
      [-1, 0, 0],
      [1, 0, 0],
    ],
  );
  for (const [i, site] of supports.entries()) {
    const isLid = i < 4,
      id = `${isLid ? 'lid' : 'battery'}-nut-${isLid ? i : i - 4}`,
      piece = pieces.find((item) => item.component.id === id)!;
    assert.ok(piece, `${id}: canonical nut missing`);
    const model = componentGeometry(libraries, [piece], true),
      points: [number, number][] = [];
    let bottom = Infinity,
      top = -Infinity;
    try {
      model.updateMatrixWorld(true);
      model.traverse((item) => {
        if (!(item instanceof Mesh)) return;
        const positions = item.geometry.getAttribute('position');
        for (let index = 0; index < positions.count; index++) {
          const point = new Vector3()
            .fromBufferAttribute(positions, index)
            .applyMatrix4(item.matrixWorld);
          bottom = Math.min(bottom, point.z);
          top = Math.max(top, point.z);
          points.push(
            [point.x, point.y],
            [point.x - 6 * site.nutLoadingDirection[0], point.y - 6 * site.nutLoadingDirection[1]],
          );
        }
      });
    } finally {
      disposeModel(model);
    }
    // The convex hull of the actual metal at both endpoints encloses every
    // intermediate pose. Filling its thread bore makes this conservative.
    const unique = [...new Map(points.map((point) => [point.join(','), point])).values()].sort(
        (a, b) => a[0] - b[0] || a[1] - b[1],
      ),
      cross = (a: number[], b: number[], c: number[]) =>
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const chains = [unique, [...unique].reverse()].map((ordered) => {
      const hull: [number, number][] = [];
      for (const point of ordered) {
        while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0)
          hull.pop();
        hull.push(point);
      }
      return hull.slice(0, -1);
    });
    const sweep: Shape = {
        kind: 'prism',
        points: chains.flat(),
        origin: bottom,
        depth: top - bottom,
        axis: 'z',
      },
      post = isLid ? C(6.2, lidMount.bossBottom, 0, site.x, site.y) : batteryPostSupports(),
      remaining = subtract(post, ...cuts),
      obstruction = volume(sweep) - volume(subtract(sweep, remaining));
    assert.ok(obstruction < 1e-5, `${id}: its corners snag during insertion by ${obstruction} mm³`);
  }
});

test('All actual M2 and DS-225 retaining nut meshes stay inside the closed case core', () => {
  // The three authored exteriors preserve this core above their bottom rounds.
  // Test the purchased library meshes after their real assembly placements.
  const polygon = caseOutline();
  for (const preset of part.presets) {
    const p = { ...part.defaults, ...preset.parameters },
      pieces = configuredPieces(p, 'assembled').filter((piece) =>
        /^(lid-nut-|battery-nut-|button-)/.test(piece.component.id),
      ),
      model = componentGeometry(libraries, pieces, true);
    try {
      model.updateMatrixWorld(true);
      let nuts = 0;
      model.traverse((item) => {
        if (!(item instanceof Mesh) || !item.name.toLowerCase().includes('nut')) return;
        nuts++;
        const positions = item.geometry.getAttribute('position'),
          checked = new Set<string>();
        for (let i = 0; i < positions.count; i++) {
          const point = new Vector3()
              .fromBufferAttribute(positions, i)
              .applyMatrix4(item.matrixWorld),
            key = point.toArray().join(',');
          if (checked.has(key)) continue;
          checked.add(key);
          assert.ok(point.z > 5 && point.z < shell.seam, `${preset.id}: ${item.name} vertical fit`);
          let crossings = 0;
          for (let edge = 0; edge < polygon.length; edge++) {
            const a = polygon[edge],
              b = polygon[(edge + 1) % polygon.length];
            if (
              a[1] > point.y !== b[1] > point.y &&
              point.x < a[0] + ((point.y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
            )
              crossings++;
          }
          assert.equal(crossings % 2, 1, `${preset.id}: ${item.name} crosses the exterior wall`);
        }
      });
      assert.equal(nuts, 8, `${preset.id}: inspect six M2 nuts and both DS-225 retaining nuts`);
    } finally {
      disposeModel(model);
    }
  }
});

test('A complete three millimetre cap fits under every well inside each actual rounded floor', () => {
  const caps = union(
    ...mounts.flatMap(({ mount, sites }) =>
      sites.map(([x, y]) => C(mount.boreDiameter, 3, mount.boreBottom - 3, x, y)),
    ),
  );
  const expected = volume(caps);
  for (const bodyModel of ['original', 'contoured', 'web-grip']) {
    const retained = volume({
      kind: 'intersect',
      children: [caps, roundedFloorEnvelope({ bodyModel })],
    });
    assert.ok(
      Math.abs(expected - retained) < 1e-5,
      `${bodyModel}: the actual rounded underside removes ${expected - retained} mm³ of a well cap`,
    );
  }
});
