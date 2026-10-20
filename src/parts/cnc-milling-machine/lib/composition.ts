import { Euler, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyDefinition } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import frame, { type FrameHole } from '../../cnc-frame-part/part';
import rail, { railParameters, railMountingHoles } from '../../cnc-guide-rail/part';
import carriage, { carriageParameters, carriageMountingHoles } from '../../cnc-guide-carriage/part';
import bolt from '../../bolt-screw/part';
import threadedRod from '../../threaded-rod/part';
import spindle from '../../cnc-spindle/part';
import mount from '../../cnc-spindle-mount/part';
import cooling from '../../cnc-process-accessory/part';
import control from '../../machine-control/part';
import { addControlEquipment, controlEquipmentLibraries } from './control-equipment';
import { millingInspectionOffsets } from './inspection';
import washer from '../../washer/part';
import { addWorkSurface } from './work-surface';
import table, { worktableParameters, worktableLayout } from '../../cnc-worktable/part';
import { millingLayout, millingPose } from './layout';
import { alignMatingFasteners } from './thread-mating';
import { addLimits, limitLibraries, limitRequirements } from './limits';
import { millingQualificationRequirements } from './qualification';
import { millingHandoff } from './handoff';
import { addPrecisionDrives, precisionDriveLibraries } from './precision-drives';
import servoDrive from '../../cnc-servo-drive/part';
import { addLinearEncoders, encoderLibraries, linearEncoderRequirements } from './encoders';
import { groupMillingPurchasedKits, purchasedKitLibraries } from './purchased-kits';
import { specifyMillingGuides } from './guide-order';
import { addZGuides, addZHead } from './z-head';
import { addPortalSide } from './portal';

export const millingLibraries = [
  frame,
  rail,
  carriage,
  ...precisionDriveLibraries,
  servoDrive,
  bolt,
  threadedRod,
  spindle,
  mount,
  table,
  cooling,
  control,
  ...controlEquipmentLibraries,
  washer,
  ...limitLibraries,
  ...encoderLibraries,
  ...purchasedKitLibraries,
];
export type Motion = 'fixed' | 'gantry' | 'x' | 'z';
export interface MillingPiece extends ConfiguredPiece {
  motion: Motion;
  section: 'bed' | 'mechanism' | 'equipment';
}
const pitch: Record<number, number> = { 3: 0.5, 4: 0.7, 5: 0.8, 6: 1, 8: 1.25, 10: 1.5 };
export const rotationForNormal = (axis: Vec): Vec =>
  axis[0] === 1
    ? [0, 90, 0]
    : axis[0] === -1
      ? [0, -90, 0]
      : axis[1] === 1
        ? [-90, 0, 0]
        : axis[1] === -1
          ? [90, 0, 0]
          : axis[2] === -1
            ? [0, 180, 0]
            : [0, 0, 0];
