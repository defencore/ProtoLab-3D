import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import type { Parameters } from '../src/core/types';
import hat from '../src/parts/bus-servo-driver/part';
import release from '../src/parts/rocket-release/part';
import { hatData } from '../src/parts/bus-servo-driver/lib/hat';
import copied from '../src/parts/rocket-release/lib/hat-native.json';
import { pieces } from '../src/parts/rocket-release/lib/model';
import { batteryLayout } from '../src/parts/rocket-release/lib/balance';
import { component } from '../src/parts/rocket-release/lib/shapes';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

test('HAT uses fixed official geometry in both independent packages', () => {
  assert.deepEqual(copied, hatData);
  assert.deepEqual(validateParameters(hat, hat.defaults, 'assembled'), []);
  const model = hat.buildGeometry(hat.defaults, 'assembled');
  const b = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
  hat.dimensions(hat.defaults, 'assembled').forEach((n, i) => assert.ok(Math.abs(n - b[i]) < 0.03));
  assert.equal(model.children.length, 361);
  assert.ok(hatData.radialEnvelope < 42.2);
  assert.deepEqual(hatData.mountingHoles, [
    [-24.5, -29],
    [24.5, -29],
    [-24.5, 29],
    [24.5, 29],
  ]);
  assert.ok(hat.python(hat.defaults, 'assembled').includes(hatData.sourceSha256));
  disposeModel(model);
});
test('Powered nose carries controller and a series pack with separate metal retention', () => {
  const p = release.presets.find((p) => p.id === 'nose-90-86-st3215')!.parameters;
  const items = pieces(p, 'open');
  assert.equal(items.filter((p) => p.label.startsWith('BUY Waveshare')).length, 1);
  assert.equal(items.filter((p) => p.label.startsWith('3S series tab')).length, 2);
  assert.equal(items.filter((p) => p.label.startsWith('3S frame tie to servo disk')).length, 4);
  assert.ok(
    !items.some((p) =>
      /18650 metal cage tie|18650 retaining lid|18650 insulating end cup/.test(p.label),
    ),
  );
  assert.equal(items.filter((p) => p.label.startsWith('3S common')).length, 3);
  assert.equal(items.filter((p) => p.label.startsWith('3S harness liner')).length, 4);
  assert.equal(items.filter((p) => p.label.startsWith('HAT common anti-flex carrier')).length, 1);
  assert.equal(items.filter((p) => p.label.startsWith('HAT compression limiter')).length, 4);
  assert.equal(items.filter((p) => p.label.startsWith('HAT insulating washer')).length, 8);
  assert.equal(items.filter((p) => p.label.startsWith('HAT anti-flex contact pad')).length, 2);
  assert.equal(items.filter((p) => p.label.startsWith('HAT clamped frame gasket')).length, 1);
  assert.ok(!items.some((p) => /HAT carrier nut|HAT anti-flex support screw/.test(p.label)));
  const after = pieces({ ...p, release: 100 }, 'open');
  for (const prefix of [
    'BUY Waveshare',
    '3S and HAT structural frame',
    '3S series tab B1',
    '3S common outer seat plate',
    '3S common servo-side seat plate',
    'HAT common anti-flex carrier',
    '18650 cell 2 · 3S1P',
  ]) {
    const a = items.find((i) => i.label.startsWith(prefix))!,
      b = after.find((i) => i.label === a.label)!;
    const x = component(a.shape, a.label, a.color),
      y = component(b.shape, b.label, b.color);
    const before = new Box3().setFromObject(x, true),
      next = new Box3().setFromObject(y, true);
    assert.ok(Math.abs(next.min.z - before.min.z - +p.separation) < 1e-5);
    disposeModel(x);
    disposeModel(y);
  }
  const terminalZ = (i: number, positive: boolean) => {
    const entry = items.find(
      (p) => p.label === `18650 cell ${i} · ${positive ? 'positive' : 'negative'} terminal`,
    )!;
    const model = component(entry.shape, entry.label, entry.color);
    const z = new Box3().setFromObject(model, true).getCenter(new Vector3()).z;
    disposeModel(model);
    return z;
  };
  assert.ok(terminalZ(1, true) < terminalZ(1, false));
  assert.ok(terminalZ(2, true) > terminalZ(2, false));
  assert.ok(terminalZ(3, true) < terminalZ(3, false));
  assert.ok(release.assessment!(p).some((t) => t.includes('12.6 V')));
  assert.ok(release.assessment!(p).some((t) => t.includes('not strength ratings')));
});
test('Mass balance includes an editable installed controller CG', () => {
  const p: Parameters = {
    ...release.presets.find((p) => p.id === 'nose-90-86-st3215')!.parameters,
    driverCgX: 1,
    driverCgY: -0.5,
  };
  const cells = batteryLayout(p);
  const sx =
    cells.reduce((s, [x]) => s + x * +p.cellMass, 0) +
    +p.servoMass * +p.servoCgX +
    +p.driverMass * +p.driverCgX;
  const sy =
    cells.reduce((s, [, y]) => s + y * +p.cellMass, 0) +
    +p.servoMass * +p.servoCgY +
    +p.driverMass * +p.driverCgY;
  assert.ok(Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9);
  const original = pieces(release.defaults, 'assembled');
  assert.ok(!original.some((p) => /HAT|18650/.test(p.label)));
});

