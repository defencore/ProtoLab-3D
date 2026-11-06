import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, Raycaster, Vector3, type Group } from 'three';
import { parts } from '../src/parts';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import type { Parameters, PartDefinition } from '../src/core/types';

const ids = [
  'rocket-body-tube',
  'rocket-coupler',
  'rocket-centering-ring',
  'rocket-bulkhead',
  'rocket-avionics-sled',
  'rocket-rail-button',
  'rocket-prep-cradle',
];
const find = (id: string): PartDefinition => {
  const part = parts.find((candidate) => candidate.id === id);
  assert.ok(part, `Missing registered component ${id}`);
  return part;
};
const state = (part: PartDefinition) => part.states?.[0]?.id ?? 'default';

async function inspect(
  part: PartDefinition,
  parameters: Parameters,
  check: (model: Group) => void,
) {
  await part.initializeGeometry?.(parameters, state(part));
  const model = part.buildGeometry(parameters, state(part));
  try {
    model.updateMatrixWorld(true);
    check(model);
  } finally {
    disposeModel(model);
  }
}

/** Signed triangle volume verifies that the material remains after the bores are cut. */
function volume(model: Group): number {
  let result = 0;
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    const indices = object.geometry.index;
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      const vertices = [0, 1, 2].map((offset) =>
        new Vector3()
          .fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset)
          .applyMatrix4(object.matrixWorld),
      );
      result += vertices[0].dot(vertices[1].cross(vertices[2])) / 6;
    }
  });
  return result;
}

test('LDRS components are independently registered and discoverable by the event name', () => {
  for (const id of ids) {
    const part = find(id);
    assert.equal(part.category, 'VEHICLE STRUCTURES', id);
    assert.equal(part.subgroup, 'MODEL ROCKETS', id);
    assert.equal(part.product.kind, 'detail', id);
    assert.ok(part.presets.length > 0, `${id}: examples`);
    for (const preset of part.presets) {
      assert.deepEqual(
        validateParameters(part, preset.parameters, state(part)),
        [],
        `${id}/${preset.id}`,
      );
    }
  }
  const index = buildLibrarySearchIndex(groupBrowseFamilies(parts));
  for (const query of ['LDRS', 'Large Dangerous Rocket Ships']) {
    const matches = new Set(searchLibrary(index, query).map(({ family }) => family.id));
    for (const id of ids) assert.ok(matches.has(id), `${query}: ${id}`);
  }
});

test('airframe tubes, sleeves and rings retain their open bores and annular material volumes', async () => {
  for (const id of [
    'rocket-body-tube',
    'rocket-coupler',
    'rocket-centering-ring',
    'rocket-bulkhead',
  ]) {
    const part = find(id);
    for (const preset of part.presets) {
      const p = preset.parameters;
      const tube = id === 'rocket-body-tube' || id === 'rocket-coupler';
      const outer = Number(id === 'rocket-bulkhead' ? p.diameter : p.outerDiameter);
      const bore = Number(
        tube ? outer - 2 * Number(p.wall) : id === 'rocket-bulkhead' ? p.holeDiameter : p.bore,
      );
      const length = Number(tube ? p.length : p.thickness);
      const expected = (Math.PI / 4) * (outer ** 2 - bore ** 2) * length;
      await inspect(part, p, (model) => {
        assert.ok(
          Math.abs(volume(model) - expected) < expected * 0.01,
          `${id}/${preset.id}: material volume`,
        );
        if (bore > 0) {
          const hits = new Raycaster(
            new Vector3(0, 0, length + 1),
            new Vector3(0, 0, -1),
          ).intersectObject(model, true);
          assert.equal(hits.length, 0, `${id}/${preset.id}: unobstructed central bore`);
        }
      });
    }
  }
});

test('passive airframe components reject zero walls and vanished webs', () => {
  for (const id of ['rocket-body-tube', 'rocket-coupler']) {
    const part = find(id);
    for (const wall of [0, Number(part.defaults.outerDiameter) / 2]) {
      assert.ok(
        validateParameters(part, { ...part.defaults, wall }, state(part)).length > 0,
        `${id}: ${wall}`,
      );
    }
  }
  const ring = find('rocket-centering-ring');
  assert.ok(
    validateParameters(ring, { ...ring.defaults, bore: ring.defaults.outerDiameter }, state(ring))
      .length > 0,
  );
  const bulkhead = find('rocket-bulkhead');
  assert.ok(
    validateParameters(
      bulkhead,
      { ...bulkhead.defaults, holeDiameter: bulkhead.defaults.diameter },
      state(bulkhead),
    ).length > 0,
  );
});

