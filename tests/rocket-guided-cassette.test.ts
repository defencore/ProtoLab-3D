import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, DoubleSide, Euler, Mesh, Raycaster, Vector3, type Object3D } from 'three';
import nose, { configuredPieces, libraries } from '../src/parts/rocket-camera-nose/part';
import { componentGeometry, type ConfiguredPiece } from '../src/core/assembly/detail-instances';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { physicalProductState, eskdIdentity } from '../src/core/eskd';
import { availableModelState } from '../src/core/part-selection';
import { pythonShape } from '../src/core/assembly/boundary/shapes';
import { pi5Interface } from '../src/parts/raspberry-pi/part';
import { adapterInterface } from '../src/parts/waveshare-pcie-m2-d/part';
import {
  guidedLayout,
  guidedDatums,
  worldPoint,
  guidedGpioServiceOpening,
} from '../src/parts/rocket-camera-nose/lib/guided-layout';
import {
  guidedPciePlan,
  guidedCsiPlan,
  guidedRoutingCoordinates,
  guidedPcieReserve,
} from '../src/parts/rocket-camera-nose/lib/guided-routing';
import {
  guidedShellShape,
  guidedShellAnchorDatums,
} from '../src/parts/rocket-camera-nose/lib/guided-shell';
import {
  guidedCageJointSpecs,
  guidedAuxiliaryFixing,
  guidedCageDatums,
} from '../src/parts/rocket-camera-nose/lib/guided-cage';
import {
  guidedPowerPlan,
  guidedPowerFrameClearance,
} from '../src/parts/rocket-camera-nose/lib/guided-power';
import { guidedCameraProfile } from '../src/parts/rocket-camera-nose/lib/guided-camera';
import { guidedNoseProfile } from '../src/parts/rocket-camera-nose/lib/guided-profile';

import type { AssemblyComponent } from '../src/core/product-types';
import type { Parameters } from '../src/core/types';

const preset = nose.presets.find((p) => p.id === 'structural-90-86')!;
const p = preset.parameters;
const almost = (
  actual: readonly number[],
  expected: readonly number[],
  message: string,
  tolerance = 1e-8,
) => {
  assert.equal(actual.length, expected.length, message);
  assert.ok(
    actual.every((value, axis) => Math.abs(value - expected[axis]) < tolerance),
    `${message}: ${actual} vs ${expected}`,
  );
};
const point = (piece: ConfiguredPiece, local = new Vector3()) =>
  local
    .clone()
    .applyEuler(
      new Euler(
        ...(piece.component.placement.rotation.map((v) => (v * Math.PI) / 180) as [
          number,
          number,
          number,
        ]),
        'ZYX',
      ),
    )
    .add(new Vector3(...piece.component.placement.translation))
    .add(new Vector3(...(piece.position ?? [0, 0, piece.z ?? 0])));
const definition = (component: AssemblyComponent) => ({
  id: component.id,
  libraryId: component.libraryId,
  presetId: component.presetId,
  parameters: component.parameters,
  state: component.state,
  quantity: component.quantity,
  supply: component.supply,
  procurement: component.procurement,
});
async function units(ids: string[], check: (map: Map<string, Object3D>) => void) {
  await nose.initializeGeometry?.(p, 'assembled');
  const pieces = configuredPieces(p).filter((piece) => ids.includes(piece.component.id));
  assert.equal(pieces.length, ids.length);
  const model = componentGeometry(libraries, pieces);
  try {
    model.updateMatrixWorld(true);
    model.traverse((node) => {
      if (node instanceof Mesh)
        for (const material of Array.isArray(node.material) ? node.material : [node.material])
          material.side = DoubleSide;
    });
    check(new Map(pieces.map((piece, index) => [piece.component.id, model.children[index]])));
  } finally {
    disposeModel(model);
  }
}
const crossings = (node: Object3D, origin: Vector3, direction: Vector3, far = 100) =>
  new Raycaster(origin, direction, 0, far)
    .intersectObject(node, true)
    .filter((hit, index, all) => index === 0 || hit.distance - all[index - 1].distance > 1e-4)
    .map((hit) => hit.point);

