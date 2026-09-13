import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Vector3 } from 'three';
import part, { doubleAngularRaceProfiles } from "../src/parts/double-row-angular-contact-bearing/part";
import { withSupplierPresets } from '../src/catalog/supplier-presets';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

// Exact supplier envelope boundaries include the thin 3000 series and the large 3317.
const sizes = [
  [10, 30, 14],
  [17, 35, 14],
  [20, 42, 16],
  [30, 55, 19],
  [85, 180, 73],
];
const closures = ['open', 'rubber', 'metal', 'rubber-one', 'metal-one'];

test('double angular source boundaries and imported presets validate in every state', () => {
  const sourceCases: Parameters[] = sizes.flatMap(([bore, outer, width]) =>
    [10, 25, 30, 32, 45].map((contactAngle) => ({
      ...part.defaults,
      bore,
      outer,
      width,
      contactAngle,
    })),
  );
  for (const p of [...sourceCases, ...withSupplierPresets(part).presets.map((x) => x.parameters)])
    for (const state of part.states!) assert.deepEqual(validateParameters(part, p, state.id), []);
  const invalid: Parameters[] = [
    { elements: 64 },
    { elements: 9.5 },
    { width: 1 },
    { width: 250 },
    { outer: 20.1 },
  ];
  for (const patch of invalid)
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length > 0);
});

test('opposing race shoulders and grooves differ from symmetric radial races', () => {
  const profile = doubleAngularRaceProfiles(part.defaults)[0].slice(1, -2);
  const row = Number(part.defaults.width) * 0.23,
    near = (z: number) =>
      profile.reduce((a, b) => (Math.abs(a[1] - z) < Math.abs(b[1] - z) ? a : b));
  assert.ok(near(row + 2.5)[0] > near(row - 2.5)[0]);
  for (let i = 0; i < profile.length; i++)
    assert.ok(Math.abs(profile[i][0] - profile[profile.length - 1 - i][0]) < 1e-9);
  assert.notDeepEqual(
    doubleAngularRaceProfiles({ ...part.defaults, contactAngle: 10 }),
    doubleAngularRaceProfiles({ ...part.defaults, contactAngle: 45 }),
  );
});

test('both ball rows, closure sides, through-bore and manifold component shells are preserved', () => {
  for (let s = 0; s < sizes.length; s++)
    for (const state of part.states!) {
      const [bore, outer, width] = sizes[s],
        p: Parameters = { ...part.defaults, bore, outer, width, closure: closures[s] },
        model = part.buildGeometry(p, state.id),
        label = `${bore}/${outer}/${width}/${state.id}`;
      assert.equal(
        model.children.filter((x) => x.name === 'Lower angular ball').length,
        p.elements,
      );
      assert.equal(
        model.children.filter((x) => x.name === 'Upper angular ball').length,
        p.elements,
      );
      assert.equal(model.children.filter((x) => x.name === 'Angular ball cage').length, 2);
      const expectedClosures =
        state.id === 'internals' || p.closure === 'open'
          ? 0
          : String(p.closure).endsWith('-one')
            ? 1
            : 2;
      assert.equal(
        model.children.filter((x) => /^(Rubber seal|Metal shield)$/.test(x.name)).length,
        expectedClosures,
      );
      if (state.id === 'assembled') {
        const size = new Box3().setFromObject(model, true).getSize(new Vector3());
        [outer, outer, width].forEach((value, axis) =>
          assert.ok(Math.abs(size.getComponent(axis) - value) < 1e-5, label),
        );
      }
      model.updateMatrixWorld(true);
      for (const child of model.children) {
        const mesh = child as Mesh,
          positions = mesh.geometry.getAttribute('position'),
          index = mesh.geometry.getIndex(),
          edges = new Map<string, number>();
        let volume = 0;
        for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
          const [a, b, c] = [0, 1, 2].map((j) =>
            new Vector3().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j),
          );
          assert.ok(
            b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-18,
            `${label}/${child.name}: nondegenerate triangles`,
          );
          volume += a.dot(b.clone().cross(c)) / 6;
          for (const point of [a, b, c]) {
            const world = point.clone().applyMatrix4(mesh.matrixWorld);
            assert.ok(Math.hypot(world.x, world.y) > bore / 2 - 1e-5, `${label}: through bore`);
          }
          const ids = [a, b, c].map((v) =>
            v
              .toArray()
              .map((x) => Math.round(x * 1e5))
              .join(','),
          );
          for (let j = 0; j < 3; j++) {
            const edge = [ids[j], ids[(j + 1) % 3]].sort().join('|');
            edges.set(edge, (edges.get(edge) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0, `${label}/${child.name}: outward shell`);
        for (const count of edges.values())
          assert.equal(count, 2, `${label}/${child.name}: closed shell`);
      }
      disposeModel(model);
    }
});
