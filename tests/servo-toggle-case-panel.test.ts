import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import test from 'node:test';
import { Box3, Euler, Mesh, Ray, Vector3, type Object3D } from 'three';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';
import part from '../src/parts/servo-toggle-actuator/part';
import { configured } from '../src/parts/servo-toggle-actuator/lib/model';
import {
  casePanelLayout,
  casePanelStructure,
} from '../src/parts/servo-toggle-actuator/lib/case-panel';
import { caseElectronicsLayout } from '../src/parts/servo-toggle-actuator/lib/case-electronics-layout';
import {
  caseElectronicsHoneycomb,
  caseElectronicsRetention,
} from '../src/parts/servo-toggle-actuator/lib/case-electronics';
import {
  caseElectronicsAccess,
  caseElectronicsEmi,
} from '../src/parts/servo-toggle-actuator/lib/case-electronics-components';
import { caseFitLayout } from '../src/parts/servo-toggle-actuator/lib/case-fit';
import { caseWallMountStructure } from '../src/parts/servo-toggle-actuator/lib/case-wall-mounts';
import { caseConnectorMounting } from '../src/parts/servo-toggle-actuator/lib/case-components';
import terminal from '../src/parts/laboratory-terminal/part';
import { pieces as terminalPieces } from '../src/parts/laboratory-terminal/lib/model';

