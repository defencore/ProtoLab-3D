import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { parts } from '../../src/parts';
import { consoleCommand, generateScript } from '../../src/core/freecad';
import type { PartDefinition } from '../../src/core/types';
import { validateParameters } from '../../src/core/validation';
import { geometrySamples } from '../catalog-samples';

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

export const catalogShardCount = 8;

/** Split the unchanged per-part contracts into independent test processes. */
export function registerPartContractTests(shard: number) {
  assert.ok(Number.isInteger(shard) && shard >= 0 && shard < catalogShardCount);
  for (const part of parts.filter((_, index) => index % catalogShardCount === shard)) {
    test(`${part.name}: every preset validates in every state`, () => {
      for (const preset of part.presets)
        for (const state of stateIds(part))
          assert.deepEqual(
            validateParameters(part, preset.parameters, state),
            [],
            `${part.id}/${preset.id}/${state}`,
          );
    });
    test(`${part.name}: every shape variant and stock size boundary has matching dimensions`, () => {
      for (const preset of geometrySamples(part)) {
        for (const state of stateIds(part)) {
          const label = `${part.id}/${preset.id}/${state}`;
          assert.deepEqual(validateParameters(part, preset.parameters, state), [], label);
          const model = part.buildGeometry(preset.parameters, state);
          try {
            // Transform vertices directly: rotated roller bounding boxes overestimate the solid envelope.
            const bounds = new THREE.Box3().setFromObject(model, true);
            assert.ok(!bounds.isEmpty(), label);
            const actual = bounds.getSize(new THREE.Vector3()).toArray();
            const dimensions = part.dimensions(preset.parameters, state);
            assert.ok(
              dimensions.every((value) => Number.isFinite(value) && value > 0),
              label,
            );
            for (let axis = 0; axis < 3; axis++) {
              assert.ok(Number.isFinite(actual[axis]) && actual[axis] > 0, label);
              // Helical end profiles and tessellated circles differ slightly from nominal envelopes.
              assert.ok(
                Math.abs(actual[axis] - dimensions[axis]) <=
                  Math.max(0.05, dimensions[axis] * 0.01),
                `${label}: axis ${axis} preview ${actual[axis]}, declared ${dimensions[axis]}`,
              );
            }
            let meshes = 0;
            model.traverse((child) => {
              if (!(child instanceof THREE.Mesh)) return;
              meshes++;
              for (const attribute of ['position', 'normal']) {
                const values = child.geometry.getAttribute(attribute);
                assert.ok(values && values.count > 0, `${label}: ${attribute}`);
                assert.ok(
                  Array.from(values.array).every(Number.isFinite),
                  `${label}: finite ${attribute}`,
                );
              }
            });
            assert.ok(meshes > 0, label);
          } finally {
            dispose(model);
          }
        }
      }
    });

    test(`${part.name}: binary STL contains complete, finite triangle records`, () => {
      for (const state of stateIds(part)) {
        const model = part.buildGeometry(part.defaults, state);
        try {
          model.updateMatrixWorld(true);
          let expectedTriangles = 0;
          model.traverse((child) => {
            if (child instanceof THREE.Mesh)
              expectedTriangles +=
                (child.geometry.getIndex()?.count ??
                  child.geometry.getAttribute('position').count) / 3;
          });
          const stl = new STLExporter().parse(model, { binary: true });
          const triangleCount = stl.getUint32(80, true);
          assert.ok(triangleCount > 0);
          assert.equal(triangleCount, expectedTriangles);
          assert.equal(stl.byteLength, 84 + 50 * triangleCount);
          for (let triangle = 0; triangle < triangleCount; triangle++) {
            for (let component = 0; component < 12; component++) {
              assert.ok(
                Number.isFinite(stl.getFloat32(84 + triangle * 50 + component * 4, true)),
                `${part.id}/${state}: triangle ${triangle}`,
              );
            }
          }
        } finally {
          dispose(model);
        }
      }
    });

    test(`${part.name}: console command preserves the complete FreeCAD macro`, () => {
      for (const preset of geometrySamples(part)) {
        for (const state of stateIds(part)) {
          const script = generateScript(part, preset.parameters, state);
          assert.match(script, /import FreeCAD as App/);
          assert.match(script, /doc\.openTransaction\(/);
          assert.match(script, /doc\.abortTransaction\(\)/);
          assert.match(script, /obj\.Shape = shape/);
          assert.match(script, /shape\.isValid\(\)/);
          assert.ok(
            script.includes(
              part
                .python(preset.parameters, state)
                .split('\n')
                .map((line) => `        ${line}`)
                .join('\n'),
            ),
          );
          const command = consoleCommand(script);
          assert.ok(command.startsWith('exec(') && command.endsWith(')'));
          assert.ok(!command.includes('\n'), 'Console payload must be one line.');
          assert.equal(JSON.parse(command.slice(5, -1)), script);
        }
      }
    });

    test(`${part.name}: invalid parameter inputs cannot generate a CAD macro`, () => {
      const state = stateIds(part)[0];
      const active = part.parameters.filter(
        (parameter) => !parameter.visibleWhen || parameter.visibleWhen(part.defaults, state),
      );
      const field =
        active.find((parameter) => parameter.type === 'number') ??
        active.find((parameter) => parameter.type === 'select');
      assert.ok(field);
      const badValues =
        field.type === 'number'
          ? [NaN, Infinity, -Infinity, '12', (field.min ?? 0) - 1]
          : [NaN, Infinity, -Infinity, '__unsupported_catalog_option__', false];
      for (const badValue of badValues) {
        const values = { ...part.defaults, [field.key]: badValue };
        assert.ok(validateParameters(part, values, state).length > 0);
        assert.throws(() => generateScript(part, values, state));
      }
      const missing = { ...part.defaults };
      delete missing[field.key];
      assert.ok(validateParameters(part, missing, state).length > 0);
    });
  }
}
