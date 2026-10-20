import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Box3, Mesh, Vector3 } from 'three';
import { workshopJigIds } from '../scripts/workshop-jigs/manifest';
import { inspectPackage } from '../scripts/part-modules/library';
import { checkPackageDefinitions } from '../scripts/part-modules/check';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { PartDefinition, Parameters } from '../src/core/types';
import type { Shape, Vec } from '../src/core/assembly/boundary/shapes';

interface Model {
  pieces(p: Parameters): { id: string; shape: Shape; bought?: string }[];
  paths(p: Parameters): { origin: Vec; axis: Vec; diameter: number; length: number }[];
  layout(p: Parameters): Record<string, any>;
}
const entries = await Promise.all(
  workshopJigIds.map(async (id) => ({
    id,
    part: (await import(pathToFileURL(resolve('src/parts', id, 'part.ts')).href))
      .default as PartDefinition,
    model: (await import(pathToFileURL(resolve('src/parts', id, 'lib/model.ts')).href)) as Model,
  })),
);
const entry = (id: string) => entries.find((item) => item.id === id)!;

test('twelve independent workshop packages validate all 74 presets and declare their dependencies', async () => {
  const packages = await Promise.all(
    workshopJigIds.map((id) => inspectPackage(resolve('src/parts', id), resolve('.'))),
  );
  assert.deepEqual(await checkPackageDefinitions(packages), { parts: 12, presets: 74 });
  for (const { id, part } of entries) {
    assert.equal(part.category, 'WORKSHOP TOOLS', id);
    for (const p of [part.defaults, ...part.presets.map((preset) => preset.parameters)]) {
      for (const state of ['assembled', 'exploded'])
        assert.deepEqual(validateParameters(part, p, state), [], id);
      assert.ok(part.assessment!(p).length >= 2, id);
    }
  }
});

test('preview and native exports share physical component identities independently of inspection state', () => {
  for (const { id, part } of entries) {
    const p = part.defaults,
      composition = part.composition!(p);
    assert.ok(composition.components.length > 0, id);
    assert.ok(
      composition.components.every((item) =>
        ['manufactured-detail', 'purchased-component'].includes(item.libraryId),
      ),
      id,
    );
    assert.deepEqual(part.composition!(p), composition, id);
    const normal = part.python(p, 'assembled'),
      exploded = part.python(p, 'exploded');
    assert.match(normal, /component_labels/);
    assert.match(exploded, /component_labels/);
    assert.ok(
      composition.components.every((item) =>
        item.supply === 'purchased'
          ? !!item.procurement?.designation
          : !!item.manufacturing?.material,
      ),
      id,
    );
  }
});

for (const { id, part } of entries) {
  test(id + ' builds finite, nonempty preview meshes and correct measured bounds', () => {
    const model = part.buildGeometry(part.defaults, 'assembled');
    try {
      assert.equal(model.children.length, part.composition!(part.defaults).components.length);
      let meshes = 0;
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        meshes++;
        const positions = object.geometry.getAttribute('position');
        assert.ok(positions.count > 0);
        assert.ok(Array.from(positions.array).every(Number.isFinite));
      });
      assert.ok(meshes > 0);
      model.updateMatrixWorld(true);
      const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      const expected = part.dimensions(part.defaults, 'assembled');
      assert.ok(size.every((value, i) => value > 0 && Math.abs(value - expected[i]) < 0.001));
    } finally {
      disposeModel(model);
    }
  });
}

test('bolt-circle stations, rectangular pitch and row counts follow the configured datums', () => {
  const { part, model } = entry('drill-pattern-jig');
  for (const preset of part.presets) {
    const p = preset.parameters,
      d = model.layout(p);
    if (p.pattern === 'circle') {
      assert.equal(d.centers.length, p.count);
      assert.ok(
        d.centers.every(([x, y]: Vec) => Math.abs(Math.hypot(x, y) - Number(p.pcd) / 2) < 1e-9),
      );
    } else
      assert.equal(
        d.centers.length,
        p.pattern === 'grid' ? Number(p.rows) * Number(p.columns) : p.count,
      );
  }
  assert.match(
    validateParameters(part, { ...part.defaults, pcd: 15, count: 24 }, 'assembled').join(' '),
    /between stations/,
  );
});