const input = (extra: Parameters = {}): Parameters => {
  const preset = part.presets.find((item) => item.parameters.mechanism === 'case-panel');
  assert.ok(preset, 'The case panel is an independently selectable configuration.');
  return { ...part.defaults, ...preset.parameters, ...extra };
};
const near = (actual: number, expected: number, tolerance = 1e-3) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} versus ${expected}`);
const plateEnvelope = (p: Parameters): Box3 => {
  const layout = casePanelLayout(p),
    mounts = caseWallMountStructure(p),
    bounds = new Box3(
      new Vector3(layout.min[0], layout.min[1], layout.panelBottom),
      new Vector3(layout.max[0], layout.max[1], layout.panelTop),
    );
  for (const rib of mounts.ribs) {
    bounds.expandByPoint(new Vector3(...rib.min));
    bounds.expandByPoint(new Vector3(...rib.max));
  }
  for (const { bossLocalBounds, frame, additionsMaximumZ } of mounts.mounts) {
    const corners = [bossLocalBounds.min[0], bossLocalBounds.max[0]].flatMap((x) =>
      [bossLocalBounds.min[1], bossLocalBounds.max[1]].flatMap((y) =>
        [bossLocalBounds.min[2], bossLocalBounds.max[2]].map((z) =>
          new Vector3(x, y, z)
            .applyEuler(new Euler(
              ...(frame.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
              'ZYX',
            ))
            .add(new Vector3(...frame.at)),
        ),
      ),
    );
    for (const [index, corner] of corners.entries()) {
      if (corner.z <= additionsMaximumZ) bounds.expandByPoint(corner);
      // A tilted box cut by a horizontal plane gains vertices on its twelve edges.
      for (const bit of [1, 2, 4]) {
        const otherIndex = index ^ bit;
        if (otherIndex <= index) continue;
        const other = corners[otherIndex];
        if ((corner.z-additionsMaximumZ)*(other.z-additionsMaximumZ) < 0)
          bounds.expandByPoint(corner.clone().lerp(other,
            (additionsMaximumZ-corner.z)/(other.z-corner.z)));
      }
    }
  }
  return bounds;
};
const electronicsModuleIds = [
  'case-servo-driver-hat',
  'case-heltec-v4',
  'case-adc-cjmcu1220',
  'case-buck-1',
  'case-buck-2',
  'case-lc-filter-1',
  'case-lc-filter-2',
];
const allElectronicsModuleIds = [...electronicsModuleIds, 'case-pwm-mosfet'];
const electronicsServiceIds = (ids: string[], screws: string[], p: Parameters) => {
  const structure = casePanelStructure(p),
    retained = new Set([
      ...structure.brassSupports.supports.flatMap((row) => row.retainedComponentIds),
    ]);
  return ids.filter(
    (id) =>
      (['case-lower-body', 'case-lower-cradle', 'case-pwm-backing'].includes(id) ||
        retained.has(id) ||
        id.startsWith('case-electronics-') ||
        allElectronicsModuleIds.includes(id) ||
        [
          'case-test-clip-carrier',
          'case-test-clip-red',
          'case-test-clip-black',
          'case-pwm-keeper',
        ].includes(id)) &&
      !screws.includes(id),
  );
};
function containsPoint(model: Object3D, point: Vector3): boolean {
  const ray = new Ray(point, new Vector3(1, 0.371, 0.267).normalize()),
    vertices = [new Vector3(), new Vector3(), new Vector3()],
    hit = new Vector3();
  let occupied = false;
  model.traverse((object) => {
    if (occupied || !(object instanceof Mesh)) return;
    const position = object.geometry.getAttribute('position'),
      index = object.geometry.index,
      distances: number[] = [];
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      vertices.forEach((vertex, j) =>
        vertex
          .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
          .applyMatrix4(object.matrixWorld),
      );
      if (ray.intersectTriangle(vertices[0], vertices[1], vertices[2], false, hit))
        distances.push(point.distanceTo(hit));
    }
    // Closed source solids may touch or overlap. Their occupancies form a union;
    // collapsing coincident crossings across different solids changes parity.
    distances.sort((a, b) => a - b);
    occupied =
      distances.filter((distance, index) => !index || distance - distances[index - 1] > 1e-5)
        .length %
        2 ===
      1;
  });
  return occupied;
}

function positiveVolume(model: Object3D): number {
  let volume = 0;
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const position = object.geometry.getAttribute('position'),
      index = object.geometry.index;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const [a, b, c] = [0, 1, 2].map((j) =>
        new Vector3()
          .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
          .applyMatrix4(object.matrixWorld),
      );
      assert.ok([a, b, c].every((point) => point.toArray().every(Number.isFinite)));
      volume += a.dot(b.clone().cross(c)) / 6;
    }
  });
  return volume;
}

test('case-panel keeps two controls, a central LED and separated connector columns', () => {
  const p = input(),
    m = casePanelLayout(p),
    e = caseElectronicsLayout(p);
  assert.deepEqual(validateParameters(part, p, 'assembled'), []);
  assert.deepEqual([m.width, m.height], [214, 150.6]);
  assert.equal(m.panelCornerRadius, 4);
  near(m.panelBottom, 1.5);
  near(m.panelTop, 7.5);
  assert.deepEqual(m.connectors, [
    [12.3, 94],
    [12.3, 124.5],
  ]);
  assert.deepEqual(m.batteries, [
    [65, 91],
    [65, 124.5],
  ]);
  assert.deepEqual(m.batterySize, [88, 24, 74]);
  assert.ok(m.arm1[0] < m.arm2[0]);
  assert.equal('onOff' in m, false);
  assert.equal('start' in m, false);
  assert.equal('powerLegend' in m, false);
  assert.deepEqual(m.batteryLabelTexts, ['B2', 'B1']);
  assert.equal(m.mechanismLegendHost, 'case-top-bridge');
  near(m.mechanismLegendTopZ, 9.5);
  assert.deepEqual(m.sp20Legends.map((row) => row.text), ['TS', 'PS']);
  assert.deepEqual(m.sp20Legends.map((row) => row.centre[0]), [198, 198]);
  assert.deepEqual(m.sp20Legends.map((row) => row.centre[1]), [127.75, 87.75]);
  assert.deepEqual(m.indicators, [
    [136, 130.75],
    [136, 107.75],
    [136, 84.75],
  ]);
  assert.deepEqual(m.indicatorLegends.map((row) => row.text), ['I', 'R', 'P']);
  assert.deepEqual(m.indicatorLegends.map((row) => row.centre), [
    [152, 130.75],
    [152, 107.75],
    [152, 84.75],
  ]);
  assert.deepEqual(m.clipLegend, { text: 'ICT', centre: [180.5, 62.5] });
  assert.deepEqual(m.sp20Connectors, [
    [174, 127.75],
    [174, 87.75],
  ]);
  assert.ok(m.sp20Connectors[0][1] - m.sp20Connectors[1][1] > 2 * m.sp20NutToolRadius);
  assert.equal(m.indicatorHoleDiameter, 16);
  near(m.indicatorSeatZ, 7.5);
  assert.ok(m.sp20PanelThickness <= 4);
  assert.deepEqual(e.bodyMountAxes, [
    [61, 15],
    [61, 55],
    [106, 15],
    [106, 55],
  ]);
  near(m.panelTop - m.batteryFloorBottom, 63);
  near(m.batteryTop - m.panelTop, 13.4);
  assert.equal(m.testClips.length, 2);
  near(m.testClips[1][1] - m.testClips[0][1], 18);
  for (const patch of [{ baseLength: 200 }, { baseWidth: 151 }] as Parameters[])
    assert.ok(part.validate({ ...p, ...patch }, 'assembled').length);
});

test('four-post captured lower prints retain independent board adapters and metal supports', () => {
  const pieces = configured(input(), 'assembled'),
    c = pieces.map((v) => v.component),
    ids = c.map((v) => v.id),
    prints = pieces.filter((v) => v.component.supply === 'manufactured');
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [
    'parallel-base',
    'case-top-bridge',
    'case-lower-body',
    'case-lower-cradle',
    'case-pwm-backing',
    'parallel-clamp',
    'parallel-rocker',
    'case-test-clip-carrier',
    'case-pwm-keeper',
    'case-servo-shim',
    'case-fit-seat-ring',
    'case-panel-gasket',
    'case-electronics-analogue-hood',
  ])
    assert.ok(ids.includes(id), id);
  for (const id of ids)
    assert.doesNotMatch(
      id,
      /case-electronics-(?:deck|hanger|upper-screw|lower-nut|board-screw|board-nut)|case-servo-sleeve|guard-seat|case-arm1-cradle|case-onoff-cradle/,
    );
  assert.ok(
    !ids.some((id) =>
      /^case-body-|^case-cassette-(?:screw|nut|washer)-|^case-test-clip-(?:carrier-)?(?:\d+-)?(?:screw|nut)-|^parallel-clamp-(?:screw|nut)-|^case-battery-(?:bank|key|screw|nut)/.test(
        id,
      ),
    ),
  );
  assert.equal(ids.filter((id) => id.startsWith('case-lid-screw-')).length, 4);
  assert.equal(ids.filter((id) => id.startsWith('case-lid-nut-')).length, 0);
  const modular = casePanelStructure(input()).modularElectronics;
  const modularAnchors = modular.adapters.reduce((sum, adapter) => sum + adapter.anchors.length, 0);
  assert.equal(prints.length, 20 + modular.adapters.length + 1);
  assert.equal(ids.length, 125 + modular.adapters.length + 1 + 2 * modularAnchors);
  assert.ok(!ids.includes('case-electronics-quiet-keeper'));
  for (const id of ['case-electronics-adc-keeper', 'case-electronics-filter-2-keeper', ...modular.adapters.map((a) => a.id)])
    assert.ok(ids.includes(id), id);
  const split = casePanelStructure(input()).lowerSplit;
  const assemblyBearing = casePanelStructure(input()).bearings.find((row) => row.id === 'lower-panel-shoulder')!;
  assert.deepEqual(assemblyBearing.movingIds, ['case-lower-cradle', 'case-lower-body']);
  assert.ok(assemblyBearing.minimumAreaMm2 >= 500);
  const apron = casePanelStructure(input()).panelBearingApron;
  assert.equal(apron.partId, 'case-lower-cradle');
  assert.equal(apron.fixedId, 'parallel-base');
  near(apron.planeZ, 1.5);
  near(apron.thicknessMm, 3);
  assert.deepEqual(apron.regions.map((row) => row.id), [
    'front-arm1', 'front-servo', 'front-arm2',
    'rear-arm1', 'rear-servo', 'rear-arm2', 'left-front', 'left-rear',
  ]);
  for (const row of apron.regions) {
    assert.ok(row.minimumAreaMm2 >= 50 && row.rootProbes.length > 0);
    assert.deepEqual(row.shift, [0, 0, 0.01]);
    assert.ok(row.cellWidthMm <= 1 && row.minimumCoverageFraction >= 0.98);
    assert.ok(row.maximumGapMm <= 1 && row.minimumBearingWidthMm >= 1.5);
    assert.ok(row.minimumStraightLandWidthMm >= 3.5);
    const transverse = row.coverageAxis === 'x' ? 1 : 0;
    assert.ok(row.straightLandProbe.max[transverse] - row.straightLandProbe.min[transverse] >= 3.5 - 1e-7);
  }
  for (const row of apron.regions.filter((row) => row.id === 'front-arm1' || row.id === 'front-arm2')) {
    const bridge = row.rootProbes.at(-1)!;
    assert.ok(Math.min(bridge.max[0] - bridge.min[0], bridge.max[1] - bridge.min[1]) >= 3);
    assert.ok(bridge.min[1] < 10 && bridge.max[1] > 10);
  }
  assert.equal(apron.networkRegion.partId, apron.partId);
  assert.ok(apron.networkRegion.min[2] > -52.5);
  assert.equal(split.attachment, 'four-main-brass-post-capture');
  assert.equal('joints' in split || 'keys' in split || 'railContacts' in split, false);
  assert.equal(ids.some((id) => id.startsWith('case-lower-seam-')), false);
  assert.deepEqual(split.floorFootprint.size, [206.8, 141.2]);
  near(split.capturePlaneZ, -49.5);
  const capture = casePanelStructure(input()).fourPostCapture;
  assert.equal(capture.posts.length, 4);
  assert.equal(capture.retainedWhenLidRemoved, true);
  const carrierSupport = capture.carrierSupport;
  assert.equal('carrierSupportWeb' in capture, false);
  assert.equal(carrierSupport.architecture, 'straight-bed-rooted-ladder');
  assert.equal(carrierSupport.partId, 'case-lower-cradle');
  assert.equal(carrierSupport.carrierId, 'case-test-clip-carrier');
  assert.ok(carrierSupport.minimumMemberThicknessMm >= 3.5);
  near(carrierSupport.printBedPlaneZ, 1.5);
  near(carrierSupport.positiveBearingPlaneZ, -12);
  near(carrierSupport.fullDepthMm, 13.5);
  assert.ok(carrierSupport.mainWallLapMm >= 3);
  assert.equal(carrierSupport.crossRibs.length, 2);
  assert.equal(carrierSupport.sections.length, 4);
  assert.equal(carrierSupport.bedContactPatches.length, 4);
  assert.equal(carrierSupport.mainWallLapProbes.length, 2);
  assert.equal(carrierSupport.seatWallLapProbes.length, 2);
  assert.deepEqual(carrierSupport.retainedBrassSupportIds, [1, 2, 3, 4].map((i) => `case-brass-carrier-${i}`));
  for (const member of [carrierSupport.rootWall, carrierSupport.seatWall, ...carrierSupport.crossRibs]) {
    near(member.min[2], -12);
    near(member.max[2], carrierSupport.printBedPlaneZ);
    assert.ok(member.max[0] <= 149.5);
  }
  carrierSupport.sections.forEach((section, i) => {
    assert.ok(section.minimumAreaMm2 >= [54, 54, 58.05, 47.25][i] - 1e-7);
  });
  for (const lap of carrierSupport.seatWallLapProbes) {
    assert.ok(lap.min[2] <= -13 && lap.max[2] >= -10.1);
    assert.ok(lap.min[2] < carrierSupport.seatWall.min[2]);
  }
  for (const row of capture.posts) {
    assert.ok(ids.includes(row.brassId) && ids.includes(row.bottomScrewId) && ids.includes(row.lidScrewId));
    near(row.brassSeatZ - row.capturePlaneZ, 2);
    near(row.capturePlaneZ - row.headSeatZ, 2.9);
    assert.deepEqual(row.webAnnuli.map((w) => w.partId), ['case-lower-body', 'case-lower-cradle']);
    assert.deepEqual(row.webAnnuli.map((w) => w.minimumThicknessMm), [2.9, 2]);
    assert.deepEqual(row.contacts.map((v) => v.id), ['foot-to-tray', 'brass-to-foot', 'head-to-tray']);
    assert.deepEqual(row.retainedComponentIds, [row.brassId, row.bottomScrewId]);
    assert.deepEqual(row.removedBeforeWithdrawalIds, [row.lidScrewId]);
    assert.equal(row.sleeveWallProbes.length, 3);
    assert.equal(row.slotEdgeProbes.length, 2);
    assert.equal(row.closedEndProbes.length, 2);
    assert.equal(row.jointRootProbes.length, 2);
    near(row.cleaningSlot.widthMm, 2.4);
    near(row.cleaningSlot.min[2], -47.5);
    near(row.cleaningSlot.max[2], -19.7);
    assert.equal(row.socketRegistration.wallProbeSegments.length, 6);
    assert.equal(row.upperRootProbes.length, 2);
    assert.equal(row.footRootProbes.length, 2);
    near(row.socketRegistration.engagementMm, 49);
  }
  for (const c0 of c.filter((v) => v.id.startsWith('case-lid-screw-')))
    assert.equal(c0.parameters.length, 15);
  const supports = casePanelStructure(input()).brassSupports.supports;
  assert.equal(supports.length, 8);
  assert.equal(supports.filter((row) => row.role === 'main').length, 4);
  assert.equal(supports.filter((row) => row.role === 'carrier').length, 4);
  for (const row of supports) {
    assert.ok(ids.includes(row.id) && ids.includes(row.bottomScrewId));
    near(row.acrossFlatsMm, 5);
    near(row.topSeatZ - row.bottomSeatZ, row.bodyLengthMm);
    assert.equal(c.find((v) => v.id === row.bottomScrewId)!.parameters.length, 8);
    assert.ok(row.minimumFloorWebMm >= 2.9 - 1e-7);
    assert.deepEqual(row.clampedPartIds, row.role === 'main' ? ['case-lower-body', 'case-lower-cradle'] : ['case-lower-body']);
    assert.equal(row.bottomBearingPartId, row.role === 'main' ? 'case-lower-cradle' : 'case-lower-body');
    assert.deepEqual(row.webParts.map((w) => w.partId), row.clampedPartIds);
    near(row.webParts.reduce((sum, w) => sum + w.minimumThicknessMm, 0), row.minimumFloorWebMm);
    assert.ok(row.minimumUsableFemaleDepthMm >= (row.role === 'carrier' ? 5.5 : 3.5));
  }
  assert.equal(c.filter((v) => v.parameters.model === 'xt60e-m').length, 2);
  assert.equal(
    c.filter(
      (v) =>
        v.libraryId === 'panel-switch' && String(v.parameters.model).startsWith('daier-asw-07d'),
    ).length,
    2,
  );
  assert.equal(ids.includes('power-toggle-switch'), false);
  assert.equal(ids.includes('case-onoff-gasket'), false);
  for (const [i, colour] of ['red', 'yellow', 'green'].entries()) {
    const v = c.find((v) => v.id === `case-indicator-${i + 1}`)!;
    assert.equal(v.libraryId, 'panel-indicator');
    assert.equal(v.parameters.model, 'lehao-ad16-16c');
    assert.equal(v.parameters.lensColour, colour);
  }
  for (const n of [1, 2]) {
    const v = c.find((v) => v.id === `case-sp20-connector-${n}`)!;
    assert.equal(v.parameters.model, 'sp20-4-panel-socket');
    assert.ok(Number(v.parameters.panelThickness) <= 4);
  }
  for (const v of prints) {
    assert.equal(v.requireSingleSolid, true, v.component.id);
    assert.ok(v.component.manufacturing?.requirements?.length, v.component.id);
  }
  assert.deepEqual(
    ids.filter((id) => /^case-electronics-.*-keeper$/.test(id)).sort(),
    [
      'case-electronics-heltec-keeper',
      'case-electronics-buck-1-keeper',
      'case-electronics-buck-2-keeper',
      'case-electronics-filter-1-keeper',
      'case-electronics-adc-keeper',
      'case-electronics-filter-2-keeper',
    ].sort(),
  );
  for (const prefix of [
    'case-electronics-hat-screw-',
    'case-electronics-hat-nut-',
    'case-electronics-hat-washer-',
  ])
    assert.equal(ids.filter((id) => id.startsWith(prefix)).length, 4);
  for (const colour of ['red', 'black']) {
    const v = c.find((v) => v.id === `case-test-clip-${colour}`)!;
    assert.equal(v.parameters.model, 'lever-clip-55-bottom');
    assert.deepEqual(v.placement.rotation, [0, 0, -90]);
  }
});

test('seven wall mounts retain the measured side coordinates and the upper-groove datum', () => {
  const p = input(),
    mounts = caseWallMountStructure(p),
    enclosure = caseFitLayout(p),
    coordinates = {
      front: [30, 184],
      rear: [60, 154],
      left: [75],
      right: [25, 125],
    };
  assert.equal(mounts.mounts.length, 7);
  near(mounts.caseWallThicknessMm!, 4);
  assert.equal(mounts.exteriorScrewsIncluded, true);
  for (const [side, along] of Object.entries(coordinates)) {
    const rows = mounts.mounts.filter((row) => row.side === side);
    assert.equal(rows.length, along.length);
    assert.deepEqual(rows.map((row) => row.axisPoint[side === 'left' || side === 'right' ? 1 : 0]), along);
    for (const row of rows) {
      near(row.axisPoint[2], 0.5);
      near(enclosure.rimZ - row.axisPoint[2], 20);
      near(enclosure.grooveFloorZ - row.axisPoint[2], 18);
      near(new Vector3(...row.inwardAxis).length(), 1);
      near(row.nominalGapMm, 0.2);
    }
  }
});

test('eight modules use two left power bays and an insulated ADC filter pod with separate mechanical routes', () => {
  const p = input(),
    m = caseElectronicsLayout(p),
    c = configured(p, 'assembled').map((v) => v.component),
    byId = new Map(c.map((v) => [v.id, v]));
  assert.ok(allElectronicsModuleIds.every((id) => byId.has(id)));
  assert.equal(byId.get('case-servo-driver-hat')!.libraryId, 'bus-servo-driver');
  assert.equal(byId.get('case-heltec-v4')!.libraryId, 'lora-module');
  assert.deepEqual(m.hat.at, [152, 38.5, -40.5]);
  assert.deepEqual(m.hat.rotation, [0, 0, 0]);
  assert.deepEqual(m.heltec.at, [53, 33, -44]);
  assert.deepEqual(m.heltec.rotation, [0, 0, 90]);
  assert.deepEqual(
    m.bucks.map((v) => v.at),
    [
      [35, 10, -33.7],
      [35, 52, -33.7],
    ],
  );
  assert.ok(m.bucks.every((v) => v.rotation[0] === -90));
  assert.deepEqual(m.adc.at, [177, 102, -44]);
  assert.deepEqual(m.filters[1].at, [176, 126, -44]);
  assert.deepEqual(m.pwm.at, [181, 31, -18.8]);
  assert.deepEqual(m.pwm.rotation, [-90, 0, 0]);
  assert.deepEqual(m.quietPodMin, [156, 80]);
  assert.deepEqual(m.quietPodMax, [198, 138]);
  assert.ok(m.adc.at[0] - Math.max(...m.bucks.map((v) => v.at[0])) > 100);
  assert.ok(m.pwm.at[1] + 8 < m.quietPodMin[1] - 30);
  near(m.floorBottom, -55.5);
  near(m.floorTop - m.floorBottom, 3);
  assert.deepEqual(m.floorMin, [5, 6]);
  assert.deepEqual(m.floorMax, [209, 144]);
  const honeycomb = caseElectronicsHoneycomb(p);
  assert.ok(honeycomb.centres.length > 10);
  assert.equal(honeycomb.cells.length, honeycomb.centres.length);
  assert.ok(
    honeycomb.cells.every((cell) => cell.flat >= 8 && cell.flat <= 24 && cell.points.length === 6),
  );
  assert.ok(honeycomb.minimumWeb >= 2.6);
  assert.ok(honeycomb.minimumWeb >= 2.4 && honeycomb.perimeterWidth >= 6);
  assert.ok(honeycomb.mountingIslandRadius >= 8 && honeycomb.tieLandWidth >= 5);
  assert.ok(m.tieSlot[0] > m.tieWidth && m.tieSlot[1] > m.tieThickness);
  const access = caseElectronicsAccess(p),
    emi = caseElectronicsEmi(p);
  assert.equal(access.physicalCableOccurrences, 0);
  assert.equal(access.reserves.length, 5);
  assert.equal(access.reserves.filter((v) => v.scope === 'installed').length, 2);
  for (const v of access.reserves) {
    assert.ok(v.min.every((x, i) => x < v.max[i]));
    near(Math.hypot(...v.outward), 1);
    assert.match(v.limits, /unverified|not qualified|does not qualify/);
  }
  assert.equal(emi.physicalWireOccurrences, 0);
  assert.match(JSON.stringify(emi), /EXTERIOR|exterior/);
  const moving = electronicsServiceIds(
    c.map((v) => v.id),
    m.serviceScrewIds,
    p,
  );
  assert.ok(moving.includes('case-lower-body'));
  assert.ok(moving.includes('case-lower-cradle'));
  assert.ok(moving.includes('case-pwm-backing'));
  assert.ok(electronicsModuleIds.every((id) => moving.includes(id)));
  assert.ok(moving.includes('case-pwm-mosfet'));
  assert.ok(
    [
      'case-test-clip-carrier',
      'case-test-clip-red',
      'case-test-clip-black',
      'case-pwm-keeper',
    ].every((id) => moving.includes(id)),
  );
  for (const id of allElectronicsModuleIds.slice(2)) {
    assert.equal(byId.get(id)!.supply, 'purchased');
    assert.match(byId.get(id)!.notes!, /provisional|unverified|not verified|user/);
  }
});

test('the independent ledge adapter retains the measured case floor and closed lid margins', () => {
  const p = input(),
    e = caseFitLayout(p),
    m = casePanelLayout(p),
    c = configured(p, 'assembled').map((v) => v.component);
  assert.deepEqual(e.topOpening, [214, 150]);
  assert.deepEqual(e.bottomOpening, [208, 142]);
  assert.deepEqual(e.grooveSize, [218, 154, 2]);
  near(e.grooveFloorZ - e.innerFloorZ, 75);
  near(e.lidCeilingZ - e.rimZ, 18);
  near(m.batteryFloorBottom - e.innerFloorZ, 1);
  near(e.lidCeilingZ - e.closedCoverTopZ, 1.2);
  assert.equal(e.cornerRadiusApproximate, true);
  near(e.cornerRadius, 6);
  assert.deepEqual(e.panelSize, [214, 150.6]);
  assert.equal(e.workingPanelFit.componentId, 'parallel-base');
  assert.equal(e.workingPanelFit.status, 'provisional-physical-fit-prototype');
  assert.deepEqual(e.workingPanelFit.centre, [107, 75]);
  assert.deepEqual(e.workingPanelFit.outerSize, [214, 150.6]);
  assert.equal(e.workingPanelFit.cornerRadius, 4);
  near(e.workingPanelFit.minZ, m.panelBottom);
  near(e.workingPanelFit.maxZ, m.panelTop);
  assert.equal(e.workingPanelFit.fullTaperReMeasured, false);
  assert.equal(e.workingPanelFit.cornerRadiusMeasured, false);
  assert.deepEqual(e.ringOuterSize, [217.4, 154.4]);
  assert.deepEqual(e.ringCentre, [107, 74.5]);
  assert.deepEqual(e.workingRingFit.componentIds, ['case-fit-seat-ring', 'case-panel-gasket']);
  assert.equal(e.workingRingFit.status, 'provisional-user-requested-front-edge-extension');
  assert.deepEqual(e.workingRingFit.direction, [0, -1, 0]);
  near(e.workingRingFit.extensionMm, 1);
  assert.deepEqual(e.workingRingFit.referenceCentre, [107, 75]);
  assert.deepEqual(e.workingRingFit.referenceOuterSize, [217.4, 153.4]);
  assert.deepEqual(e.workingRingFit.fixedMountingAxes, e.mountingAxes);
  near(e.ringCentre[1] + e.ringOuterSize[1] / 2, 75 + 153.4 / 2);
  near(e.ringCentre[1] - e.ringOuterSize[1] / 2, 75 - 153.4 / 2 - 1);
  assert.deepEqual(e.gasketInnerOpening, [214, 151]);
  assert.deepEqual(e.gasketInnerCentre, [107, 74.5]);
  const wall = e.ringWallMounting;
  assert.equal(wall.hostId, 'case-fit-seat-ring');
  assert.equal(wall.holes.length, 9);
  assert.equal(new Set(wall.holes.map((hole) => hole.id)).size, 9);
  assert.deepEqual(wall.holes.map((hole) => [hole.side, hole.alongMm]), [
    ['left', 15], ['left', 134], ['right', 107.75], ['right', 64],
    ['front', 145], ['front', 17], ['rear', 20], ['rear', 107], ['rear', 194],
  ]);
  assert.deepEqual(wall.installation.removedComponentIds, ['case-battery-pack-1', 'case-battery-pack-2']);
  assert.deepEqual([
    wall.installation.shaftDiameterMm, wall.installation.shaftLengthMm,
    wall.installation.handleDiameterMm, wall.installation.handleLengthMm,
    wall.installation.engagementTravelMm,
  ], [6, 20, 8, 20, 5]);
  near(wall.boreDiameterMm, 3.4);
  near(wall.countersinkDiameterMm, 6.2);
  near(wall.countersinkAngleDegrees, 90);
  near(wall.countersinkDepthMm, 1.4);
  assert.ok(wall.minimumCylindricalWebMm >= 3.4 && wall.minimumTopEdgeLandMm >= 1.2);
  for (const hole of wall.holes) {
    near(hole.headFace[2], 16);
    near(Math.hypot(...hole.outward), 1);
    near(hole.wallPoint.reduce((sum, value, i) => sum + (value - hole.headFace[i]) * hole.outward[i], 0), 5);
  }
  assert.equal(e.postReinforcement.architecture, 'two-wall-full-height-T-roots');
  assert.ok(e.postReinforcement.ribWidthMm >= 4 && e.postReinforcement.reachMm >= 12);
  assert.ok(e.postReinforcement.minimumPostLapMm >= 4.2);
  near(e.gasketBottomZ, e.grooveFloorZ);
  near(e.gasketTopZ, e.ringFlangeBottomZ);
  near(e.ringFlangeTopZ - e.grooveFloorZ, 1.8);
  near(e.skirtBottomZ, m.panelTop);
  for (const prefix of ['case-fit-screw-', 'case-fit-nut-', 'case-fit-washer-'])
    assert.equal(c.filter((v) => v.id.startsWith(prefix)).length, 4);
});

test('the flat front, keyed full bores, rear indicator relief and 0.7 mm servo shim are physical', () => {
  const p = input(),
    m = casePanelLayout(p),
    pieces = configured(p, 'assembled'),
    model = part.buildGeometry(p, 'assembled');
  try {
    model.updateMatrixWorld(true);
    const child = (id: string) => {
        const i = pieces.findIndex((v) => v.component.id === id);
        assert.ok(i >= 0, id);
        return model.children[i];
      },
      plate = child('parallel-base'),
      b = new Box3().setFromObject(plate, true);
    near(b.min.z, plateEnvelope(p).min.z);
    near(b.max.z, m.panelTop);
    const declaredEnvelope = plateEnvelope(p);
    for (const axis of [0, 1, 2]) {
      near(b.min.getComponent(axis), declaredEnvelope.min.getComponent(axis));
      near(b.max.getComponent(axis), declaredEnvelope.max.getComponent(axis));
    }
    // The main slab has its own bearing planes; integral underside bosses extend lower.
    for (const z of [m.panelBottom + 0.01, m.panelTop - 0.01])
      assert.ok(containsPoint(plate, new Vector3(100, 3.5, z)));
    for (const z of [m.panelBottom - 0.01, m.panelTop + 0.01])
      assert.equal(containsPoint(plate, new Vector3(100, 3.5, z)), false);
    for (const [x, y] of m.indicators) {
      assert.equal(containsPoint(plate, new Vector3(x, y, 7.4)), false);
      assert.ok(containsPoint(plate, new Vector3(x + 8.3, y, 7.4)));
      assert.equal(containsPoint(plate, new Vector3(x + 8.3, y, 1.6)), false);
    }
    for (const [x, y] of m.sp20Connectors) {
      assert.equal(containsPoint(plate, new Vector3(x + 10.1, y, 7.4)), false);
      assert.ok(containsPoint(plate, new Vector3(x, y + 9.6, 7.4)));
    }
    const shim = new Box3().setFromObject(child('case-servo-shim'), true).getSize(new Vector3());
    near(Math.min(shim.x, shim.y, shim.z), 0.7);
    const body = new Box3().setFromObject(child('case-lower-body'), true);
    near(body.min.z, -55.5);
    for (const [x, y] of caseElectronicsLayout(p).bodyMountAxes)
      assert.ok(
        containsPoint(child('case-lower-body'), new Vector3(x + 3, y, -55)),
        'Every main brass seat has a complete printed floor root.',
      );
    for (const [x, y] of caseElectronicsLayout(p).bodyMountAxes)
      assert.equal(
        containsPoint(child('case-lower-body'), new Vector3(x, y, -30)),
        false,
        'The shared screw bore stays open.',
      );
    const structure = casePanelStructure(p);
    assert.equal(structure.mechanismAxialSeats.length, 4);
    assert.equal(structure.mechanismGuides.length, 12);
    assert.equal(structure.mechanismGuides.filter((row) => row.hostId === 'drive-servo').length, 4);
    for (const guide of structure.mechanismGuides) {
      const centre = new Vector3(
        ...(guide.probe.min.map((v, axis) => (v + guide.probe.max[axis]) / 2) as [
          number,
          number,
          number,
        ]),
      );
      assert.ok(containsPoint(child(guide.partId), centre), guide.id);
      assert.equal(containsPoint(child(guide.hostId), centre), false, guide.id);
      if (guide.hostId === 'drive-servo') {
        near(guide.nominalGapMm, guide.probe.min[2] === -12 ? 0.506975576 : 0.456605128, 1e-6);
        near(guide.gapToleranceMm, 0.005);
      } else near(guide.nominalGapMm, 0.4);
    }
    for (const [x, y] of caseElectronicsHoneycomb(p).centres)
      assert.equal(
        containsPoint(child('case-lower-body'), new Vector3(x, y, -54.3)),
        false,
        'Honeycomb cells are through openings.',
      );
    for (const n of [1, 2]) {
      const pack = new Box3().setFromObject(child(`case-battery-pack-${n}`), true);
      near(pack.max.z - pack.min.z, 74);
      near(pack.max.z, m.batteryTop);
    }
    near(new Box3().setFromObject(child('manual-toggle-switch'), true).max.z, 37.3);
    assert.ok(new Box3().setFromObject(model, true).min.z >= -55.501);
  } finally {
    disposeModel(model);
  }
});

test('joined spring clips face contacts right and keep their geometric hinge envelope below closed covers', () => {
  const p = input(),
    layout = casePanelLayout(p),
    pieces = configured(p, 'assembled');
  for (const colour of ['red', 'black']) {
    const clip = pieces.find((p) => p.component.id === `case-test-clip-${colour}`)!.component,
      source = terminal.buildGeometry(clip.parameters, 'assembled'),
      rotation = new Euler(
        ...(clip.placement.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
        'ZYX',
      ),
      origin = new Vector3(...clip.placement.translation),
      world = (point: Vector3) => point.applyEuler(rotation).add(origin),
      contact = world(new Vector3(0, 19.5, 29)),
      spring = world(new Vector3(0, -15, 21));
    assert.ok(contact.x > origin.x && spring.x < origin.x);
    near(contact.y, origin.y);
    near(spring.y, origin.y);
    near(origin.z, layout.testClipSeatZ);
    let highest = -Infinity;
    try {
      source.updateMatrixWorld(true);
      source.children.forEach((child) =>
        child.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const vertices = object.geometry.getAttribute('position');
          for (let i = 0; i < vertices.count; i++) {
            const point = new Vector3()
              .fromBufferAttribute(vertices, i)
              .applyMatrix4(object.matrixWorld);
            if (/ridged pivot lever|moving brass jaw/.test(child.name)) {
              const angle = Math.max(
                0,
                Math.min(Math.PI / 2, Math.atan2(point.y - 7, point.z - 21.7)),
              );
              point.z = 21.7 + (point.y - 7) * Math.sin(angle) + (point.z - 21.7) * Math.cos(angle);
            }
            highest = Math.max(highest, point.z + origin.z);
          }
        }),
      );
      assert.ok(
        highest < 37.3 - 0.4,
        'Even the hypothetical free hinge0–90° height remains below the closed cover.',
      );
    } finally {
      disposeModel(source);
    }
  }
});

test('manual controls retain their own positions across all servo phases', () => {
  const phases = ['off', 'press-on', 'on', 'press-off'];
  const manual = (p: Parameters) =>
    configured(p, 'assembled')
      .map((piece) => piece.component)
      .filter(
        (component) =>
          component.libraryId === 'panel-switch' &&
          String(component.parameters.model).startsWith('daier-asw-07d') &&
          component.id !== 'toggle-switch',
      );
  const baseline = manual(input());
  assert.equal(baseline.length, 1);
  for (const phase of phases) {
    const p = input({ phase });
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    assert.deepEqual(manual(p), baseline);
  }
});

test('assembled and separated panel previews match their export geometry and retain positive component volumes', () => {
  for (const state of ['assembled', 'exploded']) {
    const p = input(),
      pieces = configured(p, state),
      preview = part.buildGeometry(p, state),
      exported = part.buildExportGeometry!(p, state);
    try {
      preview.updateMatrixWorld(true);
      exported.updateMatrixWorld(true);
      assert.equal(preview.children.length, pieces.length);
      assert.equal(exported.children.length, pieces.length);
      for (const [index, piece] of pieces.entries()) {
        assert.ok(positiveVolume(preview.children[index]) > 0, piece.component.id);
        const a = new Box3().setFromObject(preview.children[index], true),
          b = new Box3().setFromObject(exported.children[index], true);
        a.min.toArray().forEach((value, axis) => near(value, b.min.toArray()[axis], 0.02));
        a.max.toArray().forEach((value, axis) => near(value, b.max.toArray()[axis], 0.02));
      }
      const actual = new Box3().setFromObject(preview, true).getSize(new Vector3()).toArray();
      part.dimensions(p, state).forEach((value, axis) => near(value, actual[axis], 0.02));
    } finally {
      disposeModel(preview);
      disposeModel(exported);
    }
  }
});

test(
  'native compact panel clears its hardware, battery insertion and provisional clip press sweeps',
  { skip: !process.env.FREECAD_PYTHON, timeout: 1_800_000 },
  () => {
    const p = input(),
      layout = casePanelLayout(p),
      electronics = caseElectronicsLayout(p),
      electronicsAccess = caseElectronicsAccess(p),
      enclosure = caseFitLayout(p),
      wallMounts = caseWallMountStructure(p),
      plateSolidEnvelope = plateEnvelope(p),
      labels = terminalPieces({ model: 'lever-clip-55-bottom' }, 'assembled').map((p) => p.label),
      movingIndices = ['ridged pivot lever', 'moving brass jaw'].map((name) =>
        labels.findIndex((label) => label.includes(name)),
      );
    assert.ok(movingIndices.every((index) => index >= 0));
    const jobs = [
      { phase: 'off' },
      { phase: 'press-on' },
      { phase: 'press-off' },
      { phase: 'off', manualState: 'open-off' },
      { phase: 'on', manualState: 'open-on' },
    ].map((values) => {
      const parameters = { ...p, ...values } as Parameters;
      return {
        values,
        source: part.python(parameters, 'assembled'),
        records: configured(parameters, 'assembled').map((piece) => ({
          id: piece.component.id,
          fingerprint: createHash('sha256')
            .update(
              JSON.stringify([
                piece.component.libraryId,
                piece.component.parameters,
                piece.component.state,
                piece.component.placement,
              ]),
            )
            .digest('hex'),
          supply: piece.component.supply,
          parameters: piece.component.parameters,
          placement: piece.component.placement,
          translation: piece.component.placement.translation,
          rotation: piece.component.placement.rotation,
          diameter: piece.component.parameters.diameter,
          headHeight: piece.component.parameters.headHeight,
          headSize: piece.component.parameters.headSize,
        })),
      };
    });
    const packingReserves = [
      {
        id: 'case-adc-cjmcu1220',
        keeperId: 'case-electronics-adc-keeper',
        pose: electronics.adc,
        size: electronics.adcReserve,
      },
      ...electronics.bucks.map((pose, i) => ({
        id: `case-buck-${i + 1}`,
        keeperId: `case-electronics-buck-${i + 1}-keeper`,
        pose,
        size: electronics.buckReserve,
      })),
      ...electronics.filters.map((pose, i) => ({
        id: `case-lc-filter-${i + 1}`,
        keeperId: `case-electronics-filter-${i + 1}-keeper`,
        pose,
        size: electronics.filterReserve,
      })),
    ].map(({ pose, size, ...record }) => {
      const e = new Euler(
          ...(pose.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
          'ZYX',
        ),
        corners = [-1, 1].flatMap((x) =>
          [-1, 1].flatMap((y) =>
            [0, 1].map((z) =>
              new Vector3((x * size[0]) / 2, (y * size[1]) / 2, z * size[2])
                .applyEuler(e)
                .add(new Vector3(...pose.at)),
            ),
          ),
        );
      const adapter = casePanelStructure(p).modularElectronics.adapters.find((a) => a.boardId === record.id)!;
      return {
        ...record,
        ownMountIds: [adapter.id, ...adapter.anchors.flatMap((a) => [a.screwId, a.nutId])],
        min: [0, 1, 2].map((i) => Math.min(...corners.map((v) => v.getComponent(i)))),
        max: [0, 1, 2].map((i) => Math.max(...corners.map((v) => v.getComponent(i)))),
      };
    });
    const preset = part.presets.find((item) => item.parameters.mechanism === 'case-panel')!,
      sourceCodeSha256 = createHash('sha256')
        .update(generateScript(part, p, 'assembled', preset.id))
        .digest('hex');
    const script = `
