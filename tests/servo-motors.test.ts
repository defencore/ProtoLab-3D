import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3, type Object3D } from 'three';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import { validateParameters } from '../src/core/validation';
import {
  catalogValue,
  matchesCatalogFilters,
  presetMatchesConfiguration,
} from '../src/core/catalog-models';
import { getModelDefinition, getModelGeometryParameters } from '../src/parts/servo-motor/part';
import nativeST3215 from '../src/parts/servo-motor/lib/waveshare/native.json';

const removedIds = [
  'waveshare-st3215-hs-servo',
  'kst-x10-mini-pro-servo',
  'power-hd-t60-bhv-servo',
  'power-hd-tds-2-servo',
];
const modelIds = [
  'waveshare-st3215-hs',
  'kst-x10-mini-pro-a',
  'kst-x10-mini-pro-b',
  'kst-x10-v8',
  'kst-x10-pro-a',
  'kst-x10-pro-b',
  'power-hd-t60-bhv',
  'power-hd-tds-2',
];
const servos = parts.filter((part) => part.id === 'servo-motor');
const servo = servos[0]!;
const bounds = (object: Object3D) => new Box3().setFromObject(object, true);

test('ST3215 uses the pinned original STEP and preserves separate source components', () => {
  const original = readFileSync(
    new URL('../public/references/st3215-hs-manufacturer.step', import.meta.url),
  );
  assert.equal(createHash('sha256').update(original).digest('hex'), nativeST3215.sourceSha256);
  const posed = { ...servo.defaults, outputAngle: 45 };
  const model = servo.buildGeometry(posed, 'assembled');
  const bare = servo.buildGeometry({ ...posed, showHorn: false }, 'assembled');
  const housing = servo.buildGeometry(posed, 'body');
  try {
    assert.deepEqual(
      model.children.map((child) => child.name),
      [
        'Middle case',
        'Front cover',
        'Rear cover and pivot',
        'Motor',
        'Circuit board',
        'Output gear and shaft',
        'Front output disc',
        'Rear idler disc',
      ],
    );
    assert.equal(bare.children.length, 6);
    assert.equal(housing.children.length, 3);
    model.children.forEach((child, index) =>
      assert.equal(child.rotation.z, index === 5 || index === 6 ? Math.PI / 4 : 0),
    );
    const script = generateScript(servo, posed, 'assembled');
    assert.equal(script.match(/importBrepFromString/g)?.length, 8);
    assert.ok(script.includes(nativeST3215.sourceSha256));
  } finally {
    [model, bare, housing].forEach(disposeModel);
  }
});

