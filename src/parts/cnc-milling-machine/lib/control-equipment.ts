import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import type { FrameHole } from '../../cnc-frame-part/part';
import detail from '../../manufactured-detail/part';
import dinRail from '../../din-rail/part';
import control, { controlMounting } from '../../machine-control/part';
import { controlSpec } from '../../machine-control/lib/model';
import drive, { servoDriveMountingHoles, servoDriveParameters } from '../../cnc-servo-drive/part';
import washer from '../../washer/part';
import nut from '../../hex-nut/part';
import type { WorkSurfaceCallbacks } from './work-surface';
import type { MillingPiece } from './composition';
import { millingLayout } from './layout';
import { addFrameTap } from './mounting';

export const controlEquipmentLibraries = [detail, dinRail];
export interface ControlMountJoint {
  device: string;
  hosts: string[];
  fasteners: string[];
  capture:
    | 'through-bolts'
    | 'source-taps'
    | 'din-latch'
    | 'rear-clamps'
    | 'supplied-collar'
    | 'external-cradle';
}
/** A named retention path for every bought device; touching a shelf is insufficient. */
export function controlMountJoints(spindlePower: number): ControlMountJoint[] {
  return [
    ...[0, 1, 2].map((i) => ({
      device: `axis-servo-drive-${i}`,
      hosts: ['control-mounting-panel'],
      fasteners: [0, 1].map((j) => `control-mount-servo-${i}-${j}`),
      capture: 'through-bolts' as const,
    })),
    {
      device: 'spindle-variable-frequency-drive',
      hosts:
        spindlePower > 2200
          ? ['vfd-captive-cradle', 'vfd-removable-top-stop']
          : ['control-mounting-panel'],
      fasteners:
        spindlePower > 2200
          ? [0, 1, 2, 3]
              .map((i) => `control-mount-vfd-cradle-${i}`)
              .concat([0, 1].map((i) => `control-mount-vfd-top-${i}`))
          : [0, 1].map((i) => `control-mount-vfd-${i}`),
      capture: spindlePower > 2200 ? 'external-cradle' : 'through-bolts',
    },
    {
      device: 'auxiliary-24v-power-supply',
      hosts: ['control-mounting-panel'],
      fasteners: [0, 1].map((i) => `control-mount-psu-${i}`),
      capture: 'source-taps',
    },
    {
      device: 'independent-safety-relay',
      hosts: ['safety-relay-din-rail', 'safety-relay-end-stop-0', 'safety-relay-end-stop-1'],
      fasteners: [0, 1]
        .map((i) => `control-mount-din-${i}`)
        .concat([0, 1].map((i) => `control-mount-din-stop-${i}`)),
      capture: 'din-latch',
    },
    {
      device: 'motion-controller',
      hosts: [0, 1, 2, 3]
        .map((i) => `controller-rear-clamp-${i}`)
        .concat(['control-mounting-panel']),
      fasteners: [0, 1, 2, 3].map((i) => `control-mount-controller-${i}`),
      capture: 'rear-clamps',
    },
    {
      device: 'emergency-stop',
      hosts: ['control-mounting-panel'],
      fasteners: [],
      capture: 'supplied-collar',
    },
  ];
}

/** Panel and post fasteners have retained hosts just as the bought devices do. */
export function controlSupportJoints(): ControlMountJoint[] {
  return [
    ...[-250, 80].map((x) => ({
      device: `control-support-post-${x}`,
      hosts: [`control-support-bed-pad-${x}`, 'drive-end-crossmember-0'],
      fasteners: [-10, 10].map((z) => `control-support-bed-${x}-${z}`),
      capture: 'source-taps' as const,
    })),
    {
      device: 'control-mounting-panel',
      hosts: [-250, 80].map((x) => `control-support-post-${x}`),
      fasteners: [-250, 80].flatMap((x) => [50, 620].map((z) => `control-support-panel-${x}-${z}`)),
      capture: 'through-bolts',
    },
  ];
}