import FreeCAD as App, Part, math, json, builtins, runpy, hashlib, time, ast
from pathlib import Path
jobs=json.loads(${JSON.stringify(JSON.stringify(jobs))})
enclosure=json.loads(${JSON.stringify(JSON.stringify(enclosure))})
case_fit=runpy.run_path('scripts/case-panel-native-fixture.py')
case_fit_reports=[]
open_case=case_fit['enclosure_fixture'](enclosure,closed=False)[0]
progress_path=${JSON.stringify(process.env.CASE_PANEL_NATIVE_PROGRESS ?? '')}
def progress(stage,values):
 if progress_path:
  with Path(progress_path).open('a') as log: log.write(json.dumps({'stage':stage,'values':values})+'\\n')
cache={}
native_cache=${JSON.stringify(process.env.CASE_PANEL_NATIVE_CACHE ?? '')}
loaded_cache_entries=0
if native_cache:
 for attempt in range(600):
  try:
   manifest=json.loads((Path(native_cache)/'manifest.json').read_text())
   if manifest.get('sourceCodeSha256')==${JSON.stringify(sourceCodeSha256)} and manifest.get('complete')is not False:break
  except (FileNotFoundError,json.JSONDecodeError):pass
  time.sleep(1)
 else:raise RuntimeError('Matching complete native source cache did not become ready')
 assert manifest['sourceCodeSha256']==${JSON.stringify(sourceCodeSha256)},'native cache belongs to another source'
 for entry in manifest['entries']:
  digest=hashlib.sha256(entry['source'].encode()).hexdigest()
  assert entry['file']==digest+'.brep'
  file=Path(native_cache)/entry['file']
  assert hashlib.sha256(file.read_bytes()).hexdigest()==entry['sha256'],'native cache checksum'
  shape=Part.Shape(); shape.read(str(file))
  assert shape.isValid() and shape.isClosed()
  assert len(shape.Solids)==entry['solids'] and len(shape.Faces)==entry['faces']
  assert abs(shape.Volume-entry['volumeMm3'])<=max(1e-7,abs(entry['volumeMm3'])*1e-9)
  cache[entry['source']]=(shape,entry['metadata'],entry['labels'])
  loaded_cache_entries+=1
 progress('native-cache-loaded',{'entries':loaded_cache_entries})
