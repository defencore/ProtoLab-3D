import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, MeshStandardMaterial, SRGBColorSpace, Vector3 } from 'three';
import part from '../src/parts/jaw-coupling/part';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

test('D25 L30 reference includes every unique visible bore pair without inventing internal dimensions', () => {
  const originals = part.presets.filter((p) => p.id.startsWith('hltnc-'));
  assert.equal(originals.length, 38);
  assert.equal(
    new Set(originals.map((p) => `${p.parameters.boreA}/${p.parameters.boreB}`)).size,
    38,
  );
  for (const preset of originals) {
    assert.deepEqual(validateParameters(part, preset.parameters, 'assembly'), []);
    assert.deepEqual(preset.catalog!.verifiedParameters, [
      'outerDiameter',
      'length',
      'boreA',
      'boreB',
    ]);
    assert.equal(preset.catalog!.sourceKind, 'attachment');
    assert.equal(preset.parameters.outerDiameter, 25);
    assert.equal(preset.parameters.length, 30);
  }
});

test('jaw coupling component states have closed outward meshes and independent bores at the size boundaries', () => {
  for (const [boreA, boreB] of [
    [5, 5],
    [14, 14],
    [5, 14],
    [12.7, 6.35],
  ]) {
    const p = { ...part.defaults, boreA, boreB };
    for (const state of part.states!) {
      const model = part.buildGeometry(p, state.id);
      try {
        const bounds = new Box3().setFromObject(model, true);
        assert.ok(bounds.getCenter(new Vector3()).length() < 1e-5);
        const dimensions = bounds.getSize(new Vector3()).toArray();
        part
          .dimensions(p, state.id)
          .forEach((d, i) => assert.ok(Math.abs(d - dimensions[i]) < 0.001));
        if (state.id === 'assembly')
          dimensions.forEach((d, i) => assert.ok(Math.abs(d - [25, 25, 30][i]) < 0.001));
        let meshes = 0;
        model.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          meshes++;
          const positions = child.geometry.getAttribute('position'),
            indices = child.geometry.getIndex();
          const edges = new Map<string, number>();
          let volume = 0;
          for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
            const vertices = [0, 1, 2].map((j) =>
              new Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j),
            );
            assert.ok(
              vertices[1]
                .clone()
                .sub(vertices[0])
                .cross(vertices[2].clone().sub(vertices[0]))
                .lengthSq() > 1e-18,
            );
            volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
            const keys = vertices.map((v) =>
              v
                .toArray()
                .map((x) => Math.round(x * 1e5))
                .join(','),
            );
            for (let j = 0; j < 3; j++) {
              const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
              edges.set(key, (edges.get(key) ?? 0) + 1);
            }
          }
          assert.ok(volume > 0);
          for (const [edge, uses] of edges)
            assert.equal(uses, 2, `${state.id} ${boreA}/${boreB}: ${edge}`);
        });
        assert.equal(meshes, state.id === 'spider' ? 1 : state.id.startsWith('hub-') ? 2 : 5);
      } finally {
        disposeModel(model);
      }
    }
  }
});

test('invalid couplings are rejected before the clamps or spider break into the shaft bore', () => {
  const changes: Parameters[] = [
    { boreA: 18 },
    { length: 15 },
    { jawDepth: 9 },
    { headDiameter: 8 },
    { slitWidth: 3 },
    { axialClearance: 2 },
  ];
  for (const change of changes)
    assert.ok(validateParameters(part, { ...part.defaults, ...change }, 'assembly').length > 0);
});