function inspectMesh(mesh: Mesh, label: string) {
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
    const keys =
      mesh.geometry.userData.nativeTopology && indices
        ? [0, 1, 2].map((j) => String(indices.getX(i + j)))
        : points.map((p) =>
            p
              .toArray()
              .map((v) => Math.round(v * 1e5))
              .join(','),
          );
    for (let j = 0; j < 3; j++) {
      const a = keys[j],
        b = keys[(j + 1) % 3];
      const key = [a, b].sort().join('|');
      const edge = edges.get(key) ?? { count: 0, winding: 0 };
      edge.count++;
      edge.winding += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  assert.ok(volume > 0, `${label}: outward positive solid volume`);
  for (const edge of edges.values())
    assert.deepEqual(edge, { count: 2, winding: 0 }, `${label}: closed oriented boundary`);
  return volume;
}

test('all requested fixed servo models are discoverable under one catalog item', () => {
  assert.deepEqual(
    servos.map((part) => part.id),
    ['servo-motor'],
  );
  assert.ok(parts.every((part) => !removedIds.includes(part.id)));
  assert.deepEqual(
    servo.presets.map((preset) => preset.parameters.model),
    modelIds,
  );
  assert.equal(servo.catalogSelectionOnly, true);
  assert.deepEqual(Object.keys(servo.defaults).sort(), [
    'hornStyle',
    'model',
    'outputAngle',
    'showHorn',
  ]);
  assert.deepEqual(
    servo.parameters.map((parameter) => parameter.key).sort(),
    Object.keys(servo.defaults).sort(),
  );
  for (const part of servos) {
    assert.equal(part.category, 'MOTION');
    assert.equal(part.subgroup, 'SERVO MOTORS');
    assert.ok(part.keywords.some((keyword) => keyword.includes('серв')));
    assert.ok(part.presets.some((preset) => preset.catalog));
    for (const preset of part.presets) {
      assert.deepEqual(Object.keys(preset.parameters).sort(), Object.keys(part.defaults).sort());
      if (!preset.catalog) continue;
      assert.ok(preset.catalog.sourceUrl && preset.catalog.verifiedParameters.length > 0);
      assert.deepEqual(preset.catalog.verifiedParameters, ['model']);
      assert.ok(preset.catalog.attributes?.caseLength);
      for (const key of preset.catalog.verifiedParameters)
        assert.ok(
          Object.hasOwn(preset.parameters, key),
          `${part.id}: unknown sourced parameter ${key}`,
        );
      assert.ok(!preset.catalog.verifiedParameters.includes('outputAngle'));
      assert.ok(!preset.catalog.verifiedParameters.includes('hornLength'));
      const result = filterPresets(buildPresetIndex([part]), {
        ...emptyPresetFilters(part),
        kind: 'catalog',
        query: preset.catalog.designation,
      });
      assert.deepEqual(result.errors, []);
      assert.ok(
        result.items.some((item) => item.preset.id === preset.id),
        `${part.id}: catalog search`,
      );
    }
  }
});

test('servo catalog filters use published characteristics and never treat missing current as zero', () => {
  const fields = servo.catalogFilterFields!;
  for (const key of [
    'caseLength',
    'caseWidth',
    'caseHeight',
    'stallTorque',
    'noLoadCurrent',
    'stallCurrent',
    'referenceVoltage',
    'motorType',
  ])
    assert.ok(
      fields.some((field) => field.key === key),
      `Filter available: ${key}`,
    );
  const matched = (filters: Parameters<typeof matchesCatalogFilters>[2]) =>
    servo.presets
      .filter((preset) => matchesCatalogFilters(preset, fields, filters))
      .map((preset) => preset.parameters.model);
  assert.deepEqual(matched({ caseWidth: { max: '10' } }), [
    'kst-x10-mini-pro-a',
    'kst-x10-mini-pro-b',
    'kst-x10-v8',
    'kst-x10-pro-a',
    'kst-x10-pro-b',
  ]);
  assert.deepEqual(matched({ stallTorque: { min: '40' } }), ['power-hd-t60-bhv']);
  assert.deepEqual(matched({ caseWidth: { max: '10' }, stallTorque: { min: '10' } }), [
    'kst-x10-pro-a',
    'kst-x10-pro-b',
  ]);
  assert.deepEqual(matched({ caseWidth: { max: '10' }, totalHeight: { min: '40' } }), [
    'kst-x10-v8',
  ]);
  assert.deepEqual(matched({ noLoadCurrent: { min: '0', max: '0.3' } }), [
    'waveshare-st3215-hs',
    'power-hd-t60-bhv',
  ]);
  assert.deepEqual(matched({ stallCurrent: { min: '0', max: '3' } }), [
    'waveshare-st3215-hs',
    'power-hd-t60-bhv',
  ]);
  assert.deepEqual(matched({ noLoadCurrent: { max: '0' } }), []);
  assert.deepEqual(matched({ stallTorque: { min: '50', max: '20' } }), []);
  for (const preset of servo.presets) {
    assert.ok(!Object.hasOwn(preset.parameters, 'stallTorque'));
    assert.ok(!Object.hasOwn(preset.parameters, 'caseWidth'));
    if (String(preset.parameters.model).startsWith('kst-')) {
      assert.equal(catalogValue(preset, 'noLoadCurrent'), undefined);
      assert.equal(catalogValue(preset, 'stallCurrent'), undefined);
    }
    if (preset.parameters.model === 'power-hd-tds-2') {
      assert.equal(catalogValue(preset, 'noLoadCurrent'), 0.4);
      assert.equal(catalogValue(preset, 'stallCurrent'), undefined);
    }
  }
});

test('X10 V8 travel is limited to 50 degrees and model changes constrain the pose', () => {
  const preset = servo.presets.find((entry) => entry.id === 'kst-x10-v8')!;
  for (const angle of [-50, 50])
    assert.deepEqual(
      servo.validate!({ ...preset.parameters, outputAngle: angle }, 'assembled'),
      [],
    );
  for (const angle of [-60, 60]) {
    const pose = { ...preset.parameters, outputAngle: angle };
    assert.ok(servo.validate!(pose, 'assembled').some((error) => error.includes('50°')));
    assert.equal(servo.updateParameters!(pose, 'model').outputAngle, Math.sign(angle) * 50);
  }
});

test('servo defaults and sourced variants produce closed meshes with matching export envelopes', () => {
  for (const part of servos) {
    for (const configuration of [{ id: 'default', parameters: part.defaults }, ...part.presets]) {
      for (const state of part.states!) {
        const label = `${part.id}/${configuration.id}/${state.id}`;
        assert.deepEqual(validateParameters(part, configuration.parameters, state.id), [], label);
        const model = part.buildGeometry(configuration.parameters, state.id);
        try {
          model.updateMatrixWorld(true);
          const actual = bounds(model).getSize(new Vector3()).toArray();
          part.dimensions(configuration.parameters, state.id).forEach((expected, axis) => {
            assert.ok(Number.isFinite(expected) && expected > 0, label);
            assert.ok(Math.abs(actual[axis] - expected) < 0.05, `${label}: axis ${axis}`);
          });
          assert.ok(model.children.length > 0, label);
          assert.ok(
            model.children.every((child) => child.name.length > 0),
            `${label}: component names`,
          );
          assert.equal(
            new Set(model.children.map((child) => child.name)).size,
            model.children.length,
          );
          model.traverse((child) => {
            if (child instanceof Mesh) inspectMesh(child, label);
          });
          const script = generateScript(part, configuration.parameters, state.id);
          assert.ok(script.includes('component_labels ='), `${label}: named CAD bodies`);
        } finally {
          disposeModel(model);
        }
      }
    }
  }
});

test('servo output rotation preserves the fixed housing and rotates the optional horn', () => {
  for (const part of servos) {
    for (const preset of part.presets) {
      const p = { ...preset.parameters, showHorn: true, hornStyle: 'single', outputAngle: 0 };
      const q = { ...p, outputAngle: 45 };
      assert.deepEqual(validateParameters(part, p, 'assembled'), []);
      assert.deepEqual(validateParameters(part, q, 'assembled'), []);
      const before = part.buildGeometry(p, 'assembled');
      const after = part.buildGeometry(q, 'assembled');
      try {
        before.updateMatrixWorld(true);
        after.updateMatrixWorld(true);
        assert.deepEqual(
          before.children.map((child) => child.name),
          after.children.map((child) => child.name),
        );
        const housingBefore = bounds(before.children[0]),
          housingAfter = bounds(after.children[0]);
        assert.ok(housingBefore.min.distanceTo(housingAfter.min) < 1e-5);
        assert.ok(housingBefore.max.distanceTo(housingAfter.max) < 1e-5);
        assert.ok(
          before.children.some((child, i) => {
            const a = bounds(child),
              b = bounds(after.children[i]);
            return a.min.distanceTo(b.min) + a.max.distanceTo(b.max) > 0.1;
          }),
          `${part.id}/${preset.id}: an asymmetric output must visibly rotate`,
        );
        for (const model of [before, after]) {
          const actual = bounds(model).getSize(new Vector3()).toArray();
          const expected = part.dimensions(model === before ? p : q, 'assembled');
          actual.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < 0.05));
          model.traverse((child) => {
            if (child instanceof Mesh) inspectMesh(child, part.id);
          });
        }
      } finally {
        disposeModel(before);
        disposeModel(after);
      }
    }
  }
});

