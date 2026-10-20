import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Box3,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
  type Object3D,
} from 'three';
import part from '../src/parts/electrical-connector/part';
import models from '../src/parts/electrical-connector/lib/models.json';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

const expected = [
  {
    id: 'xt60e-f',
    width: 34,
    height: 15.8,
    length: 20.2,
    flange: 4.1,
    pitch: 25,
    bore: 3.1,
    sex: 'F',
    count: 4,
  },
  {
    id: 'xt60e-m',
    width: 27.1,
    height: 12.1,
    length: 16.7,
    flange: 4,
    pitch: 20.5,
    bore: 2.5,
    sex: 'M',
    count: 3,
  },
  {
    id: 'xt90e-m',
    width: 42,
    height: 15.1,
    length: 22.8,
    flange: 3,
    pitch: 32.4,
    bore: 3.2,
    sex: 'M',
    count: 3,
  },
];
function inside(object: Object3D, point: number[]): boolean {
  const ray = new Raycaster(
    new Vector3(...(point as [number, number, number])),
    new Vector3(0.913, 0.327, 0.244).normalize(),
  );
  let result = false;
  object.traverse((mesh) => {
    if (!(mesh instanceof Mesh)) return;
    (mesh.material as MeshStandardMaterial).side = DoubleSide;
    const hit = ray.intersectObject(mesh, false).map((entry) => entry.distance);
    if (hit.filter((d, i) => i === 0 || Math.abs(d - hit[i - 1]) > 1e-5).length % 2) result = true;
  });
  return result;
}

test('AMASS E models extend the catalog without changing the twelve existing selections', () => {
  assert.equal(models.length, 19);
  assert.deepEqual(part.defaults, { model: 'xt60-m', detail: 'envelope' });
  assert.equal(part.presets!.length, 19);
  assert.deepEqual(part.catalogSelection, [{ key: 'model' }]);
  for (const m of expected) {
    const preset = part.presets!.find((p) => p.id === m.id)!;
    assert.ok(preset);
    assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), []);
    assert.equal(preset.catalog!.geometryEvidence!.kind, 'source-dimensions');
    assert.match(preset.catalog!.geometryEvidence!.limitations!, /not original manufacturer CAD/);
    assert.match(preset.catalog!.geometryEvidence!.limitations!, /wires are omitted/);
    assert.equal(preset.catalog!.attributes!.mountPitch, m.pitch);
    assert.equal(preset.catalog!.attributes!.mountDiameter, m.bore);
    assert.deepEqual(preset.catalog!.verifiedParameters, ['model']);
    assert.ok(part.validate({ ...preset.parameters, mountPitch: 99 }, 'assembled').length);
  }
  for (const key of ['mounting', 'mountPitch', 'mountDiameter', 'flangeThickness'])
    assert.ok(part.catalogFilterFields!.some((f) => f.key === key));
});

test('panel connector dimensions retain their different manufacturer flange footprints in both detail modes', () => {
  for (const m of expected)
    for (const detail of ['envelope', 'detailed']) {
      const p = { model: m.id, detail },
        group = part.buildGeometry(p, 'assembled');
      try {
        group.updateMatrixWorld(true);
        const b = new Box3().setFromObject(group, true),
          dims = b.getSize(new Vector3()).toArray();
        dims.forEach((v, i) =>
          assert.ok(Math.abs(v - [m.width, m.height, m.length][i]) < 0.002, m.id),
        );
        assert.ok(Math.abs(b.max.z - m.flange) < 0.002);
        assert.ok(Math.abs(b.min.z - (m.flange - m.length)) < 0.002);
        assert.equal(group.children.length, m.count);
        assert.ok(group.children.every((c) => !/wire|cable/i.test(c.name)));
        assert.deepEqual(
          part.dimensions(p, 'assembled').map((v) => +v.toFixed(2)),
          [m.width, m.height, m.length],
        );
      } finally {
        disposeModel(group);
      }
    }
});

test('flange bores are genuinely open with material around both mounting holes', () => {
  for (const m of expected) {
    const group = part.buildGeometry({ model: m.id, detail: 'envelope' }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      const housing = group.children[0] as Mesh;
      for (const x of [-m.pitch / 2, m.pitch / 2]) {
        assert.equal(inside(housing, [x, 0, m.flange / 2]), false, m.id + ' mounting bore');
        assert.equal(
          inside(housing, [x, m.bore / 2 + 0.5, m.flange / 2]),
          true,
          m.id + ' flange material',
        );
      }
    } finally {
      disposeModel(group);
    }
  }
});

