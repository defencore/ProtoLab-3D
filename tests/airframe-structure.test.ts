import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import { registerPartModules } from '../src/core/part-modules';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import wingModule from '../src/parts/wing-rib';
import formerModule from '../src/parts/fuselage-bulkhead';
import {
  section as ribSection,
  polygonGap as ribGap,
  boundaryDistance as ribDistance,
  ordinate,
} from '../src/parts/wing-rib/lib/model';
import {
  section as formerSection,
  polygonGap as formerGap,
  boundaryDistance as formerDistance,
} from '../src/parts/fuselage-bulkhead/lib/model';
import type { Parameters, PartDefinition } from '../src/core/types';

const wing = wingModule.part,
  former = formerModule.part;
function meshVolumeAndClosure(mesh: Mesh): number {
  const position = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index;
  const edges = new Map<string, { count: number; winding: number }>();
  let volume = 0;
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const points = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j),
    );
    assert.ok(points.every((v) => v.toArray().every(Number.isFinite)));
    assert.ok(
      points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).lengthSq() > 1e-15,
    );
    volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
    const keys = points.map((p) =>
      p
        .toArray()
        .map((v) => Math.round(v * 1e5))
        .join(','),
    );
    for (let j = 0; j < 3; j++) {
      const a = keys[j],
        b = keys[(j + 1) % 3],
        key = [a, b].sort().join('|'),
        edge = edges.get(key) ?? { count: 0, winding: 0 };
      edge.count++;
      edge.winding += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  assert.ok(volume > 0);
  for (const [key, edge] of edges)
    assert.deepEqual(edge, { count: 2, winding: 0 }, `Closed oriented edge ${key}`);
  return volume;
}
function area(points: [number, number][]): number {
  return (
    Math.abs(
      points.reduce((sum, a, i) => {
        const b = points[(i + 1) % points.length];
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0),
    ) / 2
  );
}
function expectedVolume(part: PartDefinition, p: Parameters): number {
  if (part.id === 'wing-rib') {
    const s = ribSection(p);
    return (
      (area(s.outline) -
        s.slots.reduce((a, h) => a + area(h), 0) -
        s.circles.reduce((a, c) => a + Math.PI * c.radius ** 2, 0)) *
      Number(p.thickness)
    );
  }
  const s = formerSection(p);
  return (
    (area(s.outline) -
      (s.opening ? area(s.opening) : 0) -
      s.circles.reduce((a, c) => a + Math.PI * c.radius ** 2, 0)) *
    Number(p.thickness)
  );
}
test('airframe sheet details register as independent manufactured API 2 packages', () => {
  const parts = registerPartModules([wingModule, formerModule]);
  assert.equal(parts.length, 2);
  for (const p of parts) {
    assert.equal(p.category, 'VEHICLE STRUCTURES');
    assert.equal(p.subgroup, 'AIRFRAME STRUCTURE');
    assert.equal(p.product.kind, 'detail');
    assert.equal(p.product.supply, 'manufactured');
    assert.ok(p.presets.length >= 4);
  }
});
for (const part of [wing, former])
  for (const preset of part.presets)
    test(`${part.id}/${preset.id}: one closed cut sheet with matching dimensions and volume`, () => {
      assert.deepEqual(validateParameters(part, preset.parameters, 'flat'), []);
      const geometry = part.buildGeometry(preset.parameters, 'flat');
      try {
        let count = 0,
          volume = 0;
        geometry.traverse((o) => {
          if (o instanceof Mesh) {
            count++;
            volume += meshVolumeAndClosure(o);
          }
        });
        assert.equal(count, 1);
        const bounds = new Box3().setFromObject(geometry, true).getSize(new Vector3()).toArray(),
          dimensions = part.dimensions(preset.parameters, 'flat');
        for (let i = 0; i < 3; i++)
          assert.ok(Math.abs(bounds[i] - dimensions[i]) < 0.002, `Dimension ${i}`);
        assert.ok(Math.abs(volume / expectedVolume(part, preset.parameters) - 1) < 0.0004);
        const native = part.python(preset.parameters, 'flat');
        assert.match(native, /Part.Face/);
        assert.match(native, /extrude/);
        assert.doesNotMatch(native, /makeCompound/);
      } finally {
        disposeModel(geometry);
      }
    });
test('rib spar slots include the total allowance once and retain a complete profile web', () => {
  for (const p of wing.presets.map((v) => v.parameters)) {
    const s = ribSection(p),
      web = Number(p.minimumWeb);
    assert.equal(s.slots.length, p.rearSpar ? 2 : 1);
    assert.ok(
      Math.abs(
        s.slots[0][1][0] - s.slots[0][0][0] - Number(p.mainWidth) - Number(p.slotClearance),
      ) < 1e-10,
    );
    assert.ok(
      Math.abs(
        s.slots[0][2][1] - s.slots[0][1][1] - Number(p.mainHeight) - Number(p.slotClearance),
      ) < 1e-10,
    );
    for (const slot of s.slots) assert.ok(ribGap(slot, s.outline) >= web);
    for (const c of s.circles) {
      assert.ok(c.radius >= 1);
      assert.ok(ribDistance(c.center, s.outline) - c.radius >= web);
      for (const slot of s.slots) assert.ok(ribDistance(c.center, slot) - c.radius >= web);
    }
  }
  assert.equal(ordinate('naca0012', 0, true)[1], 0);
  assert.ok(Math.abs(ordinate('naca0012', 0.3, true)[1] - 0.0600172664) < 1e-8);
  assert.ok(
    Math.abs(
      (ordinate('naca2412', 0.4, true)[1] + ordinate('naca2412', 0.4, false)[1]) / 2 - 0.02,
    ) < 1e-12,
  );
});
test('former seats preserve the stated web to the service opening and all mounting circles', () => {
  for (const p of former.presets.map((v) => v.parameters)) {
    const s = formerSection(p),
      web = Number(p.minimumWeb);
    if (s.opening) assert.ok(formerGap(s.outline, s.opening) >= web);
    for (const c of s.circles) {
      assert.ok(formerDistance(c.center, s.outline) - c.radius >= web);
      if (s.opening) assert.ok(formerDistance(c.center, s.opening) - c.radius >= web);
    }
    if (p.notches) {
      const depth = Number(p.notchDepth),
        rx = Number(p.width) / 2;
      assert.ok(
        s.outline.some(
          (v) =>
            Math.abs(v[0] - (rx - depth)) < 1e-8 &&
            Math.abs(v[1] - Number(p.notchWidth) / 2) < 1e-8,
        ),
      );
    }
  }
  const updated = former.updateParameters!({ ...former.defaults, width: 160 }, 'width');
  assert.equal(updated.height, 160);
});
test('invalid airframe dimensions cannot remove the spar, perimeter or mounting webs', () => {
  for (const part of [wing, former]) {
    assert.ok(validateParameters(part, part.defaults, 'unknown').length);
    assert.ok(part.validate({ ...part.defaults, thickness: NaN }, 'flat').length);
    assert.ok(part.validate({ ...part.defaults, minimumWeb: -1 }, 'flat').length);
  }
  const invalidRibs: Parameters[] = [
    { mainHeight: 50 },
    { mainWidth: 100 },
    { rearHeight: 25 },
    { rearPosition: 10 },
    { lighteningDiameter: 0 },
    { minimumWeb: 12 },
    { tailTrim: 1 },
  ];
  for (const change of invalidRibs)
    assert.ok(
      wing.validate({ ...wing.defaults, ...change }, 'flat').length,
      JSON.stringify(change),
    );
  const invalidFormers: Parameters[] = [
    { openingWidth: 99 },
    { openingHeight: 99 },
    { notchDepth: 22 },
    { notchWidth: 49 },
    { mountingInset: 49 },
    { holeDiameter: 12 },
    { height: 120 },
  ];
  for (const change of invalidFormers)
    assert.ok(
      former.validate({ ...former.defaults, ...change }, 'flat').length,
      JSON.stringify(change),
    );
});
test('small and large sheet designs retain finite closed outlines without tiny cutout remnants', () => {
  const ribCases = [
    {
      ...wing.defaults,
      profile: 'naca0012',
      chord: 80,
      mainWidth: 2,
      mainHeight: 2,
      rearSpar: false,
      lightening: false,
      minimumWeb: 1,
      tailTrim: 8,
    },
    {
      ...wing.defaults,
      profile: 'naca0018',
      chord: 800,
      thickness: 12,
      mainWidth: 40,
      mainHeight: 80,
      rearWidth: 30,
      rearHeight: 40,
      minimumWeb: 20,
      tailTrim: 20,
      lighteningDiameter: 100,
    },
  ];
  const formerCases = [
    {
      ...former.defaults,
      width: 30,
      height: 30,
      thickness: 1,
      openingWidth: 8,
      openingHeight: 8,
      notches: false,
      mountingHoles: false,
      minimumWeb: 1,
    },
    {
      ...former.defaults,
      form: 'ellipse',
      width: 600,
      height: 400,
      thickness: 12,
      openingWidth: 480,
      openingHeight: 260,
      notchWidth: 40,
      notchDepth: 25,
      mountingHoles: false,
      minimumWeb: 25,
    },
  ];
  for (const [part, cases] of [
    [wing, ribCases],
    [former, formerCases],
  ] as const)
    for (const p of cases) {
      assert.deepEqual(validateParameters(part, p, 'flat'), []);
      const g = part.buildGeometry(p, 'flat');
      try {
        g.traverse((o) => {
          if (o instanceof Mesh) meshVolumeAndClosure(o);
        });
      } finally {
        disposeModel(g);
      }
    }
});
test('fabrication DXF retains closed millimetre contours and analytic circular cuts', () => {
  for (const part of [wing, former]) {
    const file = part.fabricationFiles!(part.defaults)[0];
    assert.equal(file.type, 'application/dxf');
    assert.match(file.content, /\$INSUNITS\n70\n4/);
    assert.match(file.content, /LWPOLYLINE/);
    assert.match(file.content, /CIRCLE/);
    assert.match(file.content, /100\nAcDbPolyline\n90\n/);
    assert.match(file.content, /100\nAcDbCircle\n10\n/);
    assert.match(file.content, /\n70\n1\n/);
    assert.ok(file.content.endsWith('0\nEOF\n'));
    const values = file.content.trim().split('\n');
    const groups = Array.from({ length: values.length / 2 }, (_, i) => [
      values[2 * i],
      values[2 * i + 1],
    ]);
    const starts = groups.flatMap((g, i) =>
      g[0] === '0' && ['LWPOLYLINE', 'CIRCLE'].includes(g[1]) ? [i] : [],
    );
    const entities = starts.map((i) => {
      let end = i + 1;
      while (end < groups.length && groups[end][0] !== '0') end++;
      return groups.slice(i, end);
    });
    const paths = entities.filter((e) => e[0][1] === 'LWPOLYLINE');
    const circles = entities.filter((e) => e[0][1] === 'CIRCLE');
    const expected =
      part.id === 'wing-rib' ? ribSection(part.defaults) : formerSection(part.defaults);
    const expectedPaths =
      'slots' in expected
        ? [expected.outline, ...expected.slots]
        : [expected.outline, ...(expected.opening ? [expected.opening] : [])];
    assert.equal(paths.length, expectedPaths.length);
    assert.equal(circles.length, expected.circles.length);
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i],
        x = path.filter((g) => g[0] === '10').map((g) => Number(g[1])),
        y = path.filter((g) => g[0] === '20').map((g) => Number(g[1]));
      assert.equal(Number(path.find((g) => g[0] === '70')![1]), 1);
      assert.equal(Number(path.find((g) => g[0] === '90')![1]), expectedPaths[i].length);
      assert.deepEqual(
        x.map((value, j) => [value, y[j]]),
        expectedPaths[i],
      );
    }
    for (let i = 0; i < circles.length; i++)
      assert.equal(Number(circles[i].find((g) => g[0] === '40')![1]), expected.circles[i].radius);
  }
});