test('fixed servo models retain catalog attribution through pose changes and reject dimension edits', () => {
  for (const part of servos) {
    for (const preset of part.presets.filter((preset) => preset.catalog)) {
      assert.match(generateScript(part, preset.parameters, 'assembled'), /obj\.CatalogSource =/);
      const posed = { ...preset.parameters, showHorn: true, outputAngle: 37 };
      assert.ok(presetMatchesConfiguration(part, preset, posed));
      const script = generateScript(part, posed, 'assembled');
      assert.match(script, /obj\.CatalogSource =/);
      assert.match(script, /obj\.CatalogAttributes =/);
      assert.match(script, /obj\.CatalogAttributeConditions =/);
      const custom = { ...preset.parameters, bodyWidth: 999 };
      assert.ok(validateParameters(part, custom, 'assembled').length);
      assert.throws(() => generateScript(part, custom, 'assembled'));
    }
    assert.ok(validateParameters(part, { ...part.defaults, outputAngle: NaN }, 'assembled').length);
    assert.throws(() => generateScript(part, { ...part.defaults, outputAngle: NaN }, 'assembled'));
    assert.ok(validateParameters(part, part.defaults, 'unknown-state').length);
    assert.ok(
      validateParameters(part, { ...part.defaults, model: 'unknown-model' }, 'assembled').length,
    );
    assert.throws(() =>
      generateScript(part, { ...part.defaults, model: 'unknown-model' }, 'assembled'),
    );
  }
});

