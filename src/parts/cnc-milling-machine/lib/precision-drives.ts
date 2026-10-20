import { Euler, Matrix4, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import type { MillingPiece, Motion } from './composition';
import type { WorkSurfaceCallbacks } from './work-surface';
import type { millingLayout } from './layout';
import type { FrameHole } from '../../cnc-frame-part/part';
import { frameManufacturing } from '../../cnc-frame-part/part';
import motor, {
  feedServoParameters,
  feedServoLayout,
  feedServoMountingHoles,
} from '../../cnc-feed-servo/part';
import screw, {
  precisionScrewParameters,
  precisionScrewLayout,
} from '../../cnc-precision-screw/part';
import nut, {
  precisionNutParameters,
  precisionNutLayout,
  precisionNutMountingHoles,
  precisionScrewSource,
} from '../../cnc-precision-nut/part';
import support, {
  precisionSupportParameters,
  precisionSupportLayout,
  precisionSupportMountingHoles,
} from '../../cnc-precision-support/part';
import coupling, { precisionCouplingParameters } from '../../cnc-precision-coupling/part';
import hexNut from '../../hex-nut/part';
import retainingRing from '../../retaining-ring/part';
import washer from '../../washer/part';

export const precisionDriveLibraries = [
  motor,
  screw,
  nut,
  support,
  coupling,
  hexNut,
  retainingRing,
  washer,
];
export interface PrecisionDriveHosts {
  tieHoles: FrameHole[];
  beamHoles: FrameHole[];
  backHoles: FrameHole[];
  xPlateHoles: FrameHole[];
  zSaddleHoles: FrameHole[];
}
const plus = (a: Vec, b: Vec): Vec => a.map((n, i) => n + b[i]) as Vec;
const turned = (at: Vec, rotation: Vec): Vec =>
  new Vector3(...at)
    .applyEuler(new Euler(...(rotation.map((a) => (a * Math.PI) / 180) as Vec), 'ZYX'))
    .toArray() as Vec;
const pitch: Record<number, number> = { 5: 0.8, 6: 1, 8: 1.25 };
const tap = (axis: FrameHole['axis'], at: Vec, d: number, depth: number): FrameHole => ({
  axis,
  at,
  diameter: d,
  depth,
  threadPitch: pitch[d],
  threadDesignation: `M${d}`,
});
const hole = (axis: FrameHole['axis'], at: Vec, d: number, depth: number): FrameHole => ({
  axis,
  at,
  diameter: d + 0.6,
  depth,
});
const rotationFromZ = (r: Vec): Vec => {
  const matrix = new Matrix4()
    .makeRotationFromEuler(new Euler(...(r.map((a) => (a * Math.PI) / 180) as Vec), 'ZYX'))
    .multiply(new Matrix4().makeRotationY(Math.PI / 2));
  const e = new Euler().setFromRotationMatrix(matrix, 'ZYX');
  return [e.x, e.y, e.z].map((a) => (a * 180) / Math.PI) as Vec;
};

/** Exact source interfaces; custom end extension is derived from the current outer cheek. */
export function precisionDriveInterfaces(v: ReturnType<typeof millingLayout>) {
  const xBase = precisionScrewLayout(precisionScrewParameters('r25-10t3-fdi', v.racewayX));
  const xBaseMotorFace = xBase.driveJournal.start - 55;
  // Both a6mm source thermal plate and a20mm structural carrier must remain outside the cheek.
  const extension = Math.max(
    0,
    Math.ceil((xBaseMotorFace + 26 + 20 + v.sideCenterX + v.sideThickness / 2) / 5) * 5,
  );
  return [
    {
      id: 'y',
      model: 'r25-10t3-fdi' as const,
      parameters: precisionScrewParameters('r25-10t3-fdi', v.racewayY),
      at: [0, 0, v.screwYCenter] as Vec,
      r: [0, 0, 90] as Vec,
      motion: 'fixed' as Motion,
    },
    {
      id: 'x',
      model: 'r25-10t3-fdi' as const,
      parameters: precisionScrewParameters('r25-10t3-fdi', v.racewayX, extension),
      at: [0, -160, v.beamCenter] as Vec,
      r: [0, 0, 0] as Vec,
      motion: 'gantry' as Motion,
    },
    {
      id: 'z',
      model: 'r20-5t3-fdi' as const,
      parameters: precisionScrewParameters('r20-5t3-fdi', v.racewayZ, 20),
      at: [v.zScrewX, v.zScrewY, v.railZCenter] as Vec,
      r: [-90, 90, 0] as Vec,
      motion: 'x' as Motion,
    },
  ].map((axis) => {
    const layout = precisionScrewLayout(axis.parameters);
    return {
      ...axis,
      layout,
      couplingCenter: layout.driveJournal.start - 7.5,
      motorFace: layout.driveJournal.start - 55,
    };
  });
}
function updateHost(out: MillingPiece[], id: string, holes: FrameHole[]) {
  const host = out.find((row) => row.component.id === id);
  if (!host) throw new Error(`Missing precision drive host ${id}.`);
  host.component.parameters = { ...host.component.parameters, holes: JSON.stringify(holes) };
  host.component.manufacturing = frameManufacturing(host.component.parameters);
}
/** Physical motor, matched precision screw/nut, source supports and separately fabricated mounts. */
export function addPrecisionDrives(
  p: Parameters,
  v: ReturnType<typeof millingLayout>,
  h: WorkSurfaceCallbacks,
  out: MillingPiece[],
  hosts: PrecisionDriveHosts,
) {
  const { add, fabricated, fastener } = h;
  const requirement = (text: string) => {
    const row = out[out.length - 1];
    row.component.notes = [row.component.notes, text].filter(Boolean).join(' ');
  };
  const worldHole = (at: Vec, r: Vec, q: Vec): Vec => plus(at, turned(q, r));
  const matchOrder = (axis: string, model: string) => {
    const row = out[out.length - 1];
    delete row.component.procurement;
    requirement(
      `Physical HIWIN ${model.toUpperCase()} component of the axis ${axis.toUpperCase()} matched set. Shaft and nut share one purchased cnc-precision-axis parent order: preserve maker serial/set pairing. No individual complete-kit order, certificate or actual preload is inferred.`,
    );
  };
  const axisList = precisionDriveInterfaces(v);
  // Independent moving flange mounts: sourceFDI fitting direction is retained.
  for (const axis of axisList) {
    const np = precisionNutParameters(axis.model),
      nv = precisionNutLayout(np);
    let at: Vec, r: Vec, motion: Motion;
    if (axis.id === 'y') {
      at = [0, -55, v.screwYCenter];
      r = [0, 0, 90];
      motion = 'gantry';
    } else if (axis.id === 'x') {
      at = [-55, -160, v.beamCenter];
      r = [0, 0, 0];
      motion = 'x';
    } else {
      at = [v.zScrewX, v.zScrewY, v.guideLow + 100 + v.zNutPlatformBottomFromGuide];
      r = [0, -90, 0];
      motion = 'z';
    }
    add(
      axis.id + '-ball-nut',
      nut,
      np,
      'default',
      at,
      r,
      motion,
      'mechanism',
      0xa9b3bd,
      axis.model,
    );
    matchOrder(axis.id, axis.model);
    const boltD = axis.id === 'z' ? 5 : 6,
      boltLength = axis.id === 'z' ? 20 : 25,
      tapDepth = axis.id === 'z' ? 18 : 18;
    const localHoles: FrameHole[] = [];
    const bracketCenter: Vec =
      axis.id === 'y' ? [0, -45, v.screwYCenter] : [-45, -155, v.beamCenter];
    if (axis.id === 'y')
      localHoles.push({
        axis: 'y',
        at: [0, -10.1, 0],
        diameter: nv.bodyDiameter + 0.05,
        depth: 20.2,
      });
    if (axis.id === 'x')
      localHoles.push({
        axis: 'x',
        at: [-10.1, -5, 0],
        diameter: nv.bodyDiameter + 0.05,
        depth: 20.2,
      });
    for (const [i, [, y, z]] of precisionNutMountingHoles(np).entries()) {
      const q = worldHole(at, r, [0, y, z]);
      if (axis.id === 'y')
        localHoles.push(tap('y', [q[0], -10, q[2] - bracketCenter[2]], boltD, tapDepth));
      if (axis.id === 'x')
        localHoles.push(
          tap('x', [-10, q[1] - bracketCenter[1], q[2] - bracketCenter[2]], boltD, tapDepth),
        );
      if (axis.id === 'z')
        hosts.zSaddleHoles.push(
          tap(
            'z',
            [q[0], q[1] - (v.zPlateBack + v.zPlateFront) / 2, q[2] - v.saddleCenter],
            boltD,
            tapDepth,
          ),
        );
      const seat = worldHole(at, r, [-nv.flangeThickness + nv.counterboreDepth, y, z]);
      fastener(
        `${axis.id}-nut-flange-bolt-${i}`,
        boltD,
        boltLength,
        seat,
        turned([-1, 0, 0], r),
        motion,
      );
    }
    if (axis.id === 'y') {
      const halfHeight = v.screwYCenter - v.tiebarTop;
      for (const x of [-50, 50]) {
        localHoles.push(tap('z', [x, 0, -halfHeight], 8, 20));
        hosts.tieHoles.push(
          hole('z', [x, -45, -v.tiebarHeight / 2 - 0.1], 8, v.tiebarHeight + 0.2),
        );
        fabricated(
          'y-nut-crush-' + x,
          'crush-sleeve',
          [14, 14, v.tiebarHeight - 24],
          [x, -45, v.tiebarCenter],
          [],
          'gantry',
          'steel',
          { sleeveDiameter: 14, sleeveBore: 8.6 },
        );
        fastener(
          'y-nut-bracket-anchor-' + x,
          8,
          90,
          [x, -45, v.tiebarCenter - v.tiebarHeight / 2],
          [0, 0, -1],
          'gantry',
        );
      }
      fabricated(
        'y-nut-bracket',
        'nut-bracket',
        [140, 20, 2 * halfHeight],
        bracketCenter,
        localHoles,
        'gantry',
        'steel',
      );
      requirement(
        'Source51g6 land; authored51.05mm installation bore is a clearance/inspection choice, not an approved locating fit. Clamp preload, flange flatness and assembled lead/axis alignment require physical inspection.',
      );
    } else if (axis.id === 'x') {
      for (const z of [-45, 45]) {
        localHoles.push(tap('y', [0, -45, z], 6, 24));
        hosts.backHoles.push(hole('y', [-45, -10.1, z], 6, 20.2));
        fastener('x-nut-back-anchor-' + z, 6, 40, [-45, -220, v.beamCenter + z], [0, -1, 0], 'x');
      }
      fabricated(
        'x-nut-bracket',
        'nut-bracket',
        [20, 90, 120],
        bracketCenter,
        localHoles,
        'x',
        'steel',
        { cornerReliefRadius: 35 },
      );
      requirement(
        'Source 51g6 land; authored 51.05 mm clearance bore. Through-X corner relief R35 at local Y45/Z60 clears the source X scale/backing plate without modifying supplier geometry. Nominal bore-to-relief ligament17.58 mm, nearest M6 flange-tap wall12.96 mm, complete74 mm flange envelope-to-relief clearance6.10 mm; all six flange taps and rear anchors retained. Inspect the local ligament, source flange seating and bolted load path. Verify factory flange datum, clamp torque and actual fitted set before metrology acceptance.',
      );
    } else {
      hosts.zSaddleHoles.push({
        axis: 'z',
        at: [
          v.zScrewX,
          v.zScrewY - (v.zPlateBack + v.zPlateFront) / 2,
          at[2] - v.saddleCenter - 0.1,
        ],
        diameter: nv.bodyDiameter + 0.05,
        depth: v.zNutCarrierThickness + 0.2,
      });
    }
  }
  fabricated(
    'x-saddle-rear',
    'z-fixed-plate',
    [180, 20, 280],
    [0, -210, v.beamCenter],
    hosts.backHoles,
    'x',
  );
  for (const axis of axisList) {
    const dl = axis.layout,
      world = (q: Vec) => worldHole(axis.at, axis.r, q),
      normal = (q: Vec) => turned(q, axis.r);
    add(axis.id + '-drive-screw', screw, axis.parameters, 'default', axis.at, axis.r, axis.motion);
    matchOrder(axis.id, axis.model);
    const cp = precisionCouplingParameters(axis.id === 'z' ? 15 : 20);
    add(
      axis.id + '-precision-coupling',
      coupling,
      cp,
      'default',
      world([axis.couplingCenter, 0, 0]),
      axis.r,
      axis.motion,
      'mechanism',
      0xafb9c2,
      `bk2-15-59-19-${axis.id === 'z' ? 15 : 20}`,
    );
    const mp = feedServoParameters(axis.id === 'z' ? 'ecm-a3h-c20807ss1' : 'ecm-a3h-c20807rs1');
    const mr = rotationFromZ(axis.r),
      mv = feedServoLayout(mp);
    add(
      axis.id + '-axis-motor',
      motor,
      mp,
      'default',
      world([axis.motorFace, 0, 0]),
      mr,
      axis.motion,
      'equipment',
      0x354554,
      String(mp.model),
    );
    // Exact maker thermal plate, plus a separate structural carrier to avoid relying on a6mm plate for mount rigidity.
    const thermalHoles: FrameHole[] = [{ axis: 'x', at: [-3.1, 0, 0], diameter: 70.2, depth: 6.2 }],
      carrierHoles: FrameHole[] = [{ axis: 'x', at: [-10.1, 0, 0], diameter: 70.2, depth: 20.2 }];
    for (const [i, [x, y]] of feedServoMountingHoles().entries()) {
      // Native motorx,y map to local −Z,Y after RY90.
      const yy = y,
        zz = -x;
      thermalHoles.push(hole('x', [-3.1, yy, zz], 6, 6.2));
      carrierHoles.push(hole('x', [-10.1, yy, zz], 6, 20.2));
      fastener(
        `${axis.id}-servo-flange-bolt-${i}`,
        6,
        40,
        world([axis.motorFace - 8, yy, zz]),
        normal([-1, 0, 0]),
        axis.motion,
      );
      add(
        `${axis.id}-servo-flange-nut-${i}`,
        hexNut,
        { ...hexNut.defaults, bore: 6, acrossFlats: 10, height: 5, pitch: 1 },
        'default',
        world([axis.motorFace + 26, yy, zz]),
        mr,
        axis.motion,
      );
    }
    const plateFix = (yy: number, zz: number, d: number, length: number, id: string) => {
      thermalHoles.push(hole('x', [-3.1, yy, zz], d, 6.2));
      carrierHoles.push(hole('x', [-10.1, yy, zz], d, 20.2));
      fastener(id, d, length, world([axis.motorFace, yy, zz]), normal([-1, 0, 0]), axis.motion);
    };
    if (axis.id === 'x') {
      const outer = -v.sideCenterX - v.sideThickness / 2,
        gap = outer - (axis.motorFace + 26);
      if (gap < 0.5)
        throw new Error('X motor carrier must remain outside the actual portal cheek.');
      const side = out.find((row) => row.component.id === 'x-drive-end-plate');
      if (!side) throw new Error('Missing left X drive end plate for precision servo mount.');
      const sideHoles: FrameHole[] = JSON.parse(String(side.component.parameters.holes));
      for (const yy of [60, 110])
        for (const zz of [-75, 75]) {
          const id = `x-servo-cheek-${yy}-${zz}`;
          // Choose standard bolts with at least one diameter engagement and positive blind floor reserve.
          const length = Math.ceil((26 + gap + 8) / 5) * 5,
            engagement = length - 26 - gap;
          if (engagement < 8 || engagement > 18)
            throw new Error(
              'X servo cheek bolt has insufficient engagement or blind floor reserve.',
            );
          plateFix(yy, zz, 8, length, id + '-bolt');
          const seat = world([outer, yy, zz]);
          sideHoles.push(
            tap(
              'x',
              [
                seat[0] + v.sideCenterX,
                seat[1],
                seat[2] - Number(side.component.placement.translation[2]),
              ],
              8,
              22,
            ),
          );
          fabricated(
            id + '-spacer',
            'crush-sleeve',
            [18, 18, gap],
            world([axis.motorFace + 26 + gap / 2, yy, zz]),
            [],
            axis.motion,
            'steel',
            { sleeveDiameter: 18, sleeveBore: 8.6 },
            mr,
          );
        }
      updateHost(out, 'x-drive-end-plate', sideHoles);
    } else if (axis.id === 'y') {
      const end = out.find((row) => row.component.id === 'drive-end-crossmember-0');
      if (!end) throw new Error('Missing fixed Y support crossmember.');
      const at = end.component.placement.translation,
        front = at[1] - Number(end.component.parameters.sizeY) / 2,
        gap = front - (axis.motorFace + 26),
        eh: FrameHole[] = JSON.parse(String(end.component.parameters.holes));
      for (const yy of [-80, 80]) {
        const zz = -70,
          length = Math.ceil((26 + gap + 8) / 5) * 5,
          engagement = length - 26 - gap;
        if (gap < 0.5 || engagement < 8 || engagement > 20)
          throw new Error('Y motor carrier/post attachment does not fit its fixed crossmember.');
        plateFix(yy, zz, 8, length, `y-servo-crossmember-bolt-${yy}`);
        const q = world([front, yy, zz]);
        eh.push(
          tap(
            'y',
            [q[0] - at[0], -Number(end.component.parameters.sizeY) / 2, q[2] - at[2]],
            8,
            24,
          ),
        );
        fabricated(
          `y-servo-crossmember-spacer-${yy}`,
          'crush-sleeve',
          [18, 18, gap],
          world([axis.motorFace + 26 + gap / 2, yy, zz]),
          [],
          axis.motion,
          'steel',
          { sleeveDiameter: 18, sleeveBore: 8.6 },
          mr,
        );
      }
      updateHost(out, 'drive-end-crossmember-0', eh);
    } else {
      const roof = v.fixedPlateCenter + v.fixedPlateHeight / 2,
        bridgeThickness = 20,
        bridgeCenterY = 180,
        bridgeTop = roof + bridgeThickness,
        carrierBottom = world([axis.motorFace + 26, 0, 0])[2],
        height = carrierBottom - bridgeTop,
        bridgeHoles: FrameHole[] = [
          {
            axis: 'z',
            at: [v.zScrewX, v.zScrewY - bridgeCenterY, -bridgeThickness / 2 - 0.1],
            diameter: 51,
            depth: bridgeThickness + 0.2,
          },
        ];
      if (height < 20)
        throw new Error('Braked Z servo needs clear space above the real tower bridge.');
      for (const [i, [xx, yy, d]] of [
        [-80, (v.xPlateBack + v.xPlateFront) / 2, 8],
        [80, (v.xPlateBack + v.xPlateFront) / 2, 8],
        [-v.fixedRibCenterX, 210, 6],
        [v.fixedRibCenterX, 210, 6],
      ].entries()) {
        const tapDepth = d === 8 ? 20 : 16,
          boltLength = d === 8 ? 35 : 30;
        bridgeHoles.push(
          hole('z', [xx, yy - bridgeCenterY, -bridgeThickness / 2 - 0.1], d, bridgeThickness + 0.2),
        );
        hosts.xPlateHoles.push(
          tap(
            'z',
            [xx, yy - (v.xPlateBack + v.xPlateFront) / 2, roof - tapDepth - v.railZCenter],
            d,
            tapDepth,
          ),
        );
        fastener(
          `z-servo-bridge-anchor-${i}`,
          d,
          boltLength,
          [xx, yy, bridgeTop],
          [0, 0, 1],
          axis.motion,
        );
      }
      for (const [i, [xx, yy, d, width]] of [
        [v.zScrewX - 55, (v.xPlateBack + v.xPlateFront) / 2, 8, 20],
        [v.zScrewX + 55, (v.xPlateBack + v.xPlateFront) / 2, 8, 20],
        [v.zScrewX, 220, 6, 20],
      ].entries()) {
        const point: Vec = [xx, yy, carrierBottom],
          q = new Vector3(...(point.map((n, j) => n - axis.at[j]) as Vec))
            .applyEuler(new Euler(...(axis.r.map((a) => (-a * Math.PI) / 180) as Vec), 'XYZ'))
            .toArray() as Vec;
        if (i === 2) {
          // A top socket head here would intersect the actual 80 mm servo flange.
          // Clamp from below through the bridge/column into the structural carrier.
          const boltLength = 60,
            engagement = boltLength - bridgeThickness - height;
          if (engagement < d || 18 - engagement < 0.5)
            throw new Error(
              'The front Z column needs carrier thread engagement and floor reserve.',
            );
          bridgeHoles.push(
            hole(
              'z',
              [xx, yy - bridgeCenterY, -bridgeThickness / 2 - 0.1],
              d,
              bridgeThickness + 0.2,
            ),
          );
          carrierHoles.push(tap('x', [-8, q[1], q[2]], d, 18));
          fastener(
            `z-servo-tower-bolt-${i}`,
            d,
            boltLength,
            [xx, yy, roof],
            [0, 0, -1],
            axis.motion,
          );
        } else {
          const boltLength = Math.ceil((26 + height + d) / 5) * 5,
            engagement = boltLength - 26 - height;
          if (engagement < d || 18 - engagement < 0.5)
            throw new Error(
              'Z motor tower attachment has insufficient thread engagement or floor reserve.',
            );
          plateFix(q[1], q[2], d, boltLength, `z-servo-tower-bolt-${i}`);
          bridgeHoles.push(tap('z', [xx, yy - bridgeCenterY, bridgeThickness / 2 - 18], d, 18));
        }
        const ch = [hole('z', [0, 0, -height / 2 - 0.1], d, height + 0.2)];
        fabricated(
          `z-servo-tower-column-${i}`,
          'support-bracket',
          [width, 20, height],
          [xx, yy, bridgeTop + height / 2],
          ch,
          axis.motion,
          'steel',
        );
      }
      fabricated(
        'z-servo-tower-bridge',
        'support-bracket',
        [v.fixedPlateWidth, 110, bridgeThickness],
        [0, bridgeCenterY, roof + bridgeThickness / 2],
        bridgeHoles,
        axis.motion,
        'steel',
      );
      requirement(
        `Authored removable ${v.fixedPlateWidth}×110×20 mm steel top bridge with a 51 mm coupling opening. It bolts to the fixed web and both 12 mm fins; three real 20 mm square columns fit inside the separate 250 mm thermal/structural carrier. Release datum flatness, bolt preload and bridge stiffness. The 20 mm extra smooth shaft end is an ordered machining feature, not additional raceway.`,
      );
    }
    fabricated(
      axis.id + '-servo-thermal-plate',
      'motor-bracket',
      [6, 250, 250],
      world([axis.motorFace + 3, 0, 0]),
      thermalHoles,
      axis.motion,
      'aluminium',
      {},
      axis.r,
    );
    requirement(
      'Manufacturer rated cooling condition:250×250×6mm aluminium plate,0–40°C; prove actual thermal dissipation in service. Ø70.2pilot bore is authored inspection/installation clearance; release actual fitted datum tolerance.',
    );
    fabricated(
      axis.id + '-servo-structural-carrier',
      'motor-bracket',
      [20, 250, 250],
      world([axis.motorFace + 16, 0, 0]),
      carrierHoles,
      axis.motion,
      'aluminium',
      {},
      axis.r,
    );
    requirement(
      'Separate20mm structural carrier; include thermal interface, actual bolt preload and machining/assembly flatness. Detailed servo housing/connector envelopes are illustrative, verify rear screw access against delivered CAD.',
    );
    for (const fixed of [true, false]) {
      const large = axis.id !== 'z',
        sp = precisionSupportParameters(
          large ? (fixed ? 'bk20-c3' : 'bf20-c3') : fixed ? 'bk15-c3' : 'bf15-c3',
        ),
        sv = precisionSupportLayout(sp),
        center = fixed ? dl.fixedSupportCenter : dl.freeSupportCenter;
      add(
        `${axis.id}-${fixed ? 'bk' : 'bf'}${large ? 20 : 15}`,
        support,
        sp,
        'default',
        world([center, 0, 0]),
        axis.r,
        axis.motion,
        'mechanism',
        0x3e4c58,
        String(sp.model),
      );
      if (axis.id === 'z') {
        const sourceBase = world([center, 0, sv.bottom]),
          shimThickness = sourceBase[1] - v.xPlateFront,
          tapDepth = 12,
          shimHoles: FrameHole[] = [];
        if (Math.abs(shimThickness - 5) > 1e-6)
          throw new Error('Central Z supports require the released 5 mm shim datum.');
        for (const [i, [x, y]] of precisionSupportMountingHoles(sp).entries()) {
          const seat = world([center + x, y, sv.wingTop - sv.counterboreDepth]),
            tapEnd = world([center + x, y, sv.bottom - shimThickness]),
            grip = seat[1] - tapEnd[1],
            boltLength = 45,
            engagement = boltLength - grip;
          if (engagement < 6 || tapDepth - engagement < 0.5)
            throw new Error(
              'Central Z source support bolt needs engagement and blind floor reserve.',
            );
          hosts.xPlateHoles.push(
            tap(
              'y',
              [
                tapEnd[0],
                tapEnd[1] - tapDepth - (v.xPlateBack + v.xPlateFront) / 2,
                tapEnd[2] - v.railZCenter,
              ],
              6,
              tapDepth,
            ),
          );
          shimHoles.push(hole('z', [x, y, -shimThickness / 2 - 0.1], 6, shimThickness + 0.2));
          fastener(
            `z-support-${fixed ? 'fixed' : 'free'}-bolt-${i}`,
            6,
            boltLength,
            seat,
            normal([0, 0, 1]),
            axis.motion,
          );
        }
        fabricated(
          `z-${fixed ? 'fixed' : 'free'}-support-shim`,
          'support-bracket',
          [sv.bodyLength, sv.width, shimThickness],
          world([center, 0, sv.bottom - shimThickness / 2]),
          shimHoles,
          axis.motion,
          'steel',
          {},
          axis.r,
        );
        requirement(
          'Authored 5 mm steel datum shim between the source BK15/BF15 base and fixed tower. Release parallelism, actual bearing center and matched-set alignment. Four/two source M6 bolts engage 8.5 mm in 12 mm blind taps with 3.5 mm tip reserve.',
        );
      } else {
        const thickness = axis.id === 'y' ? 16 : 30,
          width = 128,
          platformCenterY = axis.id === 'x' ? -4 : 0,
          ph: FrameHole[] = [];
        for (const [i, [x, y]] of precisionSupportMountingHoles(sp).entries()) {
          const d = large ? 8 : 6,
            depth = axis.id === 'y' ? 15 : 22;
          ph.push(tap('z', [x, y - platformCenterY, -thickness / 2 + thickness - depth], d, depth));
          const seat = sv.wingTop - sv.counterboreDepth,
            length = large ? 55 : 45;
          fastener(
            `${axis.id}-support-${fixed ? 'fixed' : 'free'}-bolt-${i}`,
            d,
            length,
            world([center + x, y, seat]),
            normal([0, 0, 1]),
            axis.motion,
          );
        }
        if (axis.id === 'y') {
          const end = out.find(
            (row) => row.component.id === 'drive-end-crossmember-' + (fixed ? 0 : 1),
          );
          if (!end) throw new Error('Missing Y support crossmember.');
          const eh: FrameHole[] = JSON.parse(String(end.component.parameters.holes)),
            endAt = end.component.placement.translation;
          for (const xx of [-35, 35])
            for (const yy of [-52, 52]) {
              ph.push(hole('z', [xx, yy, -thickness / 2 - 0.1], 8, thickness + 0.2));
              const at = world([center + xx, yy, sv.bottom - thickness]);
              eh.push(
                tap(
                  'z',
                  [
                    at[0] - endAt[0],
                    at[1] - endAt[1],
                    Number(end.component.parameters.sizeZ) / 2 - 14,
                  ],
                  8,
                  14,
                ),
              );
              fastener(
                `y-platform-anchor-${fixed}-${xx}-${yy}`,
                8,
                25,
                world([center + xx, yy, sv.bottom]),
                [0, 0, 1],
              );
            }
          updateHost(out, end.component.id, eh);
        } else {
          const stockWasher = washer.presets.find(
            (row) => row.catalog?.designation === 'DIN 125 M8',
          );
          if (!stockWasher?.catalog) throw new Error('Missing sourced DIN 125 M8 washer.');
          const washerThickness = Number(stockWasher.parameters.thickness),
            rearY = platformCenterY - width / 2;
          for (const xx of [-30, 30]) {
            ph.push(hole('y', [xx, -width / 2 - 0.1, 0], 8, width + 0.2));
            hosts.beamHoles.push(
              tap('y', [center + xx, -100.1, sv.bottom - thickness / 2], 8, 12.7),
            );
            add(
              `x-drive-platform-washer-${fixed}-${xx}`,
              washer,
              { ...washer.defaults, ...stockWasher.parameters },
              'default',
              world([center + xx, rearY - washerThickness / 2, sv.bottom - thickness / 2]),
              [90, 0, 0],
              'gantry',
              'mechanism',
              0xa9b3bd,
              stockWasher.id,
            );
            fastener(
              `x-drive-platform-anchor-${fixed}-${xx}`,
              8,
              140,
              world([center + xx, rearY - washerThickness, sv.bottom - thickness / 2]),
              [0, -1, 0],
              'gantry',
            );
          }
        }
        fabricated(
          `${axis.id}-${fixed ? 'fixed' : 'free'}-support-platform`,
          'support-bracket',
          [100, width, thickness],
          world([center, platformCenterY, sv.bottom - thickness / 2]),
          ph,
          axis.motion,
          'steel',
          {},
          axis.r,
        );
        requirement(
          axis.id === 'x'
            ? 'Source support seat and actual ordered bearing/shaft datums. Rear M8×140 anchors with sourced 1.6 mm DIN125 washers pass through the platform into the actual 12.5 mm rear beam wall, with 10.4 mm engagement. Rear-wall taps open into the hollow beam; front carriage travel has no bolt heads or sleeves. Joint preload, tightening torque, wall strength, fit and runout remain unreleased.'
            : 'Source support seat and actual ordered bearing/shaft datums; authored mount hole and fit allowances need released drawing, runout and thermal acceptance.',
        );
      }
      if (!fixed) {
        const stock = retainingRing.presets.find(
          (row) => row.catalog?.designation === `DIN 471 M${sv.shaftDiameter}`,
        );
        if (!stock?.catalog) throw new Error('Missing sourced shaft retaining ring.');
        const installedDiameter = dl.groove.diameter + 0.1,
          delta = installedDiameter - Number(stock.parameters.innerDiameter),
          ringP = {
            ...stock.parameters,
            innerDiameter: installedDiameter,
            outerDiameter: Number(stock.parameters.outerDiameter) + delta,
            eccentricity: 0,
            boreEnvelope: installedDiameter,
          };
        add(
          `${axis.id}-free-shaft-circlip`,
          retainingRing,
          ringP,
          'default',
          world([(dl.groove.start + dl.groove.end) / 2, 0, 0]),
          rotationFromZ(axis.r),
          axis.motion,
        );
        out[out.length - 1].component.procurement = {
          designation: stock.catalog.designation,
          manufacturer: stock.catalog.manufacturer ?? '',
          standard: stock.catalog.standard,
          source: stock.catalog.sourceUrl,
        };
        requirement(
          'Actual purchased DIN471 ring selected byshaft size; installed expanded profile is an illustrative envelope, not the free supplier shape or elastic deformation simulation. Verify supplied ring/groove fit and retention against approved end drawing.',
        );
      }
    }
    void mv;
  }
  updateHost(out, 'lower-moving-tiebar', hosts.tieHoles);
  updateHost(out, 'gantry-box-beam', hosts.beamHoles);
}