test('female sockets remain open while M contacts occupy the contact axes inside an open shroud', () => {
  for (const m of expected) {
    const group = part.buildGeometry({ model: m.id, detail: 'detailed' }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      const model = models.find((item) => item.id === m.id)!,
        z = m.flange - 2,
        contact = group.children.find((c) => c.name.includes('1 · solder cup')) as Mesh;
      assert.ok(contact);
      // Probe away from the cosmetic contact slot, using the centre axis.
      assert.equal(inside(contact, [-model.pitch / 2, 0.3, z - 1]), m.sex === 'M', m.id);
      if (m.sex === 'M')
        assert.equal(inside(group.children[0] as Mesh, [0, 0, z]), false, 'Open pin shroud');
      assert.match(
        part.python({ model: m.id, detail: 'envelope' }, 'assembled'),
        /components = \[\]/,
      );
    } finally {
      disposeModel(group);
    }
  }
});

test('exploded inspection retains the same independent housing, gasket and contact parts', () => {
  for (const m of expected) {
    const p = { model: m.id, detail: 'envelope' },
      assembled = part.buildGeometry(p, 'assembled'),
      exploded = part.buildGeometry(p, 'exploded');
    try {
      assert.deepEqual(
        exploded.children.map((c) => c.name),
        assembled.children.map((c) => c.name),
      );
      assert.equal(exploded.children.length, m.count);
      assert.ok(new Box3().setFromObject(exploded, true).getSize(new Vector3()).z > m.length);
      assert.deepEqual(part.validate(p, 'exploded'), []);
    } finally {
      disposeModel(assembled);
      disposeModel(exploded);
    }
  }
});

const pcbExpected = [
  {
    id: 'xt30upb-m',
    width: 10.2,
    height: 5.6,
    length: 13.7,
    pitch: 5,
    bore: 1.8,
    plane: 'Z',
    front: 10.7,
    row: 0,
    tabs: 0,
  },
  {
    id: 'xt30upb-f',
    width: 10.2,
    height: 5.6,
    length: 12.4,
    pitch: 5,
    bore: 1.8,
    plane: 'Z',
    front: 9.4,
    row: 0,
    tabs: 0,
  },
  {
    id: 'xt60pw-m30',
    width: 15.5,
    height: 11.9,
    length: 18.2,
    pitch: 7.2,
    bore: 2.9,
    plane: 'Y',
    front: 10.35,
    row: -6,
    tabs: 2,
  },
  {
    id: 'xt60pw-f30',
    width: 15.5,
    height: 11.9,
    length: 17.2,
    pitch: 7.2,
    bore: 2.9,
    plane: 'Y',
    front: 9.35,
    row: -6,
    tabs: 2,
  },
];

test('verified PCB executions retain published contact patterns and fixed purchase identities', () => {
  for (const e of pcbExpected) {
    const m = models.find((m) => m.id === e.id)!,
      preset = part.presets!.find((p) => p.id === e.id)!;
    assert.ok(m && preset);
    assert.deepEqual(preset.parameters, { model: e.id, detail: 'envelope' });
    assert.deepEqual(preset.catalog!.verifiedParameters, ['model']);
    assert.deepEqual(part.validate(preset.parameters, 'assembled'), []);
    assert.equal(preset.catalog!.geometryEvidence!.kind, 'source-dimensions');
    assert.match(preset.catalog!.geometryEvidence!.limitations!, /not original manufacturer CAD/);
    assert.equal(m.pitch, e.pitch);
    assert.equal(m.pcbHoleDiameter, e.bore);
    assert.equal(m.pinProjection, 3);
    assert.equal(m.pcbFront, e.front);
    assert.equal(m.holdDowns, e.tabs);
    assert.equal(preset.catalog!.attributes!.pcbHoleDiameter, e.bore);
    if (e.tabs) {
      assert.equal(m.pcbRowOffset, 6);
      assert.equal(m.pcbHoldPitch, 13.5);
      assert.equal(m.pcbSlotWidth, 0.8);
      assert.equal(m.pcbSlotLength, 1.9);
      assert.equal(m.pcbTabProjection, 3.5);
      assert.match(
        preset.catalog!.geometryEvidence!.limitations!,
        /female front-face position.*reconstructed/,
      );
      assert.match(preset.catalog!.designation, /30$/);
    }
    assert.ok(part.validate({ ...preset.parameters, pitch: 10 }, 'assembled').length);
  }
});