test('Power-HD drawing datums and mounting cutouts are retained in the actual geometry', () => {
  // Independently transcribed from page 3 of the two user-supplied official PDFs.
  const fixtures = [
    {
      id: 'power-hd-t60-bhv',
      bodyLength: 40.7,
      bodyWidth: 20.5,
      bodyHeight: 38.7,
      totalHeight: 44.2,
      mountSpan: 54.2,
      mountBottom: 28,
      mountThickness: 2.6,
      mountTop: 30.6,
    },
    {
      id: 'power-hd-tds-2',
      bodyLength: 41,
      bodyWidth: 20,
      bodyHeight: 29,
      totalHeight: 34,
      mountSpan: 54.4,
      mountBottom: 19.7,
      mountThickness: 2.5,
      mountTop: 22.2,
    },
  ];
  for (const { id, mountTop, ...dimensions } of fixtures) {
    const part = servo;
    const preset = part.presets.find((preset) => preset.parameters.model === id)!;
    const geometry = getModelGeometryParameters(preset.parameters);
    const verifiedDimensions = getModelDefinition(id).geometryEvidence.verifiedDimensions;
    for (const [key, value] of Object.entries({
      ...dimensions,
      mountPitchX: 49,
      mountPitchY: 10,
    })) {
      assert.equal(geometry[key], value, `${id}: fixed source dimension ${key}`);
      assert.ok(verifiedDimensions.includes(key), `${id}: source coverage ${key}`);
    }
    assert.ok(!verifiedDimensions.includes('mountHoleDiameter'));
    if (id === 'power-hd-tds-2') assert.ok(!verifiedDimensions.includes('shaftOffset'));
    assert.equal(preset.catalog!.attributes!.caseLength, dimensions.bodyLength);
    assert.equal(preset.catalog!.attributes!.caseWidth, dimensions.bodyWidth);
    assert.equal(preset.catalog!.attributes!.caseHeight, dimensions.bodyHeight);
    assert.equal(preset.catalog!.attributes!.totalHeight, dimensions.totalHeight);
    const model = part.buildGeometry(preset.parameters, 'body');
    try {
      model.updateMatrixWorld(true);
      for (const x of [-24.5, 24.5])
        for (const y of [-5, 5]) {
          const hits = new Raycaster(new Vector3(x, y, 100), new Vector3(0, 0, -1)).intersectObject(
            model,
            true,
          );
          assert.equal(hits.length, 0, `${id}: mounting cutout at ${x},${y} is open`);
        }
      const land = new Raycaster(new Vector3(23, 0, 100), new Vector3(0, 0, -1)).intersectObject(
        model,
        true,
      );
      assert.ok(land.length > 0, `${id}: mounting ear has a connected land`);
      assert.ok(Math.abs(land[0].point.z - mountTop) < 0.01, `${id}: mounting face datum`);
    } finally {
      disposeModel(model);
    }
  }
});

