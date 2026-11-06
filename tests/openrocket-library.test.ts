import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, Raycaster, Vector3, type Group } from 'three';
import { parts } from '../src/parts';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import type { Parameters, PartDefinition } from '../src/core/types';
import { estimatedMass } from '../src/parts/rocket-ballast/part';

const newIds = [
  'rocket-nose-cone',
  'rocket-transition',
  'rocket-fin',
  'rocket-launch-lug',
  'rocket-parachute',
  'rocket-streamer',
  'rocket-shock-cord',
  'rocket-ballast',
];
const sharedIds = [
  'rocket-body-tube',
  'rocket-coupler',
  'rocket-centering-ring',
  'rocket-bulkhead',
  'rocket-rail-button',
];
const find = (id: string): PartDefinition => {
  const result = parts.find((part) => part.id === id);
  assert.ok(result, `Missing registered component ${id}`);
  return result;
};

async function inspect(part: PartDefinition, p: Parameters, check: (model: Group) => void) {
  await part.initializeGeometry?.(p, 'default');
  const model = part.buildGeometry(p, 'default');
  try {
    model.updateMatrixWorld(true);
    check(model);
  } finally {
    disposeModel(model);
  }
}

function volume(model: Group): number {
  let result = 0;
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const vertices = object.geometry.getAttribute('position');
    const indices = object.geometry.index;
    for (let i = 0; i < (indices?.count ?? vertices.count); i += 3) {
      const triangle = [0, 1, 2].map((offset) =>
        new Vector3()
          .fromBufferAttribute(vertices, indices ? indices.getX(i + offset) : i + offset)
          .applyMatrix4(object.matrixWorld),
      );
      result += triangle[0].dot(triangle[1].cross(triangle[2])) / 6;
    }
  });
  return result;
}

function near(actual: number, expected: number, label: string, relativeTolerance = 0.01) {
  assert.ok(
    Math.abs(actual - expected) <= Math.max(0.001, expected * relativeTolerance),
    `${label}: actual ${actual}, expected ${expected}`,
  );
}

test('OpenRocket physical component counterparts are registered, searchable and have valid prototypes', () => {
  const index = buildLibrarySearchIndex(groupBrowseFamilies(parts));
  const matches = new Set(searchLibrary(index, 'OpenRocket').map(({ family }) => family.id));
  for (const id of [...newIds, ...sharedIds]) {
    const part = find(id);
    assert.ok(matches.has(id), `OpenRocket search: ${id}`);
    assert.equal(part.category, 'VEHICLE STRUCTURES', id);
    assert.equal(part.subgroup, 'MODEL ROCKETS', id);
    assert.equal(part.product.kind, 'detail', id);
    for (const preset of part.presets)
      assert.deepEqual(
        validateParameters(part, preset.parameters, 'default'),
        [],
        `${id}/${preset.id}`,
      );
  }
});

test('internal tube, tube fin and engine block roles reuse their physical tube and ring families', () => {
  const tube = find('rocket-body-tube'),
    ring = find('rocket-centering-ring');
  for (const presetId of ['inner-tube-29', 'tube-fin-40'])
    assert.ok(
      tube.presets.some((preset) => preset.id === presetId),
      presetId,
    );
  assert.ok(ring.presets.some((preset) => preset.id === 'engine-block-28'));
  const index = buildLibrarySearchIndex(groupBrowseFamilies(parts));
  for (const [query, id] of [
    ['inner tube', tube.id],
    ['tube fin', tube.id],
    ['engine block', ring.id],
  ])
    assert.ok(
      searchLibrary(index, query).some(({ family }) => family.id === id),
      `${query}: ${id}`,
    );
});

test('each planar fin preserves its planform material area and negative-sweep overhang', async () => {
  const part = find('rocket-fin');
  for (const preset of part.presets) {
    const p = preset.parameters;
    const points = JSON.parse(String(p.points)) as [number, number][];
    const polygonArea =
      Math.abs(
        points.reduce((sum, point, i) => {
          const next = points[(i + 1) % points.length];
          return sum + point[0] * next[1] - point[1] * next[0];
        }, 0),
      ) / 2;
    const area =
      p.shape === 'trapezoidal'
        ? ((Number(p.rootChord) + Number(p.tipChord)) * Number(p.span)) / 2
        : p.shape === 'elliptical'
          ? (Math.PI * Number(p.rootChord) * Number(p.span)) / 4
          : polygonArea;
    await inspect(part, p, (model) => near(volume(model), area * Number(p.thickness), preset.id));
  }
  const p: Parameters = {
    ...part.defaults,
    rootChord: 120,
    tipChord: 50,
    span: 60,
    thickness: 3,
    sweep: -40,
  };
  assert.deepEqual(validateParameters(part, p, 'default'), []);
  assert.deepEqual(part.dimensions(p, 'default'), [160, 60, 3]);
});

