import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import guide from '../src/parts/hiwin-profile-guide/part';
import tbi from '../src/parts/tbi-ball-screw/part';
import stepper from '../src/parts/stepper-motor/part';
import {
  guideModel,
  railHoles,
  carriageHoles,
  guideLayout,
} from '../src/parts/hiwin-profile-guide/lib/model';
import { screwModel, mountAngles, nutMountingHoles } from '../src/parts/tbi-ball-screw/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { matchesCatalogFilters } from '../src/core/catalog-models';
import { withGeometryMode } from '../src/core/geometry-mode';

test('source families expose 30 HIWIN guides and 19 distinct TBI nuts without rescaling interfaces', () => {
  assert.equal(guide.presets.length, 30);
  assert.equal(tbi.presets.length, 19);
  for (const part of [guide, tbi])
    for (const preset of part.presets) {
      assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), [], preset.id);
      assert.deepEqual(preset.catalog!.verifiedParameters, ['model']);
      assert.equal(preset.catalog!.geometryEvidence!.kind, 'source-dimensions');
      assert.ok(preset.catalog!.sourceUrl.startsWith('https:'));
    }
  const a = screwModel({ ...tbi.defaults, model: 'sfnu01605-4' }),
    b = screwModel({ ...tbi.defaults, model: 'sfb01605-3.8' });
  assert.deepEqual(
    [a.diameter, a.lead, a.nutLength, b.diameter, b.lead, b.nutLength],
    [16, 5, 45, 16, 5, 31],
  );
  const conventional = guideModel({ ...guide.defaults, model: 'mgn12h' });
  assert.deepEqual(
    [
      conventional.height,
      conventional.bodyLength,
      conventional.blockLength,
      conventional.threadDepth,
    ],
    [13, 32.4, 45.4, 3.5],
  );
});

test('industrial nominal size and actual rail width remain separate; MGW15 has two mounting rows', () => {
  for (const [model, width] of [
    ['hgh25ca', 23],
    ['hgh30ca', 28],
  ] as const)
    assert.equal(guideModel({ ...guide.defaults, model }).railWidth, width);
  const p = { ...guide.defaults, model: 'mgw15h', length: 400 };
  const holes = railHoles(p),
    v = guideLayout(p);
  assert.equal(holes.length, 2 * v.holes);
  assert.deepEqual([...new Set(holes.map((h) => h[1]))], [-11.5, 11.5]);
  assert.ok(Math.abs(holes[0][0] + holes[holes.length - 1][0]) < 1e-8);
  assert.equal(holes[2][0] - holes[0][0], 40);
});

test('TBI four-hole SFB pattern is 45 degrees and differs from the generic 30 degree pattern', () => {
  const p = { ...tbi.defaults, model: 'sfb01205-2.8' };
  assert.deepEqual(mountAngles(p), [45, 135, 225, 315]);
  const [x, y] = nutMountingHoles(p)[0];
  assert.ok(Math.abs(x - y) < 1e-9);
  assert.ok(Math.abs(Math.hypot(x, y) - 16) < 1e-9);
  assert.deepEqual(mountAngles({ ...p, model: 'sfnu01605-4' }), [45, 90, 135, 225, 270, 315]);
});

test('dimension filters select real gauge models and exclude incompatible widths and leads', () => {
  const guideMatches = guide.presets.filter((p) =>
    matchesCatalogFilters(p, guide.catalogFilterFields!, {
      series: { value: 'HGH' },
      railWidth: { min: '20', max: '20' },
    }),
  );
  assert.deepEqual(
    guideMatches.map((p) => p.id),
    ['hgh20ca', 'hgh20ha'],
  );
  const screws = tbi.presets.filter((p) =>
    matchesCatalogFilters(p, tbi.catalogFilterFields!, {
      diameter: { min: '16', max: '16' },
      lead: { min: '5', max: '5' },
    }),
  );
  assert.deepEqual(
    screws.map((p) => p.id),
    ['sfnu01605-4', 'sfb01605-3.8'],
  );
});

test('all source guide and screw models have finite solid previews with correct physical-state bounds', () => {
  for (const part of [guide, tbi])
    for (const preset of part.presets)
      for (const state of part.states!) {
        const g = withGeometryMode('simple', () => part.buildGeometry(preset.parameters, state.id));
        try {
          const size = new Box3().setFromObject(g, true).getSize(new Vector3()).toArray();
          part
            .dimensions(preset.parameters, state.id)
            .forEach((v, i) =>
              assert.ok(
                Math.abs(v - size[i]) < 0.02,
                `${preset.id}/${state.id}/${i}: ${size[i]} vs ${v}`,
              ),
            );
          assert.ok(g.children.length);
          g.traverse((o) => {
            if (o instanceof Mesh)
              assert.ok(
                Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite),
                o.name,
              );
          });
        } finally {
          disposeModel(g);
        }
      }
});