/** Completeness is per device/joint, so an unrelated bolt cannot hide a missing mount. */
export function controlMountErrors(rows: MillingPiece[], spindlePower: number): string[] {
  const ids = new Map(rows.map((row) => [row.component.id, row]));
  const errors: string[] = [];
  if (ids.size !== rows.length) errors.push('Duplicate installed component identities.');
  const assigned = new Set<string>();
  for (const joint of [...controlMountJoints(spindlePower), ...controlSupportJoints()]) {
    if (!ids.has(joint.device)) errors.push('Missing mounted device: ' + joint.device);
    for (const host of joint.hosts)
      if (!ids.has(host)) errors.push('Missing mounting host: ' + host);
    for (const bolt of joint.fasteners) {
      if (assigned.has(bolt)) errors.push('Mount fastener has multiple owners: ' + bolt);
      assigned.add(bolt);
      if (ids.get(bolt)?.component.libraryId !== 'bolt-screw')
        errors.push('Missing mount fastener: ' + bolt);
      if (joint.capture !== 'source-taps' && !ids.has(bolt + '-nut'))
        errors.push('Missing retained mount nut: ' + bolt);
    }
  }
  for (const row of rows)
    if (
      row.component.libraryId === 'bolt-screw' &&
      (row.component.id.startsWith('control-mount-') || row.component.id.startsWith('control-support-')) &&
      !assigned.has(row.component.id)
    )
      errors.push('Unmatched installed mount fastener: ' + row.component.id);
  return errors;
}