test('LF offers the exact Clamp and Thimble bore lists and independent Other hole orders', () => {
  const expected = {
    clamp: [
      '3-3',
      '3-4',
      '3-6.35',
      '4-4',
      '4-5',
      '4-6',
      '5-5',
      '5-6',
      '6.35-6.35',
      '6-6',
      '6-6.35',
      'other',
    ],
    thimble: [
      '3-3',
      '3-4',
      '3-6',
      '4-4',
      '4-5',
      '4-6.35',
      '4-8',
      '5-5',
      '5-8',
      '6.35-6.35',
      '6-6.35',
      '6-6',
      '6-7',
      '6-8',
      '7-7',
      '7-8',
      '8-8',
      'other',
    ],
  };
  const presets = part.presets.filter((row) => row.parameters.design === 'lf-d14-l22');
  assert.equal(presets.length, 30);
  for (const [fixing, options] of Object.entries(expected)) {
    assert.deepEqual(
      presets
        .filter((row) => row.parameters.fixing === fixing)
        .map((row) => row.parameters.boreOption),
      options,
    );
  }
  for (const preset of presets) {
    for (const state of part.states!)
      assert.deepEqual(validateParameters(part, preset.parameters, state.id), [], preset.id);
    assert.equal(preset.catalog!.sourceUrl, 'references/jaw-coupling/lf-d14-l22-drawing.png');
    const oversize =
      Math.max(Number(preset.parameters.boreA), Number(preset.parameters.boreB)) > 6.5;
    assert.equal(preset.catalog!.verifiedParameters.includes('outerDiameter'), !oversize);
    if (oversize) assert.match(preset.description, /provisional/);
    if (preset.parameters.boreOption === 'other') {
      assert.ok(!preset.catalog!.verifiedParameters.includes('boreA'));
      let p: Parameters = { ...preset.parameters, boreA: 3.5, boreB: 4.5 };
      p = part.updateParameters!(p, 'boreA');
      assert.equal(p.boreOption, 'other');
      assert.deepEqual(validateParameters(part, p, 'assembly'), []);
    }
  }
});

test('LF fastening and bore selectors update geometry inputs while Other hole exposes custom inputs', () => {
  let p = part.updateParameters!({ ...part.defaults, design: 'lf-d14-l22' }, 'design');
  assert.equal(p.outerDiameter, 14);
  assert.equal(p.length, 22);
  p = part.updateParameters!({ ...p, boreOption: '6-6.35' }, 'boreOption');
  assert.equal(p.boreA, 6);
  assert.equal(p.boreB, 6.35);
  const bore = part.parameters.find((f) => f.key === 'boreA')!;
  assert.equal(bore.visibleWhen!(p, 'assembly'), false);
  assert.equal(bore.visibleWhen!({ ...p, boreOption: 'other' }, 'assembly'), true);
  const hub = part.python(p, 'hub-a');
  const thimble = part.python({ ...p, fixing: 'thimble' }, 'hub-a');
  assert.match(hub, /hub = hub.cut\(Part.makeBox/);
  assert.doesNotMatch(thimble, /hub = hub.cut\(Part.makeBox/);
  assert.match(thimble, /Set-screw hub A/);
});

test('miniature two-jaw Clamp and Thimble have closed positive meshes and their declared envelopes', () => {
  for (const id of [
    'lf-d14-l22-clamp-3-3',
    'lf-d14-l22-clamp-6.35-6.35',
    'lf-d14-l22-thimble-3-3',
    'lf-d14-l22-thimble-8-8',
  ]) {
    const p = part.presets.find((row) => row.id === id)!.parameters;
    for (const state of part.states!) {
      const model = part.buildGeometry(p, state.id);
      try {
        const bounds = new Box3().setFromObject(model, true);
        const actual = bounds.getSize(new Vector3()).toArray();
        const expected = part.dimensions(p, state.id);
        expected.forEach((d, i) =>
          assert.ok(Math.abs(d - actual[i]) < 0.03, `${id}/${state.id}/${i}: ${d} vs ${actual[i]}`),
        );
        let count = 0;
        model.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          count++;
          const positions = child.geometry.getAttribute('position'),
            indices = child.geometry.getIndex();
          const edges = new Map<string, number>();
          let volume = 0;
          for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
            const v = [0, 1, 2].map((j) =>
              new Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j),
            );
            volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
            const keys = v.map((a) =>
              a
                .toArray()
                .map((x) => Math.round(x * 1e5))
                .join(','),
            );
            for (let j = 0; j < 3; j++) {
              const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
              edges.set(key, (edges.get(key) ?? 0) + 1);
            }
          }
          assert.ok(volume > 0, child.name);
          for (const [edge, uses] of edges)
            assert.equal(uses, 2, `${id}/${state.id}/${child.name}: ${edge}`);
        });
        assert.equal(count, state.id === 'spider' ? 1 : state.id.startsWith('hub-') ? 2 : 5);
      } finally {
        disposeModel(model);
      }
    }
  }
});

