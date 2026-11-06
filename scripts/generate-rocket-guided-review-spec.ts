/** Assembly, tool and loading stages for the interchangeable centered-camera cassette. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { Euler, Vector3 } from 'three';
import part, { configuredPieces } from '../src/parts/rocket-camera-nose/part';
import {
  guidedLayout,
  guidedEthernetReserve,
  at,
  worldPoint,
  guidedGpioReserve,
  guidedPowerPassage,
} from '../src/parts/rocket-camera-nose/lib/guided-layout';
import {
  guidedCsiPlan,
  guidedCsiReserve,
  guidedPciePlan,
  guidedPcieReserve,
} from '../src/parts/rocket-camera-nose/lib/guided-routing';
import { guidedShellAnchorDatums } from '../src/parts/rocket-camera-nose/lib/guided-shell';
import { guidedSupportSeatContact } from '../src/parts/rocket-camera-nose/lib/guided-supports';
import {
  guidedCageDatums,
  guidedCageJointSpecs,
  guidedCageStopContacts,
  guidedAuxiliaryFixing,
} from '../src/parts/rocket-camera-nose/lib/guided-cage';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  pythonShape,
  type Shape,
  type Vec,
} from '../src/core/assembly/boundary/shapes';
import { guidedPowerPlan } from '../src/parts/rocket-camera-nose/lib/guided-power';
import { guidedCameraProfile } from '../src/parts/rocket-camera-nose/lib/guided-camera';
import { pi5Interface } from '../src/parts/raspberry-pi/part';
import type { ConfiguredPiece } from '../src/core/assembly/detail-instances';

const preset = part.presets.find((x) => x.id === (process.argv[3] ?? 'structural-90-86'))!;
assert.ok(preset);
const p = preset.parameters;
const a = guidedLayout(p);
const cageDatums = guidedCageDatums(p);
const cameraProfile = guidedCameraProfile(p);
const pieces = configuredPieces(p, 'assembled') as (ConfiguredPiece & { fixed: boolean })[];
const ids = pieces.map((x) => x.component.id);
const lookup = new Map(pieces.map((x) => [x.component.id, x]));
const unique = (...sets: string[][]) => [...new Set(sets.flat())];
const requireIds = (...wanted: string[]) => {
  for (const id of wanted) assert.ok(lookup.has(id), 'Missing live occurrence ' + id);
  return wanted;
};
const select = (test: (id: string) => boolean) => ids.filter(test);
const fixed = pieces.filter((x) => x.fixed).map((x) => x.component.id);
assert.ok(fixed.includes('outer-shell'), 'A single live fixed outer shell is required.');
assert.ok(
  !ids.some((id) =>
    /^(hood-lock-|cap-lock-|pi-shoe-|pi-mount-|ups-mount-|power-clamp-|aux-bridge-|camera-keeper-)/.test(
      id,
    ),
  ),
  'Obsolete independent mounts are not part of this architecture.',
);
const bodyScrews = requireIds(
  ...guidedShellAnchorDatums.map((f) => f.id.replace('body-anchor-', 'body-anchor-screw-')),
);
const bodyNuts = requireIds(
  ...guidedShellAnchorDatums.map((f) => f.id.replace('body-anchor-', 'body-anchor-nut-')),
);
const caseOnly = requireIds('outer-shell', ...bodyNuts);
const jointScrews = requireIds('cage-joint-screw-0', 'cage-joint-screw-1');
const jointNuts = requireIds('cage-joint-nut-0', 'cage-joint-nut-1');
const auxKeeperScrew = requireIds('aux-keeper-screw');
const auxKeeperNut = requireIds('aux-keeper-nut');
const cells = requireIds('ups-cell-0', 'ups-cell-1', 'ups-cell-2');
const cameraSide = select(
  (id) => id.startsWith('camera-side-') || id.startsWith('camera-compression-'),
);
assert.equal(
  cameraSide.length,
  cameraProfile.usesSideScrews ? 6 : 0,
  'Only the19mm housing camera uses the two source side screw/washer/tube stacks.',
);
const cameraModule = requireIds('csi-camera', 'camera-pocket', 'camera-front-liner', ...cameraSide);
const auxDevices = requireIds('aux-gps', 'aux-buzzer');
const cassette = ids.filter((id) => !caseOnly.includes(id) && !bodyScrews.includes(id));
const base = requireIds('cassette-cage-base');
const baseWithPlate = unique(base, requireIds('rear-retainer'));
const cushionedBase = unique(baseWithPlate, requireIds('adapter-cushion'));
const adapterAssembly = requireIds('nvme-adapter', 'nvme-ssd', 'ssd-retention-screw');
const adapterPresent = unique(cushionedBase, adapterAssembly);
const carrierPresent = unique(adapterPresent, requireIds('power-carrier', 'pi-pocket'));
const powerPresent = unique(carrierPresent, requireIds('ups3s'), cells);
const powerCompleted = unique(powerPresent, requireIds('ups-cell-cover'));
const piCompleted = unique(powerCompleted, requireIds('pi5'));
const baseCompleted = unique(piCompleted, cameraModule);
const coverBare = requireIds('cassette-cage-cover', ...jointNuts, ...auxKeeperNut);
const coverWithPressure = unique(coverBare, requireIds('pi-pressure'));
const coverWithBed = unique(coverWithPressure, requireIds('aux-bed'));
const coverWithDevices = unique(coverWithBed, auxDevices);
const coverWithClamp = unique(coverWithDevices, requireIds('aux-clamp'));
const coverCompleted = unique(coverWithClamp, requireIds('aux-pressure-plate'));
const closedBeforeScrews = unique(baseCompleted, coverCompleted);
assert.deepEqual(
  unique(closedBeforeScrews, jointScrews, auxKeeperScrew).sort(),
  [...cassette].sort(),
  'Every cage occurrence belongs to an explicit assembly group.',
);

type Motion = {
  id: string;
  kind: string;
  description: string;
  stageReason: string;
  movingIds?: string[];
  proxyCode?: string;
  obstacleIds: string[];
  removedIds: string[];
  waypoints: Vec[];
  maxStep: number;
  requireExteriorEndpoint: true;
  extraMoving?: { id: string; shapeCode: string }[];
  extraObstacles?: { id: string; shapeCode: string }[];
};
const motions: Motion[] = [];
function addMotion(
  id: string,
  kind: string,
  movingIds: string[],
  present: string[],
  delta: Vec,
  description: string,
  extraMoving?: Motion['extraMoving'],
) {
  for (const value of unique(movingIds, present))
    assert.ok(lookup.has(value), id + ': missing ' + value);
  const stage = unique(movingIds, present);
  const obstacles = stage.filter((value) => !movingIds.includes(value));
  assert.ok(obstacles.length, id + ': no stage obstacles');
  motions.push({
    id,
    kind,
    description,
    stageReason: description,
    movingIds,
    obstacleIds: obstacles,
    removedIds: ids.filter((value) => !stage.includes(value)),
    waypoints: [delta, [0, 0, 0]],
    maxStep: 0.5,
    requireExteriorEndpoint: true,
    ...(extraMoving ? { extraMoving } : {}),
  });
}
function addProxy(
  id: string,
  kind: string,
  shape: Shape,
  present: string[],
  delta: Vec,
  description: string,
) {
  requireIds(...present);
  motions.push({
    id,
    kind,
    description,
    stageReason: description,
    proxyCode: 'shape = ' + pythonShape(shape),
    obstacleIds: unique(present),
    removedIds: ids.filter((value) => !present.includes(value)),
    waypoints: [delta, [0, 0, 0]],
    maxStep: 0.5,
    requireExteriorEndpoint: true,
  });
}
const csi = {
  id: 'connected-csi-ribbon-clearance',
  shapeCode: 'shape = ' + pythonShape(guidedCsiReserve(p)),
};
const pcie = {
  id: 'connected-pcie-ribbon-clearance',
  shapeCode: 'shape = ' + pythonShape(guidedPcieReserve(p)),
};
const { gpioPins, passage, socket, path, powerCode } = guidedPowerPlan(p);
const gpio = { id: 'gpio-ups-power-lead-clearance', shapeCode: powerCode };

addMotion(
  'complete-prewired-cassette-insertion',
  'cassette-insertion',
  cassette,
  caseOnly,
  [0, 0, -250],
  'Insert the complete camera-first bench-wired cassette into the single case from its open rear. All four fixed case nyloc nuts remain installed; the four tube screws are absent. Both cage halves, rear plate, all electronics and camera hardware move together.',
  [csi, pcie, gpio],
);
addMotion(
  'rear-plate-placement',
  'printed-insert-placement',
  requireIds('rear-retainer'),
  base,
  [100, 0, 0],
  'Place the separate flat rear plate into the open negative-X cage half before electronics. Its broad grooves capture it only after the positive-X half closes. No separate cap fastener exists.',
);
addMotion(
  'adapter-cushion-placement',
  'printed-insert-placement',
  requireIds('adapter-cushion'),
  baseWithPlate,
  [100, 0, 0],
  'Place the empty TPU adapter cushion from positive X onto the open base before the adapter and all other modules.',
);
addMotion(
  'ssd-axial-placement',
  'ssd-placement',
  requireIds('nvme-ssd'),
  requireIds('nvme-adapter'),
  [0, 0, -100],
  'On the bench, engage the complete SSD axially in its separate source adapter before installing the supplier-interface SSD screw and placing the subassembly on the base.',
);
addMotion(
  'adapter-board-placement',
  'board-placement',
  adapterAssembly,
  cushionedBase,
  [100, 0, 0],
  'Place the preassembled adapter/SSD from positive X into the open base before the power divider and UPS. The continuous negative-X backplate makes the former negative-X entry unavailable.',
);
addMotion(
  'power-carrier-placement',
  'printed-insert-placement',
  requireIds('power-carrier'),
  adapterPresent,
  [100, 0, 0],
  'Place the source-cleared TPU power divider onto the open base after the adapter/SSD, before UPS, Pi, camera and closing cage.',
);
addMotion(
  'pi-pocket-placement',
  'printed-insert-placement',
  requireIds('pi-pocket'),
  unique(adapterPresent, requireIds('power-carrier')),
  [100, 0, 0],
  'Place the connected TPU Pi support form onto the open base. No Pi screw or shoe hardware is present in this architecture.',
);
addMotion(
  'ups-module-placement',
  'board-placement',
  requireIds('ups3s', ...cells),
  carrierPresent,
  [100, 0, 0],
  'Place the source UPS with its three installed cells onto the TPU carrier while the outer case and closing cage are absent. The source board is located by TPU forms, not separate board screws.',
);
addMotion(
  'ups-cell-cover-placement',
  'retainer-placement',
  requireIds('ups-cell-cover'),
  powerPresent,
  [100, 0, 0],
  'Place the thick TPU cell restraint onto the seated source UPS and cells before the common PETG cage closes around it.',
);
addMotion(
  'pi-board-placement',
  'board-placement',
  requireIds('pi5'),
  powerCompleted,
  [100, 0, 0],
  'Place the complete source Pi along its PCB normal onto the TPU support and locating features. The pressure insert arrives with the common closing cage; no board screws are installed.',
);
addMotion(
  'camera-into-open-rear-cradle',
  'camera-placement',
  requireIds('csi-camera'),
  requireIds('camera-pocket'),
  [0, 0, 100],
  'Place the unmodified purchased camera axially into its source-specific open rear cradle on the bench. The separate front liner and any19mm side hardware are absent; no TPU deformation is assumed.',
);
addMotion(
  'camera-front-liner-placement',
  'retainer-placement',
  requireIds('camera-front-liner'),
  requireIds('camera-pocket', 'csi-camera'),
  [0, 0, 100],
  'Slide the separate objective liner over the actual camera lens from the front after seating the camera on its rear support. The completed cartridge is then captured by the common cage.',
);
addMotion(
  'camera-module-placement',
  'camera-placement',
  cameraModule,
  piCompleted,
  [100, 0, 0],
  'Place the complete centered camera, rear TPU cradle and separate front liner into the open base. Only the19mm housing execution includes its two source side-screw stacks. The common cage supplies positive external capture instead of a separate keeper.',
);
addMotion(
  'pi-pressure-placement',
  'printed-insert-placement',
  requireIds('pi-pressure'),
  coverBare,
  [-100, 0, 0],
  'Place the thick TPU Pi pressure form into the separate positive-X cage half from its open negative-X face before bringing this half toward the board.',
);
addMotion(
  'aux-bed-placement',
  'accessory-placement',
  requireIds('aux-bed'),
  coverWithPressure,
  [100, 0, 0],
  'Place the empty TPU tracker/finder bed on the separate closing cage before either device or the common TPU retaining form. This checks the proposed rigid entry path without assuming clip deflection.',
);
addMotion(
  'aux-devices-placement',
  'accessory-placement',
  auxDevices,
  coverWithBed,
  [100, 0, 0],
  'Place the complete tracker and finder procurement units into their common TPU bed on the separate closing cage. No accessory screws or permanent front lip may be assumed to yield.',
);
addMotion(
  'aux-clamp-placement',
  'retainer-placement',
  requireIds('aux-clamp'),
  coverWithDevices,
  [100, 0, 0],
  'Place the common thick TPU accessory restraint on both devices before the broad PETG pressure plate. The one keeper screw clamps the PETG plate rather than point-loading a device.',
);
addMotion(
  'aux-pressure-plate-placement',
  'retainer-placement',
  requireIds('aux-pressure-plate'),
  coverWithClamp,
  [100, 0, 0],
  'Place the broad PETG auxiliary pressure plate after both devices and their TPU lid. Its single source M3 keeper screw is absent until the plate reaches the broad cover boss; no thin yielding latch or unverified captive-slot kinematics is assumed.',
);
addMotion(
  'populated-cover-closure',
  'cage-closure',
  coverCompleted,
  baseCompleted,
  [100, 0, 0],
  'Bring the populated positive-X cage half, its preloaded joint nuts, Pi pressure form and tracker/finder forms against the populated base. Both cage screws and the outer case are absent. This must reach the actual hard stops with all boards and camera already seated.',
);
motions.at(-1)!.extraObstacles = [csi, pcie];
motions.at(-1)!.description +=
  ' Leave the loose power lead aside; connect it through the source-bound GPIO and UPS service openings after cage closure, on the bench, before outer-case insertion.';
motions.at(-1)!.stageReason = motions.at(-1)!.description;
addProxy(
  'gpio-power-connection-after-cage-closure',
  'connector-working-space',
  guidedGpioReserve(),
  cassette,
  [-100, 0, 0],
  'Insert the pin4/6 power plug through the dedicated rear-face service opening after closing the cage, while the outer case is absent. Lay the flexible lead into its verified final route before case insertion.',
);
addProxy(
  'ups-power-connection-after-cage-closure',
  'connector-working-space',
  box([9, 8, 6], [socket[0], socket[1] - 4, socket[2] - 3]),
  cassette,
  [100, 0, 0],
  'Connect the other power lead end through the fully open UPS socket working corridor after cage closure. The exact delivered harness and its flexible laying operation require physical qualification.',
);
addProxy(
  'nose-facing-ethernet-access',
  'connector-working-space',
  guidedEthernetReserve(),
  cassette,
  [0, -100, 5],
  'After withdrawing the complete cassette, bring the Ethernet plug from the open side beneath the camera neck, then insert it5mm along the nose-facing socket axis. The wired cassette remains assembled; case and tube hardware are absent.',
);
motions.at(-1)!.waypoints = [
  [0, -100, 5],
  [0, 0, 5],
  [0, 0, 0],
];
motions.at(-1)!.extraObstacles = [csi, pcie, gpio];

// User-specified tube envelope, not an invented purchased tube product or BOM unit.
const tubeStock = subtract(cylinder(45, 180, [0, 0, -180]), cylinder(43, 180.4, [0, 0, -180.2]));
const tubeShape = subtract(
  tubeStock,
  ...guidedShellAnchorDatums.map((f) =>
    at(cylinder(2.2, 8, [41, 0, f.z], 'x'), { translation: [0, 0, 0], rotation: [0, 0, f.angle] }),
  ),
);
const tube = {
  id: 'user-aluminum-90-86-tube-envelope',
  shapeCode: 'shape = ' + pythonShape(tubeShape),
};
addProxy(
  'complete-unit-into-aluminum-tube',
  'tube-installation',
  tubeShape,
  ids.filter((id) => !bodyScrews.includes(id)),
  [0, 0, -200],
  'Inverse relative-motion check of the complete case/cassette entering the user OD90/ID86 aluminum tube: hold the nose fixed and translate the tube upward from wholly below it. All four tube screws are absent. Tube length180mm is an authored inspection extent, not a purchased product definition.',
);

/** Use the actual catalog hex drive and complete screw pose, not a convenient empty line. */
function driverShape(screwId: string): { shape: Shape; outward: Vec } {
  const piece = lookup.get(screwId)!;
  assert.ok(piece && piece.component.libraryId === 'bolt-screw');
  const params = piece.component.parameters;
  assert.equal(params.drive, 'hex', screwId + ': only actual hex drives are implemented');
  const width = Number(params.driveWidth) - 0.1;
  const depth = Number(params.driveDepth) - 0.1;
  const front = (Number(params.length) + Number(params.headHeight)) / 2;
  assert.ok(width > 0 && depth > 0);
  const bit = prism(
    Array.from({ length: 6 }, (_, i) => {
      const angle = ((2 * i + 1) * Math.PI) / 6;
      return [
        (width / Math.sqrt(3)) * Math.cos(angle),
        (width / Math.sqrt(3)) * Math.sin(angle),
      ] as [number, number];
    }),
    25 + depth + 0.2,
    front - depth,
  );
  const handle = cylinder(8, 35, [0, 0, front + 25]);
  const placement = piece.component.placement;
  const angles = placement.rotation.map((v) => (v * Math.PI) / 180) as Vec;
  const outward = new Vector3(0, 0, 1).applyEuler(new Euler(...angles, 'ZYX')).toArray() as Vec;
  return { shape: { kind: 'transform', child: union(bit, handle), ...placement }, outward };
}
function driver(screwId: string, present: string[], reason: string) {
  const { shape, outward } = driverShape(screwId);
  addMotion(
    'install-' + screwId,
    'screw-placement',
    requireIds(screwId),
    unique(present, [screwId]),
    outward.map((v) => v * 100) as Vec,
    reason +
      ' Insert the complete source screw along its axis before tightening. This checks the nominal solid envelope, not helical thread engagement or torque.',
  );
  addProxy(
    'tool-' + screwId,
    'screwdriver-access',
    shape,
    unique(present, [screwId]),
    outward.map((v) => v * 100) as Vec,
    reason +
      ' A source-clocked hex bit enters the actual recess; a D16 handle starts 25 mm beyond the head face.',
  );
}