function turned(v: Vec, r: Vec): Vec {
  return new Vector3(...v)
    .applyEuler(new Euler(...(r.map((a) => (a * Math.PI) / 180) as Vec), 'ZYX'))
    .toArray() as Vec;
}
const plus = (a: Vec, b: Vec): Vec => a.map((v, i) => v + b[i]) as Vec;
function tap(axis: FrameHole['axis'], at: Vec, d: number, depth: number): FrameHole {
  return { axis, at, diameter: d, depth, threadPitch: pitch[d], threadDesignation: `M${d}` };
}
function clearance(axis: FrameHole['axis'], at: Vec, d: number, depth: number): FrameHole {
  return { axis, at, diameter: d + 0.6, depth };
}
/** Canonical installed list. Motion and inspection are applied outside configured library instances. */
export function millingComponents(p: Parameters): MillingPiece[] {
  const v = millingLayout({ ...p, xPosition: 50, yPosition: 50, zPosition: 50 }),
    out: MillingPiece[] = [];
  const add = (
    id: string,
    part: PartDefinition,
    parameters: Parameters,
    state: string,
    translation: Vec,
    rotation: Vec = [0, 0, 0],
    motion: Motion = 'fixed',
    section: MillingPiece['section'] = 'mechanism',
    color = 0xa1a9ae,
    presetId?: string,
  ) => {
    const profile = part.product;
    const component = {
      id,
      libraryId: part.id,
      parameters,
      state,
      quantity: 1,
      placement: { translation, rotation },
      name: id.replaceAll('-', ' '),
      supply: profile.supply,
      ...(presetId ? { presetId } : {}),
      ...millingHandoff(part, parameters, presetId),
      ...(part === spindle
        ? {
            procurement: {
              designation:
                v.spindle.drawingDesignation + ' / 220 V winding; nameplate current pending',
              manufacturer: v.spindle.manufacturer,
              source: v.spindle.sourceUrl,
            },
          }
        : {}),
    };
    out.push({
      component,
      label: component.name,
      color,
      motion,
      section,
      requireSingleSolid: part === frame || part === mount || part === table,
      preserveLibraryAppearance: profile.supply === 'purchased',
    });
  };
  const fabricated = (
    id: string,
    role: string,
    size: Vec,
    at: Vec,
    holes: FrameHole[] = [],
    motion: Motion = 'fixed',
    material = 'aluminium',
    extra: Parameters = {},
    rotation: Vec = [0, 0, 0],
    section: MillingPiece['section'] = 'mechanism',
  ) =>
    add(
      id,
      frame,
      {
        ...frame.defaults,
        threadFitAllowance: 0.05,
        role,
        material,
        stockGrade: material === 'steel' ? v.steelGrade : v.aluminiumGrade,
        sizeX: size[0],
        sizeY: size[1],
        sizeZ: size[2],
        holes: JSON.stringify(holes),
        ...extra,
      },
      'default',
      at,
      rotation,
      motion,
      section,
      material === 'steel' ? 0x40525f : 0xb0b7bb,
    );
  const fastener = (
    id: string,
    d: number,
    length: number,
    seat: Vec,
    normal: Vec,
    motion: Motion = 'fixed',
    section: MillingPiece['section'] = 'mechanism',
  ) => {
    const headSize = ({ 3: 5.5, 4: 7, 5: 8.5, 6: 10, 8: 13, 10: 16 } as Record<number, number>)[d];
    add(
      id,
      bolt,
      {
        ...bolt.defaults,
        diameter: d,
        shankDiameter: d,
        length,
        head: 'socket-cap',
        headSize,
        headHeight: d,
        drive: 'hex',
        driveWidth: ({ 3: 2.5, 4: 3, 5: 4, 6: 5, 8: 6, 10: 8 } as Record<number, number>)[d],
        driveDepth: d / 2,
        pitch: pitch[d],
        threadLength: length,
        tipLength: 0.5,
        tipDiameter: d * 0.65,
      },
      'default',
      seat.map((n, i) => n + (normal[i] * (d - length)) / 2) as Vec,
      rotationForNormal(normal),
      motion,
      section,
      0x69727b,
    );
  };
  const railBolts = (
    id: string,
    length: number,
    origin: Vec,
    rotation: Vec,
    motion: Motion,
    baseHoles?: FrameHole[],
  ) => {
    const rp = railParameters(length);
    add(id, rail, rp, 'default', origin, rotation, motion);
    for (const [i, position] of railMountingHoles(rp).entries()) {
      const hole = plus(origin, turned(position, rotation)),
        normal = turned([0, 0, 1], rotation),
        seat = plus(hole, turned([0, 0, 9], rotation));
      fastener(id + '-mount-' + (i + 1), 5, 20, seat, normal, motion);
      if (baseHoles) baseHoles.push(tap('z', [position[0], position[1], -12], 5, 12));
    }
  };
  const bedHoles: FrameHole[][] = [[], []],
    bedFlangeHoles: FrameHole[][] = [[], []];
  const structuralWasher = washer.presets.find((row) => row.id === 'gvyntok-b1670f902fb5');
  if (!structuralWasher) throw new Error('Missing DIN 125 M8 structural washer dimensions.');
  const washeredM8 = (
    id: string,
    length: number,
    seat: Vec,
    normal: Vec,
    motion: Motion = 'gantry',
    section: MillingPiece['section'] = 'mechanism',
  ) => {
    add(
      id + '-washer',
      washer,
      structuralWasher.parameters,
      'default',
      plus(seat, normal.map((n) => n * 0.8) as Vec),
      rotationForNormal(normal),
      motion,
      section,
      0xb6b9bd,
      structuralWasher.id,
    );
    const source =
      structuralWasher.catalog?.alternateSourceUrls?.find((url) => url.includes('hv-200')) ??
      structuralWasher.catalog?.sourceUrl;
    if (!source) throw new Error('The structural washer requires its exact supplier link.');
    out[out.length - 1].component.procurement = {
      designation: 'DIN 125 M8 hardened steel HV200 washer; material certificate required',
      manufacturer: '',
      source,
      standard: 'DIN 125',
    };
    fastener(id, 8, length, plus(seat, normal.map((n) => n * 1.6) as Vec), normal, motion, section);
  };
  const rowY = worktableLayout(
    worktableParameters('slat', { thickness: v.tableThickness }),
  ).yRows.map((y) => y + v.tableCenterY);
  const slatXs = Array.from({ length: 10 }, (_, i) => (i - 4.5) * 100.5);
  for (const [i, y] of rowY.entries()) {
    const centerZ = v.tableBottom - v.tableRibHeight / 2;
    const holes: FrameHole[] = slatXs.flatMap((x) =>
      [-35, 35].map((dx) =>
        clearance('z', [x + dx, 0, -v.tableRibHeight / 2 - 0.1], 6, v.tableRibHeight + 0.2),
      ),
    );
    for (const side of [-1, 1]) {
      const insertX = side * (v.tableRibSpan / 2 - 20),
        insertHoles: FrameHole[] = [tap('x', [side < 0 ? -20 : 0, 0, 0], 8, 20)];
      for (const dx of [-10, 10])
        for (const zz of [-20, 20]) {
          holes.push(
            clearance(
              'y',
              [insertX + dx, -v.tableRibWidth / 2 - 0.1, zz],
              6,
              v.tableRibWidth + 0.2,
            ),
          );
          insertHoles.push(
            tap('y', [dx, -(v.tableRibWidth - 2 * v.tableRibWall - 0.2) / 2, zz], 6, 15),
          );
          fastener(
            `rib-${i + 1}-insert-${side}-${dx}-${zz}`,
            6,
            20,
            [insertX + dx, y - v.tableRibWidth / 2, centerZ + zz],
            [0, -1, 0],
            'fixed',
            'bed',
          );
        }
      fabricated(
        `rib-${i + 1}-end-insert-${side}`,
        'section-insert',
        [
          40,
          v.tableRibWidth - 2 * v.tableRibWall - 0.2,
          v.tableRibHeight - 2 * v.tableRibWall - 0.2,
        ],
        [insertX, y, centerZ],
        insertHoles,
        'fixed',
        'steel',
        { tubeAxis: 'x', cornerRadius: v.tableRibCornerRadius - v.tableRibWall + 0.2 },
        [0, 0, 0],
        'bed',
      );
      bedHoles[side < 0 ? 0 : 1].push(
        clearance(
          'x',
          [-v.bedWidth / 2 - 0.1, y, v.bedTubeDepth / 2 - v.tableRibHeight / 2],
          8,
          v.bedWidth + 0.2,
        ),
      );
      fabricated(
        `rib-${i + 1}-crush-${side}`,
        'crush-sleeve',
        [18, 18, v.bedWidth - 2 * v.bedWall],
        [side * 600, y, centerZ],
        [],
        'fixed',
        'steel',
        { sleeveDiameter: 18, sleeveBore: 8.6 },
        [0, 90, 0],
        'bed',
      );
      fastener(
        `rib-${i + 1}-end-bolt-${side}`,
        8,
        115,
        [side * 650, y, centerZ],
        [side, 0, 0],
        'fixed',
        'bed',
      );
    }
    for (const [j, x] of slatXs.flatMap((x) => [-35, 35].map((dx) => x + dx)).entries())
      fabricated(
        `table-rib-${i + 1}-mount-crush-${j}`,
        'crush-sleeve',
        [18, 18, v.tableRibHeight - 2 * v.tableRibWall],
        [x, y, centerZ],
        [],
        'fixed',
        'steel',
        { sleeveDiameter: 18, sleeveBore: 6.6 },
        [0, 0, 0],
        'bed',
      );
    fabricated(
      'table-rib-' + (i + 1),
      'table-rib-tube',
      [v.tableRibSpan, v.tableRibWidth, v.tableRibHeight],
      [0, y, centerZ],
      holes,
      'fixed',
      'steel',
      { tubeAxis: 'x', wall: v.tableRibWall, cornerRadius: v.tableRibCornerRadius },
      [0, 0, 0],
      'bed',
    );
  }
  const portalBeamHoles: FrameHole[] = [];
  for (const side of [-1, 1]) {
    const x = side * 600,
      bi = side < 0 ? 0 : 1;
    const padHoles = railMountingHoles(railParameters(v.railYLength)).map(([y]) =>
      tap('z', [0, y, -8], 5, 16),
    );
    for (const [j, y] of [-920, -620, -320, -20, 280, 580, 880].entries())
      for (const dx of [-25, 25]) {
        padHoles.push({
          ...clearance('z', [dx, y, -8.1], 5, dx < 0 ? 20.2 : 16.2),
          counterboreDiameter: 9.5,
          counterboreDepth: 6.1,
        });
        // At the actual rounded roof edge a nominal10mm cut can leave a curved blind floor.
        bedHoles[bi].push(tap('z', [dx, y, v.bedTubeDepth / 2 - 12], 5, 12));
        fastener(
          `rail-pad-${side}-bolt-${j}-${dx}`,
          5,
          dx < 0 ? 25 : 20,
          [x + dx, y, v.railYBase - (dx < 0 ? 2 : 6)],
          [0, 0, 1],
          'fixed',
          'bed',
        );
      }
    fabricated(
      'y-rail-pad-' + side,
      'rail-pad',
      [70, v.railYLength, 16],
      [x, 0, v.tableBottom + 8],
      padHoles,
      'fixed',
      'steel',
      { shoulderHeight: 4, shoulderWidth: 25 },
      [0, 0, 0],
      'bed',
    );
    railBolts('y-guide-rail-' + side, v.railYLength, [x, 0, v.railYBase], [0, 0, 90], 'fixed');
    const footHoles: FrameHole[] = [];
    for (const [j, dy] of [-v.blockSpacingY / 2, v.blockSpacingY / 2].entries()) {
      add(
        `y-carriage-${side}-${j}`,
        carriage,
        { ...carriageParameters(), threadFitAllowance: 0.05 },
        'assembled',
        [x, dy, v.railYBase],
        [0, 0, 90],
        'gantry',
      );
      for (const [k, h] of carriageMountingHoles().entries()) {
        const local = turned(h, [0, 0, 90]);
        footHoles.push(
          clearance(
            'z',
            [
              local[0] + side * (v.railSpacingY / 2 - v.footPlateCenterX),
              dy + local[1],
              -v.footPlateThickness / 2 - 0.1,
            ],
            5,
            v.footPlateThickness + 0.2,
          ),
        );
        fastener(
          `y-carriage-${side}-${j}-bolt-${k}`,
          5,
          v.footPlateThickness + 5,
          [x + local[0], dy + local[1], v.gantryFootTop],
          [0, 0, 1],
          'gantry',
        );
      }
    }
    addPortalSide(
      side,
      v,
      { add, fabricated, fastener, washeredM8 },
      footHoles,
      portalBeamHoles,
      out,
    );
  }

  const tieHoles: FrameHole[] = [],
    beamHoles: FrameHole[] = [...portalBeamHoles];
  for (const side of [-1, 1])
    for (const dx of [-8, 8]) {
      for (const z of [-20, 20])
        tieHoles.push(clearance('y', [side * (v.sideInnerX - 20) + dx, -65.1, z], 6, 130.2));
      for (const z of [-50, 50])
        if (side < 0)
          beamHoles.push(clearance('y', [side * (v.sideInnerX - 20) + dx, -100.1, z], 6, 200.2));
    }
  fabricated(
    'lower-moving-tiebar',
    'y-tiebar',
    [v.tiebarWidth, v.tiebarDepth, v.tiebarHeight],
    [0, 0, v.tiebarCenter],
    tieHoles,
    'gantry',
    'steel',
    { tubeAxis: 'x', wall: 12 },
  );
  // Gantry beam rail holes and separate top/bottom datum strips share the actual mounting pattern.
  for (const [i, z] of [v.beamCenter - 70, v.beamCenter + 70].entries()) {
    const rp = railParameters(v.railXLength);
    for (const [j, [x]] of railMountingHoles(rp).entries()) {
      beamHoles.push(tap('y', [x, v.beamFrontDatum - 10, z - v.beamCenter], 5, 10));
      fastener(`x-rail-${i}-bolt-${j}`, 5, 20, [x, v.beamFrontDatum + 9, z], [0, 1, 0], 'gantry');
    }
    add('x-guide-rail-' + i, rail, rp, 'default', [0, v.railXBaseY, z], [-90, 0, 0], 'gantry');
  }
  fabricated(
    'gantry-box-beam',
    'gantry-beam',
    [v.beamWidth, v.beamDepth, v.beamHeight],
    [0, 0, v.beamCenter],
    beamHoles,
    'gantry',
    'steel',
    {
      tubeAxis: 'x',
      wall: v.beamWall,
      cornerRadius: v.beamCornerRadius,
      frontDatumTrim: v.beamDepth / 2 - v.beamFrontDatum,
    },
  );
  // Fixed end crossmembers support the drive and attach to the lower walls, outside Y travel.
  for (const [i, y] of [-910, 904].entries()) {
    const holes: FrameHole[] = [];
    for (const side of [-1, 1])
      for (const dx of [-25, 25]) {
        holes.push(clearance('z', [side * 600 + dx, 0, -20.1], 8, 40.2));
        bedFlangeHoles[side < 0 ? 0 : 1].push(tap('z', [dx, y, -v.bedFlangeThickness / 2], 8, 14));
        fastener(
          `drive-end-crossmember-${i}-${side}-${dx}`,
          8,
          50,
          [side * 600 + dx, y, v.bedBottom - 40],
          [0, 0, -1],
          'fixed',
          'bed',
        );
      }
    fabricated(
      'drive-end-crossmember-' + i,
      'cross-rib',
      [1300, 160, 40],
      [0, y, v.bedBottom - 20],
      holes,
      'fixed',
      'steel',
      {},
      [0, 0, 0],
      'bed',
    );
  }
  // Corner plates and four hollow legs have separate machined end joints and accessible bolts.
  if (p.stand)
    for (const side of [-1, 1])
      for (const yy of [-1120, 1120]) {
        const x = side * 600,
          legHeight = v.bedBottom - 32,
          legHoles: FrameHole[] = [],
          topHoles: FrameHole[] = [],
          bottomHoles: FrameHole[] = [];
        for (const dx of [-25, 25])
          for (const dy of [-45, 45]) {
            legHoles.push(
              tap('z', [dx, dy, legHeight / 2 - 24], 6, 24),
              tap('z', [dx, dy, -legHeight / 2], 6, 24),
            );
            topHoles.push({
              ...clearance('z', [dx, dy, -8.1], 6, 16.2),
              counterboreDiameter: 10.5,
              counterboreDepth: 6.6,
            });
            bottomHoles.push({
              ...clearance('z', [dx, dy, -8.1], 6, 16.2),
              counterboreDiameter: 10.5,
              counterboreDepth: 6.6,
            });
            fastener(
              `leg-top-${side}-${yy}-${dx}-${dy}`,
              6,
              30,
              [x + dx, yy + dy, v.bedBottom - 6.5],
              [0, 0, 1],
              'fixed',
              'bed',
            );
            fastener(
              `leg-bottom-${side}-${yy}-${dx}-${dy}`,
              6,
              30,
              [x - dx, yy + dy, 6.5],
              [0, 0, -1],
              'fixed',
              'bed',
            );
          }
        for (const dx of [-35, 35])
          for (const dy of [-65, 65]) {
            topHoles.push(clearance('z', [dx, dy, -8.1], 8, 16.2));
            bedFlangeHoles[side < 0 ? 0 : 1].push(
              tap('z', [dx, yy + dy, -v.bedFlangeThickness / 2], 8, 14),
            );
            fastener(
              `stand-bed-${side}-${yy}-${dx}-${dy}`,
              8,
              25,
              [x + dx, yy + dy, v.bedBottom - 16],
              [0, 0, -1],
              'fixed',
              'bed',
            );
          }
        fabricated(
          `stand-leg-${side}-${yy}`,
          'corner-leg',
          [100, 100, legHeight],
          [x, yy, 16 + legHeight / 2],
          legHoles,
          'fixed',
          'steel',
          { tubeAxis: 'z', wall: 10, cornerRadius: 25 },
          [0, 0, 0],
          'bed',
        );
        fabricated(
          `stand-top-plate-${side}-${yy}`,
          'foot-plate',
          [160, 160, 16],
          [x, yy, v.bedBottom - 8],
          topHoles,
          'fixed',
          'steel',
          {},
          [0, 0, 0],
          'bed',
        );
        fabricated(
          `stand-floor-plate-${side}-${yy}`,
          'foot-plate',
          [160, 160, 16],
          [x, yy, 8],
          bottomHoles,
          'fixed',
          'steel',
          {},
          [0, 180, 0],
          'bed',
        );
      }
  for (const side of [-1, 1]) {
    const bi = side < 0 ? 0 : 1;
    for (const [j, y] of [-1000, -800, -600, -400, -200, 0, 200, 400, 600, 800, 1000].entries())
      for (const dx of [-20, 20]) {
        bedHoles[bi].push(tap('z', [dx, y, -v.bedTubeDepth / 2], 8, v.bedWall));
        bedFlangeHoles[bi].push(
          clearance('z', [dx, y, -v.bedFlangeThickness / 2 - 0.1], 8, v.bedFlangeThickness + 0.2),
        );
        washeredM8(
          `bed-flange-${side}-clamp-${j}-${dx}`,
          45,
          [side * 600 + dx, y, v.bedBottom],
          [0, 0, -1],
          'fixed',
          'bed',
        );
      }
    fabricated(
      'fixed-bed-side-' + side,
      'bed-member',
      [v.bedWidth, v.bedLength, v.bedTubeDepth],
      [side * 600, 0, v.bedTop - v.bedTubeDepth / 2],
      bedHoles[bi],
      'fixed',
      'steel',
      { tubeAxis: 'y', wall: v.bedWall, cornerRadius: v.bedCornerRadius },
      [0, 0, 0],
      'bed',
    );
    fabricated(
      'fixed-bed-lower-flange-' + side,
      'bed-flange',
      [v.bedWidth, v.bedLength, v.bedFlangeThickness],
      [side * 600, 0, v.bedBottom + v.bedFlangeThickness / 2],
      bedFlangeHoles[bi],
      'fixed',
      'steel',
      {},
      [0, 0, 0],
      'bed',
    );
    out[out.length - 1].component.manufacturing!.requirements.push(
      'Prepare the tube/flange contact datum, specify hardened washers, property-class8.8 fasteners, qualified preload and measured no-slip acceptance before using composite section stiffness. Position-dependent gravity compensation remains a machine-calibration requirement.',
    );
  }
  const xPlateHoles: FrameHole[] = [],
    zSaddleHoles: FrameHole[] = [];
  const xCarriageWasher = washer.presets.find((p) => p.id === 'gvyntok-032e19cf6e92');
  if (!xCarriageWasher) throw new Error('Missing sourced DIN 125 M5 washer.');
  for (const [i, z] of [v.beamCenter - 70, v.beamCenter + 70].entries())
    for (const [j, x] of [-100, 100].entries()) {
      add(
        `x-carriage-${i}-${j}`,
        carriage,
        { ...carriageParameters(), threadFitAllowance: 0.05 },
        'assembled',
        [x, v.railXBaseY, z],
        [-90, 0, 0],
        'x',
      );
      for (const [k, h] of carriageMountingHoles().entries()) {
        const hh = turned(h, [-90, 0, 0]),
          xx = x + hh[0],
          zz = z + hh[2];
        xPlateHoles.push({
          ...clearance('y', [xx, -10.1, zz - v.railZCenter], 5, 20.2),
          counterboreDiameter: 11.2,
          counterboreDepth: 6.1,
        });
        add(
          `x-carriage-${i}-${j}-washer-${k}`,
          washer,
          xCarriageWasher.parameters,
          'default',
          [xx, v.xPlateFront - 5.5, zz],
          [-90, 0, 0],
          'x',
          'mechanism',
          0xb6b9bd,
          xCarriageWasher.id,
        );
        fastener(
          `x-carriage-${i}-${j}-bolt-${k}`,
          5,
          20,
          [xx, v.xPlateFront - 5, zz],
          [0, 1, 0],
          'x',
        );
      }
    }
  addZGuides(v, { add, fabricated, fastener }, xPlateHoles, zSaddleHoles);
  // The rear X nut carrier wraps above and below the stationary beam, leaving 10 mm hard clearance.
  const backHoles: FrameHole[] = [];
  for (const side of [-1, 1]) {
    const z = v.beamCenter + side * 120,
      bridgeRear = -200,
      bridgeFront = v.xPlateBack,
      bridgeDepth = bridgeFront - bridgeRear,
      holes: FrameHole[] = [];
    for (const x of [-40, 40]) {
      holes.push(
        tap('y', [x, -bridgeDepth / 2, 0], 6, 15),
        tap('y', [x, bridgeDepth / 2 - 15, 0], 6, 15),
      );
      backHoles.push(clearance('y', [x, -10.1, side * 120], 6, 20.2));
      xPlateHoles.push(clearance('y', [x, -10.1, z - v.railZCenter], 6, 20.2));
      fastener(`x-bridge-rear-${side}-${x}`, 6, 30, [x, -220, z], [0, -1, 0], 'x');
      fastener(`x-bridge-front-${side}-${x}`, 6, 30, [x, v.xPlateFront, z], [0, 1, 0], 'x');
    }
    fabricated(
      'x-saddle-bridge-' + side,
      'support-bracket',
      [180, bridgeDepth, 20],
      [0, (bridgeRear + bridgeFront) / 2, z],
      holes,
      'x',
    );
  }
  addPrecisionDrives(p, v, { add, fabricated, fastener }, out, {
    tieHoles,
    beamHoles,
    backHoles,
    xPlateHoles,
    zSaddleHoles,
  });
  // Final drive and guide patterns belong to the actual independently manufactured blanks.
  const beam = out.find((piece) => piece.component.id === 'gantry-box-beam')!;
  beam.component.parameters = { ...beam.component.parameters, holes: JSON.stringify(beamHoles) };
  addZHead(p, v, { add, fabricated, fastener }, xPlateHoles, zSaddleHoles);
  addWorkSurface(p, v, { add, fabricated, fastener }, out);
  // Separate floor units and one light control rack stay outside the gantry and lower Y bay.
  if (v.spindle.cooling === 'water')
    add(
      'spindle-water-cooler',
      cooling,
      { ...cooling.defaults, model: 'teyu-cw5000-tity' },
      'default',
      [-1000, 800, 0],
      [0, 0, 0],
      'fixed',
      'equipment',
    );
  if (p.coolant)
    add(
      'cutting-coolant-kit',
      cooling,
      { ...cooling.defaults, model: 'vertex-vwp81-150k' },
      'default',
      [-1000, 100, 0],
      [0, 0, 0],
      'fixed',
      'equipment',
    );
  addControlEquipment(p, v.spindle.power, { add, fabricated, fastener }, out);
  addLimits(p, v, { add, fabricated, fastener }, out);
  addLinearEncoders(p, v, { add, fabricated, fastener }, out);
  specifyMillingGuides(out);
  return alignMatingFasteners(out);
}
export const millingIssues = [
  ...linearEncoderRequirements,
  ...limitRequirements,
  'The modeled female thread radial allowance0.05 mm is an authored inspection fit; nominal M thread callouts remain unchanged. Release actual ISO fit classes, engagement and torque before manufacturing.',
  'This is an independently authored ProtoLab CNC with800×1500×200 mm travel. The supplier is a reference for work range and equipment classes. Factory construction drawings, envelope, mass, accuracy and cutting capability are not reproduced.',
  ...millingQualificationRequirements,
  'Stainless/steel cutting is not certified; the reference supplier limits stainless use to engraving. Confirm the actual spindle clamp window with its manufacturer.',
  'Select 220 V spindle windings and verify actual motor nameplate current against the selected10 A/17 A VFD. Controller panel cutout, driver/equipment anchoring, wiring, protective bonding and regeneration margin require delivered-product drawings and electrical design; cases on rack shelves are installation reservations, not approved supplier mounts.',
  'Specify every material grade, fit, thread engagement, mounting torque, sealing detail, electrical interlock, limit switch, coolant hose and guard before design release.',
  'The portal posts seat on separate aluminium caps and horizontal feet. Release cap bending, threaded-tie preload and beam-wall thread capacity; gross RHS section values do not qualify the assembled joint.',
  'The portal clamps use 287.2 mm cuts from identified M10 threaded stock, DIN 934 class 8 nuts and DIN 125 HV200 washers. The stock supplier labels DIN 975; confirm delivered execution/certificates, cut-end quality and dry-fit stud projection before assembly. The nominal stud-to-beam gap is 0.9 mm; accept actual clearances and clamp preload before powered use.',
];
export function millingComposition(p: Parameters): AssemblyDefinition {
  return {
    components: groupMillingPurchasedKits(millingComponents(p).map((piece) => piece.component)),
    issues: [...millingIssues],
  };
}
export function millingPieces(p: Parameters, state: string): MillingPiece[] {
  const pose = millingPose(p, state);
  const posed = millingComponents(p)
    .filter((piece) =>
      state === 'bed'
        ? piece.section === 'bed'
        : state === 'z-head'
          ? piece.motion === 'x' || piece.motion === 'z'
          : state === 'mechanism'
            ? piece.section !== 'bed'
            : true,
    )
    .map((piece) => {
      const offset: Vec = [
        piece.motion === 'x' || piece.motion === 'z' ? pose.x : 0,
        piece.motion !== 'fixed' ? pose.y : 0,
        piece.motion === 'z' ? pose.z - 100 : 0,
      ];
      return { ...piece, position: offset };
    });
  if (state !== 'exploded') return posed;
  const offsets = millingInspectionOffsets(millingLibraries, posed);
  return posed.map((piece) => ({
    ...piece,
    position: plus(piece.position, offsets[piece.motion]),
  }));
}
