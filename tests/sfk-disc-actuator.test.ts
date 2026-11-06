import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import part, { actuatorLayout } from '../src/parts/sfk-disc-actuator/part';
import previous from '../src/parts/sfk-rotary-actuator/part';
import {
  laserPlates,
  laserPlateShape,
  type LaserPlate,
  type LaserPoint,
} from '../src/parts/sfk-disc-actuator/lib/laser-plates';
import {
  laserFabricationFiles,
  manufacturingManifest,
  plateDxf,
  plateLoops,
  nestDxf,
  plateArea,
} from '../src/parts/sfk-disc-actuator/lib/fabrication';
import { boundaryThreadCallouts, type Shape } from '../src/core/assembly/boundary/shapes';
import { validateParameters } from '../src/core/validation';
import { Box3, Euler, Vector3 } from 'three';
import { disposeModel } from '../src/core/mechanical';
import { columnLayout, columnPieces } from '../src/parts/sfk-disc-actuator/lib/columns';
import {
  discAxisHeight,
  driveOffsetZ,
  screwAxisHeight,
  outputAxisHeight,
} from '../src/parts/sfk-disc-actuator/lib/drive-layout';
import { purchasedPieces } from '../src/parts/sfk-disc-actuator/lib/components';
import { ballScrewLayout } from '../src/parts/ball-screw/lib/parts/ball-screw-geometry';

function entities(text: string) {
  const lines = text.trim().split('\n');
  assert.equal(lines.length % 2, 0);
  const records: { type: string; groups: Map<number, string[]> }[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const code = Number(lines[index]),
      value = lines[index + 1];
    if (code === 0) records.push({ type: value, groups: new Map() });
    else if (records.length) {
      const groups = records.at(-1)!.groups;
      groups.set(code, [...(groups.get(code) ?? []), value]);
    }
  }
  return records.filter((record) => ['CIRCLE', 'LWPOLYLINE'].includes(record.type));
}

