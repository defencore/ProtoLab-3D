import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import screw from "../src/parts/ball-screw/part";
import nut from "../src/parts/ball-nut/part";
import {
  ballScrewBalls,
  ballScrewDefaults,
  ballScrewGeometry,
  ballScrewLayout,
  validateBallScrew,
} from "../src/parts/ball-screw/lib/parts/ball-screw-geometry";
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

function assertClosed(model: ReturnType<typeof ballScrewGeometry>): void {
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const position = child.geometry.getAttribute('position'),
      index = child.geometry.index,
      edges = new Map<string, number>();
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const keys = [0, 1, 2].map((offset) => {
        const j = index ? index.getX(i + offset) : i + offset;
        return [position.getX(j), position.getY(j), position.getZ(j)]
          .map((v) => Math.round(v * 1e5))
          .join(',');
      });
      for (let edge = 0; edge < 3; edge++) {
        if (keys[edge] === keys[(edge + 1) % 3]) continue;
        const key = [keys[edge], keys[(edge + 1) % 3]].sort().join('|');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.equal([...edges.values()].filter((count) => count !== 2).length, 0, child.name);
  });
}

test('every ball-screw and standalone-nut source preset validates in every display state', () => {
  for (const part of [screw, nut]) {
    assert.ok(part.presets.length >= 40);
    for (const preset of part.presets)
      for (const state of part.states!) {
        assert.deepEqual(
          validateParameters(part, preset.parameters, state.id),
          [],
          `${preset.id}/${state.id}`,
        );
      }
  }
});

test('nut travel follows lead and hand while the loaded ball train stays aligned with the rotating groove', () => {
  for (const hand of ['right', 'left']) {
    const a = { ...ballScrewDefaults, hand },
      b = { ...a, rotation: 135 },
      first = ballScrewLayout(a),
      second = ballScrewLayout(b),
      before = ballScrewBalls(a, first.center),
      after = ballScrewBalls(b, second.center);
    assert.ok(
      Math.abs(second.center - first.center - (first.hand * first.lead * 135) / 360) < 1e-10,
    );
    assert.equal(before.length, after.length);
    for (let i = 0; i < before.length; i++) assert.ok(before[i].distanceTo(after[i]) < 1e-10);
  }
});

test('cutaway raceways and double/internal-return nut solids remain closed', () => {
  const samples: Parameters[] = [
    { ...ballScrewDefaults },
    { ...ballScrewDefaults, family: 'SFE', lead: 10, starts: 2 },
    { ...ballScrewDefaults, family: 'DFI', nutLength: 80, flangeWidth: 48 },
    { ...ballScrewDefaults, family: 'SFY', flangeOffset: 10 },
    nut.presets.find((preset) => preset.id.startsWith('sfe3264'))!.parameters,
    nut.presets.find((preset) => preset.id.startsWith('sfk1004'))!.parameters,
  ];
  for (const p of samples)
    for (const state of ['assembled', 'cutaway']) {
      const model = ballScrewGeometry(p, state, true);
      try {
        assertClosed(model);
        const bounds = new Box3().setFromObject(model, true).getSize(new Vector3());
        assert.ok(
          Math.abs(bounds.z - Number(p.nutLength)) < 0.01,
          'Nut length includes all return covers.',
        );
        if (state === 'cutaway') {
          const housingBounds = new Box3().setFromObject(
            model.getObjectByName('Ball nut housing')!,
            true,
          );
          assert.ok(Math.abs(housingBounds.min.y - 0.001) < 0.0001);
        }
      } finally {
        disposeModel(model);
      }
    }
});

test('a 550 mm miniature screw retains its full raceway within a bounded preview mesh', () => {
  const p: Parameters = {
      ...ballScrewDefaults,
      shaftDiameter: 4,
      lead: 1,
      ballDiameter: 0.55,
      length: 550,
      endMachining: 'none',
    },
    model = ballScrewGeometry(p, 'screw');
  try {
    const mesh = model.children[0] as Mesh,
      bounds = new Box3().setFromObject(model, true).getSize(new Vector3());
    assert.ok(mesh.geometry.getAttribute('position').count < 400000);
    assert.ok(Math.abs(bounds.z - 550) < 1e-6);
    assert.ok(Math.abs(bounds.x - 4) < 0.01);
  } finally {
    disposeModel(model);
  }
});

test('impossible journal steps, travel and adjacent ball tracks produce actionable errors', () => {
  const samples: Parameters[] = [
    { ...ballScrewDefaults, lead: 3, starts: 2 },
    { ...ballScrewDefaults, length: 70 },
    { ...ballScrewDefaults, fixedJournalDiameter: 18 },
    { ...ballScrewDefaults, starts: 1.5 },
    { ...ballScrewDefaults, flangeOffset: 48 },
  ];
  for (const p of samples) assert.ok(validateBallScrew(p).length > 0);
});

test('native exports reject a missing or invalid component before assembling the result', () => {
  for (const module of [screw, nut]) {
    const python = module.python(ballScrewDefaults, 'cutaway');
    assert.match(python, /len\(component\.Solids\) != 1/);
    assert.match(python, /not component\.isValid\(\)/);
    assert.match(python, /not component\.Solids\[0\]\.isClosed\(\)/);
    assert.ok(python.indexOf('raise ValueError') < python.indexOf('shape = Part.makeCompound'));
  }
});