large_parts={}
shape_boxes={}
pair_cache={}
pair_checks=0
pair_reuses=0
validated_components=set()
def shape_bounds(shape):
 cached=shape_boxes.get(builtins.id(shape))
 if cached is None:
  cached=(shape,shape.BoundBox); shape_boxes[builtins.id(shape)]=cached
 return cached[1]
def boxes_overlap(aa,bb):
 return all(min(getattr(aa,d+'Max'),getattr(bb,d+'Max'))-max(getattr(aa,d+'Min'),getattr(bb,d+'Min'))>=1e-6 for d in 'XYZ')
def solid_parts(shape):
 cached=large_parts.get(builtins.id(shape))
 if cached is not None: return cached[1]
 parts=[(solid,solid.BoundBox) for solid in shape.Solids]
 if len(parts)>=32: large_parts[builtins.id(shape)]=(shape,parts)
 return parts
def overlap(a,b):
 if not boxes_overlap(shape_bounds(a),shape_bounds(b)): return 0
 first=solid_parts(a); second=solid_parts(b)
 if max(len(first),len(second))>=32:
  return sum(left.common(right).Volume for left,left_box in first for right,right_box in second if boxes_overlap(left_box,right_box))
 return a.common(b).Volume
def cached_overlap(a,b,first_key,second_key):
 global pair_checks,pair_reuses
 key=tuple(sorted((first_key,second_key)))
 if key in pair_cache:
  pair_reuses+=1
  return pair_cache[key]
 pair_checks+=1
 volume=overlap(a,b)
 pair_cache[key]=volume
 return volume