test('the centered cassette retains source products while replacing individual mounts with ten accessible screws', () => {
  assert.ok(preset);
  assert.deepEqual(nose.defaults, p);
  assert.deepEqual(validateParameters(nose, p, 'assembled'), []);
  const components = nose.composition!(p).components;
  assert.equal(components.length, 45);
  const expected = new Map([
    ['pi5', ['raspberry-pi', 'raspberry-pi-5']],
    ['ups3s', ['waveshare-ups-3s', 'ups-module-3s']],
    ['nvme-adapter', ['waveshare-pcie-m2-d', 'pcie-m2-d']],
    ['nvme-ssd', ['m2-ssd', '2280-reference']],
    ['csi-camera', ['board-camera-19', 'imx577-19x19-rear-mipi-m25']],
    ['aux-gps', ['gps-tracker', 'zx908']],
    ['aux-buzzer', ['jhe42b-finder', 'jhe42b']],
  ]);
  assert.equal(new Set(components.map((c) => c.id)).size, components.length);
  for (const [id, [libraryId, presetId]] of expected) {
    const item = components.find((c) => c.id === id);
    assert.ok(item, id);
    assert.equal(item.libraryId, libraryId);
    assert.equal(item.presetId, presetId);
    assert.equal(item.quantity, 1);
    assert.equal(item.supply, 'purchased');
  }
  const cells = components.filter((c) => c.libraryId === 'li-ion-cell');
  assert.equal(cells.length, 3);
  assert.ok(cells.every((c) => c.presetId === 'molicel-p28a'));
  const printed = components.filter((c) => c.manufacturing?.processes.includes('printing'));
  assert.equal(printed.length, 14);
  for (const id of ['pi-pocket', 'pi-pressure', 'power-carrier', 'camera-pocket'])
    assert.equal(printed.find((c) => c.id === id)?.manufacturing?.material, 'TPU');
  const screws = components.filter((c) => c.libraryId === 'bolt-screw');
  assert.equal(screws.length, 10);
  assert.equal(components.filter((c) => c.libraryId === 'nyloc-nut').length, 7);
  assert.equal(components.filter((c) => c.libraryId === 'washer').length, 2);
  assert.equal(components.filter((c) => c.libraryId === 'spacer').length, 2);
  assert.equal(screws.filter((c) => /^body-anchor-screw-/.test(c.id)).length, 4);
  assert.equal(screws.filter((c) => /^cage-joint-screw-/.test(c.id)).length, 2);
  assert.equal(screws.filter((c) => /^camera-side-screw-/.test(c.id)).length, 2);
  assert.equal(screws.filter((c) => c.id === 'ssd-retention-screw').length, 1);
  assert.equal(screws.filter((c) => c.id === 'aux-keeper-screw').length, 1);
  const keeperNut = components.find((c) => c.id === 'aux-keeper-nut');
  assert.equal(keeperNut?.libraryId, 'nyloc-nut');
  assert.equal(keeperNut?.presetId, 'gvyntok-a71fbd19aaf2');
  assert.ok(
    !components.some(
      (c) =>
        c.libraryId === 'optical-dome-window' ||
        /^window-|^pi-mount-|^ups-mount-|^power-clamp-|^hood-lock-|^cap-lock-|^aux-bridge/.test(
          c.id,
        ),
    ),
  );
});

test('the centered 240mm execution preserves the short-cable board poses and supplier SSD seat', () => {
  const a = guidedLayout(p),
    pieces = configuredPieces(p);
  assert.equal(Number(p.noseLength) + Number(p.shoulderLength) + 2, 240);
  assert.equal(nose.dimensions(p, 'assembled')[2], 240);
  almost(a.pi.translation, [4.5, -2, 46], 'unchanged Pi pose');
  almost(a.ups.translation, [2, 0, -44], 'unchanged UPS pose');
  almost(a.adapter.translation, [-9, 3, -40], 'unchanged adapter pose');
  almost(a.camera.translation, [0, 0, 115], 'centered original camera');
  for (const [id, pose] of [
    ['pi5', a.pi],
    ['ups3s', a.ups],
    ['nvme-adapter', a.adapter],
    ['nvme-ssd', a.ssd],
    ['csi-camera', a.camera],
  ] as const) {
    const item = pieces.find((piece) => piece.component.id === id)!;
    almost(item.component.placement.translation, pose.translation, id + ' translation');
    almost(item.component.placement.rotation, pose.rotation, id + ' rotation');
  }
  const adapter = pieces.find((piece) => piece.component.id === 'nvme-adapter')!,
    ssd = pieces.find((piece) => piece.component.id === 'nvme-ssd')!;
  almost(
    point(ssd).toArray(),
    point(adapter, new Vector3(-2.5, 9.95, 4)).toArray(),
    'supplier SSD seat',
  );
  for (const change of [
    { shoulderLength: 94 },
    { noseLength: 141 },
    { tubeID: 88, tubeOD: 92 },
  ] as Parameters[])
    assert.ok(validateParameters(nose, { ...p, ...change }, 'assembled').length > 0);
});

