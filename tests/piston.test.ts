import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import part from '../src/parts/piston/part';
import type { Parameters } from '../src/core/types';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { hasCatalogQuickSize, quickPickMatches } from '../src/core/quick-picks';
import module from '../src/parts/piston';
import { pistonValues, pistonComponents } from '../src/parts/piston/lib/piston';
import { assemblyBounds, componentBounds } from '../src/parts/piston/lib/solids';

test('compressor source verifies only nominal listing sizes and distinguishes running clearance', () => {
  const sourced = part.presets.filter((p) => p.catalog);
  assert.deepEqual(
    sourced.map((p) => p.parameters.nominalBore),
    [42, 47, 48, 51, 65, 70, 80, 90],
  );
  for (const preset of part.presets) {
    if (preset.catalog) {
      assert.deepEqual(preset.catalog.verifiedParameters, ['variant', 'nominalBore']);
      assert.equal(preset.catalog.sourceKind, 'attachment');
    }
    for (const state of part.states!)
      assert.deepEqual(
        validateParameters(part, preset.parameters, state.id),
        [],
        `${preset.id}/${state.id}`,
      );
  }
  assert.equal(pistonValues(part.defaults).radius * 2, 64.9);
  assert.equal(hasCatalogQuickSize(module.part, part.defaults), true);
  for (const variant of ['engine', 'pneumatic']) {
    assert.equal(hasCatalogQuickSize(module.part, { ...part.defaults, variant }), false);
    assert.equal(quickPickMatches(part.presets, { variant, nominalBore: '65' }).length, 0);
  }
});

test('all preset assemblies expose closed outward physical components with matching bounds', () => {
  for (const preset of part.presets) {
    const p = preset.parameters,
      components = pistonComponents(p, 'assembled'),
      model = part.buildGeometry(p, 'assembled');
    try {
      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model, true),
        size = bounds.getSize(new Vector3()).toArray();
      assert.ok(bounds.getCenter(new Vector3()).length() < 1e-4, preset.id);
      part
        .dimensions(p, 'assembled')
        .forEach((d, i) =>
          assert.ok(Math.abs(d - size[i]) < 0.01, `${preset.id} dimension ${i}: ${d}/${size[i]}`),
        );
      assert.deepEqual(
        model.children.map((c) => c.name),
        components.map((c) => c.name),
      );
      const overall = assemblyBounds(components),
        center = overall[0].map((v, i) => (v + overall[1][i]) / 2);
      model.children.forEach((child, i) => {
        const expected = componentBounds(components[i]),
          actual = new Box3().setFromObject(child, true);
        for (const [side, v] of [
          [0, actual.min],
          [1, actual.max],
        ] as const)
          v.toArray().forEach((x, j) =>
            assert.ok(
              Math.abs(x - (expected[side][j] - center[j])) < 0.01,
              `${preset.id}/${child.name} bounds`,
            ),
          );
        child.traverse((mesh) => {
          if (!(mesh instanceof Mesh)) return;
          const pos = mesh.geometry.getAttribute('position'),
            edges = new Map<string, number>();
          let volume = 0;
          for (let j = 0; j < pos.count; j += 3) {
            const vs = [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(pos, j + k));
            assert.ok(
              vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).lengthSq() > 1e-17,
              `${preset.id}/${child.name}: degenerate triangle`,
            );
            volume += vs[0].dot(vs[1].clone().cross(vs[2])) / 6;
            const keys = vs.map((v) =>
              v
                .toArray()
                .map((x) => Math.round(x * 1e5))
                .join(','),
            );
            for (let k = 0; k < 3; k++) {
              const key = [keys[k], keys[(k + 1) % 3]].sort().join('|');
              edges.set(key, (edges.get(key) ?? 0) + 1);
            }
          }
          assert.ok(volume > 0, `${preset.id}/${child.name}: inward mesh`);
          for (const [edge, uses] of edges)
            assert.equal(uses, 2, `${preset.id}/${child.name}: ${edge}`);
        });
      });
    } finally {
      disposeModel(model);
    }
  }
});