head_bearing_areas=[]
hat_nut_loading_checks=[]
case_mount_checks=[]
access_checks=[]
for job_number,job in enumerate(jobs):
 progress('start',job['values'])
 records=job['records']
 env={'App':App,'Part':Part,'math':math,'_case_panel_cache':cache}
 tree=ast.parse(job['source'].replace('_pl_component_cache = {}','_pl_component_cache = _case_panel_cache'))
 nodes=[];cursor=-1
 for node in tree.body:
  if isinstance(node,ast.Assign)and isinstance(node.value,ast.Call)and isinstance(node.value.func,ast.Name)and node.value.func.id=='_pl_component':cursor+=1
  validation=isinstance(node,ast.If)and not node.orelse and all(isinstance(n,ast.Raise)for n in node.body)and any(isinstance(n,ast.Name)and n.id=='component'for n in ast.walk(node.test))and any(token in ast.unparse(node.test)for token in['isValid','isClosed','isNull','Solids'])
  if cursor>=0 and validation and records[cursor]['fingerprint']in validated_components:continue
  nodes.append(node)
 assert cursor+1==len(records),'native component validation cursor differs from recipe'
 exec(compile(ast.fix_missing_locations(ast.Module(body=nodes,type_ignores=[])),'<fresh-state-audit>','exec'),env)
 components=env['components']
 index={r['id']:i for i,r in enumerate(records)}
 for shape,record in zip(components,records):
  if record['fingerprint'] in validated_components:continue
  assert shape.isValid() and shape.isClosed() and shape.Volume>0,(job['values'],record['id'])
  if record['supply']=='manufactured': assert len(shape.Solids)==1,(record['id'],'disconnected printable')
  validated_components.add(record['fingerprint'])
 plate=components[index['parallel-base']]
 assert abs(plate.BoundBox.ZMin-${plateSolidEnvelope.min.z})<1e-7,('plate underside envelope',plate.BoundBox.ZMin,${plateSolidEnvelope.min.z})
 assert abs(plate.BoundBox.ZMax-${layout.panelTop})<1e-7
 # OCC's default box can overbound tilted trimmed faces. Check their exact
 # outer vertices and cut against the independently clipped declared envelope.
 for axis in [0,1]:
  values=[v.Point[axis]for v in plate.Vertexes]
  assert abs(min(values)-${JSON.stringify(plateSolidEnvelope.min.toArray())}[axis])<1e-7,'plate ear minimum envelope'
  assert abs(max(values)-${JSON.stringify(plateSolidEnvelope.max.toArray())}[axis])<1e-7,'plate ear maximum envelope'
 declared_envelope=Part.makeBox(${plateSolidEnvelope.max.x - plateSolidEnvelope.min.x},${plateSolidEnvelope.max.y - plateSolidEnvelope.min.y},${plateSolidEnvelope.max.z - plateSolidEnvelope.min.z},App.Vector(${plateSolidEnvelope.min.x},${plateSolidEnvelope.min.y},${plateSolidEnvelope.min.z}))
 assert plate.cut(declared_envelope).Volume<1e-6,'native material exceeds declared panel/ear envelope'
 main_slab=plate.common(Part.makeBox(${layout.width},${layout.height},${layout.panelThickness},App.Vector(${layout.min[0]},${layout.min[1]},${layout.panelBottom})))
 assert main_slab.isValid()and main_slab.isClosed()and len(main_slab.Solids)==1,'disconnected main panel slab'
 # The exact Boolean crop is inside this box, while OCC's analytic trimmed-face
 # BoundBox can extend beyond it. Verify actual boundary vertices and material.
 for axis,expected in enumerate([(${layout.min[0]},${layout.max[0]}),(${layout.min[1]},${layout.max[1]}),(${layout.panelBottom},${layout.panelTop})]):
  vertices=[v.Point[axis]for v in main_slab.Vertexes]
  assert abs(min(vertices)-expected[0])<1e-7 and abs(max(vertices)-expected[1])<1e-7,('main panel slab exact dimensions',axis,min(vertices),max(vertices),expected)
 slab_box=Part.makeBox(${layout.width},${layout.height},${layout.panelThickness},App.Vector(${layout.min[0]},${layout.min[1]},${layout.panelBottom}))
 assert main_slab.cut(slab_box).Volume<1e-6,'main panel slab exceeds exact declared box'
 for x,y in ${JSON.stringify(layout.indicators)}:
  bore=Part.makeCylinder(7.99,${layout.panelThickness + 2},App.Vector(x,y,${layout.panelBottom - 1}))
  assert plate.common(bore).Volume<1e-4,(x,y,'blocked diameter16 hole')
 for x,y in ${JSON.stringify(layout.indicators)}:
  assert plate.isInside(App.Vector(x+8.5,y,${layout.indicatorSeatZ - 0.1}),1e-7,False),(x,y,'missing2 mm indicator web')
  assert not plate.isInside(App.Vector(x+8.5,y,${layout.panelBottom + 0.1}),1e-7,False),(x,y,'blocked indicator rear nut relief')
 for x,y in ${JSON.stringify(layout.sp20Connectors)}:
  opening=Part.makeCylinder(10.24,${layout.panelThickness + 2},App.Vector(x,y,${layout.panelBottom - 1}))
  opening=opening.common(Part.makeBox(30,19.48,${layout.panelThickness + 2},App.Vector(x-15,y-10.24,${layout.panelBottom - 1})))
  assert plate.common(opening).Volume<1e-4,(x,y,'blocked SP20 D opening')
  assert plate.isInside(App.Vector(x,y+9.6,${layout.sp20SeatZ - 0.1}),1e-7,False),(x,y,'missing SP20 anti-rotation flat')
  assert plate.isInside(App.Vector(x+12,y,${layout.sp20SeatZ - 0.1}),1e-7,False),(x,y,'missing4 mm SP20 web')
  assert not plate.isInside(App.Vector(x+12,y,${layout.panelBottom + 0.1}),1e-7,False),(x,y,'blocked SP20 rear nut relief')
 bank=components[index['case-lower-body']]
 assert abs(bank.BoundBox.ZMin-${layout.batteryFloorBottom})<1e-7
 for number in [1,2]:
  pack=components[index['case-battery-pack-'+str(number)]]
  assert abs(pack.BoundBox.ZMax-${layout.batteryTop})<1e-7
  for lift in [0,10,35,75]:
   insertion=pack.copy(); insertion.translate(App.Vector(0,0,lift))
   for target in [bank,plate]:
    assert overlap(target,insertion)<.001,(number,lift,'blocked vertical battery insertion')
 for i,a in enumerate(components):
  for j in range(i+1,len(components)):
   volume=cached_overlap(a,components[j],records[i]['fingerprint'],records[j]['fingerprint'])
   assert volume<.001,(job['values'],records[i]['id'],records[j]['id'],volume)
 progress('installed-pairs-clear',job['values'])
 carrier=components[index['case-test-clip-carrier']]
 assert carrier.BoundBox.ZMin<=${layout.testClipFloorBottom}
 for x,y in ${JSON.stringify(layout.testClips)}:
  floor=Part.makeBox(2,2,${layout.testClipSeatZ - layout.testClipFloorBottom - 0.2},App.Vector(x-1,y-1,${layout.testClipFloorBottom + 0.1}))
  assert floor.cut(carrier).Volume<1e-5,(x,y,'discontinuous reinforced clip floor')
 case_report=case_fit['audit_case_fit'](enclosure,records,components,closed=job_number<3,mounting=json.loads(${JSON.stringify(JSON.stringify(wallMounts))}))
 assert case_report['passed'],(job['values'],case_report)
 case_fit_reports.append({'state':job['values'],**case_report})
 progress('case-envelope-clear',job['values'])
 if job_number==0:
  adapter=components[index[${JSON.stringify(enclosure.ringId)}]]
  for number in range(1,5):
   screw_id='case-fit-screw-'+str(number)
   screw=components[index[screw_id]]; record=records[index[screw_id]]
   nut=components[index['case-fit-nut-'+str(number)]]
   washer=components[index['case-fit-washer-'+str(number)]]
   sb=screw.BoundBox; nb=nut.BoundBox; wb=washer.BoundBox
   underhead=sb.ZMax-record['headHeight']
   assert sb.ZMin<=nb.ZMin+1e-6 and underhead>=nb.ZMax-1e-6,(screw_id,'incomplete adapter nut engagement')
   assert abs(wb.ZMax-${layout.panelBottom})<1e-6,(screw_id,'washer does not seat below main panel slab')
   assert abs(nb.ZMax-wb.ZMin)<1e-6,(screw_id,'nut does not seat against washer')
   x,y=record['translation'][:2]
   washer_probe=washer.common(Part.makeBox(10,10,.02,App.Vector(x-5,y-5,${layout.panelBottom - 0.02})))
   assert washer_probe.isValid()and washer_probe.Volume>.1,(screw_id,'missing washer top bearing surface')
   washer_probe.translate(App.Vector(0,0,.02))
   washer_area=washer_probe.common(plate).Volume/.02
   assert washer_area>=20,(screw_id,'insufficient local washer-to-panel bearing',washer_area)
   ring=Part.makeCylinder(record['headSize']/2-.05,.05,App.Vector(x,y,underhead-.05))
   ring=ring.cut(Part.makeCylinder(record['diameter']/2+.2,.07,App.Vector(x,y,underhead-.06)))
   area=ring.common(adapter).Volume/.05
   assert area>=12.5,(screw_id,'insufficient adapter screw head bearing land')
   assert ring.cut(adapter).Volume<1e-6,(screw_id,'interrupted adapter head annulus')
   tool=Part.makeCylinder(1.5,25,App.Vector(x,y,sb.ZMax+.01))
   for j,target in enumerate(components):
    if records[j]['id']==screw_id: continue
    assert cached_overlap(tool,target,'tool:'+record['fingerprint'],records[j]['fingerprint'])<.001,(screw_id,records[j]['id'],'blocked vertical3 mm tool approach')
   case_mount_checks.append({'id':screw_id,'headBearingAreaMm2':area,'washerPanelBearingAreaMm2':washer_area,'washerSeatZ':${layout.panelBottom},'straightToolDiameterMm':3,'straightToolLengthMm':25})
  hat=components[index['case-servo-driver-hat']]
  assert len(hat.Solids)==361,('complete supplier HAT geometry',len(hat.Solids))
  body=components[index['case-lower-body']]
  bridge=components[index['case-top-bridge']]
  lid=components[index['parallel-clamp']]
  hood=components[index['case-electronics-analogue-hood']]
  assert abs(body.BoundBox.ZMin-${electronics.floorBottom})<1e-7
  assert min(shape.BoundBox.ZMin for shape in components)>=${electronics.floorBottom - 1e-6},'insert exceeds designed under-panel depth'
  for id in ${JSON.stringify(electronicsModuleIds)}:
   assert components[index[id]].BoundBox.ZMax < -19.7,(id,'module enters upper cradle zone')
  # The separately mounted PWM stands vertically below its carrier, rather
  # than sharing the seven floor modules' upper-cradle height limit.
  pwm=components[index['case-pwm-mosfet']]
  pwm_envelope=Part.makeBox(26,16,6,App.Vector(-13,-8,0))
  pwm_envelope.Placement=App.Placement(App.Vector(*${JSON.stringify(electronics.pwm.at)}),App.Rotation(*${JSON.stringify([...electronics.pwm.rotation].reverse())}))
  assert pwm.cut(pwm_envelope).Volume<1e-6,'PWM exceeds its source-declared 26 x 16 x 6 mm occupied-body envelope'
  for axis in 'XYZ':
   for side in ['Min','Max']:
    assert abs(getattr(pwm.BoundBox,axis+side)-getattr(pwm_envelope.BoundBox,axis+side))<1e-6,('PWM source-declared envelope',axis,side)
  # Dedicated adapter/root and actual bolted-foot probes below replace the old
  # board-specific assertion that the universal tray itself contains a BEC wall.
  for x,y in ${JSON.stringify(caseElectronicsHoneycomb(p).centres)}:
   assert not body.isInside(App.Vector(x,y,${electronics.floorBottom + 1.5}),1e-7,False),(x,y,'blocked through honeycomb cell')
  for x,y in ${JSON.stringify(electronics.bodyMountAxes)}:
   assert body.isInside(App.Vector(x+3,y,${electronics.floorBottom + 0.5}),1e-7,False),(x,y,'column foot does not reach floor bottom')
  moving_ids=set(${JSON.stringify(
    electronicsServiceIds(
      jobs[0].records.map((record) => record.id),
      electronics.serviceScrewIds,
      p,
    ),
  )})
  for reserve in json.loads(${JSON.stringify(JSON.stringify(electronicsAccess.reserves))}):
   low,high=reserve['min'],reserve['max']
   envelope=Part.makeBox(*(high[axis]-low[axis] for axis in range(3)),App.Vector(*low))
   if reserve['scope']=='installed':
    assert case_fit['box_inside'](enclosure,envelope.BoundBox,True) or envelope.cut(case_fit['enclosure_fixture'](enclosure)[0]).Volume<.001,(reserve['id'],'installed power-plug reserve exceeds case')
   checked=[]
   for target,record in zip(components,records):
    if record['id']==reserve['hostId']: continue
    if reserve['scope']=='detached-body' and record['id'] not in moving_ids: continue
    assert overlap(envelope,target)<.001,(reserve['id'],record['id'],'connector installation reserve blocked')
    checked.append(record['id'])
   access_checks.append({**reserve,'checkedComponentCount':len(checked),'passed':True})
  progress('connector-access-reserves-clear',job['values'])
  reserves=json.loads(${JSON.stringify(JSON.stringify(packingReserves))})
  for reserve in reserves:
   low,high=reserve['min'],reserve['max']
   envelope=Part.makeBox(*(high[i]-low[i] for i in range(3)),App.Vector(*low))
   assert case_fit['box_inside'](enclosure,envelope.BoundBox,True) or envelope.cut(case_fit['enclosure_fixture'](enclosure)[0]).Volume<.001,(reserve['id'],'rotated reserve exceeds case')
   for target,record in zip(components,records):
    if record['id'] in [reserve['id'],reserve['keeperId'],*reserve['ownMountIds']]:continue
    assert overlap(envelope,target)<.001,(reserve['id'],record['id'],'provisional packing reserve blocked')
  retention=runpy.run_path('scripts/case-panel-retention-fixture.py')['audit_retention']({'components':records,'electronics':json.loads(${JSON.stringify(JSON.stringify(electronics))}),'electronicsAccess':json.loads(${JSON.stringify(JSON.stringify(electronicsAccess))}),'electronicsRetention':json.loads(${JSON.stringify(JSON.stringify(caseElectronicsRetention(p)))}),'mechanicalStructure':json.loads(${JSON.stringify(JSON.stringify(casePanelStructure(p)))}),'caseEnvelope':enclosure},components,overlap,case_fit)
  assert retention['passed'],retention
  print('CASE_PANEL_RETENTION '+json.dumps(retention),flush=True)
  structure=runpy.run_path('scripts/case-panel-structure-fixture.py')['audit_structure']({'components':records,'layout':json.loads(${JSON.stringify(JSON.stringify(layout))}),'electronics':json.loads(${JSON.stringify(JSON.stringify(electronics))}),'electronicsRetention':json.loads(${JSON.stringify(JSON.stringify(caseElectronicsRetention(p)))}),'mechanicalStructure':json.loads(${JSON.stringify(JSON.stringify(casePanelStructure(p)))}),'connectorMounting':json.loads(${JSON.stringify(JSON.stringify(caseConnectorMounting(p)))})},components,overlap)
  guard_sweep=runpy.run_path('scripts/case-panel-structure-fixture.py')['audit_guard_sweep']({'components':records},components,overlap)
  structure['honeycomb']=runpy.run_path('scripts/case-panel-structure-fixture.py')['audit_honeycomb']({'components':records,'electronics':json.loads(${JSON.stringify(JSON.stringify(electronics))}),'electronicsHoneycomb':json.loads(${JSON.stringify(JSON.stringify(caseElectronicsHoneycomb(p)))} )},components,overlap)
  structure['passed']=structure['passed']and structure['honeycomb']['passed']
  structure['guardSweep']=guard_sweep
  structure['passed']=structure['passed']and guard_sweep['passed']
  assert structure['passed'],structure
  assert structure['modularElectronics']['passed'],structure['modularElectronics']
  assert structure['fourPostCapture']['carrierSupport']['passed'],structure['fourPostCapture']['carrierSupport']
  print('CASE_PANEL_STRUCTURE '+json.dumps(structure),flush=True)
  wall_mounts=runpy.run_path('scripts/case-panel-wall-mount-fixture.py')['audit_wall_mounts']({'components':records,'caseEnvelope':enclosure,'mechanicalStructure':json.loads(${JSON.stringify(JSON.stringify(casePanelStructure(p)))})},components,overlap,json.loads(${JSON.stringify(JSON.stringify(wallMounts))}),case_fit)
  assert wall_mounts['passed'],wall_mounts
  print('CASE_PANEL_WALL_MOUNTS '+json.dumps(wall_mounts),flush=True)
  progress('side-wall-mounts-clear',job['values'])
  adapter_screw_ids={anchor['screwId'] for row in structure['modularElectronics']['adapters'] for anchor in row['anchors']}
  assert len(adapter_screw_ids)==${casePanelStructure(p).modularElectronics.adapters.reduce((sum,a)=>sum+a.anchors.length,0)}
  for record in records:
   id=record['id']
   if id.startswith('case-electronics-hat-nut-'):
    # The small HAT adapter is loaded on the bench, before its PCB is fitted.
    # Its original four M2.5 nuts enter horizontally through the actual +Y slots.
    nut=components[index[id]]; nb=nut.BoundBox
    hat_adapter=components[index['case-electronics-hat-adapter']]
    for distance in [0,.25,.5,1,3,6,10]:
     inserted=nut.copy();inserted.translate(App.Vector(0,distance,0))
     assert overlap(inserted,hat_adapter)<.001,(id,distance,'inaccessible HAT adapter side-loading slot')
    outer=max(nut.slice(App.Vector(0,0,1),(nb.ZMin+nb.ZMax)/2),key=lambda wire:Part.Face(wire).Area)
    points=sorted(set((v.Point.x,v.Point.y+dy) for v in outer.Vertexes for dy in [0,10]))
    def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower=[]; upper=[]
    for point in points:
     while len(lower)>=2 and cross(lower[-2],lower[-1],point)<=0:lower.pop()
     lower.append(point)
    for point in reversed(points):
     while len(upper)>=2 and cross(upper[-2],upper[-1],point)<=0:upper.pop()
     upper.append(point)
    polygon=lower[:-1]+upper[:-1]
    wire=Part.makePolygon([App.Vector(x,y,nb.ZMin) for x,y in polygon]+[App.Vector(*polygon[0],nb.ZMin)])
    sweep=Part.Face(wire).extrude(App.Vector(0,0,nb.ZLength))
    blocked=overlap(sweep,hat_adapter)
    assert blocked<.001,(id,blocked,'blocked continuous +Y HAT nut loading sweep')
    hat_nut_loading_checks.append({'id':id,'adapterId':'case-electronics-hat-adapter','stage':'detached adapter on bench before PCB installation','outwardDirection':[0,1,0],'travelMm':10,'continuousConservativeSweepOverlapMm3':blocked,'passed':True})
   if id=='case-electronics-shield-bond-nut':
    for distance in [0,.5,1,3,6]:
     inserted=components[index[id]].copy();inserted.translate(App.Vector(0,0,-distance))
     assert overlap(inserted,hood)<.001,(id,distance,'inaccessible hood nut before assembly')
   if not (id.startswith('case-electronics-') and '-screw' in id or id.startswith('case-lid-screw-')):continue
   screw=components[index[id]];bb=screw.BoundBox
   bottom_up=id in adapter_screw_ids
   underhead=bb.ZMin+record['headHeight'] if bottom_up else bb.ZMax-record['headHeight']
   if not id.startswith('case-lid-screw-'):
    nut_id=id.replace('-screw','-nut')
    assert nut_id in index,(id,'missing mating nut')
    nb=components[index[nut_id]].BoundBox
    if bottom_up:
     assert record['rotation'][0]==180 and bb.ZMax>=nb.ZMax-1e-6 and underhead<=nb.ZMin+1e-6,(id,'incomplete bottom-up adapter nut engagement')
    else:assert bb.ZMin<=nb.ZMin+1e-6 and underhead>=nb.ZMax-1e-6,(id,'incomplete nut engagement')
   x,y=record['translation'][:2]
   ring=Part.makeCylinder(record['headSize']/2-.05,.05,App.Vector(x,y,underhead-.05)).cut(Part.makeCylinder(record['diameter']/2+.15,.07,App.Vector(x,y,underhead-.06)))
   if bottom_up:
    land=body
    ring=Part.makeCylinder(record['headSize']/2-.05,.05,App.Vector(x,y,underhead+.01)).cut(Part.makeCylinder(1.75,.07,App.Vector(x,y,underhead)))
    assert ring.cut(body).Volume<1e-6,(id,'interrupted underside adapter screw bearing annulus')
   elif id.startswith('case-lid-screw-'):
    land=lid
    # Actual Ø3.4 shank bore, complete head annulus and1mm printed bearing web.
    ring=Part.makeCylinder(record['headSize']/2-.05,.05,App.Vector(x,y,underhead-.05)).cut(Part.makeCylinder(1.7,.07,App.Vector(x,y,underhead-.06)))
    assert ring.cut(lid).Volume<1e-6,(id,'interrupted shared-lid bearing annulus')
    web=Part.makeCylinder(record['headSize']/2-.05,.98,App.Vector(x,y,underhead-.99)).cut(Part.makeCylinder(1.7,1,App.Vector(x,y,underhead-1)))
    assert web.cut(lid).Volume<1e-5,(id,'missing continuous1mm head web')
   elif '-hat-screw-' in id:land=components[index[id.replace('-hat-screw-','-hat-washer-')]]
   else:land=components[index['case-electronics-shield-bond-washer']]
   area=ring.common(land).Volume/.05
   assert area>(12.5 if bottom_up or id.startswith('case-lid-screw-') else .05),(id,area,'insufficient head bearing')
   head_bearing_areas.append({'id':id,'areaMm2':area})
  progress('body-hardware-access-clear',job['values'])
 detached_ids=set(${JSON.stringify(electronics.serviceScrewIds)})|{'case-battery-pack-1','case-battery-pack-2'}
 group_parts=[components[index[id]] for id in moving_ids]
 for row in json.loads(${JSON.stringify(JSON.stringify(casePanelStructure(p).ties))}):
  group_parts += [Part.makeBox(*(s['max'][i]-s['min'][i]for i in range(3)),App.Vector(*s['min'])) for s in row['segments']]
 group=Part.makeCompound(group_parts)
 service_key=hashlib.sha256((':'.join(records[index[id]]['fingerprint']for id in sorted(moving_ids))).encode()).hexdigest()
 for distance in [0,1,5,20,50,85]:
  moved=group.copy();moved.translate(App.Vector(0,0,-distance))
  for target,record in zip(components,records):
   if record['id'] in moving_ids or record['id'] in detached_ids:continue
   assert cached_overlap(moved,target,'body-with-all-retained-loops:'+service_key+':'+str(distance),record['fingerprint'])<.001,(distance,record['id'],'blocked supported lower-body withdrawal')
  large_parts.clear();shape_boxes.clear()
 progress('lower-body-removal-clear',job['values'])
 for colour in ['red','black']:
  i=index['case-test-clip-'+colour]; origin=records[i]['translation']
  source=components[i].childShapes()
  assert len(source)==${labels.length},('clip source components',len(source))
  for angle in range(31):
   moving=[]
   for part_index in ${JSON.stringify(movingIndices)}:
    shape=source[part_index].copy()
    shape.rotate(App.Vector(origin[0]+7,origin[1],origin[2]+21.7),App.Vector(0,-1,0),angle)
    moving.append(shape)
   moving=Part.makeCompound(moving)
   for tie in json.loads(${JSON.stringify(JSON.stringify(casePanelStructure(p).ties))}):
    probe=Part.makeCompound([Part.makeBox(*(s['max'][d]-s['min'][d]for d in range(3)),App.Vector(*s['min']))for s in tie['segments']])
    assert cached_overlap(moving,probe,records[i]['fingerprint']+':moving:'+str(angle),'retained-loop:'+tie['id'])<.001,(colour,angle,tie['id'],'clip motion catches retaining tie')
   if job_number==0:
    assert case_fit['box_inside'](enclosure,moving.BoundBox,False) or moving.cut(open_case).Volume<.001,(colour,angle,'clip press exceeds opened-case cavity')
   for j,target in enumerate(components):
    if j==i: continue
    assert cached_overlap(moving,target,records[i]['fingerprint']+':moving:'+str(angle),records[j]['fingerprint'])<.001,(job['values'],colour,angle,records[j]['id'],'provisional clip press study')
  progress('clip-press-study-clear',{**job['values'],'colour':colour,'minimumDegrees':0,'maximumDegrees':30,'stepDegrees':1})
 print('CASE_PANEL_CHECKPOINT_OK '+json.dumps(job['values']),flush=True)
 progress('checkpoint-complete',job['values'])
 large_parts.clear()
 shape_boxes.clear()
 if job_number==0: del group,moved,hat,body,hood,bridge,adapter
