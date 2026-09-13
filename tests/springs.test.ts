import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import compression from "../src/parts/compression-spring/part";
import extension from "../src/parts/extension-spring/part";
import torsion from "../src/parts/torsion-spring/part";
import doubleTorsion from "../src/parts/double-torsion-spring/part";
import spiral from "../src/parts/spiral-spring/part";
import { validateParameters } from '../src/core/validation';
import { hasWireCollision, v } from "../src/parts/compression-spring/lib/core/spring-geometry";
import type { Parameters, PartDefinition } from '../src/core/types';

const springs = [compression, extension, torsion, doubleTorsion, spiral];
function signature(part: PartDefinition, parameters: Parameters, state: string): string {
  const model = part.buildGeometry(parameters, state),
    hash = createHash('sha256');
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const values = child.geometry.getAttribute('position').array;
    hash.update(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material])
      material.dispose();
  });
  return hash.digest('hex');
}

for (const part of springs) {
  test(`${part.id}: all presets and states are finite and valid`, () => {
    for (const preset of [{ id: 'default', parameters: part.defaults }, ...part.presets]) {
      for (const state of part.states?.map((s) => s.id) ?? ['default']) {
        const label = `${part.id}/${preset.id}/${state}`;
        assert.deepEqual(validateParameters(part, preset.parameters, state), [], label);
        const model = part.buildGeometry(preset.parameters, state);
        const bounds = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).toArray();
        const dimensions = part.dimensions(preset.parameters, state);
        bounds.forEach((value, i) =>
          assert.ok(
            Number.isFinite(value) && value > 0 && Math.abs(value - dimensions[i]) < 0.05,
            label,
          ),
        );
        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          assert.ok(
            Array.from(child.geometry.getAttribute('position').array).every(Number.isFinite),
            label,
          );
          assert.ok(
            Array.from(child.geometry.getAttribute('normal').array).every(Number.isFinite),
            label,
          );
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        });
        assert.match(part.python(preset.parameters, state), /shape = /, label);
        assert.doesNotMatch(part.python(preset.parameters, state), /makeCompound/, label);
      }
    }
  });

  test(`${part.id}: every selectable variant changes preview and CAD geometry`, () => {
    for (const field of part.parameters.filter((p) => p.type === 'select')) {
      const hashes = new Set<string>(),
        scripts = new Set<string>();
      for (const option of field.options ?? []) {
        const values = { ...part.defaults, [field.key]: option.value };
        const state = part.states?.[0]?.id ?? 'default';
        assert.deepEqual(validateParameters(part, values, state), []);
        hashes.add(signature(part, values, state));
        scripts.add(part.python(values, state));
      }
      assert.equal(hashes.size, field.options?.length, `${part.id}/${field.key}: preview variants`);
      assert.equal(
        scripts.size,
        field.options?.length,
        `${part.id}/${field.key}: FreeCAD variants`,
      );
    }
  });
}

test('spring end dimensions and angular controls alter their intended geometry', () => {
  const variations: [PartDefinition, Parameters][] = [
    [extension, { eyeDiameter: 16 }],
    [extension, { endLength: 12 }],
    [extension, { endRotation: 90 }],
    [extension, { endA: 'hook', hookAngle: 160 }],
    [torsion, { legLengthA: 40 }],
    [torsion, { legLengthB: 40 }],
    [torsion, { legAngle: 180 }],
    [torsion, { legEndA: 'axial', bendAngle: 60 }],
    [doubleTorsion, { coilGap: 12 }],
    [doubleTorsion, { bridgeLength: 18 }],
    [spiral, { radialGap: 3 }],
    [spiral, { endAngle: 180 }],
  ];
  for (const [part, patch] of variations) {
    const state = part.states?.[0]?.id ?? 'default';
    assert.notEqual(
      signature(part, part.defaults, state),
      signature(part, { ...part.defaults, ...patch }, state),
      `${part.id}/${Object.keys(patch).join(',')}`,
    );
  }
});

test('spring validation rejects colliding coils, tight bends and undersized eyes', () => {
  const invalid: [PartDefinition, Parameters, string][] = [
    [compression, { freeLength: 12 }, 'relaxed'],
    [compression, { compression: 32 }, 'compressed'],
    [compression, { profile: 'conical', secondaryDiameter: 3 }, 'relaxed'],
    [extension, { eyeDiameter: 4 }, 'relaxed'],
    [extension, { endLength: 2 }, 'relaxed'],
    [extension, { bodyLength: 8 }, 'relaxed'],
    [torsion, { legEndA: 'inward', bendRadius: 1 }, 'relaxed'],
    [doubleTorsion, { coilGap: 4 }, 'relaxed'],
    [spiral, { innerDiameter: 2, stripThickness: 1 }, 'default'],
  ];
  for (const [part, patch, state] of invalid)
    assert.ok(
      validateParameters(part, { ...part.defaults, ...patch }, state).length,
      `${part.id}/${Object.keys(patch).join(',')}`,
    );
});

test('round-wire spring previews have closed end caps and consistent outward winding', () => {
  for (const part of springs.filter((p) => p.id !== 'spiral-spring')) {
    const model = part.buildGeometry(part.defaults, part.states![0].id);
    const mesh = model.children[0] as THREE.Mesh,
      geometry = mesh.geometry;
    const positions = geometry.getAttribute('position'),
      indices = geometry.getIndex()!.array;
    const edges = new Map<string, number>();
    let volume = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const vertices = [0, 1, 2].map((j) =>
        new THREE.Vector3().fromBufferAttribute(positions, indices[i + j]),
      );
      volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
      const keys = vertices.map((point) =>
        point
          .toArray()
          .map((value) => Math.round(value * 10000))
          .join(','),
      );
      for (let j = 0; j < 3; j++) {
        const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(volume > 0, part.id);
    assert.ok(
      [...edges.values()].every((count) => count === 2),
      `${part.id}: all shell edges shared twice`,
    );
    geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
});

test('wire clearance catches a returning tail without rejecting a straight wire', () => {
  assert.equal(hasWireCollision([v(0, 0, 0), v(20, 0, 0), v(20, 0, 5), v(0, 0, 0.5)], 1), true);
  assert.equal(hasWireCollision([v(0, 0, 0), v(20, 0, 0)], 1), false);
});