test('exploded and body views retain component labels and preview/export dimensions', () => {
  for (const preset of [part.presets[0], part.presets[8], part.presets[9]])
    for (const state of ['exploded', 'body']) {
      const components = pistonComponents(preset.parameters, state),
        model = part.buildGeometry(preset.parameters, state);
      try {
        const bounds = new Box3().setFromObject(model, true),
          size = bounds.getSize(new Vector3()).toArray();
        part
          .dimensions(preset.parameters, state)
          .forEach((d, i) => assert.ok(Math.abs(d - size[i]) < 0.01, `${preset.id}/${state}`));
        if (state === 'body') assert.equal(model.children.length, 1);
        const macro = part.python(preset.parameters, state);
        assert.ok(
          macro.includes(`component_labels = ${JSON.stringify(components.map((c) => c.name))}`),
        );
        assert.ok(macro.includes('len(item.Solids) != 1'));
      } finally {
        disposeModel(model);
      }
    }
});

test('hollow skirt has a continuous crown and pneumatic disks have a through rod bore', () => {
  const p = part.defaults,
    model = part.buildGeometry(p, 'body');
  try {
    model.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(0, 0, -100), new Vector3(0, 0, 1)),
      hits = ray.intersectObject(model, true);
    assert.ok(hits.length > 0);
    assert.ok(Math.abs(hits[0].point.z - (Number(p.height) / 2 - Number(p.crownThickness))) < 0.01);
  } finally {
    disposeModel(model);
  }
  const pneumatic = part.presets.find((p) => p.id === 'pneumatic-disk-32')!,
    disk = part.buildGeometry(pneumatic.parameters, 'body');
  try {
    disk.updateMatrixWorld(true);
    assert.equal(
      new Raycaster(new Vector3(0, 0, -100), new Vector3(0, 0, 1)).intersectObject(disk, true)
        .length,
      0,
    );
  } finally {
    disposeModel(disk);
  }
});

test('invalid groove walls, interrupted crowns and unsupported pins are rejected', () => {
  const changes: Parameters[] = [
    { grooveDepth: 3 },
    { grooveCount: 3.5 },
    { crown: 'dished', dishDepth: 5 },
    { pinLength: 64 },
    { pinInnerDiameter: 18 },
    { compressionHeight: 45 },
    { bossDepth: 30 },
    { groovePitch: 2 },
  ];
  for (const change of changes)
    assert.ok(
      validateParameters(part, { ...part.defaults, ...change }, 'assembled').length > 0,
      JSON.stringify(change),
    );
});

test('piston type transitions initialize coherent dimensions and seals remain engaged', () => {
  for (const preset of part.presets) {
    let p: Parameters = preset.parameters;
    for (const variant of ['pneumatic', 'engine', 'compressor']) {
      p = part.updateParameters!({ ...p, variant }, 'variant');
      assert.deepEqual(validateParameters(part, p, 'assembled'), [], `${preset.id} → ${variant}`);
      assert.equal(p.nominalBore, preset.parameters.nominalBore);
    }
  }
  for (const nominalBore of [20, 32, 50, 180, 200]) {
    let p: Parameters = { ...part.defaults, nominalBore };
    for (const variant of ['pneumatic', 'engine', 'compressor']) {
      p = part.updateParameters!({ ...p, variant }, 'variant');
      assert.deepEqual(validateParameters(part, p, 'assembled'), [], `${nominalBore} → ${variant}`);
    }
  }
  const pneumatic = part.presets.find((p) => p.id === 'pneumatic-disk-32')!.parameters;
  assert.ok(
    validateParameters(
      part,
      { ...pneumatic, grooveDepth: 0.4, ringRadialClearance: 1 },
      'assembled',
    ).some((error) => error.includes('engagement')),
  );
  assert.equal(
    part.parameters.find((p) => p.key === 'ringRadialClearance')!.visibleWhen,
    undefined,
  );
});