test('KST A and B preserve their distinct mounting axes and official hole patterns', () => {
  const part = servo;
  const fixtures: Record<
    string,
    { height: number; shaftOffset: number; upper: number; lower?: [number, number] }
  > = {
    'kst-x10-mini-pro-a': { height: 28.5, shaftOffset: 6.6, upper: 24.5, lower: [-4, 3] },
    'kst-x10-mini-pro-b': { height: 28, shaftOffset: 6.6, upper: 21.9 },
    'kst-x10-v8': { height: 35.5, shaftOffset: 6.55, upper: 31.5, lower: [0, -3.7] },
    'kst-x10-pro-a': { height: 33.5, shaftOffset: 6.6, upper: 29.5, lower: [-4, 5] },
    'kst-x10-pro-b': { height: 33.5, shaftOffset: 6.6, upper: 27.4 },
  };
  for (const preset of part.presets.filter((preset) =>
    String(preset.parameters.model).startsWith('kst-'),
  )) {
    const p = getModelGeometryParameters(preset.parameters);
    assert.equal(p.bodyLength, 30);
    assert.equal(p.bodyWidth, 10);
    assert.equal(p.mountingSpan, 42);
    assert.equal(p.mountingPitch, 36);
    assert.equal(p.mountingHoleDiameter, 3);
    const fixture = fixtures[preset.id];
    assert.equal(p.shaftOffset, fixture.shaftOffset);
    assert.equal(p.bodyHeight, fixture.height);
    assert.equal(p.earThickness, p.variant === 'a' ? 1.8 : 1.9);
    const model = part.buildGeometry(preset.parameters, 'body');
    try {
      model.updateMatrixWorld(true);
      const rays =
        p.variant === 'a'
          ? [[-18, fixture.upper], [18, fixture.upper], fixture.lower!].map(
              ([x, z]) => new Raycaster(new Vector3(x, -100, z), new Vector3(0, 1, 0)),
            )
          : [-18, 18].map((x) => new Raycaster(new Vector3(x, 0, 100), new Vector3(0, 0, -1)));
      for (const ray of rays)
        assert.equal(
          ray.intersectObject(model, true).length,
          0,
          `${preset.id}: open mounting hole`,
        );
      if (preset.id === 'kst-x10-v8') {
        assert.ok(
          Math.abs(bounds(model).min.z + 6.4) < 0.01,
          'V8 lower mounting tab projects 6.4 mm',
        );
        assert.ok(
          new Raycaster(new Vector3(2.1, -100, -3.7), new Vector3(0, 1, 0)).intersectObject(
            model,
            true,
          ).length > 0,
          'V8 lower hole has a physical surrounding tab',
        );
      }
    } finally {
      disposeModel(model);
    }
  }
});

test('ST3215 retains fixed manufacturer drawing datums and the supplied disc accessory', () => {
  const part = servo;
  const preset = part.presets.find((preset) => preset.parameters.model === 'waveshare-st3215-hs')!;
  const geometry = getModelDefinition(preset.parameters.model).geometryEvidence.dimensions!;
  const verifiedDimensions = getModelDefinition(preset.parameters.model).geometryEvidence
    .verifiedDimensions;
  const fixture = {
    bodyLength: 45.22,
    bodyWidth: 24.72,
    bodyHeight: 29,
    shaftOffset: 10.11,
    mountStart: 18.41,
    frontMountPitch: 20.7,
    rearMountPitch: 24.45,
    mountRowPitch: 20.5,
    hornDiameter: 19.2,
    hornHolePitch: 14,
  };
  for (const [key, value] of Object.entries(fixture)) {
    assert.equal(geometry[key], value, `ST3215 drawing ${key}`);
    assert.ok(verifiedDimensions.includes(key), `ST3215 source coverage ${key}`);
  }
  for (const key of ['mountHoleDepth', 'fitClearance', 'hornArmLength', 'hornArmWidth'])
    assert.ok(
      !Object.hasOwn(preset.parameters, key),
      `${key} is fixed inside the model, not a configurable dimension`,
    );
  for (const angle of [0, 45]) {
    const p = { ...preset.parameters, showHorn: true, hornStyle: 'disc', outputAngle: angle };
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    const model = part.buildGeometry(p, 'assembled');
    try {
      model.updateMatrixWorld(true);
      assert.equal(model.children.length, 8, 'eight original STEP components');
      assert.ok(Math.abs(bounds(model).getSize(new Vector3()).z - 37.8) < 0.01);
      model.traverse((child) => {
        if (child instanceof Mesh) inspectMesh(child, `ST3215 discs ${angle}`);
      });
    } finally {
      disposeModel(model);
    }
  }
});
