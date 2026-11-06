import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Matrix4, Vector3 } from 'three';
import type { ConfiguredPiece } from '../src/core/assembly/detail-instances';
import type { Shape, Vec } from '../src/core/assembly/boundary/shapes';
import part, { pieces } from '../src/parts/tr8-quad-geared-rocker-actuator/part';
import {
  caseManifest,
  fabricationFiles,
  machiningSchedule,
} from '../src/parts/tr8-quad-geared-rocker-actuator/lib/fabrication';
import {
  fixed,
  enclosureDiameter,
  standMountStations,
} from '../src/parts/tr8-quad-geared-rocker-actuator/lib/layout';
import {
  panelLighteningCircles,
  panelLighteningSlots,
  endDiscLighteningCircles,
} from '../src/parts/tr8-quad-geared-rocker-actuator/lib/lightening';
import {
  cableRouting,
  cableRoutingCuts,
} from '../src/parts/tr8-quad-geared-rocker-actuator/lib/cable-routing';
import {
  coverMountStations,
  coverStandAccessCuts,
  coverValues,
} from '../src/parts/tr8-quad-geared-rocker-actuator/lib/plastic-cover';

const motors = ['surpass-2838-3700kv', 'surpass-2845-3100kv'];
const near = (a: number, b: number, tolerance = 1e-7) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(...a.map((value, index) => value - b[index]));
const fixtures = motors.map((motor) => {
  const p = { ...part.defaults, motor };
  return {
    p,
    files: fabricationFiles(p),
    manifest: caseManifest(p),
    schedule: machiningSchedule(p),
  };
});

function dxfEntities(content: string) {
  const lines = content.trimEnd().split(/\r?\n/);
  const entities: { kind: string; fields: Map<number, string> }[] = [];
  let current: (typeof entities)[number] | undefined;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i]),
      value = lines[i + 1];
    if (code !== 0) {
      current?.fields.set(code, value);
      continue;
    }
    if (current?.fields.get(8) === 'CUT') entities.push(current);
    current = ['CIRCLE', 'ARC', 'LINE'].includes(value)
      ? { kind: value, fields: new Map() }
      : undefined;
  }
  if (current?.fields.get(8) === 'CUT') entities.push(current);
  return entities;
}
type Entity = ReturnType<typeof dxfEntities>[number];
const field = (entity: Entity, code: number) => Number(entity.fields.get(code));
function roundCut(entities: Entity[], kind: string, center: readonly number[], radius: number) {
  const matches = entities.filter(
    (entity) =>
      entity.kind === kind &&
      distance([field(entity, 10), field(entity, 20)], center) < 1e-7 &&
      Math.abs(field(entity, 40) - radius) < 1e-7,
  );
  assert.equal(matches.length, 1, `${kind} at ${center}, radius ${radius}`);
  return matches[0];
}
const placement = (piece: ConfiguredPiece) =>
  new Matrix4()
    .makeRotationZ(((piece.angle ?? 0) * Math.PI) / 180)
    .setPosition(...(piece.position ?? [0, 0, piece.z ?? 0]))
    .multiply(
      new Matrix4()
        .makeRotationFromEuler(
          new Euler(
            ...(piece.component.placement.rotation.map((n) => (n * Math.PI) / 180) as Vec),
            'ZYX',
          ),
        )
        .setPosition(...piece.component.placement.translation),
    );