test('PCIe route honors the measured40mm/13mm split and real opposed board-end datums', () => {
  const plan = guidedPciePlan(p),
    source = guidedRoutingCoordinates.pcie;
  almost(
    plan.adapterMouth,
    worldPoint(adapterInterface.ribbonConnector.mouth, guidedDatums.adapter),
    'adapter public mouth',
  );
  almost(
    plan.piMouth,
    worldPoint(pi5Interface.connectors.pcie.mouth, guidedDatums.pi),
    'Pi public mouth',
  );
  almost(plan.sourceNormal, [0, 0, 1], 'adapter entry is axial');
  almost(source.piOutward, [-1, 0, 0], 'Pi entry points towards adapter');
  assert.equal(plan.availableLength, 40);
  assert.equal(plan.measuredOnboardBudget, 27);
  assert.equal(plan.measuredFreeLength, 13);
  assert.equal(
    plan.adapterInsertionDepth,
    null,
    'remaining measured adapter-side allowance is not invented socket depth',
  );
  assert.ok(plan.modelledOnboardLength <= 27);
  assert.ok(plan.measuredOnboardAllowance >= 0);
  assert.ok(plan.freeLengthWithInsertion < 13);
  assert.ok(plan.totalLength < 40);
  assert.ok(plan.slack > 0);
  assert.ok(
    Math.abs(plan.freeLengthWithInsertion - plan.freePathLength - plan.piInsertionAllowance) < 1e-9,
  );
  assert.ok(Math.abs(plan.totalLength - 27 - plan.freeLengthWithInsertion) < 1e-9);
  assert.equal(plan.freeEdgePathLengths.length, 2);
  assert.ok(plan.freeEdgePathLengths.every((length) => length + plan.piInsertionAllowance < 13));
  assert.ok(plan.lateralDrift < 0.01);
  assert.ok(
    plan.minFreeBendRadius > 3,
    'the forward Pi datum increases the available free bend above the preliminary2.63mm layout',
  );
  const first = plan.freeSegments[0],
    last = plan.freeSegments.at(-1)!;
  assert.equal(first.kind, 'arc');
  assert.equal(last.kind, 'line');
  if (last.kind === 'line')
    almost(last.end, plan.piMouth, 'final lead enters the source connector');
  assert.match(
    pythonShape(guidedPcieReserve(p)),
    /Part\.Arc|makeCircle/,
    'routing arcs stay analytic in native CAD',
  );
});

test('100mm CSI route connects source CAM1 to the shifted rear latch with a true longest-edge budget', () => {
  const plan = guidedCsiPlan(p),
    a = guidedLayout(p);
  almost(
    plan.sourceMouth,
    worldPoint(pi5Interface.connectors.cam1.mouth, guidedDatums.pi),
    'source camera mouth',
  );
  almost(
    plan.cameraMouth,
    [1, a.camera.translation[1] + 5.5, a.cameraRear - 0.5],
    'rear-MIPI mouth follows camera position',
  );
  assert.equal(plan.availableLength, 100);
  assert.equal(plan.insertionAllowance, 10);
  assert.ok(plan.edgePathLengths.every((v) => Number.isFinite(v) && v > 0));
  assert.equal(plan.longestEdgeLength, Math.max(...plan.edgePathLengths));
  assert.ok(
    Math.abs(plan.totalLength - Math.max(plan.freePathLength, ...plan.edgePathLengths) - 10) < 1e-9,
  );
  assert.ok(plan.totalLength < 100);
  assert.ok(plan.slack > 0);
  assert.ok(plan.minimumLongitudinalEdgeFactor > 0, 'neither actual ribbon edge locally reverses');
  assert.ok(
    plan.minimumReserveLongitudinalFactor > 0,
    'the wider cutter does not fold through itself',
  );
  assert.ok(
    plan.stations.every(
      (f) => Math.abs(new Vector3(...f.tangent).dot(new Vector3(...f.width))) < 1e-8,
    ),
  );
});