test('router template compensates guide bush against cutter and rejects impossible radii', () => {
  const { part, model } = entry('router-template'),
    d = model.layout(part.defaults);
  assert.equal(d.offset, 5);
  assert.equal(d.L, 70);
  assert.equal(d.W, 22);
  assert.match(
    validateParameters(part, { ...part.defaults, follower: 6, cutter: 8 }, 'assembled').join(' '),
    /larger than cutter/,
  );
  assert.match(
    validateParameters(part, { ...part.defaults, opening: 'pocket', corner: 2 }, 'assembled').join(
      ' ',
    ),
    /corner radius/,
  );
});

test('slot drilling leaves separate full-size holes and positive finishing allowance', () => {
  const { part, model } = entry('chain-drill-slot-jig');
  for (const preset of part.presets) {
    const p = preset.parameters,
      d = model.layout(p);
    assert.ok(d.pitch >= Number(p.finalDrill) + 1 - 1e-9);
    assert.ok(Number(p.slotWidth) - Number(p.finalDrill) >= 1);
    assert.ok(d.count >= 2);
  }
});

test('fishmouth profile satisfies the intersection of the two outside cylinders at every sampled station', () => {
  const { part, model } = entry('tube-coping-template');
  for (const preset of part.presets) {
    const p = preset.parameters,
      d = model.layout(p);
    const raw = d.heights.map((_: number, i: number) => {
      const t = (i * 2 * Math.PI) / d.steps;
      return (
        (d.r * Math.cos(t) * Math.cos(d.a) +
          Math.sqrt(Math.max(0, d.R * d.R - d.r * d.r * Math.sin(t) ** 2))) /
        Math.sin(d.a)
      );
    });
    const min = Math.min(...raw);
    for (let i = 0; i < d.steps; i++) {
      const t = (i * 2 * Math.PI) / d.steps,
        x = d.r * Math.cos(t),
        y = d.r * Math.sin(t),
        z = d.heights[i] - Number(p.base) + min;
      assert.ok(Math.abs(y * y + (x * Math.cos(d.a) - z * Math.sin(d.a)) ** 2 - d.R * d.R) < 1e-7);
    }
  }
  assert.match(
    validateParameters(part, { ...part.defaults, mateOD: 20 }, 'assembled').join(' '),
    /at least as large/,
  );
});

test('operation-specific restrictions reject stock breakout, index collisions and insufficient stop clearance', () => {
  const dowel = entry('edge-dowel-jig').part;
  assert.match(
    validateParameters(
      dowel,
      { ...dowel.defaults, stockThickness: 10, drill: 3, bushOD: 24 },
      'assembled',
    ).join(' '),
    /bridge side/,
  );
  const vBlock = entry('v-block-drill-jig').part;
  assert.match(
    validateParameters(vBlock, { ...vBlock.defaults, bushOD: 24, endOffset: 10 }, 'assembled').join(
      ' ',
    ),
    /first-hole offset/,
  );
  assert.match(
    validateParameters(
      dowel,
      { ...dowel.defaults, stockThickness: 10, centerOffset: 4 },
      'assembled',
    ).join(' '),
    /edge distance/,
  );
  const index = entry('indexing-disc-jig').part;
  assert.match(
    validateParameters(index, { ...index.defaults, count: 48, pcd: 60 }, 'assembled').join(' '),
    /Adjacent locking holes/,
  );
  assert.match(
    validateParameters(index, { ...index.defaults, position: 12 }, 'assembled').join(' '),
    /less than the division count/,
  );
  const saw = entry('manual-miter-guide').part;
  assert.match(
    validateParameters(
      saw,
      { ...saw.defaults, stockWidth: 65, angle: 60, stopDistance: 20 },
      'assembled',
    ).join(' '),
    /stop beyond/,
  );
});
