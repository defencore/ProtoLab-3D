import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Euler, Matrix4, Vector3 } from 'three';
import quad, { quadPieces, quadFramePieces } from '../src/parts/tr8-quad-mini-actuator/part';
import released, { quadPieces as releasedPieces } from '../src/parts/tr8-quad-actuator/part';
import { frameLayout as releasedLayout } from '../src/parts/tr8-quad-actuator/lib/layout';
import single from '../src/parts/tr8-compact-actuator/part';
import { channels, packing, placePiece } from '../src/parts/tr8-quad-mini-actuator/lib/placement';
import { mechanismPieces } from '../src/parts/tr8-quad-mini-actuator/lib/mechanism';
import {
  bearingCheeks,
  bearingCheekSlots,
} from '../src/parts/tr8-quad-mini-actuator/lib/bearing-cheeks';
import profiles from '../src/parts/tr8-quad-mini-actuator/lib/laser-profiles.json';
import {
  sharedPlateProfileSource,
  sharedPlates,
} from '../src/parts/tr8-quad-mini-actuator/lib/shared-plates';
import {
  frameColumnPieces,
  columnStages,
  plateStations,
} from '../src/parts/tr8-quad-mini-actuator/lib/columns';
import standoff from '../src/parts/pcb-standoff/part';

const close = (a: number, b: number, tolerance = 1e-8) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function matrix(placement: { translation: number[]; rotation: number[] }) {
  return new Matrix4()
    .makeRotationFromEuler(
      new Euler(
        ...(placement.rotation.map((a) => (a * Math.PI) / 180) as [number, number, number]),
        'ZYX',
      ),
    )
    .setPosition(...(placement.translation as [number, number, number]));
}

test('mini quad commands independently move only their own channel and keep a unique shared frame', () => {
  const releasedBefore = releasedPieces(released.defaults);
  assert.equal(quad.id, 'tr8-quad-mini-actuator');
  assert.equal(released.id, 'tr8-quad-actuator');
  assert.equal(releasedLayout.discDiameter, 82);
  assert.ok(packing.discDiameter < releasedLayout.discDiameter);
  const neutral = quadPieces(quad.defaults);
  const mixed = quadPieces({ ...quad.defaults, angleA: -20, angleB: 20, angleC: -10, angleD: 10 });
  assert.equal(new Set(neutral.map((p) => p.component.id)).size, neutral.length);
  for (const letter of ['a', 'b', 'c', 'd']) {
    assert.equal(neutral.filter((p) => p.component.id.startsWith(letter + '-')).length, 32);
    const nut = neutral.find((p) => p.component.id === letter + '-lead-nut')!.component;
    const moved = mixed.find((p) => p.component.id === nut.id)!.component;
    assert.notDeepEqual(moved.placement.translation, nut.placement.translation);
    assert.equal(nut.supply, 'purchased');
    assert.equal(nut.procurement?.designation, 'TR8×8(P2) RH H-flange nut · 22×11×15');
  }
  const frame = quadFramePieces();
  assert.deepEqual(
    mixed.filter((p) => !/^[abcd]-/.test(p.component.id)),
    frame,
  );
  const onlyB = quadPieces({ ...quad.defaults, angleB: 13 });
  assert.deepEqual(
    onlyB.filter((p) => !p.component.id.startsWith('b-')),
    neutral.filter((p) => !p.component.id.startsWith('b-')),
  );
  assert.ok(quad.validate({ ...quad.defaults, angleC: 20.1 }, 'assembled').length);
  assert.deepEqual(quad.validate(quad.defaults, 'assembled'), []);
  assert.deepEqual(single.defaults.outputAngle, 0);
  assert.deepEqual(releasedPieces(released.defaults), releasedBefore);
});