test('the closed cage and all electronics withdraw as one populated cassette without changing procurement identity', () => {
  const assembled = configuredPieces(p),
    extracted = configuredPieces(p, 'extracted'),
    byId = new Map(extracted.map((piece) => [piece.component.id, piece]));
  const delta = point(byId.get('pi5')!).sub(
    point(assembled.find((piece) => piece.component.id === 'pi5')!),
  );
  almost(delta.toArray(), [0, 0, -guidedLayout(p).extraction], 'complete cassette withdrawal');
  for (const id of [
    'pi5',
    'ups3s',
    'nvme-adapter',
    'nvme-ssd',
    'csi-camera',
    'ups-cell-0',
    'ups-cell-1',
    'ups-cell-2',
    'aux-gps',
    'aux-buzzer',
    'cassette-cage-base',
    'cassette-cage-cover',
    'pi-pocket',
    'pi-pressure',
    'power-carrier',
    'aux-bed',
    'aux-clamp',
    'aux-pressure-plate',
    'aux-keeper-screw',
    'aux-keeper-nut',
    'camera-pocket',
    'camera-front-liner',
    'rear-retainer',
  ]) {
    const before = assembled.find((piece) => piece.component.id === id);
    assert.ok(before, id);
    const after = byId.get(id)!;
    assert.deepEqual(definition(after.component), definition(before.component));
    almost(point(after).sub(point(before)).toArray(), delta.toArray(), id + ' remains on cassette');
  }
  for (const before of assembled.filter(
    (piece) => piece.component.id === 'outer-shell' || /^body-anchor-nut-/.test(piece.component.id),
  ))
    almost(
      point(byId.get(before.component.id)!).toArray(),
      point(before).toArray(),
      before.component.id + ' belongs to fixed case',
    );
  const canonical = eskdIdentity(nose, p, 'assembled', preset.id);
  for (const state of ['cutaway', 'extracted', 'print-layout']) {
    assert.equal(physicalProductState(nose, state), 'assembled');
    assert.equal(eskdIdentity(nose, p, state, preset.id).designation, canonical.designation);
  }
});

