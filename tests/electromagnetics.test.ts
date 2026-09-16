import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3, type Object3D } from 'three';
import { parts } from '../src/parts';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';

const ids = ['holding-electromagnet', 'tubular-solenoid', 'open-frame-solenoid'];
const electromagneticParts = parts.filter((part) => ids.includes(part.id));

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

const bounds = (object: Object3D) => new Box3().setFromObject(object, true);

test('electromagnetics is a discoverable section with complete prototype size choices', () => {
  assert.deepEqual(
    electromagneticParts.map((part) => part.id),
    ids,
  );
  for (const part of electromagneticParts) {
    assert.equal(part.category, 'MOTORS & ACTUATORS');
    assert.equal(part.subgroup, part.id === 'holding-electromagnet' ? 'HOLDING MAGNETS' : 'SOLENOIDS');
    assert.equal(part.icon, 'magnet');
    assert.ok(part.presets.length >= 4);
    for (const preset of part.presets) {
      assert.equal(
        preset.catalog,
        undefined,
        'Prototype dimensions must not claim supplier evidence',
      );
      assert.deepEqual(Object.keys(preset.parameters).sort(), Object.keys(part.defaults).sort());
    }
    const filters = { ...emptyPresetFilters(part), kind: 'examples' as const, query: part.name };
    const result = filterPresets(buildPresetIndex([part]), filters);
    assert.deepEqual(result.errors, []);
    assert.ok(result.items.length > 0, `${part.id}: discoverable preset examples`);
  }
});

test('all electromagnetic presets and display states have valid closed models and export envelopes', () => {
  for (const part of electromagneticParts) {
    for (const preset of [{ id: 'default', parameters: part.defaults }, ...part.presets]) {
      for (const state of part.states!) {
        const label = `${part.id}/${preset.id}/${state.id}`;
        assert.deepEqual(validateParameters(part, preset.parameters, state.id), [], label);
        const model = part.buildGeometry(preset.parameters, state.id);
        try {
          model.updateMatrixWorld(true);
          const actual = bounds(model).getSize(new Vector3()).toArray();
          part.dimensions(preset.parameters, state.id).forEach((expected, axis) => {
            assert.ok(Number.isFinite(expected) && expected > 0, label);
            assert.ok(Math.abs(actual[axis] - expected) < 0.05, `${label}: axis ${axis}`);
          });
          assert.ok(model.children.length > 0, label);
          assert.equal(new Set(model.children.map((c) => c.name)).size, model.children.length);
          model.traverse((child) => {
            if (child instanceof Mesh) checkMesh(child, `${label}/${child.name}`);
          });
          const script = generateScript(part, preset.parameters, state.id);
          assert.ok(script.includes('component_labels ='), `${label}: named FreeCAD components`);
          assert.ok(
            !script.includes('obj.CatalogSource ='),
            `${label}: no invented catalog source`,
          );
        } finally {
          disposeModel(model);
        }
      }
    }
  }
});

test('solenoid actuation moves one plunger exactly one stroke without shifting the housing', () => {
  for (const part of electromagneticParts.filter((p) => p.subgroup === 'SOLENOIDS')) {
    for (const preset of part.presets) {
      const extended = part.buildGeometry(preset.parameters, 'extended');
      const retracted = part.buildGeometry(preset.parameters, 'retracted');
      try {
        extended.updateMatrixWorld(true);
        retracted.updateMatrixWorld(true);
        assert.deepEqual(
          extended.children.map((c) => c.name),
          retracted.children.map((c) => c.name),
        );
        let moved = 0;
        extended.children.forEach((child, i) => {
          const a = bounds(child),
            b = bounds(retracted.children[i]);
          const movement = a.getCenter(new Vector3()).sub(b.getCenter(new Vector3()));
          if (movement.length() < 1e-5) return;
          moved++;
          assert.ok(Math.abs(movement.x) < 1e-5 && Math.abs(movement.y) < 1e-5);
          assert.ok(Math.abs(Math.abs(movement.z) - Number(preset.parameters.stroke)) < 1e-4);
          assert.ok(a.getSize(new Vector3()).distanceTo(b.getSize(new Vector3())) < 1e-4);
        });
        assert.equal(moved, 1, `${part.id}/${preset.id}: only the plunger moves`);
      } finally {
        disposeModel(extended);
        disposeModel(retracted);
      }
    }
  }
});

test('impossible electromagnetic walls, bores and strokes are rejected before CAD export', () => {
  const patches: Record<string, Parameters[]> = {
    'holding-electromagnet': [
      { wallThickness: 100 },
      { mountingBoreDepth: 100 },
      { poleDiameter: 200 },
    ],
    'tubular-solenoid': [{ wallThickness: 100 }, { stroke: 200 }, { plungerDiameter: 200 }],
    'open-frame-solenoid': [{ frameWall: 100 }, { stroke: 200 }, { coilDiameter: 200 }],
  };
  for (const part of electromagneticParts)
    for (const patch of patches[part.id as keyof typeof patches]) {
      const p = { ...part.defaults, ...patch };
      assert.ok(validateParameters(part, p, part.states![0].id).length > 0, part.id);
      assert.throws(() => generateScript(part, p, part.states![0].id));
    }
});