function segmentDistance(point: number[], first: number[], second: number[]) {
  const dx = second[0] - first[0],
    dy = second[1] - first[1];
  const fraction = Math.max(
    0,
    Math.min(1, ((point[0] - first[0]) * dx + (point[1] - first[1]) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(point[0] - first[0] - fraction * dx, point[1] - first[1] - fraction * dy);
}

function worldPoint(plate: LaserPlate, point: LaserPoint) {
  const rotation = plate.placement.rotation.map((angle) => (angle * Math.PI) / 180) as [
    number,
    number,
    number,
  ];
  return new Vector3(point[0], point[1], 0)
    .applyEuler(new Euler(...rotation, 'ZYX'))
    .add(new Vector3(...plate.placement.translation));
}

function verticalSection(plate: LaserPlate, x: number) {
  assert.ok(plate.outer.kind === 'path');
  const points = plate.outer.points.map((point) => worldPoint(plate, point));
  const crossings = points.flatMap((first, index) => {
    const second = points[(index + 1) % points.length];
    if ((first.x <= x && x < second.x) || (second.x <= x && x < first.x)) {
      const t = (x - first.x) / (second.x - first.x);
      return [first.z + t * (second.z - first.z)];
    }
    return [];
  });
  crossings.sort((a, b) => a - b);
  assert.equal(crossings.length, 2, 'A rail/tab section must be one continuous strip of steel.');
  return { minimumZmm: crossings[0], maximumZmm: crossings[1] };
}

function nutTravelProof() {
  const neutral = actuatorLayout(part.defaults).center;
  assert.equal(neutral, 8.5);
  let minimumNutPosition = Infinity,
    maximumNutPosition = -Infinity;
  let minimumLeftRacewayMarginMm = Infinity,
    minimumRightRacewayMarginMm = Infinity;
  for (let angle = -20; angle <= 20; angle += 0.25) {
    const parameters = { ...part.defaults, outputAngle: angle };
    const kinematics = actuatorLayout(parameters);
    const screw = purchasedPieces(parameters).find(
      (piece) => piece.component.id === 'ball-screw',
    )!.component;
    const source = ballScrewLayout(screw.parameters);
    assert.ok(Math.abs(source.center - kinematics.center) < 1e-8);
    assert.ok(
      Math.abs(kinematics.center - neutral - 13 * Math.tan((angle * Math.PI) / 180)) < 1e-9,
    );
    assert.ok(Math.abs(kinematics.pin[0] - kinematics.center - 4.9) < 1e-9);
    const left = source.center - source.nl / 2 - source.start;
    const right = source.end - source.center - source.nl / 2;
    assert.ok(
      Math.min(left, right) >= source.lead - 1e-9,
      'The stock nut must retain at least one full lead of raceway at both ends.',
    );
    const position = Number(screw.parameters.nutPosition);
    assert.ok(position >= -1e-9 && position <= 100 + 1e-9);
    minimumNutPosition = Math.min(minimumNutPosition, position);
    maximumNutPosition = Math.max(maximumNutPosition, position);
    minimumLeftRacewayMarginMm = Math.min(minimumLeftRacewayMarginMm, left);
    minimumRightRacewayMarginMm = Math.min(minimumRightRacewayMarginMm, right);
  }
  return {
    neutralNutCentreXmm: neutral,
    pinOffsetXmm: 4.9,
    minimumNutPosition,
    maximumNutPosition,
    minimumLeftRacewayMarginMm,
    minimumRightRacewayMarginMm,
    inspectedAngles: 161,
  };
}

test('nut travel follows the cheek-centred axis without exhausting the source raceway', () => {
  const proof = nutTravelProof();
  assert.ok(proof.minimumLeftRacewayMarginMm > 2.768);
  assert.ok(proof.maximumNutPosition <= 45.455);
});

test('offset drive keeps the output axis at the disc centres with clear rims and columns', () => {
  assert.equal(discAxisHeight, 28);
  assert.equal(driveOffsetZ, 13);
  assert.equal(screwAxisHeight, discAxisHeight + driveOffsetZ);
  assert.equal(outputAxisHeight, discAxisHeight);
  const webs: { id: string; minimumFinishedEdgeWebMm: number }[] = [];
  for (const plate of laserPlates) {
    const inner = plateLoops(plate, 'finished').slice(1);
    if (plate.outer.kind === 'circle') {
      assert.deepEqual(plate.outer.center, [0, 0]);
      assert.equal(plate.outer.radius, 34);
      assert.equal(plate.placement.translation[2], discAxisHeight);
      assert.deepEqual(
        plate.inner
          .filter((feature) => feature.id.startsWith('column-'))
          .map((feature) => (feature.loop.kind === 'circle' ? feature.loop.center : null)),
        [
          [-20, 20],
          [20, 20],
          [0, -22],
        ],
      );
      const driveHole = plate.inner.find(
        (feature) => feature.id === 'bearing-bore' || feature.id === 'motor-boss-clearance',
      )!;
      assert.ok(driveHole.loop.kind === 'circle');
      assert.deepEqual(driveHole.loop.center, [0, driveOffsetZ]);
      const web = Math.min(
        ...inner.map((loop) =>
          loop.kind === 'circle'
            ? 34 - Math.hypot(...loop.center) - loop.radius
            : 34 - Math.max(...loop.points.map((point) => Math.hypot(...point))),
        ),
      );
      assert.ok(web >= 4, `${plate.id} must retain at least one stock thickness of perimeter web.`);
      webs.push({ id: plate.id, minimumFinishedEdgeWebMm: web });
    } else {
      assert.equal(plate.placement.translation[2], outputAxisHeight);
      const outer = plate.outer;
      const web = Math.min(
        ...inner.map((loop) => {
          assert.ok(loop.kind === 'circle');
          return (
            Math.min(
              ...outer.points.map((point, index) =>
                segmentDistance(
                  loop.center,
                  point,
                  outer.points[(index + 1) % outer.points.length],
                ),
              ),
            ) - loop.radius
          );
        }),
      );
      assert.ok(web >= 2, `${plate.id} must retain its finished bearing-bore edge web.`);
      webs.push({ id: plate.id, minimumFinishedEdgeWebMm: web });
    }
  }
  assert.deepEqual(columnLayout.lines, [
    [-20, 48],
    [20, 48],
    [0, 6],
  ]);
  const definition = part.composition!(part.defaults);
  const fixedDisc = laserPlates.find((plate) => plate.id === 'fixed-disc')!;
  const endDisc = laserPlates.find((plate) => plate.id === 'end-disc')!;
  const supportMidpointX =
    (fixedDisc.placement.translation[0] + fixedDisc.thickness + endDisc.placement.translation[0]) /
    2;
  assert.ok(Math.abs(supportMidpointX - 13.4) < 1e-9);
  const tabSlots = [fixedDisc, endDisc].flatMap((plate) =>
    plate.inner
      .filter((inner) => inner.id.startsWith('cheek-tab-'))
      .map((inner) => {
        assert.ok(inner.loop.kind === 'path');
        const bounds = new Box3().setFromPoints(
          inner.loop.points.map((point) => worldPoint(plate, point)),
        );
        const centreZmm = (bounds.min.z + bounds.max.z) / 2;
        assert.ok(Math.abs(centreZmm - outputAxisHeight) < 1e-9);
        assert.ok(Math.abs(bounds.min.z - 24.95) < 1e-9);
        assert.ok(Math.abs(bounds.max.z - 31.05) < 1e-9);
        return {
          plateId: plate.id,
          featureId: inner.id,
          minimumZmm: bounds.min.z,
          maximumZmm: bounds.max.z,
          centreZmm,
        };
      }),
  );
  assert.equal(tabSlots.length, 4);
  const cheekCentres = laserPlates
    .filter((plate) => plate.id.endsWith('-cheek'))
    .map((plate) => {
      assert.ok(plate.outer.kind === 'path');
      const world = (point: LaserPoint) => worldPoint(plate, point);
      const bounds = new Box3().setFromPoints(plate.outer.points.map(world));
      const bore = plate.inner.find((inner) => inner.operation === 'ream')!;
      assert.ok(bore.loop.kind === 'circle');
      const centre = world(bore.loop.center);
      const midpointX = (bounds.min.x + bounds.max.x) / 2;
      const midpointZ = (bounds.min.z + bounds.max.z) / 2;
      assert.ok(
        Math.abs(centre.x - midpointX) < 1e-9 && Math.abs(centre.x - supportMidpointX) < 1e-9,
        'Each actual bearing bore must be at the cheek-span midpoint, not near an edge.',
      );
      assert.ok(Math.abs(centre.z - discAxisHeight) < 1e-9);
      assert.ok(
        Math.abs(centre.z - midpointZ) < 1e-9,
        'The complete cheek profile and its bearing bore must share the same height centre.',
      );
      assert.ok(Math.abs(bounds.min.z - 19) < 1e-9);
      assert.ok(Math.abs(bounds.max.z - 37) < 1e-9);
      const outerPoints = plate.outer.points.map(world);
      for (const x of [supportMidpointX - 9, supportMidpointX + 9])
        for (const z of [outputAxisHeight - 9, outputAxisHeight + 9])
          assert.ok(
            outerPoints.some(
              (point) => Math.abs(point.x - x) < 1e-9 && Math.abs(point.z - z) < 1e-9,
            ),
            'The bearing support is a complete 18 × 18 mm square with four unchamfered corners.',
          );
      const supportSections = [
        {
          feature: 'front-tab',
          x: fixedDisc.placement.translation[0] + fixedDisc.thickness / 2,
          height: 6,
        },
        {
          feature: 'rear-tab',
          x: endDisc.placement.translation[0] + endDisc.thickness / 2,
          height: 6,
        },
        {
          feature: 'front-shoulder',
          x: fixedDisc.placement.translation[0] + fixedDisc.thickness + 2.5,
          height: 8,
        },
        { feature: 'rear-shoulder', x: endDisc.placement.translation[0] - 2.5, height: 8 },
        { feature: 'front-rail', x: -2.35, height: 6 },
        { feature: 'rear-rail', x: 29.15, height: 6 },
        { feature: 'square-boss-negative-edge', x: supportMidpointX - 8.99, height: 18 },
        { feature: 'square-boss-positive-edge', x: supportMidpointX + 8.99, height: 18 },
      ].map(({ feature, x, height }) => {
        const section = verticalSection(plate, x);
        const centreZmm = (section.minimumZmm + section.maximumZmm) / 2;
        assert.ok(
          Math.abs(centreZmm - outputAxisHeight) < 1e-9,
          `${feature} must align with the output axis.`,
        );
        assert.ok(Math.abs(section.maximumZmm - section.minimumZmm - height) < 1e-9);
        return { feature, xMm: x, ...section, centreZmm };
      });
      return {
        id: plate.id,
        minXmm: bounds.min.x,
        maxXmm: bounds.max.x,
        minZmm: bounds.min.z,
        maxZmm: bounds.max.z,
        cheekMidpointXmm: midpointX,
        cheekMidpointZmm: midpointZ,
        boreCentreXmm: centre.x,
        boreCentreZmm: centre.z,
        supportSections,
      };
    });
  for (const component of definition.components.filter((component) =>
    component.id.startsWith('output-bearing-'),
  ))
    assert.ok(Math.abs(component.placement.translation[0] - supportMidpointX) < 1e-9);
  for (const id of ['gearmotor', 'ball-screw', 'coupling', 'screw-bearing-0', 'screw-bearing-1'])
    assert.equal(
      definition.components.find((component) => component.id === id)!.placement.translation[2],
      screwAxisHeight,
    );
  const columns = columnPieces().map((piece) => {
    const p = piece.component.parameters;
    const bodyRadius =
      p.profile === 'hex'
        ? Math.max(Number(p.cornerDiameter) / 2, Number(p.bodyWidth) / Math.sqrt(3))
        : Number(p.bodyWidth) / 2;
    const radius = Math.max(
      bodyRadius,
      Number(p.threadDiameterA) / 2,
      Number(p.threadDiameterB) / 2,
    );
    const [, y, z] = piece.component.placement.translation;
    return {
      id: piece.component.id,
      y,
      z,
      radialEnvelopeMm: radius,
      driveClearanceMm: Math.hypot(y, z - screwAxisHeight) - 14.5 - radius,
    };
  });
  assert.ok(
    columns.every((column) => column.driveClearanceMm > 0),
    'The complete Ø29 drive/nut-cover envelope must clear all standard columns.',
  );
  const model = part.buildGeometry(part.defaults, 'assembled');
  let forkY = 0,
    forkX = 0,
    forkLowZ = Infinity,
    physicalShaftCentreHeightMm = NaN,
    physicalShaftCentreXmm = NaN;
  try {
    const shaftIndex = definition.components.findIndex(
      (component) => component.id === 'output-shaft',
    );
    const shaftBounds = new Box3().setFromObject(model.children[shaftIndex], true);
    physicalShaftCentreHeightMm = (shaftBounds.min.z + shaftBounds.max.z) / 2;
    physicalShaftCentreXmm = (shaftBounds.min.x + shaftBounds.max.x) / 2;
    assert.ok(Math.abs(physicalShaftCentreXmm - supportMidpointX) < 1e-6);
    assert.ok(
      Math.abs(physicalShaftCentreHeightMm - discAxisHeight) < 1e-6,
      'The physical output shaft centre, rather than its upper surface, must coincide with the disc centres.',
    );
    definition.components.forEach((component, index) => {
      if (!/^output-(front|rear)-(?:crank|clamp)/.test(component.id)) return;
      const box = new Box3().setFromObject(model.children[index], true);
      forkY = Math.max(forkY, Math.abs(box.min.y), Math.abs(box.max.y));
      forkX = Math.max(
        forkX,
        Math.abs(box.min.x - supportMidpointX),
        Math.abs(box.max.x - supportMidpointX),
      );
      forkLowZ = Math.min(forkLowZ, box.min.z - outputAxisHeight);
    });
  } finally {
    disposeModel(model);
  }
  assert.ok(forkY > 0 && Number.isFinite(forkLowZ));
  const forkMinimumZ =
    outputAxisHeight +
    Math.min(forkLowZ, forkLowZ * Math.cos(Math.PI / 9)) -
    forkX * Math.sin(Math.PI / 9);
  const forkColumnClearances = columns.map((column) => ({
    id: column.id,
    clearanceMm:
      column.y === 0
        ? forkMinimumZ - column.z - column.radialEnvelopeMm
        : Math.abs(column.y) - column.radialEnvelopeMm - forkY,
  }));
  assert.ok(
    forkColumnClearances.every((value) => value.clearanceMm > 0),
    'The entire ±20° fork/clamp envelope must clear the fixed columns.',
  );
  const report = {
    partId: part.id,
    driveAxisHeightMm: screwAxisHeight,
    outputAxisHeightMm: outputAxisHeight,
    discCentreHeightMm: discAxisHeight,
    driveOffsetMm: driveOffsetZ,
    outputAxisExactlyAtDiscCentre: outputAxisHeight === discAxisHeight,
    physicalShaftCentreHeightMm,
    physicalShaftCentreXmm,
    supportMidpointXmm: supportMidpointX,
    tabSlots,
    cheekBearingCentres: cheekCentres,
    nutTravel: nutTravelProof(),
    driveEnvelopeRadiusMm: 14.5,
    discRimEnvelopeClearanceMm: 34 - driveOffsetZ - 14.5,
    edgeWebs: webs,
    columns,
    minimumDriveColumnClearanceMm: Math.min(...columns.map((column) => column.driveClearanceMm)),
    forkClampYEnvelopeMm: forkY,
    conservativeForkMinimumZMm: forkMinimumZ,
    forkColumnClearances,
    scope:
      'Geometric radial and coordinate-envelope separation for the full motion range, independent of sampled collision tests; no strength rating.',
  };
  if (process.env.SFK_DISC_OFFSET_ENVELOPE_PROOF) {
    const path = resolve(process.env.SFK_DISC_OFFSET_ENVELOPE_PROOF);
    mkdirSync(resolve(path, '..'), { recursive: true });
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
  }
});

test('three-disc laser family preserves five uniform through-cut plates and the previous mechanism', () => {
  assert.equal(part.id, 'sfk-disc-actuator');
  assert.equal(previous.id, 'sfk-rotary-actuator');
  assert.notEqual(part.id, previous.id);
  assert.equal(laserPlates.length, 5);
  assert.equal(
    laserPlates.filter((plate) => plate.outer.kind === 'circle' && plate.outer.radius === 34)
      .length,
    3,
  );
  assert.equal(laserPlates.filter((plate) => plate.outer.kind === 'path').length, 2);
  let reamed = 0;
  const visit = (shape: Shape): void => {
    if (shape.kind === 'transform') return visit(shape.child);
    if (shape.kind === 'cylinder') {
      assert.equal(shape.thread, undefined, 'Laser plates have no internal machining threads.');
      assert.equal(shape.axis, 'z', 'Every circular cut passes along the stock normal.');
      assert.ok(shape.height >= 4);
    } else if (shape.kind === 'prism') assert.ok(shape.depth >= 4);
    else if ('children' in shape) shape.children.forEach(visit);
    else assert.fail(`Unsupported non-through plate feature: ${shape.kind}`);
  };
  for (const plate of laserPlates) {
    assert.equal(plate.thickness, 4);
    assert.equal(boundaryThreadCallouts(laserPlateShape(plate)).length, 0);
    visit(laserPlateShape(plate));
    assert.ok(plateArea(plate, 'cut') > 0);
    for (const inner of plate.inner) {
      if (inner.operation === 'ream') {
        reamed++;
        assert.equal(inner.finishedDiameter, 13.02);
        assert.equal(inner.cutDiameter, 12.8);
        assert.equal(inner.loop.kind, 'circle');
      } else
        assert.equal(
          inner.cutDiameter,
          undefined,
          'Only bearing holes need a secondary finishing allowance.',
        );
    }
  }
  assert.equal(reamed, 4);
  for (const preset of part.presets)
    assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), [], preset.id);
  const components = part.composition!(part.defaults).components;
  assert.ok(
    laserPlates.every((plate) => components.some((component) => component.id === plate.id)),
  );
  assert.ok(components.some((component) => component.libraryId === 'pcb-standoff'));
  assert.ok(
    previous.composition!(previous.defaults).components.some(
      (component) => component.id === 'base',
    ),
  );
});

test('laser DXFs contain exact closed 1:1 mm cutting contours and four undersize bearing pilots', () => {
  let pilotCount = 0;
  for (const plate of laserPlates) {
    const text = plateDxf(plate),
      loops = plateLoops(plate, 'cut'),
      records = entities(text);
    assert.match(text, /\$INSUNITS\n70\n4\n/);
    assert.match(text, /\$MEASUREMENT\n70\n1\n/);
    assert.ok(text.endsWith('0\nEOF\n'));
    assert.equal(records.length, loops.length);
    records.forEach((record, index) => {
      const loop = loops[index];
      if (loop.kind === 'circle') {
        assert.equal(record.type, 'CIRCLE');
        assert.equal(Number(record.groups.get(40)![0]), loop.radius);
        assert.deepEqual(
          [Number(record.groups.get(10)![0]), Number(record.groups.get(20)![0])],
          loop.center,
        );
        if (loop.radius === 6.4) pilotCount++;
      } else {
        assert.equal(record.type, 'LWPOLYLINE');
        assert.equal(Number(record.groups.get(70)![0]), 1);
        assert.equal(Number(record.groups.get(90)![0]), loop.points.length);
        assert.deepEqual(
          record.groups
            .get(10)!
            .map((value, i) => [Number(value), Number(record.groups.get(20)![i])]),
          loop.points,
        );
      }
    });
  }
  assert.equal(pilotCount, 4);
  const combined = entities(nestDxf());
  assert.equal(combined.filter((record) => record.groups.get(8)![0].endsWith('_OUTER')).length, 5);
  assert.equal(
    combined.length,
    laserPlates.reduce((count, plate) => count + 1 + plate.inner.length, 0),
  );
});

test('manufacturing files are pose independent and explicitly distinguish cutting from reaming', () => {
  const files = laserFabricationFiles(part.defaults);
  assert.equal(files.length, 14);
  assert.equal(new Set(files.map((file) => file.id)).size, files.length);
  assert.equal(new Set(files.map((file) => file.name)).size, files.length);
  assert.deepEqual(files, laserFabricationFiles({ ...part.defaults, outputAngle: 20 }));
  assert.deepEqual(files, laserFabricationFiles({ ...part.defaults, outputAngle: -20 }));
  const manifest = manufacturingManifest();
  assert.equal(manifest.units, 'mm');
  assert.equal(manifest.scale, '1:1');
  assert.equal(manifest.plateOccurrences, 5);
  assert.equal(manifest.totalReamedBearingHoles, 4);
  assert.ok(manifest.plates.every((plate) => plate.quantity === 1 && plate.thickness === 4));
  for (const file of files.filter((file) => file.type === 'image/svg+xml')) {
    const dimensions = file.content.match(
      /width="([\d.]+)mm" height="([\d.]+)mm" viewBox="0 0 ([\d.]+) ([\d.]+)"/,
    );
    assert.ok(dimensions);
    assert.equal(dimensions[1], dimensions[3]);
    assert.equal(dimensions[2], dimensions[4]);
    assert.ok(!file.content.includes('<image'));
  }
  assert.equal(files.filter((file) => file.type === 'application/dxf').length, 6);
  assert.ok(
    files.some(
      (file) => file.name.endsWith('.FCMacro') && file.content.includes('StockThickness = 4'),
    ),
  );
});

test(
  'native DXF reimport agrees with actual cut blanks and only the four reamed bores change',
  { skip: !process.env.FREECAD_PYTHON, timeout: 120_000 },
  () => {
    const folder = resolve(process.env.SFK_DISC_LASER_FILES ?? '/tmp/protolab-sfk-disc-laser');
    mkdirSync(folder, { recursive: true });
    const files = laserFabricationFiles(part.defaults);
    for (const file of files) writeFileSync(resolve(folder, file.name), file.content);
    const manifest = files.find((file) => file.id === 'laser-manufacturing-manifest')!;
    const report = process.env.SFK_DISC_LASER_PROOF ?? resolve(folder, 'laser-validation.json');
    const run = spawnSync(
      process.env.FREECAD_PYTHON!,
      [resolve('scripts/verify-sfk-disc-laser.py'), resolve(folder, manifest.name), report],
      { encoding: 'utf8', env: process.env, timeout: 110_000, maxBuffer: 2_000_000 },
    );
    assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
    assert.ok(run.stdout.includes('"passed": true'));
  },
);