test('formed Pi supports and a continuous dielectric divider retain broad measurable stock', async () => {
  const power = guidedPowerPlan(p);
  assert.deepEqual(
    power.gpioPins.map((pin) => pin.number),
    [4, 6],
  );
  almost(
    power.gpioCenter,
    [0, 1, 2].map(
      (axis) =>
        power.gpioPins.reduce((sum, pin) => sum + worldPoint(pin.tip, guidedDatums.pi)[axis], 0) /
        2,
    ),
    'power route starts from the actual public 5V/GND pin tips',
  );
  assert.equal(power.passage.diameter, 4);
  assert.match(power.powerCode, /Part\.Arc/);
  assert.match(pythonShape(guidedPowerFrameClearance(p)), /Part\.Arc|makeCircle/);
  await units(
    [
      'power-carrier',
      'pi-pocket',
      'pi-pressure',
      'cassette-cage-base',
      'cassette-cage-cover',
      'aux-bed',
    ],
    (map) => {
      const carrier = map.get('power-carrier')!;
      for (const y of [-18, 18])
        for (const z of [-70, -50, -30]) {
          const xs = crossings(carrier, new Vector3(-11, y, z), new Vector3(1, 0, 0), 10);
          assert.equal(xs.length, 2, 'uninterrupted insulation section');
          almost([xs[0].x, xs[1].x], [-9, -4.8], 'divider faces', 0.03);
          assert.ok(xs[1].x - xs[0].x >= 4.15);
        }
      const pcieDivider = crossings(carrier, new Vector3(-9.1, 0, 0), new Vector3(1, 0, 0), 5);
      assert.equal(pcieDivider.length, 2, 'the detached PCIe backing film is deliberately open');
      almost(
        pcieDivider.map((face) => face.x),
        [-7.7, -4.8],
        'the routed slot leaves a continuous 2.9 mm UPS-side insulating wall',
        0.03,
      );
      for (const id of ['pi-pocket', 'pi-pressure']) {
        const size = new Box3().setFromObject(map.get(id)!, true).getSize(new Vector3());
        assert.ok(size.x > 3, 'substantial normal contact depth');
        assert.ok(size.y > 45 && size.z > 55, 'one broad form spans the source four-hole pattern');
      }
      const headerReturn = crossings(
        map.get('pi-pocket')!,
        new Vector3(1.5, 30, 22),
        new Vector3(0, 1, 0),
        5,
      );
      assert.equal(headerReturn.length, 2);
      almost(
        headerReturn.map((face) => face.y),
        [30.7, 34],
        'the GPIO return has a broad 3.3 mm bypass instead of its former narrow strip',
        0.03,
      );
      const buzzerFloor = crossings(
        map.get('aux-bed')!,
        new Vector3(8, 8, 42),
        new Vector3(1, 0, 0),
        5,
      );
      assert.equal(buzzerFloor.length, 2);
      almost(
        buzzerFloor.map((face) => face.x),
        [8.5, 11.5],
        'the unsupported buzzer membrane is replaced by a 3 mm floor',
        0.03,
      );
      const rearSector = crossings(
        map.get('cassette-cage-cover')!,
        new Vector3(36.5, 0, -92.25),
        new Vector3(0, 0, 1),
        4,
      );
      assert.equal(
        rearSector.length,
        1,
        'the retaining sector is continuous over its full axial stock',
      );
      almost([rearSector[0].z], [-89.3], 'the rear plate retains its 3 mm axial sector', 0.03);
      assert.ok(rearSector[0].z + 92.25 >= 2.9);
      const cover = map.get('cassette-cage-cover')!;
      assert.equal(
        crossings(cover, new Vector3(9.5, 18, 17), new Vector3(1, 0, 0), 4.5).length,
        0,
        'the empty Pi window has no former round pressure-pad spur',
      );
      for (const y of [-20, 0, 15]) {
        const shelf = crossings(cover, new Vector3(9.5, y, 26), new Vector3(1, 0, 0), 7);
        assert.equal(shelf.length, 2, 'one continuous shelf crosses the common accessory bay');
        almost(
          shelf.map((face) => face.x),
          [9.8, 15.5],
          'the common shelf has 5.7 mm support stock across its span',
          0.03,
        );
      }
      const fanNormal = new Vector3(1, 0, 1).normalize(),
        fan = crossings(
          cover,
          new Vector3(21.3, 0, 12).addScaledVector(fanNormal, -2),
          fanNormal,
          5,
        );
      assert.equal(fan.length, 2);
      assert.ok(fan[1].distanceTo(fan[0]) >= 2.8, 'the shelf grows from a broad diagonal fan');
      const back = guidedCageDatums(p).baseBackX,
        opening = guidedGpioServiceOpening(),
        base = map.get('cassette-cage-base')!;
      assert.ok(opening.kind === 'box');
      assert.ok(opening.size[1] >= 10 && opening.size[2] >= 10);
      almost(
        [opening.origin[1] + opening.size[1] / 2, opening.origin[2] + opening.size[2] / 2],
        power.gpioCenter.slice(1),
        'service opening is centered on the actual GPIO power pair',
      );
      for (const y of [0.25, 0.5, 0.75])
        for (const z of [0.25, 0.5, 0.75])
          assert.equal(
            crossings(
              base,
              new Vector3(
                opening.origin[0] - 0.1,
                opening.origin[1] + opening.size[1] * y,
                opening.origin[2] + opening.size[2] * z,
              ),
              new Vector3(1, 0, 0),
              opening.size[0] + 0.2,
            ).length,
            0,
            'GPIO plug access is open after closing the cage',
          );
      for (const [y, z] of [
        [opening.origin[1] - 1, power.gpioCenter[2]],
        [power.gpioCenter[1], opening.origin[2] + opening.size[2] + 1],
      ]) {
        const wall = crossings(base, new Vector3(back - 0.2, y, z), new Vector3(1, 0, 0), 20);
        assert.ok(wall.length >= 2);
        almost([wall[0].x], [back], 'broad perimeter starts on the back face', 0.03);
        assert.ok(
          wall[1].x - wall[0].x >= 3.45,
          'service-port perimeter retains full back-plate stock',
        );
      }
    },
  );
});

test('the adapter cushion retains its source-hole locators and a broad continuous rail bridge', async () => {
  const adapter = configuredPieces(p).find((piece) => piece.component.id === 'nvme-adapter')!;
  await units(['adapter-cushion'], (map) => {
    const cushion = map.get('adapter-cushion')!;
    for (const index of [0, 3]) {
      const hole = adapterInterface.holes[index],
        center = point(adapter, new Vector3(hole.x, hole.y, hole.z));
      const axial = crossings(
        cushion,
        new Vector3(-18, center.y, center.z),
        new Vector3(1, 0, 0),
        10,
      );
      assert.ok(axial.length >= 2);
      assert.ok(
        Math.abs(axial.at(-1)!.x + 9.7) < 0.03,
        'the locator enters the adapter bore by0.9mm from its rear face',
      );
      for (const direction of [
        new Vector3(0, 1, 0),
        new Vector3(0, -1, 0),
        new Vector3(0, 0, 1),
        new Vector3(0, 0, -1),
      ]) {
        const origin = new Vector3(-10.1, center.y, center.z),
          hits = crossings(cushion, origin, direction, 2);
        assert.equal(hits.length, 1);
        const radius = hits[0].distanceTo(origin);
        assert.ok(
          radius > 1.1 && radius < 1.2,
          'the actual printed locator is approximatelyD2.3mm',
        );
        assert.ok(radius < hole.diameter / 2, 'the purchasedD2.7mm hole retains running clearance');
      }
    }
    for (const z of [-86.1, -85.6, -85.05]) {
      const bridge = crossings(cushion, new Vector3(-12, 22, z), new Vector3(0, 1, 0), 6);
      assert.equal(bridge.length, 2, 'one continuous connecting section crosses the rail bridge');
      almost(
        bridge.map((face) => face.y),
        [23, 26.8],
        'the former 0.5 mm web is replaced by a continuous 3.8 mm-wide bridge',
        0.03,
      );
      assert.ok(bridge[1].y - bridge[0].y >= 3.75);
    }
  });
  assert.equal(
    nose.composition!(p).components.filter((c) => /^power-clamp-\d$/.test(c.id)).length,
    0,
  );
});