test('four radial output axes form an X through the disc centre at one axial station', () => {
  const mounted = channels({ ...quad.defaults, angleA: -20, angleB: 7, angleC: 20, angleD: -3 });
  const outputDirections: Vector3[] = [];
  assert.deepEqual(
    mounted.map((c) => c.clock),
    [45, 135, 225, 315],
  );
  assert.ok(mounted.every((c) => c.origin[0] === 0));
  for (const channel of mounted) {
    const source = mechanismPieces(quad.defaults, channel.angle);
    const local = source.find((p) => p.component.id === 'output-shaft')!;
    const actual = placePiece(local, channel);
    const outer = new Matrix4()
      .makeRotationX((channel.clock * Math.PI) / 180)
      .setPosition(...channel.origin);
    const expected = outer.multiply(matrix(local.component.placement));
    const observed = matrix(actual.component.placement);
    expected.elements.forEach((v, i) => close(v, observed.elements[i]));
    const axis = new Vector3(0, 1, 0).applyAxisAngle(
      new Vector3(1, 0, 0),
      (channel.clock * Math.PI) / 180,
    );
    const radial = new Vector3(0, channel.origin[1], channel.origin[2]);
    close(radial.length(), 20.25);
    close(axis.clone().cross(radial).length(), 0);
    close(axis.dot(radial), 20.25);
    // The line through each output pivot reaches Y/Z=0 and all pivots lie at X=0.
    const pivot = new Vector3(0, 0, 0).applyMatrix4(
      new Matrix4().makeRotationX((channel.clock * Math.PI) / 180).setPosition(...channel.origin),
    );
    const centre = pivot.clone().addScaledVector(axis, -20.25);
    close(centre.x, 0);
    close(centre.y, 0);
    close(centre.z, 0);
    const shaft = new Vector3(0, 27.5, 0).applyMatrix4(
      new Matrix4().makeRotationX((channel.clock * Math.PI) / 180).setPosition(...channel.origin),
    );
    close(shaft.x, channel.origin[0]);
    assert.ok(
      shaft
        .clone()
        .sub(new Vector3(...channel.origin))
        .dot(axis) > 27,
    );
    outputDirections.push(axis);
    const screw = source.find((p) => p.component.id === 'screw-bearing-0')!.component.placement
      .translation;
    const coupling = source.find((p) => p.component.id === 'coupling')!.component.placement
      .translation;
    close(screw[1], coupling[1]);
    close(screw[2], coupling[2]);
  }
  outputDirections.forEach((axis, i) => close(axis.dot(outputDirections[(i + 1) % 4]), 0));
  assert.deepEqual(
    channels(quad.defaults, 'negative-limit').map((c) => c.angle),
    [-20, -20, -20, -20],
  );
  assert.deepEqual(
    channels(quad.defaults, 'positive-limit').map((c) => c.angle),
    [20, 20, 20, 20],
  );
  close(packing.stagger, 0);
  close(packing.discDiameter, 72);
});

test('balanced bearing cheeks seat both symmetric rails in matching receiver plates', () => {
  const cheeks = bearingCheeks(),
    slots = bearingCheekSlots(),
    plates = sharedPlates();
  assert.equal(cheeks.length, 8);
  assert.equal(plates.length, 3);
  assert.equal(slots.length, 32);
  assert.ok(
    plates.every((p) => p.outer.kind === 'circle' && p.outer.radius === 36 && p.thickness === 3),
  );
  for (const cheek of cheeks) {
    assert.equal(cheek.thickness, 3);
    const own = slots.filter((s) => s.unit === cheek.unit && s.positive === cheek.positive);
    for (const end of ['left', 'right']) {
      const pair = own.filter((s) => s.end === end);
      assert.equal(pair.length, 2);
      close(pair[0].railOffset + pair[1].railOffset, 0);
      for (const slot of pair) {
        assert.ok(plates.some((p) => p.id === slot.plateId));
        assert.ok(
          slot.tabSpanX[0] >= slot.receiverSpanX[0] - 1e-8 &&
            slot.tabSpanX[1] <= slot.receiverSpanX[1] + 1e-8,
        );
        const receiver = plates.find((p) => p.id === slot.plateId)!;
        assert.ok(receiver.cuts.some((cut) => cut.kind === 'polygon' && cut.id === slot.id));
        close(slot.width - 3, 0.1);
      }
    }
    // Analytic laser contours close exactly, retaining circular stock at the bearing.
    for (const loop of cheek.contours) {
      for (let i = 0; i < loop.length; i++) {
        close(loop[i].to[0], loop[(i + 1) % loop.length].from[0]);
        close(loop[i].to[1], loop[(i + 1) % loop.length].from[1]);
      }
    }
  }
});