print('CASE_PANEL_NATIVE_OK')
print('CASE_PANEL_HEAD_BEARING '+json.dumps(head_bearing_areas))
print('CASE_PANEL_HAT_NUT_LOADING '+json.dumps(hat_nut_loading_checks))
print('CASE_PANEL_PAIR_CACHE '+json.dumps({'uniqueChecks':pair_checks,'identicalGeometryReuses':pair_reuses}))
print('CASE_PANEL_CASE_FIT '+json.dumps(case_fit_reports))
print('CASE_PANEL_CASE_MOUNTS '+json.dumps(case_mount_checks))
print('CASE_PANEL_NATIVE_CACHE '+str(loaded_cache_entries))
print('CASE_PANEL_CONNECTOR_ACCESS '+json.dumps(access_checks))
`;
    const started = performance.now(),
      result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
        input: script,
        encoding: 'utf8',
        timeout: 1_780_000,
        maxBuffer: 4 * 1024 * 1024,
      });
    assert.equal(
      result.status,
      0,
      result.stdout + '\n' + result.stderr + String(result.error ?? ''),
    );
    assert.match(result.stdout, /CASE_PANEL_NATIVE_OK/);
    const nativeReportPath =
      process.env.CASE_PANEL_NATIVE_REPORT ??
      'test-results/servo-toggle-case-panel/native-motion-validation.json';
    mkdirSync(dirname(nativeReportPath), { recursive: true });
    writeFileSync(
      nativeReportPath,
      JSON.stringify(
        {
          passed: true,
          sourceCodeSha256,
          fixtureCodeSha256: Object.fromEntries(
            [
              'scripts/case-panel-native-fixture.py',
              'scripts/case-panel-retention-fixture.py',
              'scripts/case-panel-structure-fixture.py',
              'scripts/case-panel-wall-mount-fixture.py',
              'tests/servo-toggle-case-panel.test.ts',
            ].map((file) => [
              file.split('/').at(-1)!,
              createHash('sha256').update(readFileSync(file)).digest('hex'),
            ]),
          ),
          validation: 'Native case-panel regression in tests/servo-toggle-case-panel.test.ts',
          nativeTestDurationMs: performance.now() - started,
          componentCount: jobs[0].records.length,
          fullCaseFitVerified: false,
          caseFitValidationScope: 'assembly-and-provisional-working-panel-fit',
          workingPanelFit: enclosure.workingPanelFit,
          collisionThresholdMm3: 0.001,
          collisionExemptions: [],
          pairCache: JSON.parse(result.stdout.match(/CASE_PANEL_PAIR_CACHE (.+)/)![1]),
          exactNativeCacheEntries: Number(result.stdout.match(/CASE_PANEL_NATIVE_CACHE (\d+)/)![1]),
          panelSizeMm: [layout.width, layout.height, layout.panelThickness],
          underPanelDepthMm: layout.panelTop - layout.batteryFloorBottom,
          batterySizeMm: layout.batterySize,
          batteryProjectionAbovePanelMm: layout.batteryTop - layout.panelTop,
          verticalBatteryLiftCheckpointsMm: [0, 10, 35, 75],
          provisionalClipPressStudyDegrees: Array.from({ length: 31 }, (_, angle) => angle),
          provisionalClipPressCaseFitChecked: true,
          clipFloorThicknessMm: layout.testClipSeatZ - layout.testClipFloorBottom,
          rearReliefWebThicknessMm: { indicator: 2, sp20: 4 },
          retention: JSON.parse(result.stdout.match(/CASE_PANEL_RETENTION (.+)/)![1]),
          hatNutLoading: JSON.parse(result.stdout.match(/CASE_PANEL_HAT_NUT_LOADING (.+)/)![1]),
          structure: JSON.parse(result.stdout.match(/CASE_PANEL_STRUCTURE (.+)/)![1]),
          wallMounts: JSON.parse(result.stdout.match(/CASE_PANEL_WALL_MOUNTS (.+)/)![1]),
          caseFit: JSON.parse(result.stdout.match(/CASE_PANEL_CASE_FIT (.+)/)![1]),
          caseMounts: JSON.parse(result.stdout.match(/CASE_PANEL_CASE_MOUNTS (.+)/)![1]),
          electronics: {
            moduleIds: allElectronicsModuleIds,
            serviceTranslation: electronics.serviceTranslation,
            removalCheckpointsMm: [0, 1, 5, 20, 50, 85],
            withdrawalCheckedInEveryState: true,
            nutInsertionChecked: true,
            fullNutEngagementChecked: true,
            fourMainM3ContinuousSeatsChecked: true,
            provisionalPackingReservesChecked: true,
            connectorAccess: JSON.parse(
              result.stdout.match(/CASE_PANEL_CONNECTOR_ACCESS (.+)/)![1],
            ),
            headBearingAreasMm2: JSON.parse(
              result.stdout.match(/CASE_PANEL_HEAD_BEARING (.+)/)![1],
            ),
          },
          checks: [
            'Valid, closed positive-volume component shapes and single-solid printables',
            'Flat lettered panel front, exact 214 x 150.6 x 6 mm R4 prototype slab and declared underside boss/rib envelope',
            'Three clear diameter 16 mm indicator holes and two clear SP20 D openings with retained flats',
            'Correct indicator2 mm and SP20 4 mm webs above rear reliefs',
            'Continuous reinforced clip floor beneath both mounting centres',
            'All component pairs clear at every checkpoint, including four flush M3 adapter mounts',
            'All other insert parts retain the earlier nominal taper checks; only the declared parallel-base working-band prototype region uses the later physical trial. Nominal mismatch is reported and full real-case fit is not claimed',
            'Seven measured side bosses retain source nuts with complete insertion paths; explicit finite 4 mm wall coupons, drilled ports and per-ID screw/washer/seal zones preserve all unrelated cavity boundaries',
            'Both complete 74 mm battery prisms clear every other component continuously through 75 mm vertical insertion/extraction, with additional sampled seat checks',
            'Both spring clip moving lever and jaw clear other components at sampled press angles',
            'Supported lower body, eight modules, tied carrier, both complete clips and their complete nylon loops clear downward after both packs and the four shared lid ties are removed',
            'All electronics nuts have insertion access and full screw engagement; screw heads have measured bearing lands',
            'Source-sized HAT XT60 installation reserve clears installed parts; compact USB studies clear detached populated lowerbody; two0.15mm foil seam layers clear case and components',
          ],
          clipMotionLimit:
            'The 0–30 degree sweep is a provisional geometric study. Supplier travel, physical stops and spring compression are unspecified.',
          checkpoints: jobs.map((job) => job.values),
        },
        null,
        2,
      ) + '\n',
    );
  },
);