test('four sourced tube screws positively locate the continuous case and cage while two joints close the halves', () => {
  const pieces = configuredPieces(p);
  assert.deepEqual(
    guidedShellAnchorDatums.map(({ angle, z }) => [angle, z]),
    [
      [0, -20],
      [180, -20],
      [0, -32],
      [180, -32],
    ],
  );
  for (const spec of guidedShellAnchorDatums) {
    const screw = pieces.find(
        (piece) => piece.component.id === spec.id.replace('body-anchor-', 'body-anchor-screw-'),
      )!,
      nut = pieces.find(
        (piece) => piece.component.id === spec.id.replace('body-anchor-', 'body-anchor-nut-'),
      )!;
    assert.ok(screw && nut);
    assert.equal(
      screw.component.presetId,
      spec.angle === 0 ? 'gvyntok-040-190-020' : 'gvyntok-040-190-022',
    );
    assert.equal(screw.component.parameters.length, spec.screwLength);
    const tip = point(
      screw,
      new Vector3(
        0,
        0,
        -(
          Number(screw.component.parameters.length) + Number(screw.component.parameters.headHeight)
        ) / 2,
      ),
    );
    assert.ok(
      Math.abs(Math.hypot(tip.x, tip.y) - spec.screwTipRadius) < 1e-8,
      'actual source screw reaches the cage pin land',
    );
    almost([tip.z], [spec.z], 'pin axial datum');
    const engagement =
      spec.cageLandRadialRange[1] - Math.max(spec.screwTipRadius, spec.cageLandRadialRange[0]);
    assert.ok(engagement >= 3.4, 'the source pin overlaps the broad cage land by at least3.4mm');
  }
  for (const [index, spec] of guidedCageJointSpecs(p).entries()) {
    const screw = pieces.find((piece) => piece.component.id === 'cage-joint-screw-' + index)!,
      nut = pieces.find((piece) => piece.component.id === 'cage-joint-nut-' + index)!;
    assert.ok(screw && nut);
    const expectedPreset = new Map([
      [20, 'gvyntok-040-130-018'],
      [45, 'gvyntok-040-150-053'],
    ]).get(spec.length);
    assert.ok(expectedPreset, 'each joint uses the agreed source screw execution');
    assert.equal(screw.component.presetId, expectedPreset);
    assert.equal(screw.component.parameters.head, 'button');
    assert.equal(screw.component.parameters.length, spec.length);
    almost(point(screw).toArray().slice(1), [spec.y, spec.z], 'joint screw datum');
    almost(point(nut).toArray().slice(1), [spec.y, spec.z], 'joint nut datum');
  }
  const keeper = pieces.find((piece) => piece.component.id === 'aux-keeper-screw')!,
    keeperNut = pieces.find((piece) => piece.component.id === 'aux-keeper-nut')!;
  assert.ok(keeper && keeperNut);
  assert.equal(keeper.component.presetId, 'gvyntok-040-130-006');
  assert.equal(keeper.component.parameters.head, 'button');
  assert.equal(keeper.component.parameters.length, guidedAuxiliaryFixing.length);
  assert.equal(keeper.component.parameters.diameter, guidedAuxiliaryFixing.diameter);
  almost(
    point(keeper).toArray().slice(1),
    guidedAuxiliaryFixing.bearing.slice(1),
    'accessible keeper screw datum',
  );
  almost(
    point(keeperNut).toArray().slice(1),
    guidedAuxiliaryFixing.nutCenter.slice(1),
    'captive keeper nut datum',
  );
});