test('freeform fins reject ambiguous polygons and accept both simple outline windings', () => {
  const part = find('rocket-fin');
  const invalid = [
    'not json',
    '[]',
    '[[0,0],[50,0]]',
    '[[0,0],[50,0],[50,30],[0,0]]',
    '[[0,0],[50,0],[25,0],[25,30]]',
    '[[0,0],[50,30],[50,0],[0,30]]',
    '[[0,0],[100,0],[100,100],[50,0],[0,100]]',
    '[[0,0],[1,0],[2,0]]',
    '[[0,0],[1e999,0],[1,1]]',
    '[[0,0],[3000,0],[3000,100]]',
  ];
  for (const points of invalid)
    assert.ok(
      validateParameters(part, { ...part.defaults, shape: 'freeform', points }, 'default').length,
      points,
    );
  for (const points of ['[[0,0],[100,0],[0,50]]', '[[0,50],[100,0],[0,0]]'])
    assert.deepEqual(
      validateParameters(part, { ...part.defaults, shape: 'freeform', points }, 'default'),
      [],
    );
});

test('launch lugs retain a clear rod bore and their annular material', async () => {
  const part = find('rocket-launch-lug');
  for (const preset of part.presets) {
    const p = preset.parameters;
    const expected =
      (Math.PI / 4) * (Number(p.outerDiameter) ** 2 - Number(p.bore) ** 2) * Number(p.length);
    await inspect(part, p, (model) => {
      near(volume(model), expected, preset.id);
      assert.equal(
        new Raycaster(
          new Vector3(0, 0, Number(p.length) + 1),
          new Vector3(0, 0, -1),
        ).intersectObject(model, true).length,
        0,
        `${preset.id}: unobstructed guide rod bore`,
      );
    });
  }
  assert.ok(
    validateParameters(part, { ...part.defaults, bore: part.defaults.outerDiameter }, 'default')
      .length,
  );
});

test('ballast estimates use cubic-centimetre density and preserve geometry when density changes', async () => {
  const part = find('rocket-ballast');
  const p: Parameters = {
    ...part.defaults,
    diameter: 10,
    length: 40 / Math.PI,
    bore: 0,
    density: 2.7,
  };
  assert.deepEqual(validateParameters(part, p, 'default'), []);
  near(estimatedMass(p), 2.7, 'one cubic centimetre at 2.7 g/cm3', 1e-10);
  near(estimatedMass({ ...p, density: 5.4 }), 5.4, 'double density', 1e-10);
  near(estimatedMass({ ...p, bore: 5 }), 2.7 * 0.75, 'annular volume removes one quarter', 1e-10);
  const original = part.python(p, 'default');
  assert.equal(
    part.python({ ...p, density: 5.4 }, 'default'),
    original,
    'density is assessment metadata',
  );
  for (const preset of part.presets) {
    await inspect(part, preset.parameters, (model) =>
      near(
        (volume(model) * Number(preset.parameters.density)) / 1000,
        estimatedMass(preset.parameters),
        preset.id,
      ),
    );
  }
});

test('conical transitions and boattails retain both open ends and oriented taper', async () => {
  const part = find('rocket-transition');
  for (const preset of part.presets) {
    const p = preset.parameters;
    const fore = Number(p.foreDiameter) / 2,
      aft = Number(p.aftDiameter) / 2;
    const length = Number(p.length),
      wall = Number(p.wall);
    const frustum = (a: number, b: number) => ((Math.PI * length) / 3) * (a * a + a * b + b * b);
    await inspect(part, p, (model) => {
      near(volume(model), frustum(fore, aft) - frustum(fore - wall, aft - wall), preset.id);
      assert.equal(
        new Raycaster(new Vector3(0, 0, length + 1), new Vector3(0, 0, -1)).intersectObject(
          model,
          true,
        ).length,
        0,
        `${preset.id}: central open passage`,
      );
      const hit = new Raycaster(
        new Vector3(Math.max(fore, aft) + 10, 0, length / 4),
        new Vector3(-1, 0, 0),
      ).intersectObject(model, true)[0];
      assert.ok(hit, preset.id);
      near(hit.point.x, aft + (fore - aft) * 0.75, `${preset.id}: forward taper orientation`, 1e-4);
    });
  }
  assert.ok(
    validateParameters(
      part,
      { ...part.defaults, foreDiameter: part.defaults.aftDiameter },
      'default',
    ).length,
  );
  assert.ok(
    validateParameters(
      part,
      { ...part.defaults, wall: Number(part.defaults.foreDiameter) / 2 },
      'default',
    ).length,
  );
});