test('Harness bores remain open and both common plates laterally capture every cell', async () => {
  const { Raycaster, Group } = await import('three');
  const { packSeatPlate, packWirePorts, wireLiner } =
    await import('../src/parts/rocket-release/lib/pack-support');
  const { noseSupport } = await import('../src/parts/rocket-release/lib/nose-support');
  const { electronicsPieces } = await import('../src/parts/rocket-release/lib/electronics');
  const p = release.presets.find((p) => p.id === 'nose-90-86-st3215')!.parameters;
  const seats = [false, true].map((upper) => component(packSeatPlate(p, upper), 'seat', 0xffffff));
  const extras = [
    noseSupport(p).find((p) => p.label.startsWith('3S and HAT'))!,
    electronicsPieces(p).find((p) => p.label.startsWith('HAT common'))!,
    { shape: packSeatPlate(p, true, true), label: 'backing', color: 0xffffff },
    ...packWirePorts.flatMap(([x, y]) => [
      { shape: wireLiner(x, y, 5, 5.5), label: 'liner', color: 0xffffff },
      { shape: wireLiner(x, y, 76.7, 5), label: 'liner', color: 0xffffff },
    ]),
  ];
  const all = new Group().add(...seats, ...extras.map((p) => component(p.shape, p.label, p.color)));
  all.updateMatrixWorld(true);
  const ray = new Raycaster();
  for (const [x, y] of packWirePorts)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ray.set(new Vector3(x + 2.8 * Math.cos(a), y + 2.8 * Math.sin(a), 0), new Vector3(0, 0, 1));
      assert.equal(
        ray.intersectObject(all, true).length,
        0,
        'Clear Ø5.6 harness corridor through all plates',
      );
    }
  for (const [index, seat] of seats.entries())
    for (const [x, y] of batteryLayout(p))
      for (let i = 0; i < 36; i++) {
        const a = (i * Math.PI) / 18;
        ray.set(new Vector3(x, y, index === 0 ? 13 : 73), new Vector3(Math.cos(a), Math.sin(a), 0));
        const hit = ray.intersectObject(seat, true)[0];
        assert.ok(
          hit && hit.distance > 9.45 && hit.distance < 9.55,
          'Continuous Ø19 lateral seat at both cell ends',
        );
      }
  disposeModel(all);
});

test('Printable cell seats preserve the geometry and independent metal retention', () => {
  const p = release.presets.find((p) => p.id === 'nose-90-86-st3215')!.parameters;
  const machined = pieces(p, 'open');
  const printed = pieces({ ...p, cellSeatMaterial: 'pa12' }, 'open');
  for (const prefix of ['3S common outer seat plate', '3S common servo-side seat plate']) {
    const before = machined.find((x) => x.label.startsWith(prefix))!;
    const after = printed.find((x) => x.label.startsWith(prefix))!;
    assert.match(after.label, /PRINT PA12/);
    assert.deepEqual(after.shape, before.shape);
  }
  assert.equal(printed.filter((x) => x.label.startsWith('3S frame tie to servo disk')).length, 4);
  assert.ok(printed.some((x) => x.label.startsWith('3S common seat backing plate')));
});