test('the common 240mm rounded case has a flush tube root, rear-bearing camera forms and a solid3mm rear disk', async () => {
  const a = guidedLayout(p),
    camera = guidedCameraProfile(p),
    profile = guidedNoseProfile(p);
  await units(['outer-shell', 'camera-pocket', 'camera-front-liner', 'rear-retainer'], (map) => {
    const shell = map.get('outer-shell')!,
      pocket = map.get('camera-pocket')!,
      liner = map.get('camera-front-liner')!;
    const size = new Box3().setFromObject(shell, true).getSize(new Vector3());
    assert.ok(
      Math.abs(size.z - 240) < 0.03,
      'rounded case uses the complete declared 240 mm envelope',
    );
    assert.ok(size.x < 256 && size.y < 256);
    const shoulderFaces = crossings(shell, new Vector3(0, 0, -1), new Vector3(1, 0, 0), 50);
    assert.equal(shoulderFaces.length, 2);
    assert.ok(
      Math.abs(2 * shoulderFaces[1].x - 85.8) < 0.03,
      'the hidden shoulder uses the requested 85.8 mm fit',
    );
    for (const z of [0.5, profile.rootZ / 2, profile.rootZ - 0.5])
      for (const direction of [new Vector3(1, 0, 0), new Vector3(0, 1, 0)]) {
        const faces = crossings(shell, new Vector3(0, 0, z), direction, 50);
        assert.equal(faces.length, 2);
        assert.ok(
          Math.abs(faces[1].distanceTo(new Vector3(0, 0, z)) - Number(p.tubeOD) / 2) < 0.03,
          'the exposed root matches the D90 tube without the former D94 collar',
        );
      }
    const capHeights = [14, 19, 24].map((radius) => {
      const faces = crossings(
        shell,
        new Vector3(radius, 0, profile.tipZ + 1),
        new Vector3(0, 0, -1),
        30,
      );
      assert.ok(faces.length >= 2);
      return faces[0].z;
    });
    assert.ok(capHeights[0] > capHeights[1] && capHeights[1] > capHeights[2]);
    assert.ok(
      capHeights[0] - capHeights[2] > 1,
      'the optical crown is curved rather than a flat annulus',
    );
    for (const fraction of [0.25, 0.5, 0.75]) {
      const angle = profile.tangentAngle + fraction * (Math.PI / 2 - profile.tangentAngle),
        normal = new Vector3(Math.cos(angle), 0, Math.sin(angle)),
        outer = new Vector3(
          profile.capCenter[0] + profile.capRadius * normal.x,
          0,
          profile.capCenter[1] + profile.capRadius * normal.z,
        ),
        faces = crossings(
          shell,
          outer.clone().addScaledVector(normal, 0.2),
          normal.clone().negate(),
          4,
        );
      assert.equal(faces.length, 2);
      assert.ok(
        Math.abs(faces[1].distanceTo(faces[0]) - 3) < 0.05,
        'normal cap wall retains 3 mm stock',
      );
    }
    for (const direction of [
      new Vector3(1, 0, 0),
      new Vector3(-1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, -1, 0),
    ]) {
      const hits = crossings(shell, new Vector3(0, 0, Number(p.noseLength) - 0.5), direction, 30);
      assert.equal(hits.length, 2, 'plain centered throat has no bayonet cutout');
      assert.ok(hits[1].distanceTo(hits[0]) >= 3);
    }
    for (const z of [a.cameraRear + 22, a.lensSleeveFront - 0.3]) {
      const hits = crossings(liner, new Vector3(0, 0, z), new Vector3(1, 0, 0), 25);
      assert.equal(hits.length, 2);
      assert.ok(hits[1].x - hits[0].x >= 2.75);
    }
    assert.equal(
      crossings(
        pocket,
        new Vector3(
          camera.connector.mouth[0],
          camera.connector.mouth[1],
          camera.rearStopRear - 0.2,
        ),
        new Vector3(0, 0, 1),
        camera.connector.mouth[2] - camera.rearStopRear + 0.3,
      ).length,
      0,
      'rear MIPI approach remains open',
    );
    const bearing = crossings(
      pocket,
      new Vector3(0, -3, camera.rearStopFront - 0.2),
      new Vector3(0, 0, 1),
      4,
    );
    assert.equal(bearing.length, 2);
    almost(
      [bearing[0].z, bearing[1].z],
      [camera.rearStopFront, camera.rearContactZ],
      'solid rear TPU air-load bearing stock',
      0.03,
    );
    const front = new Box3().setFromObject(liner, true).max.z;
    assert.ok(Math.abs(front - a.lensSleeveFront) < 0.03);
    assert.ok(a.cameraFront - front >= 0.45);
    const plate = map.get('rear-retainer')!,
      rear = guidedCageDatums(p).plateRear;
    for (const x of [-10, 0, 10]) {
      const faces = crossings(plate, new Vector3(x, 0, rear - 0.2), new Vector3(0, 0, 1), 5);
      assert.equal(faces.length, 2, 'rear disk core has no cage-screw cross-cut');
      assert.ok(
        Math.abs(faces[1].z - faces[0].z - 3) < 0.03,
        'solid rear disk retains its full3mm stock',
      );
    }
  });
  assert.match(pythonShape(guidedShellShape(p)), /Part\.Arc/, 'native circular shell meridians');
});

