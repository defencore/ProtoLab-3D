import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import stepper from '../src/parts/stepper-motor/part';
import bldc from '../src/parts/bldc-motor/part';
import stepModels from '../src/parts/stepper-motor/lib/models.json';
import bldcModels from '../src/parts/bldc-motor/lib/models.json';
import { mountHoles } from '../src/parts/bldc-motor/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import {
  buildPresetIndex,
  emptyPresetFilters,
  filterPresets,
  fieldId,
} from '../src/core/preset-search';
function checkMesh(mesh: Mesh, label: string) {
  const positions = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.index;
  const edges = new Map<string, { count: number; winding: number }>();
  let volume = 0;
  for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
    const points = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j),
    );
    assert.ok(
      points.every((p) => p.toArray().every(Number.isFinite)),
      `${label}: finite vertices`,
    );
    assert.ok(
      points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).lengthSq() > 1e-18,
      `${label}: nondegenerate triangles`,
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
        key = [a, b].sort().join('|');
      const edge = edges.get(key) ?? { count: 0, winding: 0 };
      edge.count++;
      edge.winding += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  assert.ok(volume > 0, `${label}: positive outward volume`);
  for (const edge of edges.values())
    assert.deepEqual(edge, { count: 2, winding: 0 }, `${label}: closed oriented boundary`);
}

test('fixed catalog covers nine NEMA and twenty-four BLDC models with explicit current conditions', () => {
  assert.equal(stepper.presets.length, 9);
  assert.equal(bldc.presets.length, 24);
  for (const part of [stepper, bldc]) {
    assert.equal(part.category, 'MOTORS & ACTUATORS');
    assert.equal(part.catalogSelectionOnly, true);
    for (const preset of part.presets) {
      assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), []);
      assert.ok(part.validate({ ...preset.parameters, length: 999 }, 'assembled').length);
      assert.ok(part.validate({ ...preset.parameters, outputAngle: NaN }, 'assembled').length);
      assert.ok(part.validate({ ...preset.parameters, model: 'unknown' }, 'assembled').length);
      assert.deepEqual(preset.catalog!.verifiedParameters, ['model']);
    }
  }
  const idx = buildPresetIndex([bldc]),
    filters = emptyPresetFilters(bldc);
  filters.parameters[fieldId(bldc.catalogFilterFields!.find((f) => f.key === 'current')!)] = {
    min: '0',
    max: '150',
  };
  assert.equal(filterPresets(idx, filters).items.length, 20, 'missing current is not zero');
  assert.equal(
    bldc.presets.find((p) => p.id === 'x5330')!.catalog!.attributeConditions!.current,
    'Manufacturer maximum for 10 seconds; not a continuous rating.',
  );
  const f = emptyPresetFilters(stepper);
  f.parameters[fieldId(stepper.catalogFilterFields!.find((f) => f.key === 'torque')!)] = {
    min: '4.2',
    max: '8.2',
  };
  assert.deepEqual(
    filterPresets(buildPresetIndex([stepper]), f).items.map((i) => i.preset.id),
    ['24hs40-4204s', '34he45-6004s'],
  );
});

test('every motor has closed meshes, consistent dimensions and movable assemblies', () => {
  for (const part of [stepper, bldc])
    for (const preset of part.presets)
      for (const state of part.states!) {
        const p = { ...preset.parameters, showLeads: true, outputAngle: 90 },
          label = `${part.id}/${preset.id}/${state.id}`;
        const model = part.buildGeometry(p, state.id);
        try {
          const size = new Box3().setFromObject(model, true).getSize(new Vector3());
          part
            .dimensions(p, state.id)
            .forEach((v, i) =>
              assert.ok(Math.abs(size.getComponent(i) - v) < 0.01, `${label}: dimensions`),
            );
          assert.ok(model.children.length >= 13, label);
          model.traverse((mesh) => {
            if (mesh instanceof Mesh) checkMesh(mesh, label + '/' + mesh.name);
          });
        } finally {
          disposeModel(model);
        }
      }
});

test('NEMA mounting datums and D-flat are present in actual preview geometry', () => {
  for (const m of stepModels) {
    const p = { ...stepper.defaults, model: m.id },
      group = stepper.buildGeometry(p, 'assembled');
    group.updateMatrixWorld(true);
    try {
      const flange = group.children.find((c) => c.name === 'Front flange and locating pilot')!;
      for (const x of [-m.pitch / 2, m.pitch / 2])
        for (const y of [-m.pitch / 2, m.pitch / 2]) {
          const hits = new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1)).intersectObject(
            flange,
            true,
          );
          if (m.holeDepth) {
            assert.ok(hits.length);
            assert.ok(Math.abs(hits[0].point.z + m.holeDepth) < 0.002);
          } else assert.equal(hits.length, 0, 'clearance hole is open');
        }
      if (m.shaftType === 'D') {
        const shaft = group.children.find((c) => c.name === 'Rotor and output shaft')!;
        const hits = new Raycaster(
          new Vector3(0, m.shaft, m.extension - 0.5),
          new Vector3(0, -1, 0),
        ).intersectObject(shaft, true);
        assert.ok(Math.abs(hits[0].point.y - (m.shaft / 2 - m.flatDepth)) < 0.001);
      }
    } finally {
      disposeModel(group);
    }
  }
});

