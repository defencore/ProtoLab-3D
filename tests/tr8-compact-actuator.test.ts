import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Vector3 } from 'three';
import part, { actuatorLayout, actuatorPieces } from '../src/parts/tr8-compact-actuator/part';
import previous from '../src/parts/sfk-disc-actuator/part';
import { configuredDrive, tr8Thread } from '../src/parts/tr8-compact-actuator/lib/drive';
import { outputLayout } from '../src/parts/tr8-compact-actuator/lib/output';
import { laserPlates, type LaserPlate } from '../src/parts/tr8-compact-actuator/lib/laser-plates';
import { columnPieces } from '../src/parts/tr8-compact-actuator/lib/columns';
import { screwMachiningSchedule } from '../src/parts/tr8-compact-actuator/lib/machining';
import { plateDxf, plateLoops } from '../src/parts/tr8-compact-actuator/lib/fabrication';
import { validateParameters } from '../src/core/validation';
import * as layout from '../src/parts/tr8-compact-actuator/lib/drive-layout';

const close = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

function worldPoint(plate: LaserPlate, point: [number, number]) {
  const rotation = plate.placement.rotation.map((angle) => angle * Math.PI / 180) as [number, number, number];
  return new Vector3(...point, 0).applyEuler(new Euler(...rotation, 'ZYX'))
    .add(new Vector3(...plate.placement.translation));
}

function dxfLoops(text: string) {
  const lines = text.trim().split('\n');
  const rows: { type: string; groups: Map<number, string[]> }[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const code = Number(lines[index]), value = lines[index + 1];
    if (code === 0) rows.push({ type: value, groups: new Map() });
    else if (rows.length) {
      const groups = rows.at(-1)!.groups;
      groups.set(code, [...(groups.get(code) ?? []), value]);
    }
  }
  return rows.filter((row) => ['CIRCLE', 'LWPOLYLINE'].includes(row.type));
}

test('TR8 variant retains the supplied H nut and correct four-start 8 mm lead', () => {
  assert.equal(part.id, 'tr8-compact-actuator');
  assert.equal(previous.id, 'sfk-disc-actuator');
  assert.notEqual(part, previous);
  assert.deepEqual(tr8Thread.nut, { length: 15, bossDiameter: 10, flangeLength: 22,
    flangeWidth: 11, flangeThickness: 3.5, noseLength: 1.5, rearLength: 10,
    holeDiameter: 3.5, holePitch: 16 });
  assert.equal(tr8Thread.lead, tr8Thread.pitch * tr8Thread.starts);
  assert.equal(tr8Thread.lead, 8);
  assert.equal(tr8Thread.pitch, 2);
  assert.equal(tr8Thread.starts, 4);
  assert.equal(tr8Thread.includedAngle, 30);
  close(tr8Thread.rootDiameter, 8 - 2 - 2 * 0.25);
  for (const preset of part.presets) assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), []);
});

test('full nut engagement and closed-slot travel remain clear throughout ±20 degrees', () => {
  let minimumEngagementMargin = Infinity;
  for (let angle = -20; angle <= 20; angle += 0.25) {
    const pose = actuatorLayout({ ...part.defaults, outputAngle: angle });
    const travel = 10 * Math.tan(angle * Math.PI / 180);
    close(pose.displacement, travel);
    close(pose.center, travel);
    close(pose.turns, travel / 8);
    close(pose.physicalRotation, -360 * travel / 8);
    close(pose.pinRadius, 10 / Math.cos(angle * Math.PI / 180));
    assert.ok(pose.pinRadius > outputLayout.slotRoot && pose.pinRadius < outputLayout.slotTip);
    const local = new Vector3(travel, 0, 10).applyEuler(new Euler(0, -angle * Math.PI / 180, 0));
    close(local.x, 0);
    close(local.z, pose.pinRadius);
    const left = travel - tr8Thread.nut.length / 2 - layout.screwThreadStartX;
    const right = layout.screwThreadEndX - travel - tr8Thread.nut.length / 2;
    minimumEngagementMargin = Math.min(minimumEngagementMargin, left, right);
    assert.ok(Math.min(left, right) > 1.85, 'The whole nut thread must remain within the retained stock thread.');
  }
  close(minimumEngagementMargin, 1.8602976573379766);
  close(actuatorLayout(part.defaults).stroke, 7.279404685324047);
});