test('print preparation retains canonical definitions and isolates all source products from the print kit', async () => {
  const canonical = structuredClone(nose.composition!(p).components);
  await nose.initializeGeometry?.(p, 'print-layout');
  const printed = configuredPieces(p, 'print-layout');
  const expected = canonical.filter(
    (c) => c.supply === 'manufactured' && c.manufacturing?.processes.includes('printing'),
  );
  assert.deepEqual(printed.map((x) => x.component.id).sort(), expected.map((x) => x.id).sort());
  for (const piece of printed) {
    const original = canonical.find((c) => c.id === piece.component.id)!;
    assert.deepEqual(definition(piece.component), definition(original));
    assert.ok(piece.requireSingleSolid, 'one native solid is required per physical printed unit');
    assert.ok(['PETG', 'TPU'].includes(piece.component.manufacturing!.material));
  }
  assert.deepEqual(nose.composition!(p).components, canonical);
  for (const state of ['assembled', 'cutaway', 'extracted', 'print-layout']) {
    const model = nose.buildGeometry(p, state);
    try {
      model.updateMatrixWorld(true);
      almost(
        new Box3().setFromObject(model, true).getSize(new Vector3()).toArray(),
        nose.dimensions(p, state),
        state + ' reports the actual displayed geometry dimensions',
        0.02,
      );
    } finally {
      disposeModel(model);
    }
  }
});

test('camera and packaging switches reconcile real valid executions and preserve meaningful model states', () => {
  assert.ok(nose.updateParameters);
  for (const cameraSetup of ['ov9281', 'dual', 'camera-19']) {
    const next = nose.updateParameters({ ...p, cameraSetup }, 'cameraSetup');
    assert.equal(next.noseLength, 140);
    assert.equal(next.shoulderLength, cameraSetup === 'dual' ? 94 : 98);
    assert.equal(next.wall, cameraSetup === 'dual' ? 2.4 : 3);
    assert.equal(next.shoulderClearance, cameraSetup === 'dual' ? 0.4 : 0.2);
    for (const state of nose.states!) {
      assert.equal(availableModelState(nose, next, state.id), state.id);
      assert.deepEqual(validateParameters(nose, next, state.id), [], cameraSetup + '/' + state.id);
    }
    assert.equal(availableModelState(nose, next, 'obsolete-window-service'), 'assembled');
  }
  assert.doesNotThrow(() => nose.validate?.({ ...p, cameraSetup: 'unknown-camera' }, 'assembled'));
  assert.ok(nose.validate?.({ ...p, cameraSetup: 'unknown-camera' }, 'assembled').length);
  for (const packaging of ['tandem', 'sandwich', 'tpu-compact', 'structural-ogive']) {
    const next = nose.updateParameters({ ...p, cameraSetup: 'dual', packaging }, 'packaging');
    assert.equal(next.packaging, packaging);
    assert.equal(next.cameraSetup, packaging === 'structural-ogive' ? 'dual' : 'camera-19');
    assert.deepEqual(
      validateParameters(nose, next, 'assembled'),
      [],
      packaging + ' produces a supported physical arrangement',
    );
    assert.ok(
      nose.presets.some(
        (candidate) => JSON.stringify(candidate.parameters) === JSON.stringify(next),
      ) ||
        nose.presets.some((candidate) =>
          Object.entries(candidate.parameters).every(([key, value]) => next[key] === value),
        ),
    );
  }
  const unsupportedInterfaces: Parameters[] = [
    { wall: 2.4 },
    { shoulderClearance: 0.4 },
    { shoulderClearance: 0.6 },
  ];
  for (const change of unsupportedInterfaces)
    assert.ok(
      validateParameters(nose, { ...p, ...change }, 'assembled').length > 0,
      'unsupported prototype interface cannot be silently accepted',
    );
});
