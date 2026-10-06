import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import type { Parameters, PartDefinition } from '../src/core/types';
import { validateParameters } from '../src/core/validation';

function stateIds(part: PartDefinition): string[] {
  return part.states?.map((state) => state.id) ?? ['default'];
}

function dispose(group: THREE.Group): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material])
      material.dispose();
  });
}

function triangleIndices(geometry: THREE.BufferGeometry): number[] {
  const index = geometry.getIndex();
  return index
    ? Array.from(index.array)
    : Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i);
}

test('the catalog has unique part identifiers and parameter keys', () => {
  assert.ok(parts.length >= 27);
  assert.equal(new Set(parts.map((part) => part.id)).size, parts.length);
  for (const part of parts) {
    for (const field of part.parameters) {
      assert.ok(typeof field.key === 'string' && field.key.length > 0, `${part.id}: field key`);
      assert.ok(
        ['number', 'select', 'boolean'].includes(field.type),
        `${part.id}/${field.key}: field type`,
      );
    }
    assert.equal(
      new Set(part.parameters.map((field) => field.key)).size,
      part.parameters.length,
      part.id,
    );
    assert.equal(
      new Set(part.presets.map((preset) => preset.id)).size,
      part.presets.length,
      part.id,
    );
    assert.ok(part.category && part.subgroup && part.description, part.id);
  }
});

test('geometrically impossible parameter combinations are rejected', () => {
  const invalid: Record<string, Parameters> = {
    'ball-bearing': { bore: 22, outer: 22 },
    'roller-bearing': { bore: 47, outer: 47 },
    'rod-end-bearing': { bore: 22, outer: 22 },
    'linear-bearing': { bore: 15, outer: 15 },
    'thrust-bearing': { bore: 24, outer: 24 },
    'pillow-block-bearing': { bore: 56, outer: 56 },
    'bolt-screw': { diameter: 500 },
    'set-screw': { diameter: 500 },
    'hex-nut': { acrossFlats: 6, bore: 6 },
    washer: { outerDiameter: 6.4, bore: 6.4 },
    'compression-spring': { freeLength: 12 },
    'extension-spring': { bodyLength: 12 },
    'torsion-spring': { outerDiameter: 10, wireDiameter: 4 },
    enclosure: { width: 10, wall: 6 },
    'l-bracket': { holeDiameter: 20 },
    spacer: { bore: 8, outerDiameter: 8 },
    wheel: { bore: 18, hubDiameter: 18 },
  };
  for (const [id, patch] of Object.entries(invalid)) {
    const part = parts.find((item) => item.id === id);
    assert.ok(part, id);
    const values = { ...part.defaults, ...patch };
    assert.ok(validateParameters(part, values, stateIds(part)[0]).length > 0, id);
    assert.throws(() => generateScript(part, values, stateIds(part)[0]), id);
  }
});

test('spring states change the exported geometry and honor the requested travel', () => {
  for (const id of ['compression-spring', 'extension-spring', 'torsion-spring']) {
    const part = parts.find((item) => item.id === id);
    assert.ok(part);
    const [free, loaded] = stateIds(part);
    assert.ok(free && loaded);
    const original = part.dimensions(part.defaults, free);
    const changed = part.dimensions(part.defaults, loaded);
    assert.notDeepEqual(changed, original, id);
    assert.notEqual(part.python(part.defaults, free), part.python(part.defaults, loaded), id);
    if (id === 'compression-spring')
      assert.ok(Math.abs(original[2] - changed[2] - Number(part.defaults.compression)) < 0.05);
    if (id === 'extension-spring')
      assert.ok(Math.abs(changed[2] - original[2] - Number(part.defaults.extension)) < 0.05);
    assert.ok(validateParameters(part, part.defaults, 'unknown-state').length > 0, id);
  }
});

test('enclosure and wheel previews have one closed shell without internal assembly faces', () => {
  for (const id of ['enclosure', 'wheel']) {
    const part = parts.find((item) => item.id === id);
    assert.ok(part);
    const model = part.buildGeometry(part.defaults, 'default');
    try {
      const meshes: THREE.Mesh[] = [];
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      });
      assert.equal(meshes.length, 1, id);
      const geometry = meshes[0].geometry;
      const positions = geometry.getAttribute('position');
      const indices = triangleIndices(geometry);
      const edges = new Map<string, number>();
      let volume = 0;
      for (let i = 0; i < indices.length; i += 3) {
        const vertices = indices
          .slice(i, i + 3)
          .map((index) => new THREE.Vector3().fromBufferAttribute(positions, index));
        volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
        const keys = vertices.map((vertex) =>
          vertex
            .toArray()
            .map((value) => Math.round(value * 10000))
            .join(','),
        );
        for (let side = 0; side < 3; side++) {
          const edge = [keys[side], keys[(side + 1) % 3]].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      assert.ok(volume > 0, `${id}: outward triangle winding`);
      for (const [edge, count] of edges) assert.equal(count, 2, `${id}: shared edge ${edge}`);
      if (id === 'enclosure') {
        const { width, depth, height, wall } = part.defaults as Record<string, number>;
        const expected =
          width * depth * height - (width - 2 * wall) * (depth - 2 * wall) * (height - wall);
        assert.ok(
          Math.abs(volume - expected) / expected < 0.00001,
          'Open cavity has the expected wall and floor volume.',
        );
      }
    } finally {
      dispose(model);
    }
  }
});