function discCylinders(piece: ConfiguredPiece) {
  const out: { radius: number; negative: boolean; from: Vector3; to: Vector3 }[] = [];
  function visit(shape: Shape, frame: Matrix4, negative = false) {
    if (shape.kind === 'transform') {
      const child = new Matrix4()
        .makeRotationFromEuler(
          new Euler(...(shape.rotation.map((n) => (n * Math.PI) / 180) as Vec), 'ZYX'),
        )
        .setPosition(...shape.translation);
      visit(shape.child, frame.clone().multiply(child), negative);
      return;
    }
    if (shape.kind === 'cylinder') {
      const from = new Vector3(...shape.origin).applyMatrix4(frame);
      const axis = new Vector3(
        ...({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[shape.axis] as Vec),
      ).transformDirection(frame);
      out.push({
        radius: shape.radius,
        negative,
        from,
        to: from.clone().addScaledVector(axis, shape.height),
      });
    }
    if ('children' in shape)
      shape.children.forEach((child, index) =>
        visit(child, frame, shape.kind === 'subtract' && index > 0 ? !negative : negative),
      );
  }
  visit(JSON.parse(String(piece.component.parameters.recipe)) as Shape, placement(piece));
  return out;
}

test('actual cutting exports retain exact rounded panel reliefs and end-disc slots', () => {
  for (const { p, files, manifest } of fixtures) {
    const panels = files.filter((file) => /^panel-cut-.*-dxf$/.test(file.id));
    assert.ok(panels.length > 0);
    for (const file of panels) {
      const entities = dxfEntities(file.content);
      for (const circle of panelLighteningCircles)
        roundCut(entities, 'CIRCLE', circle.center, circle.radius);
      for (const slot of panelLighteningSlots) {
        for (const z of [slot.from, slot.to]) {
          const arc = roundCut(entities, 'ARC', [slot.t, z], slot.radius);
          near((field(arc, 51) - field(arc, 50) + 360) % 360, 180);
        }
        assert.equal(
          entities.filter(
            (entity) =>
              entity.kind === 'LINE' &&
              [slot.t - slot.radius, slot.t + slot.radius].some(
                (t) =>
                  Math.abs(field(entity, 10) - t) < 1e-7 && Math.abs(field(entity, 11) - t) < 1e-7,
              ) &&
              Math.min(field(entity, 20), field(entity, 21)) === slot.from &&
              Math.max(field(entity, 20), field(entity, 21)) === slot.to,
          ).length,
          2,
        );
      }
    }
    const disc = files.find((file) => file.id === 'end-disc-dxf');
    assert.ok(disc);
    const entities = dxfEntities(disc.content);
    roundCut(entities, 'CIRCLE', [0, 0], enclosureDiameter(p) / 2);
    for (const circle of endDiscLighteningCircles(p))
      roundCut(entities, 'CIRCLE', circle.center, circle.radius);
    const slotRadius = fixed.endSlotWidth / 2;
    for (const t of [-fixed.wallRadius, fixed.wallRadius])
      for (const z of [
        -(fixed.endSlotSpan - fixed.endSlotWidth) / 2,
        (fixed.endSlotSpan - fixed.endSlotWidth) / 2,
      ])
        roundCut(entities, 'ARC', [t, z], slotRadius);
    assert.ok(manifest.lightening.nominalReliefVolume > 0);
    near(
      manifest.lightening.nominalMassReductionGrams.total,
      (manifest.lightening.nominalReliefVolume * 2.68) / 1000,
    );
    assert.match(manifest.lightening.calculationScope, /assumed density/);
  }
});

test('motor and reserve routes terminate at eight real transformed Ø10 disc mouths', () => {
  for (const { p } of fixtures) {
    const data = cableRouting(p),
      discs = pieces(p, 'housing').filter((piece) => piece.component.id.endsWith('-end-disc'));
    assert.equal(discs.length, 2);
    assert.equal(data.ports.length, 8);
    const motor = data.routes.filter((route) => route.kind === 'motor');
    const reserve = data.routes.filter((route) => route.kind === 'reserve');
    assert.equal(motor.length, 4);
    assert.equal(reserve.length, 8);
    assert.equal(new Set(motor.map((route) => route.portId)).size, 4);
    assert.equal(new Set(reserve.map((route) => route.portId)).size, 8);
    for (const port of data.ports) {
      near(port.boreDiameter, 10);
      const piece = discs.find((disc) =>
        disc.component.id.startsWith(port.upper ? 'upper-' : 'lower-'),
      )!;
      const cylinders = discCylinders(piece),
        axis = new Vector3(...port.axis);
      const inner = new Vector3(...port.innerPoint),
        outer = new Vector3(...port.outerPoint);
      const bore = cylinders.filter(
        (cut) =>
          cut.negative &&
          Math.abs(cut.radius - port.boreDiameter / 2) < 1e-8 &&
          cut.from.clone().sub(inner).cross(axis).length() < 1e-7,
      );
      assert.equal(bore.length, 1, port.id);
      const stock = cylinders.find((cylinder) => !cylinder.negative)!;
      const ends = [stock.from.dot(axis), stock.to.dot(axis)].sort((a, b) => a - b);
      near(inner.dot(axis), ends[0]);
      near(outer.dot(axis), ends[1]);
      near(outer.clone().sub(inner).dot(axis), fixed.endDiscThickness);
      for (const route of data.routes.filter((candidate) => candidate.portId === port.id)) {
        const terminal = route.centerline.at(-1)!;
        near(distance(terminal.slice(0, 2), port.innerPoint.slice(0, 2)), 0);
        near(new Vector3(...terminal).sub(inner).dot(axis), -0.2);
      }
    }
    const upperXY = data.ports
      .filter((port) => port.upper)
      .map((port) => port.innerPoint.slice(0, 2));
    for (const lower of data.ports.filter((port) => !port.upper))
      assert.ok(
        upperXY.some((upper) => distance(upper, lower.innerPoint.slice(0, 2)) < 1e-7),
        'Both discs retain the same global port clock.',
      );
  }
});

test('reserve grooves use available family-specific width while routing stays independent of pose', () => {
  let smallWidth = 0;
  for (const { p } of fixtures) {
    const data = cableRouting(p),
      reserve = data.reserve;
    near(reserve.entryNeckDiameter, reserve.minorWidth);
    assert.ok(reserve.majorWidth > reserve.entryNeckDiameter);
    assert.ok(reserve.centerTo > reserve.centerFrom);
    near(reserve.majorWidth, reserve.majorTo - reserve.majorFrom);
    near(
      enclosureDiameter(p) / 2 -
        Math.hypot(reserve.centerTo, reserve.transverseCenter) -
        reserve.minorWidth / 2,
      reserve.minimumExteriorLand,
    );
    assert.equal(reserve.splitAtWaist, true);
    assert.ok(reserve.wideSlotFromZ > reserve.servicePocketZ);
    const moved = { ...p, angleA: -20, angleB: 20, angleC: 11, angleD: -7 };
    assert.deepEqual(cableRouting(moved), data);
    assert.deepEqual(cableRoutingCuts(moved), cableRoutingCuts(p));
    assert.match(data.capacity, /No wire count/);
    assert.match(data.motorExitSource, /boot/);
    if (String(p.motor).includes('2838')) smallWidth = reserve.majorWidth;
    else assert.ok(reserve.majorWidth > smallWidth);
  }
});

test('lightening and routing preserve twenty stand taps plus four cover taps and shank-only access', () => {
  for (const { p, manifest, schedule } of fixtures) {
    const stand = standMountStations(),
      covers = coverMountStations(p),
      cuts = coverStandAccessCuts(p);
    assert.equal(stand.length, 20);
    assert.equal(covers.length, 4);
    assert.equal(manifest.standMounting.totalMetalPanelM3Threads, stand.length + covers.length);
    assert.equal(manifest.standMounting.includesStandHardware, false);
    assert.equal(cuts.length, stand.length);
    for (const cut of cuts) {
      assert.equal(cut.kind, 'cylinder');
      if (cut.kind === 'cylinder') near(cut.radius * 2, 3.4);
    }
    assert.ok(stand.every((station) => station.thread === 'M3×0.5' && station.threadLength === 3));
    near(schedule.covers.standAccess.diameter, 3.4);
    assert.match(schedule.covers.standAccess.purpose, /heads do not pass/);
    assert.equal(
      pieces(p, 'assembled').length,
      115,
      'Routing reservations add no cable or stand hardware to the BOM.',
    );
  }
});

test('motor-can envelope values are not used as the finished enclosure diameter', () => {
  for (const { p, files, schedule } of fixtures) {
    const expected = String(p.motor).includes('2845') ? 86 : 76;
    near(enclosureDiameter(p), expected);
    near(coverValues(p).outerDiameter, expected);
    near(schedule.case.endCaps.diameter, expected);
    assert.ok(schedule.selectedMotor.nominalCanCylinderDiameter < expected);
    assert.match(schedule.selectedMotor.envelopeScope, /motor-only/);
    assert.ok(!('acceptedCylinderClass' in schedule.selectedMotor));
    const exported = JSON.parse(
      files.find((file) => file.id === 'fabrication-schedule')!.content,
    ) as typeof schedule;
    near(exported.case.endCaps.diameter, expected);
    near(exported.covers.outerDiameter, expected);
    assert.notEqual(
      exported.selectedMotor.nominalCanCylinderDiameter,
      exported.case.endCaps.diameter,
    );
  }
});