test('LF bore selector follows design and fastening without offering larger HLTNC bores', () => {
  const field = part.parameters.find((row) => row.key === 'boreOption')!;
  const available = (p: Parameters) =>
    field
      .options!.filter((option) => !option.availableWhen || option.availableWhen(p))
      .map((option) => option.value);
  const clamp = part.presets.find((row) => row.id === 'lf-d14-l22-clamp-3-3')!.parameters;
  const thimble = { ...clamp, fixing: 'thimble' };
  assert.equal(available(clamp).length, 12);
  assert.equal(available(thimble).length, 18);
  assert.equal(available(part.defaults).length, 39);
  for (const p of [clamp, thimble]) {
    assert.ok(available(p).includes('other'));
    assert.ok(!available(p).includes('10-10'));
    assert.ok(!available(p).includes('14-14'));
    assert.deepEqual(validateParameters(part, { ...p, boreOption: '10-10' }, 'assembly'), [
      'Choose a valid bore pair.',
    ]);
  }
  assert.ok(!available(clamp).includes('5-8'));
  assert.ok(available(thimble).includes('5-8'));
  assert.ok(!available(part.defaults).includes('3-3'));
  for (const preset of part.presets)
    assert.ok(
      available(preset.parameters).includes(String(preset.parameters.boreOption)),
      preset.id,
    );
});

test('LF fastening changes initialize the matching screw hardware and retain independent bores', () => {
  const clamp = part.presets.find((row) => row.id === 'lf-d14-l22-clamp-3-4')!;
  const thimble = part.presets.find((row) => row.id === 'lf-d14-l22-thimble-3-4')!;
  const selected = part.updateParameters!({ ...clamp.parameters, fixing: 'thimble' }, 'fixing');
  assert.deepEqual(selected, thimble.parameters);
  assert.deepEqual(
    part.updateParameters!({ ...selected, fixing: 'clamp' }, 'fixing'),
    clamp.parameters,
  );
  const unsupported = part.presets.find((row) => row.id === 'lf-d14-l22-thimble-5-8')!;
  const custom = part.updateParameters!({ ...unsupported.parameters, fixing: 'clamp' }, 'fixing');
  assert.equal(custom.boreOption, 'other');
  assert.equal(custom.boreA, 5);
  assert.equal(custom.boreB, 8);
  assert.equal(custom.screwDiameter, 2);
  assert.equal(custom.headDiameter, 3.3);
});

test('exported coupling colors match the rendered sRGB materials in every state and construction', () => {
  const configurations = [
    part.presets.find((preset) => preset.parameters.design === 'hltnc-d25-l30')!,
    ...['clamp', 'thimble'].map((fixing) =>
      part.presets.find(
        (preset) =>
          preset.parameters.design === 'lf-d14-l22' && preset.parameters.fixing === fixing,
      )!,
    ),
  ];
  for (const preset of configurations)
    for (const state of part.states!) {
      const exported: number[][] = [];
      for (const line of part.python(preset.parameters, state.id).split('\n')) {
        const match = /^component_colors\.(extend|append)\((.+)\)$/.exec(line);
        if (!match) continue;
        const values = JSON.parse(match[2].replaceAll('(', '[').replaceAll(')', ']'));
        if (match[1] === 'extend') exported.push(...values);
        else exported.push(values);
      }
      const model = part.buildGeometry(preset.parameters, state.id);
      try {
        const rendered: number[][] = [];
        model.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          const material = child.material as MeshStandardMaterial;
          const hex = material.color.getHex(SRGBColorSpace);
          rendered.push([16, 8, 0].map((shift) => ((hex >> shift) & 255) / 255));
        });
        const label = `${preset.id}/${state.id}`;
        assert.ok(rendered.length > 0, label);
        assert.deepEqual(exported, rendered, label);
      } finally {
        disposeModel(model);
      }
    }
});