test('PCB vertical and right-angle connectors keep their different board datums and real solder tails', () => {
  for (const e of pcbExpected)
    for (const detail of ['envelope', 'detailed']) {
      const parameters = { model: e.id, detail },
        group = part.buildGeometry(parameters, 'assembled');
      try {
        group.updateMatrixWorld(true);
        const b = new Box3().setFromObject(group, true),
          size = b.getSize(new Vector3()).toArray();
        size.forEach((d, i) =>
          assert.ok(Math.abs(d - [e.width, e.height, e.length][i]) < 0.002, e.id),
        );
        assert.equal(group.children.length, 3 + e.tabs);
        assert.ok(group.children.every((c) => !/wire|cable|solder cup/i.test(c.name)));
        for (const [i, x] of [-e.pitch / 2, e.pitch / 2].entries()) {
          const contact = group.children.find((c) => c.name.includes(`${i + 1} · PCB tail`))!;
          assert.ok(contact);
          const bounds = new Box3().setFromObject(contact, true);
          if (e.plane === 'Z') {
            assert.equal(
              inside(contact, [x, 0, -1.5]),
              true,
              'Straight vertical pin below PCB Z=0',
            );
            assert.ok(Math.abs(bounds.min.z + 3) < 0.001);
          } else {
            assert.equal(inside(contact, [x, -1.5, e.row]), true, 'Bent solder leg below PCB Y=0');
            assert.ok(Math.abs(bounds.min.y + 3) < 0.001);
            assert.equal(
              inside(contact, [x, -1.5, e.row + 2]),
              false,
              'No generic solder cup or spurious vertical stem',
            );
          }
        }
        if (e.tabs)
          for (const [i, x] of [-6.75, 6.75].entries()) {
            const tab = group.children.find((c) => c.name === `Hold-down tab ${i + 1}`)!;
            assert.ok(tab);
            const bounds = new Box3().setFromObject(tab, true);
            assert.equal(inside(tab, [x, -2, 0]), true);
            assert.ok(Math.abs(bounds.min.y + 3.5) < 0.001);
            assert.ok(Math.abs((bounds.min.x + bounds.max.x) / 2 - x) < 0.001);
            assert.ok(Math.abs((bounds.min.z + bounds.max.z) / 2) < 0.001);
          }
      } finally {
        disposeModel(group);
      }
    }
});

test('PCB socket mouths and male shrouds remain open along the shared +Z mating direction', () => {
  for (const e of pcbExpected) {
    const m = models.find((m) => m.id === e.id)!,
      group = part.buildGeometry({ model: e.id, detail: 'envelope' }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      const contact = group.children[1],
        x = -e.pitch / 2,
        y = m.pcbAxisHeight!,
        z = e.front - 2;
      assert.equal(inside(contact, [x, y + 0.2, z]), m.sex === 'M', e.id + ' contact gender');
      if (m.sex === 'M') assert.equal(inside(group.children[0], [0, y, z]), false, 'Open shroud');
      const exploded = part.buildGeometry({ model: e.id, detail: 'envelope' }, 'exploded');
      try {
        assert.deepEqual(
          exploded.children.map((c) => c.name),
          group.children.map((c) => c.name),
        );
      } finally {
        disposeModel(exploded);
      }
    } finally {
      disposeModel(group);
    }
  }
});

test('PW elbow passages retain closed oriented preview boundaries in both detail and inspection modes', () => {
  for (const model of ['xt60pw-m30', 'xt60pw-f30'])
    for (const detail of ['envelope', 'detailed'])
      for (const state of ['assembled', 'exploded']) {
        const group = part.buildGeometry({ model, detail }, state);
        try {
          group.traverse((mesh) => {
            if (!(mesh instanceof Mesh)) return;
            const positions = mesh.geometry.getAttribute('position'),
              index = mesh.geometry.index,
              edges = new Map<string, { count: number; winding: number }>();
            let volume = 0;
            for (let triangle = 0; triangle < (index?.count ?? positions.count); triangle += 3) {
              const points = [0, 1, 2].map((j) =>
                new Vector3().fromBufferAttribute(
                  positions,
                  index ? index.getX(triangle + j) : triangle + j,
                ),
              );
              assert.ok(
                points.every((point) => point.toArray().every(Number.isFinite)),
                mesh.name,
              );
              assert.ok(
                points[1]
                  .clone()
                  .sub(points[0])
                  .cross(points[2].clone().sub(points[0]))
                  .lengthSq() > 1e-18,
                mesh.name,
              );
              volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
              const keys = points.map((point) =>
                point
                  .toArray()
                  .map((v) => Math.round(v * 1e5))
                  .join(','),
              );
              for (let side = 0; side < 3; side++) {
                const a = keys[side],
                  b = keys[(side + 1) % 3],
                  key = [a, b].sort().join('|'),
                  edge = edges.get(key) ?? { count: 0, winding: 0 };
                edge.count++;
                edge.winding += a < b ? 1 : -1;
                edges.set(key, edge);
              }
            }
            assert.ok(volume > 0, mesh.name + ': outward volume');
            for (const edge of edges.values())
              assert.deepEqual(
                edge,
                { count: 2, winding: 0 },
                `${model}/${detail}/${state}/${mesh.name}: closed oriented boundary`,
              );
          });
        } finally {
          disposeModel(group);
        }
      }
});