driver(
  'ssd-retention-screw',
  adapterAssembly,
  'Tighten the one SSD retainer on the separate adapter/SSD before cassette assembly.',
);
for (const id of cameraSide.filter((id) => id.startsWith('camera-side-screw-')))
  driver(
    id,
    cameraModule,
    'Tighten the actual camera-side screw/tube/washer stack on the separate camera/TPU module before mounting it on the cage.',
  );
for (const id of jointScrews)
  driver(
    id,
    cassette,
    'Close the populated cage on the bench with both common M4 joints and all electronics, TPU inserts and rear plate present. No case or tube obstructs the tool.',
  );
driver(
  auxKeeperScrew[0],
  cassette,
  'Tighten the one auxiliary keeper screw against its broad PETG spine and cover boss after the TPU bed, both devices and TPU lid are seated. The complete cassette is on the bench outside the case.',
);
for (const id of bodyScrews) {
  driver(
    id,
    ids,
    'Install the shared tube/case/cassette locating screw only after the complete unit is seated in the user aluminum tube. Fixed source nyloc nuts remain installed; the steel end enters the PETG cage land.',
  );
  motions.find((m) => m.id === 'install-' + id)!.extraObstacles = [tube];
  motions.find((m) => m.id === 'tool-' + id)!.extraObstacles = [tube];
}
function nutLoading(id: string, hosts: string[], waypoints: Vec[], description: string) {
  addMotion('load-' + id, 'captive-nut-loading', requireIds(id), hosts, waypoints[0], description);
  motions.at(-1)!.waypoints = waypoints;
}
nutLoading(
  auxKeeperNut[0],
  requireIds('cassette-cage-cover'),
  [
    [0, -100, 0],
    [0, 0, 0],
  ],
  'Load the complete source M3 nyloc through the negative-Y side mouth of the separate keeper boss before fitting the auxiliary bed, devices, TPU lid or PETG plate.',
);
for (const [i, joint] of guidedCageJointSpecs(p).entries())
  nutLoading(
    jointNuts[i],
    requireIds('cassette-cage-cover'),
    [
      [100, 0, 0],
      [0, 0, 0],
    ],
    'Load the complete source common-cage nut through its positive-X mouth in the separate empty cover before electronics and cage closure. Joint datum ' +
      joint.id +
      '.',
  );