test('BLDC crossed and alternating mount patterns retain supplier drilling dimensions', () => {
  const x = mountHoles(bldcModels.find((m) => m.id === 'x2212')!);
  assert.deepEqual(
    x.map((h) => Math.round(Math.hypot(h.x, h.y) * 2)),
    [16, 19, 16, 19],
  );
  const xerun = bldcModels.find((m) => m.id === 'xerun-4268-g3')!,
    holes = mountHoles(xerun);
  assert.deepEqual(
    holes.map((h) => h.diameter),
    [3, 4, 3, 4, 3, 4, 3, 4],
  );
  const group = bldc.buildGeometry({ ...bldc.defaults, model: xerun.id }, 'assembled');
  group.updateMatrixWorld(true);
  try {
    const cover = group.children.find((c) => c.name === 'Front mounting cover')!;
    for (const h of holes) {
      const hits = new Raycaster(new Vector3(h.x, h.y, 10), new Vector3(0, 0, -1)).intersectObject(
        cover,
        true,
      );
      assert.ok(Math.abs(hits[0].point.z + 5.5) < 0.002, 'blind tapped mounting depth');
    }
  } finally {
    disposeModel(group);
  }
});

test('drone filters distinguish applications, missing specifications and internal shafts', () => {
  const index = buildPresetIndex([bldc]);
  const application = bldc.catalogFilterFields!.find((f) => f.key === 'application')!;
  const filters = emptyPresetFilters(bldc);
  filters.parameters[fieldId(application)] = { value: 'large-multirotor' };
  assert.deepEqual(
    filterPresets(index, filters).items.map((i) => i.preset.id),
    ['mn6007-ii-160', 'mn6007-ii-320', 'u8-lite-100', 'u8-lite-190'],
  );
  filters.parameters[fieldId(bldc.catalogFilterFields!.find((f) => f.key === 'shaft')!)] = {
    min: '0',
    max: '30',
  };
  assert.deepEqual(
    filterPresets(index, filters).items.map((i) => i.preset.id),
    ['mn6007-ii-160', 'mn6007-ii-320'],
    'U8 internal shaft must not appear as an exposed output shaft',
  );
  for (const id of ['0802se-19500', '0802se-23000']) {
    const catalog = bldc.presets.find((p) => p.id === id)!.catalog!;
    assert.equal(catalog.attributes!.current, undefined);
    assert.equal(catalog.attributes!.power, undefined);
  }
  for (const id of ['xing2-1404-3800', 'xing2-1404-4600']) {
    const attributes = bldc.presets.find((p) => p.id === id)!.catalog!.attributes!;
    assert.equal(attributes.shaft, undefined);
    assert.equal(attributes.length, undefined);
  }
  assert.match(
    bldc.presets.find((p) => p.id === 'xing2-2207-1855')!.catalog!.attributeConditions!.current,
    /duration is not specified/,
  );
  assert.match(
    bldc.presets.find((p) => p.id === 'u8-lite-100')!.catalog!.attributeConditions!.current,
    /180 seconds/,
  );
});

test('drone mounting bores, flange interfaces and bare motor envelopes match their datums', () => {
  const envelopes: Record<string, number> = {
    '0802se-19500': 13.8,
    'xing2-1404-3800': 18.4,
    'xing2-2207-1855': 32.6,
    'xing-2806-5-1300': 36.8,
    'nidici-3115-900': 46.8,
    'mn4014-330': 42.9,
    'mn6007-ii-160': 31.1,
    'u8-lite-100': 27.05,
  };
  for (const [id, height] of Object.entries(envelopes)) {
    const m = bldcModels.find((m) => m.id === id)!;
    const g = bldc.buildGeometry({ ...bldc.defaults, model: id }, 'assembled');
    g.updateMatrixWorld(true);
    try {
      const bounds = new Box3().setFromObject(g, true);
      assert.ok(Math.abs(bounds.max.z - bounds.min.z - height) < 0.002, `${id}: axial envelope`);
      assert.ok(Math.abs(bounds.max.x - bounds.min.x - m.diameter) < 0.002, `${id}: diameter`);
      const base = g.children.find((c) => c.name === 'Stationary mounting base')!;
      for (const h of m.drone!.mountHoles) {
        const hits = new Raycaster(
          new Vector3(h.x, h.y, -m.length - 1),
          new Vector3(0, 0, 1),
        ).intersectObject(base, true);
        if (m.holeDepth >= m.drone!.baseHeight)
          assert.equal(hits.length, 0, `${id}: mounting hole open`);
        else
          assert.ok(
            Math.abs(hits[0].point.z - (-m.length + m.holeDepth)) < 0.002,
            `${id}: blind mounting depth`,
          );
      }
      if (id === 'mn6007-ii-160' || id === 'u8-lite-100') {
        const bell = g.children.find((c) => c.name === 'Ventilated rotor bell')!;
        for (const h of m.drone!.frontHoles) {
          const hits = new Raycaster(
            new Vector3(h.x, h.y, 10),
            new Vector3(0, 0, -1),
          ).intersectObject(bell, true);
          assert.ok(
            Math.abs(hits[0].point.z - (m.drone!.bossHeight - m.drone!.frontDepth)) < 0.002,
            `${id}: propeller hole depth`,
          );
        }
      }
    } finally {
      disposeModel(g);
    }
  }
});