test('rail buttons retain two flanges, a recessed screw seat and an unobstructed screw bore', async () => {
  const part = find('rocket-rail-button');
  for (const preset of part.presets) {
    const p = preset.parameters;
    const flange = Number(p.flangeDiameter);
    const neck = Number(p.neckDiameter);
    const height = Number(p.height);
    const thickness = Number(p.flangeThickness);
    const bore = Number(p.bore);
    const recess = Number(p.counterbore);
    const depth = Number(p.counterboreDepth);
    const expected =
      (Math.PI / 4) *
      ((neck ** 2 - bore ** 2) * height +
        (flange ** 2 - neck ** 2) * 2 * thickness -
        (recess ** 2 - bore ** 2) * depth);
    await inspect(part, p, (model) => {
      assert.ok(
        Math.abs(volume(model) - expected) < expected * 0.01,
        `${preset.id}: stepped material volume`,
      );
      assert.equal(
        new Raycaster(new Vector3(0, 0, height + 1), new Vector3(0, 0, -1)).intersectObject(
          model,
          true,
        ).length,
        0,
        `${preset.id}: axial screw clearance`,
      );
      for (const [z, radius] of [
        [0, neck / 2],
        [-height / 2 + thickness / 2, flange / 2],
        [height / 2 - thickness / 2, flange / 2],
      ]) {
        const hit = new Raycaster(new Vector3(flange, 0, z), new Vector3(-1, 0, 0)).intersectObject(
          model,
          true,
        )[0];
        assert.ok(hit, `${preset.id}: material at z=${z}`);
        assert.ok(Math.abs(hit.point.x - radius) < 0.02, `${preset.id}: rail interface at z=${z}`);
      }
      const seat = new Raycaster(
        new Vector3((bore + recess) / 4, 0, height + 1),
        new Vector3(0, 0, -1),
      ).intersectObject(model, true)[0];
      assert.ok(seat, `${preset.id}: screw head bearing seat`);
      assert.ok(Math.abs(seat.point.z - (height / 2 - depth)) < 0.02, `${preset.id}: recess depth`);
    });
  }
});

test('rail button validation preserves the groove and material around both screw clearances', () => {
  const part = find('rocket-rail-button');
  const p = part.defaults;
  const invalidChanges: Parameters[] = [
    { neckDiameter: p.flangeDiameter },
    { bore: p.neckDiameter },
    { flangeThickness: Number(p.height) / 2 },
    { counterbore: p.bore },
    { counterbore: p.flangeDiameter },
    { counterboreDepth: p.flangeThickness },
  ];
  for (const change of invalidChanges) {
    assert.ok(
      validateParameters(part, { ...p, ...change }, state(part)).length > 0,
      JSON.stringify(change),
    );
  }
});

test('avionics sleds have exactly four open mounting holes in a continuous plate', async () => {
  const part = find('rocket-avionics-sled');
  for (const preset of part.presets) {
    const p = preset.parameters;
    const thickness = Number(p.thickness);
    const expected =
      (Number(p.width) * Number(p.length) - Math.PI * Number(p.holeDiameter) ** 2) * thickness;
    await inspect(part, p, (model) => {
      assert.ok(
        Math.abs(volume(model) - expected) < expected * 0.01,
        `${preset.id}: perforated plate volume`,
      );
      for (const x of [-1, 1]) {
        for (const y of [-1, 1]) {
          const hits = new Raycaster(
            new Vector3((x * Number(p.pitchX)) / 2, (y * Number(p.pitchY)) / 2, thickness + 1),
            new Vector3(0, 0, -1),
          ).intersectObject(model, true);
          assert.equal(hits.length, 0, `${preset.id}: mounting clearance ${x}/${y}`);
        }
      }
      const center = new Raycaster(
        new Vector3(0, 0, thickness + 1),
        new Vector3(0, 0, -1),
      ).intersectObject(model, true)[0];
      assert.ok(center, `${preset.id}: central plate material`);
      assert.ok(Math.abs(center.point.z - thickness) < 0.02, `${preset.id}: plate upper face`);
    });
  }
  const p = part.defaults;
  const invalidChanges: Parameters[] = [
    { pitchX: Number(p.width) - Number(p.holeDiameter) },
    { pitchY: Number(p.length) - Number(p.holeDiameter) },
    { pitchX: 7, holeDiameter: 6 },
  ];
  for (const change of invalidChanges) {
    assert.ok(
      validateParameters(part, { ...p, ...change }, state(part)).length > 0,
      JSON.stringify(change),
    );
  }
});

test('preparation cradles retain a flat continuous base beneath their open V', async () => {
  const part = find('rocket-prep-cradle');
  for (const preset of part.presets) {
    const p = preset.parameters;
    const height = Number(p.height);
    const floor = Number(p.floor);
    const expected =
      Number(p.depth) * (Number(p.width) * height - (Number(p.opening) * (height - floor)) / 2);
    await inspect(part, p, (model) => {
      assert.ok(
        Math.abs(volume(model) - expected) < expected * 0.01,
        `${preset.id}: continuous V support volume`,
      );
      for (const [x, z] of [
        [0, floor],
        [Number(p.opening) / 4, (height + floor) / 2],
      ]) {
        const top = new Raycaster(
          new Vector3(x, 0, height + 1),
          new Vector3(0, 0, -1),
        ).intersectObject(model, true)[0];
        assert.ok(top, `${preset.id}: V contact surface`);
        assert.ok(Math.abs(top.point.z - z) < 0.02, `${preset.id}: V depth at ${x}`);
      }
      const bottom = new Raycaster(new Vector3(0, 0, -1), new Vector3(0, 0, 1)).intersectObject(
        model,
        true,
      )[0];
      assert.ok(bottom, `${preset.id}: bench contact face`);
      assert.ok(Math.abs(bottom.point.z) < 0.02, `${preset.id}: flat base datum`);
    });
  }
  const invalidChanges: Parameters[] = [
    { opening: part.defaults.width },
    { floor: part.defaults.height },
    { floor: 0 },
  ];
  for (const change of invalidChanges) {
    assert.ok(
      validateParameters(part, { ...part.defaults, ...change }, state(part)).length > 0,
      JSON.stringify(change),
    );
  }
});