/** Light fixed-bed panel, with real capture and host holes; no floor foot or unused shelves. */
export function addControlEquipment(
  p: Parameters,
  spindlePower: number,
  h: WorkSurfaceCallbacks,
  out: MillingPiece[],
) {
  const { add, fabricated, fastener } = h,
    v = millingLayout(p),
    cross = out.find((r) => r.component.id === 'drive-end-crossmember-0');
  if (!cross) throw new Error('Controls require the actual fixed front crossmember.');
  const crossAt = cross.component.placement.translation,
    hostFace = crossAt[1] - Number(cross.component.parameters.sizeY) / 2,
    panelY = hostFace - 60,
    panelBase = v.bedTop - 150,
    postBottom = crossAt[2] - 40,
    postTop = panelBase + 650,
    postHeight = postTop - postBottom;
  // Front +Y locally points towards the operator, world -Y.
  const world = ([x, y, z]: Vec): Vec => [230 - x, panelY - y, panelBase + z],
    rotation: Vec = [0, 0, 180];
  const manufactured = (id: string, shape: Shape, at: Vec, note: string) => {
    add(
      id,
      detail,
      { ...detail.defaults, recipe: JSON.stringify(shape) },
      'default',
      world(at),
      rotation,
      'fixed',
      'equipment',
      0xaab3ba,
    );
    const row = out[out.length - 1];
    row.requireSingleSolid = true;
    row.component.manufacturing = {
      material: v.aluminiumGrade,
      blank: 'Authored aluminium plate/section; dimensions in local feature recipe',
      processes: ['cutting', 'milling', 'drilling'],
      requirements: [
        'Approve drawing, mounting flatness, deburred edges and actual clamp preload.',
        note,
      ],
    };
    row.component.notes = note;
  };
  const panelTools: Shape[] = [];
  const bore = (x: number, z: number, d: number) =>
    panelTools.push(cylinder(d / 2, 4.2, [x, -4.1, z], 'y'));
  const localBolt = (id: string, d: number, length: number, seat: Vec) =>
    fastener(id, d, length, world(seat), [0, -1, 0], 'fixed', 'equipment');
  const capturedNut = (id: string, d: number, y: number, x: number, z: number) => {
    add(
      id,
      nut,
      {
        ...nut.defaults,
        threadAllowance: 0.05,
        bore: d,
        acrossFlats: ({ 4: 7, 5: 8, 6: 10 } as Record<number, number>)[d],
        height: ({ 4: 3.2, 5: 4, 6: 5 } as Record<number, number>)[d],
        pitch: ({ 4: 0.7, 5: 0.8, 6: 1 } as Record<number, number>)[d],
      },
      'default',
      world([x, y, z]),
      [-90, 0, 0],
      'fixed',
      'equipment',
    );
    out[out.length - 1].component.notes =
      'Nominal standard nut with an explicit Full-only 0.05 mm radial CAD inspection allowance. Simple keeps the nominal bore. This is not a supplier-certified ISO fit class, a machining prescription or permission to omit delivered thread-fit inspection.';
  };
  const boltThroughPanel = (
    id: string,
    d: number,
    length: number,
    x: number,
    z: number,
    seatY: number,
  ) => {
    bore(x, z, d + 0.6);
    localBolt(id, d, length, [x, seatY, z]);
    capturedNut(id + '-nut', d, -4, x, z);
  };
  const sourceDevice = (id: string, model: string, at: Vec) =>
    add(
      id,
      control,
      { ...control.defaults, model, panelThickness: 4 },
      'default',
      world(at),
      rotation,
      'fixed',
      'equipment',
    );

  for (const x of [-250, 80]) {
    const wx = world([x, 0, 0])[0],
      postHoles: FrameHole[] = [],
      padHoles: FrameHole[] = [];
    for (const dz of [-10, 10]) {
      const z = crossAt[2] + dz,
        id = `control-support-bed-${x}-${dz}`,
        seat: Vec = [wx, panelY + 4, z];
      postHoles.push({
        axis: 'y',
        at: [0, -20.1, z - (postTop + postBottom) / 2],
        diameter: 6.6,
        depth: 40.2,
      });
      padHoles.push({ axis: 'y', at: [0, -8.1, dz], diameter: 6.6, depth: 16.2 });
      fabricated(
        id + '-sleeve',
        'crush-sleeve',
        [12, 12, 34],
        [wx, panelY + 24, z],
        [],
        'fixed',
        'steel',
        { sleeveDiameter: 12, sleeveBore: 6.6 },
        [90, 0, 0],
        'equipment',
      );
      fastener(id, 6, 65, seat, [0, -1, 0], 'fixed', 'equipment');
      addFrameTap(out, cross.component.id, seat, [0, -1, 0], 56, 6, 1, 20);
    }
    fabricated(
      `control-support-bed-pad-${x}`,
      'support-bracket',
      [60, 16, 80],
      [wx, hostFace - 8, crossAt[2]],
      padHoles,
      'fixed',
      'aluminium',
      {},
      [0, 0, 0],
      'equipment',
    );
    for (const z of [50, 620]) {
      const id = `control-support-panel-${x}-${z}`;
      bore(x, z, 5.6);
      postHoles.push({
        axis: 'y',
        at: [0, -20.1, panelBase + z - (postTop + postBottom) / 2],
        diameter: 5.6,
        depth: 40.2,
      });
      fabricated(
        id + '-sleeve',
        'crush-sleeve',
        [10, 10, 34],
        world([x, -24, z]),
        [],
        'fixed',
        'steel',
        { sleeveDiameter: 10, sleeveBore: 5.6 },
        [90, 0, 0],
        'equipment',
      );
      localBolt(id, 5, 50, [x, 0, z]);
      add(
        id + '-washer',
        washer,
        { ...washer.defaults, bore: 5.4, outerDiameter: 10, thickness: 1 },
        'default',
        world([x, -44.5, z]),
        [-90, 0, 0],
        'fixed',
        'equipment',
      );
      capturedNut(id + '-nut', 5, -45, x, z);
    }
    fabricated(
      `control-support-post-${x}`,
      'corner-leg',
      [40, 40, postHeight],
      [wx, panelY + 24, (postTop + postBottom) / 2],
      postHoles,
      'fixed',
      'aluminium',
      { tubeAxis: 'z', wall: 3, cornerRadius: 6 },
      [0, 0, 0],
      'equipment',
    );
  }
  for (const [i, x] of [-230, -130, -30].entries()) {
    add(
      `axis-servo-drive-${i}`,
      drive,
      servoDriveParameters(),
      'default',
      world([x, 2, 110]),
      rotation,
      'fixed',
      'equipment',
      0x7f858c,
      'asd-a3-0721-m',
    );
    for (const [j, [hx, , hz]] of servoDriveMountingHoles().entries())
      boltThroughPanel(`control-mount-servo-${i}-${j}`, 4, 12, x + hx, 110 + hz, 4);
  }
  const vfdModel = spindlePower > 2200 ? 'gpenny-huanyang-4kw-220v' : 'atv12hu22m2';
  sourceDevice('spindle-variable-frequency-drive', vfdModel, [205, 0, 90]);
  const vf = controlMounting({ ...control.defaults, model: vfdModel });
  if (vf.kind === 'rear-tabs')
    for (const [i, [x, , z]] of vf.holes.entries())
      boltThroughPanel(`control-mount-vfd-${i}`, 5, 12, 205 + x, 90 + z, 3);
  else {
    const spec = controlSpec({ ...control.defaults, model: vfdModel }),
      a = spec.w / 2,
      d = spec.d - 4;
    const shape = subtract(
      union(
        box([spec.w + 12, d, 4], [-a - 6, 0, -4]),
        ...[-1, 1].flatMap((s) => [
          box([6, d, spec.h], [s < 0 ? -a - 6 : a, 0, 0]),
          box([8, 4, spec.h], [s < 0 ? -a - 6 : a - 2, d, 0]),
          box([25, 6, spec.h], [s < 0 ? -a - 25 : a, 0, 0]),
        ]),
      ),
      ...[-1, 1].flatMap((s) =>
        [60, spec.h - 60].map((z) => cylinder(2.3, 6.2, [s * (a + 15), -0.1, z], 'y')),
      ),
    );
    manufactured(
      'vfd-captive-cradle',
      shape,
      [205, 0, 90],
      vf.note +
        ' Bottom and side channels capture the case; insert along Z before attaching removable top stop. Bonding and cooling require review.',
    );
    for (const [i, [x, z]] of [-1, 1]
      .flatMap((s) => [60, spec.h - 60].map((z) => [205 + s * (a + 15), 90 + z]))
      .entries())
      boltThroughPanel(`control-mount-vfd-cradle-${i}`, 4, 16, x, z, 6);
    const top = subtract(
      box([spec.w + 50, 16, 12], [-a - 25, 0, spec.h]),
      ...[-1, 1].map((s) => cylinder(2.3, 16.2, [s * (a + 15), -0.1, spec.h + 6], 'y')),
    );
    manufactured(
      'vfd-removable-top-stop',
      top,
      [205, 0, 90],
      vf.note + ' Removable upper stop prevents vertical escape.',
    );
    for (const [i, s] of [-1, 1].entries())
      boltThroughPanel(
        `control-mount-vfd-top-${i}`,
        4,
        25,
        205 + s * (a + 15),
        90 + spec.h + 6,
        16,
      );
  }
  sourceDevice('auxiliary-24v-power-supply', 'lrs15024', [-220, 0, 350]);
  const ps = controlMounting({ ...control.defaults, model: 'lrs15024' });
  if (ps.kind !== 'rear-taps') throw new Error('Power supply needs its published bottom taps.');
  for (const [i, [x, , z]] of ps.holes.entries()) {
    bore(-220 + x, 350 + z, 3.6);
    fastener(
      `control-mount-psu-${i}`,
      3,
      6,
      world([-220 + x, -4, 350 + z]),
      [0, 1, 0],
      'fixed',
      'equipment',
    );
  }

  sourceDevice('independent-safety-relay', 'pnozx3', [-25, 0, 360]);
  // Its nominal section has7.5 mm outside height:6.5 leg-center span plus1 mm gauge.
  add(
    'safety-relay-din-rail',
    dinRail,
    {
      ...dinRail.defaults,
      width: 35,
      height: 6.5,
      length: 150,
      wall: 1,
      pitch: 25,
      hole: 4.6,
      detail: 'detailed',
    },
    'assembled',
    world([-100, 5.75, 403.5]),
    [0, 90, 180],
    'fixed',
    'equipment',
  );
  out[out.length - 1].component.manufacturing = {
    material: 'Zinc-coated steel',
    blank: '35 x 7.5 x 1 top-hat DIN stock, cut 150 mm; verify section tolerances',
    processes: ['cutting', 'drilling'],
    requirements: ['Gauge nominal section and verify supplied relay latch engagement.'],
  };
  for (const [i, x] of [-87.5, 37.5].entries()) {
    manufactured(
      `safety-relay-rail-spacer-${i}`,
      subtract(box([12, 8.5, 16], [-6, 0, -8]), cylinder(2.3, 8.7, [0, -0.1, 0], 'y')),
      [x, 0, 403.5],
      'Stand-off supports the DIN rail web at the fixing, outside the relay body; source latch is illustrative.',
    );
    boltThroughPanel(`control-mount-din-${i}`, 4, 20, x, 403.5, 9.5);
    const sx = -25 + (i === 0 ? -27.5 : 27.5);
    manufactured(
      `safety-relay-end-stop-${i}`,
      subtract(
        box([10, 12, 70], [-5, 0, -35]),
        box([12, 7.6, 35.2], [-6, 1.95, -17.6]),
        cylinder(2.3, 12.2, [0, -0.1, 25], 'y'),
      ),
      [sx, 0, 403.5],
      'Retaining bracket bears on the relay side and clears its complete rail section. Tighten after snapping the supplied latch in place.',
    );
    boltThroughPanel(`control-mount-din-stop-${i}`, 4, 20, sx, 428.5, 12);
  }

  const controllerModel = String(p.controller),
    cm = controlMounting({ ...control.defaults, model: controllerModel });
  if (cm.kind !== 'panel-clamps')
    throw new Error('Choose a DDCS controller with an authored panel clamp interface.');
  const controllerX = -90,
    controllerZ = 480,
    bodyZ = (cm.fasciaHeight - cm.rearHeight) / 2,
    gap = cm.rearDepth - 4;
  sourceDevice('motion-controller', controllerModel, [controllerX, -cm.rearDepth, controllerZ]);
  panelTools.push(
    box(
      [cm.rearWidth + 1, 4.2, cm.rearHeight + 1],
      [controllerX - (cm.rearWidth + 1) / 2, -4.1, controllerZ + bodyZ - 0.5],
    ),
  );
  for (const [i, [s, z]] of [-1, 1]
    .flatMap((s) =>
      [controllerZ + bodyZ + 18, controllerZ + bodyZ + cm.rearHeight - 18].map((z) => [s, z]),
    )
    .entries()) {
    const x = controllerX + s * (cm.rearWidth / 2 + 14),
      id = `control-mount-controller-${i}`;
    manufactured(
      `controller-rear-clamp-${i}`,
      subtract(box([32, 4, 12], [-16, -4, -6]), cylinder(2.3, 4.2, [s * 2, -4.1, 0], 'y')),
      [x - s * 2, -cm.rearDepth, z],
      cm.note,
    );
    fabricated(
      id + '-spacer',
      'crush-sleeve',
      [10, 10, gap],
      world([x, -cm.rearDepth + gap / 2, z]),
      [],
      'fixed',
      'aluminium',
      { sleeveDiameter: 10, sleeveBore: 4.6 },
      [90, 0, 0],
      'equipment',
    );
    bore(x, z, 4.6);
    localBolt(id, 4, Math.ceil((cm.rearDepth + 8) / 5) * 5, [x, 0, z]);
    capturedNut(id + '-nut', 4, -cm.rearDepth - 4, x, z);
  }
  sourceDevice('emergency-stop', 'xb5as8444', [220, -65, 550]);
  panelTools.push(cylinder(11.25, 4.2, [220, -4.1, 570], 'y'));
  out[out.length - 1].component.notes =
    'Supplied XB5 plastic collar rear face −4 and head flange front face 0 clamp the 4 mm panel. Factory collar torque 0.8..1.2 Nm; approve anti-rotation and delivered installation instructions.';
  manufactured(
    'control-mounting-panel',
    subtract(box([610, 4, 650], [-300, -4, 0]), ...panelTools),
    [0, 0, 0],
    'One 4 mm aluminium bed-mounted panel, no shelves or floor supports. Explicit source bolts, DIN capture, rear clamps and supplied collar retention. Approve enclosure (PNOZ requires IP54), bonding, cable access, cooling/EMC and delivered mount contours before energizing.',
  );
}