test('source holes are actual voids, with correct rail counterbore shoulders and blind carriage depths', () => {
  for (const model of ['mgn7h', 'mgn12h', 'mgw15h', 'hgh20ca', 'hgw25cc']) {
    const p = { ...guide.defaults, model },
      m = guideModel(p),
      rail = guide.buildGeometry(p, 'rail'),
      block = guide.buildGeometry(p, 'carriage');
    rail.updateMatrixWorld(true);
    block.updateMatrixWorld(true);
    try {
      const [x, y] = railHoles(p)[0];
      assert.equal(
        new Raycaster(new Vector3(x, y, m.railHeight + 10), new Vector3(0, 0, -1)).intersectObject(
          rail,
          true,
        ).length,
        0,
        model + ' through bore',
      );
      const shoulder = new Raycaster(
        new Vector3(x + m.railHole / 2 + 0.2, y, m.railHeight + 10),
        new Vector3(0, 0, -1),
      ).intersectObject(rail, true);
      assert.ok(shoulder.length);
      assert.ok(
        Math.abs(shoulder[0].point.z - (m.railHeight - m.counterDepth)) < 0.01,
        model + ' counterbore',
      );
      const [hx, hy, hz] = carriageHoles(p)[0],
        hits = new Raycaster(new Vector3(hx, hy, hz + 10), new Vector3(0, 0, -1)).intersectObject(
          block,
          true,
        );
      if (!m.flangeThickness) {
        assert.ok(hits.length);
        assert.ok(Math.abs(hits[0].point.z - (hz - m.threadDepth)) < 0.01, model + ' thread depth');
      } else assert.equal(hits.length, 0, model + ' through flange');
    } finally {
      disposeModel(rail);
      disposeModel(block);
    }
  }
});

test('cut length, block count, spacing and travel are independent configuration inputs with collision validation', () => {
  const p = { ...guide.defaults, blockCount: 2, blockSpacing: 140, length: 600 };
  assert.deepEqual(validateParameters(guide, p, 'assembled'), []);
  const v = guideLayout(p);
  assert.equal(v.span, 77.5 + 140);
  assert.equal(v.holes, 10);
  for (const changed of [{ blockCount: 1.5 }, { length: 100 }, { blockSpacing: 50 }])
    assert.ok(validateParameters(guide, { ...p, ...changed }, 'assembled').length);
  assert.ok(
    validateParameters(tbi, { ...tbi.defaults, model: 'sfnu03210-4', length: 100 }, 'assembled')
      .length,
  );
  assert.ok(validateParameters(tbi, { ...tbi.defaults, model: 'unknown' }, 'assembled').length);
  assert.ok(validateParameters(guide, { ...guide.defaults, model: 'unknown' }, 'assembled').length);
});

test('new motors retain exact source revisions, dimensional variants and unknown mass', () => {
  assert.equal(stepper.presets.length, 14);
  const small = stepper.presets.find((p) => p.id === '17hs15-1504s1')!,
    long = stepper.presets.find((p) => p.id === '17hs24-2104s')!,
    nema23 = stepper.presets.find((p) => p.id === '23hs22-2804s')!;
  assert.deepEqual([small.catalog!.attributes!.length, long.catalog!.attributes!.length], [39, 60]);
  assert.equal(long.catalog!.attributes!.torque, 0.76);
  assert.deepEqual(
    [
      nema23.catalog!.attributes!.width,
      nema23.catalog!.attributes!.shaft,
      nema23.catalog!.attributes!.mountHole,
    ],
    [57.3, 6.35, 5.2],
  );
  assert.equal(nema23.catalog!.attributes!.weight, undefined);
  assert.equal(
    stepper.presets.find((p) => p.id === '23hp45-4204s')!.catalog!.attributes!.shaft,
    10,
  );
});

test('changing a source model preserves cut length and layout instead of silently resetting the order', async () => {
  const { parametersForPreset } = await import('../src/core/part-selection');
  const current = {
    ...guide.defaults,
    length: 750,
    blockCount: 2,
    blockSpacing: 180,
    position: 65,
  };
  const preset = guide.presets.find((p) => p.id === 'hgh25ha')!;
  const next = parametersForPreset(guide, preset, current);
  assert.deepEqual(next, { ...current, model: 'hgh25ha' });
  assert.deepEqual(validateParameters(guide, next, 'assembled'), []);
  assert.equal(guideModel(next).railWidth, 23);
  assert.deepEqual(
    parametersForPreset(guide, preset),
    preset.parameters,
    'entering a different family uses its complete preset',
  );
  const tooShort = parametersForPreset(guide, preset, { ...current, length: 200 });
  assert.equal(tooShort.length, 200);
  assert.ok(
    validateParameters(guide, tooShort, 'assembled').length,
    'incompatible orders stay visible for correction',
  );
  const motor = stepper.presets.find((p) => p.id === '23hp45-4204s')!;
  assert.equal(
    parametersForPreset(stepper, motor, { ...stepper.defaults, outputAngle: 90 }).outputAngle,
    90,
  );
});

test('bare source motor bounds exclude an undimensioned cable outlet by default', () => {
  const p = { ...stepper.defaults, model: '23hs22-2804s' };
  stepper
    .dimensions(p, 'assembled')
    .forEach((v, i) => assert.ok(Math.abs(v - [57.3, 57.3, 77][i]) < 0.002));
  const model = stepper.buildGeometry(p, 'assembled');
  try {
    assert.ok(!model.children.some((c) => c.name === 'Cable outlet'));
  } finally {
    disposeModel(model);
  }
});

test('exploded encoder execution separates the rear cover from the encoder housing', () => {
  const group = stepper.buildGeometry(
    { ...stepper.defaults, model: '23hs30-2804-me1k' },
    'exploded',
  );
  try {
    group.updateMatrixWorld(true);
    const rear = group.children.find((c) => c.name === 'Rear end cover')!;
    const encoder = group.children.find(
      (c) => c.name === '1000 ppr rear encoder cover · mounting envelope',
    )!;
    assert.ok(
      new Box3().setFromObject(encoder, true).max.z < new Box3().setFromObject(rear, true).min.z,
    );
  } finally {
    disposeModel(group);
  }
});