for (const f of guidedShellAnchorDatums) {
  const id = f.id.replace('body-anchor-', 'body-anchor-nut-');
  const turn = (v: Vec): Vec => (f.angle === 0 ? v : [-v[0], -v[1], v[2]]);
  const waypoints: Vec[] =
    f.angle === 0
      ? [
          [-7.5, 0, -130 - f.z],
          [-7.5, 0, 0],
          [0, 0, 0],
        ]
      : [
          [-1, -13, -130 - f.z],
          [-1, -13, 0],
          [-1, 0, 0],
          [0, 0, 0],
        ].map((v) => turn(v as Vec));
  nutLoading(
    id,
    requireIds('outer-shell'),
    waypoints,
    f.angle === 0
      ? 'Load the fixed M4 nyloc from the open rear at radius27.5, then radially outward to its R35 seat before the cassette enters.'
      : 'Load the negative-side M4 nyloc through the open rear at local(R34,Y-13), then sideways into its mouth and radially outward toR35. The printed pin guide keeps its small D4.4 bore.',
  );
}

assert.equal(new Set(motions.map((m) => m.id)).size, motions.length);
for (const m of motions)
  assert.equal(unique(m.movingIds ?? [], m.obstacleIds, m.removedIds).length, ids.length);
const occurrenceBindings = pieces
  .map((piece) => ({
    id: piece.component.id,
    libraryId: piece.component.libraryId,
    presetId: piece.component.presetId,
    ...(piece.component.libraryId !== 'manufactured-detail'
      ? { parameters: piece.component.parameters }
      : {}),
    placement: piece.component.placement,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));
const boundFiles = [
  'src/parts/rocket-camera-nose/part.ts',
  'src/parts/rocket-camera-nose/configurator.ts',
  'src/parts/rocket-camera-nose/presets.json',
  'src/parts/rocket-camera-nose/lib/model.ts',
  'src/parts/rocket-camera-nose/lib/csi.ts',
  'src/parts/rocket-camera-nose/lib/guided-layout.ts',
  'src/parts/rocket-camera-nose/lib/guided-optics.ts',
  'src/parts/rocket-camera-nose/lib/guided-profile.ts',
  'src/parts/rocket-camera-nose/lib/guided-camera.ts',
  'src/parts/rocket-camera-nose/lib/guided-routing.ts',
  'src/parts/rocket-camera-nose/lib/guided-power.ts',
  'src/parts/rocket-camera-nose/lib/guided.ts',
  'src/parts/rocket-camera-nose/lib/guided-geometry.ts',
  'src/parts/rocket-camera-nose/lib/guided-shell.ts',
  'src/parts/rocket-camera-nose/lib/guided-supports.ts',
  'src/parts/rocket-camera-nose/lib/guided-cage.ts',
  'src/parts/rocket-camera-nose/lib/guided-retention.ts',
  'src/parts/rocket-camera-nose/lib/accessory-mounts.ts',
  'src/parts/raspberry-pi/interface.ts',
  'src/parts/waveshare-ups-3s/part.ts',
  'src/parts/waveshare-pcie-m2-d/part.ts',
  'src/parts/waveshare-ov9281-110/part.ts',
  'src/parts/waveshare-ov9281-110/presets.json',
  'src/parts/board-camera-19/part.ts',
  'src/parts/board-camera-19/presets.json',
  'src/parts/nyloc-nut/part.ts',
  'src/parts/nyloc-nut/presets.json',
  'src/core/hardware/fasteners.ts',
  'src/core/assembly/boundary/shapes.ts',
  'src/core/assembly/manifold-boundary.ts',
].map((path) => ({
  path,
  sha256: createHash('sha256')
    .update(readFileSync(resolve(path)))
    .digest('hex'),
}));
const output = resolve(
  process.argv[2] ?? 'test-results/rocket-camera-nose-guided-rebuild/review-spec.json',
);
mkdirSync(dirname(output), { recursive: true });
const serialPlan = (
  plan: ReturnType<typeof guidedPciePlan> | ReturnType<typeof guidedCsiPlan>,
) => ({
  id: plan.id,
  availableLength: plan.availableLength,
  totalLength: plan.totalLength,
  slack: plan.slack,
  minBendRadius: plan.minBendRadius,
});
const captureGroup = (id: string, movingIds: string[], obstacleIds: string[]) => ({
  id,
  movingIds: requireIds(...movingIds),
  obstacleIds: requireIds(...obstacleIds),
});
const cageHalves = requireIds('cassette-cage-base', 'cassette-cage-cover');
const captureGroups = [
  captureGroup('pi-board-capture', ['pi5'], [...cageHalves, 'pi-pocket', 'pi-pressure']),
  captureGroup('ups-board-capture', ['ups3s'], [...cageHalves, 'power-carrier', 'ups-cell-cover']),
  ...cells.map((id) =>
    captureGroup(
      id + '-capture',
      [id],
      [...cageHalves, 'ups3s', 'power-carrier', 'ups-cell-cover'],
    ),
  ),
  captureGroup('adapter-storage-capture', adapterAssembly, [
    ...cageHalves,
    'adapter-cushion',
    'power-carrier',
  ]),
  captureGroup(
    'camera-body-capture',
    ['csi-camera', ...cameraSide],
    [...cageHalves, 'camera-pocket', 'camera-front-liner'],
  ),
  captureGroup('camera-pocket-capture', cameraModule, cageHalves),
  captureGroup(
    'camera-front-liner-capture',
    ['camera-front-liner'],
    [...cageHalves, 'camera-pocket', 'csi-camera'],
  ),
  ...auxDevices.map((id) =>
    captureGroup(
      id + '-capture',
      [id],
      [...cageHalves, 'aux-bed', 'aux-clamp', 'aux-pressure-plate'],
    ),
  ),
  captureGroup(
    'common-auxiliary-bed-capture',
    ['aux-bed', 'aux-clamp', ...auxDevices],
    [...cageHalves, 'aux-pressure-plate'],
  ),
  captureGroup(
    'auxiliary-pressure-plate-capture',
    ['aux-pressure-plate'],
    [...cageHalves, ...auxKeeperScrew, ...auxKeeperNut],
  ),
  captureGroup('rear-plate-capture', ['rear-retainer'], [...cageHalves, ...jointScrews]),
  captureGroup('complete-cassette-capture', cassette, [...caseOnly, ...bodyScrews]),
];
writeFileSync(
  output,
  JSON.stringify(
    {
      schemaVersion: 1,
      units: 'mm',
      partId: part.id,
      presetId: preset.id,
      parameters: p,
      generatedAt: new Date().toISOString(),
      liveOccurrenceIds: ids,
      sourceBindings: { occurrences: occurrenceBindings, files: boundFiles },
      requiredCheckIds: motions.map((m) => m.id),
      contacts: [
        {
          ...guidedSupportSeatContact(p),
          description:
            'Broad transverse case/cassette seating face; geometric contact is not a strength rating.',
        },
        ...guidedCageStopContacts(p).map((contact) => ({
          ...contact,
          description:
            'Source-bound PETG compression stop between cage halves. Measured face contact prevents closure relying only on TPU or PCB compression; it is not a preload or strength rating.',
        })),
        {
          id: 'camera-source-to-rear-tpu-bearing',
          first: 'csi-camera',
          second: 'camera-pocket',
          axis: 'z',
          planeCoordinate: cameraProfile.rearContactZ,
          minArea: cameraProfile.setup === 'ov9281' ? 12 : 260,
          description:
            'Actual purchased rear face against the TPU compression support. OV uses only the four mounting-hole annuli; populated rear electronics are relieved.',
        },
        ...cageHalves.map((half) => ({
          id: 'camera-rear-tpu-to-' + half,
          first: 'camera-pocket',
          second: half,
          axis: 'z',
          planeCoordinate: cameraProfile.rearStopFront,
          minArea: 100,
          description:
            'Broad TPU pedestal bearing against the common4mm PETG rear shoe; load transfers directly into the two cage halves.',
        })),
      ],
      motions,
      isolationPairs: ['pi5', 'ups3s', 'csi-camera'].flatMap((electronics) =>
        ['outer-shell', ...cageHalves, 'aux-pressure-plate', 'rear-retainer'].map((frame) => ({
          electronics,
          frame,
          minimumClearance: 0.05,
          scope:
            'Nominal positive separation from PETG; TPU forms carry the electronics. This numerical contact screen is not a manufacturing tolerance or vibration rating.',
        })),
      ),
      retentionProbes: {
        groups: captureGroups,
        axes: ['x', 'y', 'z'],
        signedDistances: [-1, -0.5, -0.25, -0.1, -0.05, 0.05, 0.1, 0.25, 0.5, 1],
        overlapVolume: 0.01,
        scope:
          'Separate expected-contact screen: find a blocking structural/TPU surface within1mm in each coordinate direction. It is not an assembly motion, six-degree-of-freedom escape proof, preload measurement or strength rating.',
      },
      limits: { overlapVolume: 0.01 },
      printing: { layerHeight: 0.2, allowedLateralReach: 0.2, meshDeflection: 0.025 },
      gpioPower: {
        pins: gpioPins,
        seatZ: pi5Interface.gpio.seatZ,
        sourceUrl: pi5Interface.gpio.sourceUrl,
        projection: [8, 8, 10],
        wireBundleDiameter: passage.diameter,
        wirePassage: passage,
        wirePath: path,
        outputSocketMouth: socket,
        outputPlugSpace: [9, 8, 6],
        scope:
          'Authored external power plug/wire allowances outside exact source pin tips; not sourced cable geometry or a current rating.',
      },
      cablePlans: [serialPlan(guidedCsiPlan(p)), serialPlan(guidedPciePlan(p))],
      cassetteInstalledEnvelope: {
        tubeOD: p.tubeOD,
        tubeID: p.tubeID,
        shoulderLength: p.shoulderLength,
        noseLength: p.noseLength,
        cameraFront: a.cameraFront,
        cameraAxis: a.camera.translation.slice(0, 2),
      },
      anchorInterfaces: guidedShellAnchorDatums,
      cageJoints: guidedCageJointSpecs(p),
      auxiliaryKeeperJoint: guidedAuxiliaryFixing,
      rearPlateCapture: {
        rear: cageDatums.plateRear,
        front: cageDatums.plateFront,
        radius: cageDatums.plateRadius,
      },
      tubeInspectionProxy: {
        shapeCode: tube.shapeCode,
        source:
          'User supplied aluminum90/86mm interface; length180mm is an authored inspection extent.',
        scope:
          'Dimensioned tube envelope and four mating hole axes for pin/tool checks; not a library procurement unit.',
      },
      toolAssumptions: [
        'Straight source-clocked catalog hex bit with0.1mm across-flat and bottom clearance.',
        'D16 service handle starts25mm beyond the head face.',
        'Screw paths use the actual nominal source bodies; thread tightening, nylon friction, torque and preload are not simulated.',
      ],
      unresolvedEvidence: [
        'All rigid assembly paths must pass the actual integrated native model. TPU compliance is not an implicit collision exemption.',
        'The existing engine validates motions and declared planar contacts. Six-direction retention probes are a separate geometry screen and do not imply a shock rating.',
        'The GPIO power lead has an authored D4 swept bundle and9x8x6mm plug allowance. Adapter, tracker and finder branch wires require delivered-harness fitting.',
        'Parachute shackle is below the cassette in the user aluminum tube. Peak recovery acceleration, slack/line stiffness, printed material/process properties and cassette mass remain unknown.',
        'The four steel pin tips provide positive cage capture through3.5mm lands; fixed nuts do not apply direct cage-half preload. D4.4 guide clearance must not be treated as continuously engaged bearing support.',
        'Dense layer screening is not slicer toolpaths, actual support volume, support-removal strength, thermal qualification or flight/load certification.',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    output,
    physicalOccurrences: ids.length,
    cassetteOccurrences: cassette.length,
    fixedOccurrences: fixed.length,
    motionCount: motions.length,
    kinds: Object.fromEntries(
      [...new Set(motions.map((m) => m.kind))].map((kind) => [
        kind,
        motions.filter((m) => m.kind === kind).length,
      ]),
    ),
  }),
);