test('turned blank stations clean the thread roots and preserve four real retaining-ring lands', () => {
  const schedule = screwMachiningSchedule();
  const drive = configuredDrive(0);
  assert.equal(schedule.blank.length, 250);
  assert.equal(schedule.finishedLength, 50);
  assert.equal(schedule.finishedLength, layout.screwRightEndX - layout.screwLeftEndX);
  close(layout.screwThreadEndX - layout.screwThreadStartX, 26);
  assert.deepEqual(drive.screwOptions.journals.map((station) => station.diameter), [4, 5, 5]);
  for (const station of drive.screwOptions.journals) assert.ok(station.diameter < tr8Thread.rootDiameter);
  assert.equal(schedule.grooves.length, 4);
  for (const groove of schedule.grooves) {
    close(groove.width, 0.7);
    close(groove.rootDiameter, 4.8);
  }
  const outerEdge = Math.max(...schedule.grooves.map((groove) => Math.abs(groove.center) + groove.width / 2));
  assert.ok(layout.screwRightEndX - outerEdge >= 0.3 - 1e-9);
  assert.ok(-layout.screwStubEndX - outerEdge >= 0.3 - 1e-9);
  assert.deepEqual(drive.screwOptions.grooves?.map((groove) => groove.rootDiameter), [4.8, 4.8, 4.8, 4.8]);
});

test('short standard columns and bearing seats retain the compact centred frame', () => {
  const columns = columnPieces();
  assert.equal(columns.length, 6);
  for (const piece of columns) {
    assert.equal(piece.component.parameters.bodyLength, 30);
    assert.ok(['dremec-115x30', 'dremec-215x30'].includes(piece.component.presetId!));
    assert.ok(piece.component.procurement?.designation);
  }
  const pieces = actuatorPieces(part.defaults);
  const bearings = pieces.filter((piece) => piece.component.id.startsWith('screw-bearing-'));
  assert.equal(bearings.length, 2);
  for (const { component } of bearings) {
    assert.equal(component.presetId, 'f695-2rs');
    assert.equal(component.parameters.bore, 5);
    assert.equal(Number(component.parameters.width) - Number(component.parameters.flangeWidth), 3);
  }
  for (const piece of pieces.filter((piece) => piece.component.id.startsWith('output-bearing-'))) {
    assert.equal(piece.component.presetId, 'f686-2rs');
    assert.equal(piece.component.parameters.bore, 6);
  }
  const motorBolts = pieces.filter((piece) => piece.component.id.startsWith('motor-front-M2-'));
  assert.equal(motorBolts.length, 2);
  assert.ok(motorBolts.every((piece) => piece.component.parameters.length === 5));
  close(layout.discDiameter, 56);
  close(layout.outputAxisHeight, layout.discAxisHeight);
  close(layout.outputAxisX, (layout.fixedDiscX + layout.mainPlateThickness + layout.endDiscX) / 2);
  assert.ok(outputLayout.shaftPositiveEnd <= 32);
});

test('laser files contain exact cut profiles at the matching 3 mm and 4 mm thicknesses', () => {
  assert.equal(laserPlates.length, 5);
  for (const plate of laserPlates) {
    const cheek = plate.id.includes('cheek');
    assert.equal(plate.thickness, cheek ? 4 : 3);
    if (!cheek) {
      assert.ok(plate.outer.kind === 'circle');
      close(plate.outer.radius, 28);
      close(plate.placement.translation[2], 0);
    }
    const records = dxfLoops(plateDxf(plate));
    const loops = plateLoops(plate, 'cut');
    assert.equal(records.length, loops.length);
    for (const [index, loop] of loops.entries()) {
      const entity = records[index];
      if (loop.kind === 'circle') {
        assert.equal(entity.type, 'CIRCLE');
        close(Number(entity.groups.get(10)?.[0]), loop.center[0]);
        close(Number(entity.groups.get(20)?.[0]), loop.center[1]);
        close(Number(entity.groups.get(40)?.[0]), loop.radius);
      } else {
        assert.equal(entity.type, 'LWPOLYLINE');
        assert.equal(Number(entity.groups.get(70)?.[0]), 1);
        assert.deepEqual(entity.groups.get(10)?.map(Number), loop.points.map((point) => point[0]));
        assert.deepEqual(entity.groups.get(20)?.map(Number), loop.points.map((point) => point[1]));
      }
    }
    for (const slot of plate.inner.filter((feature) => feature.id.startsWith('cheek-tab-'))) {
      assert.ok(slot.loop.kind === 'path');
      const points = slot.loop.points.map((point) => worldPoint(plate, point));
      close((Math.min(...points.map((point) => point.z)) + Math.max(...points.map((point) => point.z))) / 2, 0);
    }
  }
});