test('nose profiles have distinct analytic sections and optional hollow shoulders', async () => {
  const part = find('rocket-nose-cone');
  for (const profile of ['conical', 'elliptical', 'tangent-ogive']) {
    const p: Parameters = {
      ...part.defaults,
      profile,
      baseDiameter: 60,
      length: 120,
      shoulderDiameter: 56,
      shoulderLength: 20,
      wall: 2,
      solid: false,
    };
    assert.deepEqual(validateParameters(part, p, 'default'), [], profile);
    const rho = (120 ** 2 + 30 ** 2) / 60;
    const radius =
      profile === 'conical'
        ? 15
        : profile === 'elliptical'
          ? 30 * Math.sqrt(0.75)
          : Math.sqrt(rho ** 2 - 60 ** 2) + 30 - rho;
    let hollowVolume = 0;
    await inspect(part, p, (model) => {
      hollowVolume = volume(model);
      const side = new Raycaster(new Vector3(100, 0, 60), new Vector3(-1, 0, 0)).intersectObject(
        model,
        true,
      )[0];
      assert.ok(side, profile);
      near(side.point.x, radius, `${profile}: half-length section`, 1e-4);
      const innerTip = new Raycaster(new Vector3(0, 0, -21), new Vector3(0, 0, 1)).intersectObject(
        model,
        true,
      )[0];
      assert.ok(innerTip, `${profile}: retained tip closes the cavity`);
      near(innerTip.point.z, 118, `${profile}: open shoulder reaches inner tip`, 1e-4);
    });
    await inspect(part, { ...p, solid: true }, (model) => {
      assert.ok(volume(model) > hollowVolume, `${profile}: filled construction adds material`);
      const bottom = new Raycaster(new Vector3(0, 0, -21), new Vector3(0, 0, 1)).intersectObject(
        model,
        true,
      )[0];
      assert.ok(bottom, profile);
      near(bottom.point.z, -20, `${profile}: filled shoulder base`, 1e-4);
    });
  }
  assert.ok(
    validateParameters(
      part,
      { ...part.defaults, shoulderDiameter: part.defaults.baseDiameter },
      'default',
    ).length,
  );
});

test('canopy vents stay open while an omitted vent closes the crown', async () => {
  const part = find('rocket-parachute');
  for (const ventDiameter of [30, 0]) {
    const p: Parameters = { ...part.defaults, ventDiameter };
    assert.deepEqual(validateParameters(part, p, 'default'), []);
    await inspect(part, p, (model) => {
      const projectedVolume =
        (Math.PI / 4) * (Number(p.diameter) ** 2 - ventDiameter ** 2) * Number(p.thickness);
      near(volume(model), projectedVolume, `vent ${ventDiameter}: axial-thickness canopy material`);
      const axialHits = new Raycaster(
        new Vector3(0, 0, Number(p.rise) + 10),
        new Vector3(0, 0, -1),
      ).intersectObject(model, true);
      if (ventDiameter > 0) assert.equal(axialHits.length, 0, 'unobstructed vent');
      else {
        assert.ok(axialHits.length > 0, 'closed crown');
        near(axialHits[0].point.z, Number(p.rise), 'outer crown height', 1e-4);
      }
    });
  }
  assert.ok(
    validateParameters(
      part,
      { ...part.defaults, ventDiameter: Number(part.defaults.diameter) * 0.8 },
      'default',
    ).length,
  );
});

test('streamer and shock-cord references retain entered material envelopes', async () => {
  for (const id of ['rocket-streamer', 'rocket-shock-cord']) {
    const part = find(id);
    for (const preset of part.presets) {
      const p = preset.parameters;
      const expected =
        Number(p.length) *
        (id === 'rocket-streamer'
          ? Number(p.width) * Number(p.thickness)
          : (Math.PI / 4) * Number(p.diameter) ** 2);
      await inspect(part, p, (model) => near(volume(model), expected, `${id}/${preset.id}`));
    }
  }
});
