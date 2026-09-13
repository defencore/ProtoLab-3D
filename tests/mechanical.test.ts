import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import profileGuide from "../src/parts/linear-guide/part";
import roundGuide from "../src/parts/round-linear-guide/part";
import retainingRing from "../src/parts/retaining-ring/part";
import springPin from "../src/parts/spring-pin/part";
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';
import { profileCircuit, roundCircuit } from "../src/parts/linear-bearing/lib/parts/guide-circuits";
import type { Parameters } from '../src/core/types';

function shellVolume(mesh: THREE.Mesh): number {
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute('position');
  const index = geometry.getIndex();
  let volume = 0;
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const [a, b, c] = [i, i + 1, i + 2].map((j) =>
      new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(j) : j),
    );
    volume += a.dot(b.clone().cross(c)) / 6;
  }
  return volume;
}

for (const part of [profileGuide, roundGuide, retainingRing, springPin]) {
  test(`${part.id}: presets and states produce closed manifold components without collapsed triangles`, () => {
    const configurations = [part.defaults, ...part.presets.map((preset) => preset.parameters)];
    if (part === profileGuide || part === roundGuide)
      configurations.push({ ...part.defaults, position: 0 }, { ...part.defaults, position: 100 });
    if (part === retainingRing)
      configurations.push(
        { ...part.defaults, gapAngle: 80, earDiameter: 2, holeDiameter: 1 },
        { ...part.defaults, mounting: 'internal', gapAngle: 70, earDiameter: 2, holeDiameter: 1 },
      );
    for (const parameters of configurations)
      for (const state of part.states?.map((item) => item.id) ?? ['default']) {
        const label = `${part.id}/${state}/${JSON.stringify(parameters)}`;
        assert.deepEqual(validateParameters(part, parameters, state), [], label);
        const model = part.buildGeometry(parameters, state);
        try {
          const bounds = new THREE.Box3()
            .setFromObject(model)
            .getSize(new THREE.Vector3())
            .toArray();
          part
            .dimensions(parameters, state)
            .forEach((length, axis) => assert.ok(Math.abs(bounds[axis] - length) < 0.015, label));
          const meshes = model.children as THREE.Mesh[];
          if (part === profileGuide || part === roundGuide) {
            const railOnly = state === 'rail' || state === 'shaft';
            assert.ok(railOnly ? meshes.length === 1 : meshes.length > 20, label);
          } else assert.equal(meshes.length, 1, label);
          for (const mesh of meshes) {
            assert.ok(shellVolume(mesh) > 0, `${label}: outward winding`);
            const geometry = mesh.geometry,
              positions = geometry.getAttribute('position'),
              index = geometry.getIndex(),
              edges = new Map<string, number>();
            for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
              const vertices = [i, i + 1, i + 2].map((j) =>
                new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(j) : j),
              );
              assert.ok(
                vertices.every((vertex) => vertex.toArray().every(Number.isFinite)),
                label,
              );
              assert.ok(
                vertices[1]
                  .clone()
                  .sub(vertices[0])
                  .cross(vertices[2].clone().sub(vertices[0]))
                  .length() > 1e-9,
                `${label}: nondegenerate triangles`,
              );
              const keys = vertices.map((vertex) =>
                vertex
                  .toArray()
                  .map((value) => Math.round(value * 10000))
                  .join(','),
              );
              for (let side = 0; side < 3; side++) {
                const key = [keys[side], keys[(side + 1) % 3]].sort().join('|');
                edges.set(key, (edges.get(key) ?? 0) + 1);
              }
            }
            for (const [edge, count] of edges)
              assert.equal(count, 2, `${label}: shared edge ${edge}`);
          }
        } finally {
          disposeModel(model);
        }
      }
  });
}

test('guide preview volumes account for the shaft bore, blind holes, rail grooves and counterbores', () => {
  for (const part of [profileGuide, roundGuide]) {
    const p = part.defaults as Record<string, number>;
    const model = part.buildGeometry(p, 'assembled');
    try {
      let expected: number[];
      if (part === profileGuide) {
        const count = Math.floor((p.length - 2 * p.endOffset) / p.holePitch) + 1;
        const rail =
          p.length * p.railWidth * p.railHeight -
          Math.PI * (p.railWidth * 0.1) ** 2 * p.length -
          count *
            Math.PI *
            ((p.railHole / 2) ** 2 * (p.railHeight - p.counterDepth) +
              (p.counterbore / 2) ** 2 * p.counterDepth);
        const circuit = profileCircuit(p);
        const block =
          p.blockLength *
            (p.blockWidth * (p.totalHeight - p.baseClearance) -
              (p.railWidth + 2 * p.clearance) * (p.railHeight + p.clearance - p.baseClearance)) -
          4 * Math.PI * (p.blockHole / 2) ** 2 * p.holeDepth -
          2 * p.blockLength * (circuit.chamber - circuit.loaded) * (circuit.high - circuit.low);
        expected = [rail, block];
      } else {
        expected = [
          Math.PI * (p.shaftDiameter / 2) ** 2 * p.length,
          p.blockLength * p.blockWidth * p.blockHeight -
            Math.PI * (roundCircuit(p).outer + 0.05) ** 2 * p.blockLength -
            4 * Math.PI * (p.holeDiameter / 2) ** 2 * p.blockHeight,
        ];
      }
      (model.children.slice(0, 2) as THREE.Mesh[]).forEach((mesh, i) =>
        assert.ok(
          Math.abs(shellVolume(mesh) - expected[i]) / expected[i] < 0.002,
          `${part.id}: component ${i}`,
        ),
      );
    } finally {
      disposeModel(model);
    }
  }
});

test('rail reference presets use the published first-hole offsets', () => {
  assert.equal(profileGuide.defaults.endOffset, 10);
  assert.equal(
    profileGuide.presets.find((preset) => preset.id === 'mgn9c')!.parameters.endOffset,
    7.5,
  );
  assert.equal(
    profileGuide.presets.find((preset) => preset.id === 'mgn15h')!.parameters.endOffset,
    15,
  );
});

test('mechanical constraints reject open walls, intersecting holes and impossible installed pins', () => {
  const invalid: [typeof profileGuide, Parameters][] = [
    [profileGuide, { railWidth: 30, railHeight: 4 }],
    [profileGuide, { counterbore: 10 }],
    [profileGuide, { counterDepth: 8 }],
    [profileGuide, { blockPitchX: 5, blockHole: 6 }],
    [profileGuide, { holeDepth: 11 }],
    [profileGuide, { endOffset: 2 }],
    [roundGuide, { pitchX: 5, holeDiameter: 6 }],
    [roundGuide, { pitchY: 10 }],
    [retainingRing, { earDiameter: 9 }],
    [retainingRing, { holeDiameter: 3.8 }],
    [springPin, { wall: 2 }],
    [springPin, { length: 4, chamfer: 2 }],
    [springPin, { installedSlotAngle: 40 }],
  ];
  for (const [part, patch] of invalid) {
    const p = { ...part.defaults, ...patch },
      state = part.states?.[0].id ?? 'default';
    assert.ok(
      validateParameters(part, p, state).length > 0,
      `${part.id}: ${JSON.stringify(patch)}`,
    );
    assert.throws(() => generateScript(part, p, state));
  }
});