test('three compact discs use standard 30 mm columns with explicit 2 mm stage shims', () => {
  assert.deepEqual(plateStations, [-52, -19, 16]);
  assert.deepEqual(
    plateStations.slice(1).map((v, i) => v - plateStations[i] - 3),
    [30, 32],
  );
  const columns = frameColumnPieces();
  assert.equal(columns.length, 20);
  const bodies = columns.filter((p) => p.component.libraryId === 'pcb-standoff');
  assert.equal(bodies.length, 8);
  for (const body of bodies) {
    const catalog = standoff.presets.find((p) => p.id === body.component.presetId);
    assert.ok(catalog, 'Each column uses an unchanged catalog preset.');
    assert.deepEqual(body.component.parameters, { ...standoff.defaults, ...catalog.parameters });
  }
  assert.deepEqual(
    columnStages.map((s) => s.preset),
    ['dremec-115x30', 'dremec-215x30'],
  );
  const shims = columns.filter((p) => p.component.id.endsWith('-spacer'));
  assert.equal(shims.length, 4);
  assert.ok(shims.every((p) => p.component.supply === 'manufactured'));
  // M3 male8 passes a3 mm disc and2 mm spacer, retaining one diameter of thread.
  close(8 - 3 - 2, 3);
});

test('downloaded laser files match the three current analytic round-disc profiles', () => {
  assert.equal(
    profiles.signature,
    createHash('sha256').update(sharedPlateProfileSource()).digest('hex'),
  );
  assert.deepEqual(
    profiles.plates.map((p) => p.id),
    ['motor', 'fixed', 'end'],
  );
  for (const plate of profiles.plates) {
    const lines = plate.dxf.trim().split(/\r?\n/),
      entities: { kind: string; codes: Map<number, string> }[] = [];
    for (let i = 0; i < lines.length; i += 2) {
      const code = Number(lines[i]),
        value = lines[i + 1];
      if (code === 0) entities.push({ kind: value, codes: new Map() });
      else entities.at(-1)?.codes.set(code, value);
    }
    const outer = entities.filter((e) => e.codes.get(8) === 'OUTER');
    assert.equal(outer.length, 1);
    assert.equal(outer[0].kind, 'CIRCLE');
    close(Number(outer[0].codes.get(40)), 36);
    close(Number(outer[0].codes.get(10)), 0);
    close(Number(outer[0].codes.get(20)), 0);
  }
  const files = quad.fabricationFiles!(quad.defaults);
  const blankIds = [...profiles.plates.map((p) => p.id), ...bearingCheeks().map((p) => p.id)];
  for (const extension of ['dxf', 'svg'])
    assert.equal(
      files.filter((f) => blankIds.some((id) => f.id === id + '-' + extension)).length,
      11,
    );
  const manifest = JSON.parse(files.find((f) => f.id === 'laser-manifest')!.content);
  assert.equal(manifest.units, 'mm');
  assert.equal(manifest.scale, '1:1');
  assert.equal(
    manifest.parts.filter(
      (p: { id: string; thickness: number }) =>
        ['motor', 'fixed', 'end'].includes(p.id) && p.thickness === 3,
    ).length,
    3,
  );
  assert.equal(manifest.parts.filter((p: { id: string; thickness: number }) => p.id.includes('cheek') && p.thickness === 3).length, 8);
});
