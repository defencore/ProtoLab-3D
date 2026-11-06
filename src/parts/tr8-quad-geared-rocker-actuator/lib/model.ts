import { Euler, Matrix4, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
import type { ManufacturingProcess } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { STEEL } from '../../../core/geometry';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import {
  pieces as sourcePieces,
  libraries as sourceLibraries,
} from '../../tr8-geared-rocker-actuator/part';
import ballBearing from '../../ball-bearing/part';
import flangedBearing, { promBearing } from '../../flanged-ball-bearing/part';
import bolt from '../../bolt-screw/part';
import hexNut from '../../hex-nut/part';
import springPin from '../../spring-pin/part';
import eRing from '../../e-ring/part';
import { compactDrive } from './compact-drive';
import { sheetPanel } from './sheet-panel';
import { coverValues, coverSectionShape, coverMountStations } from './plastic-cover';
import {
  fixed as f,
  layout,
  driveParameters,
  channelTransform,
  sourceTransform,
  panelTransform,
  roleIds,
  enclosureDiameter,
  standMountPattern,
  endDiscTransform,
} from './layout';
import {
  move,
  casePanelShape,
  centralCrossShape,
  nutShape,
  forkShape,
  shaftShape,
  headHoleCenters,
  endDiscShape,
} from './shapes';
export { channelTransform, sourceTransform, panelTransform, roleIds } from './layout';
export const libraries: PartDefinition[] = [...sourceLibraries, ballBearing, hexNut].filter(
  (p, i, a) => a.findIndex((x) => x.id === p.id) === i,
);
const colors = {
  case: 0xb8bec5,
  nut: 0xb39b66,
  fork: STEEL,
  shaft: 0x9aa1a9,
  steel: STEEL,
  plastic: 0x34383c,
};
const stockAppearance = (libraryId: string) =>
  ['surpass-2838', 'surpass-2845', 'ball-bearing', 'flanged-ball-bearing'].includes(libraryId);
const radians = (a: number) => (a * Math.PI) / 180;
/** Source-local replacement; keep the standalone actuator and all other drive pieces intact. */
function countersunkMotorBolt(piece: ConfiguredPiece): ConfiguredPiece {
  const c = piece.component;
  if (c.id !== 'motor-bolt-1' && c.id !== 'motor-bolt-2') return piece;
  const preset = bolt.presets.find((item) => item.id === 'gvyntok-040-070-001')!;
  const catalog = preset.catalog!;
  const name = 'DIN 7991 M3×5 countersunk motor screw';
  return {
    ...piece,
    label: name,
    component: {
      ...c,
      name,
      parameters: { ...preset.parameters },
      presetId: preset.id,
      procurement: {
        designation: `${catalog.designation} ${catalog.standard}`,
        manufacturer: catalog.manufacturer ?? 'Standard hardware',
        standard: catalog.standard,
        source: catalog.sourceUrl,
      },
      notes:
        'Countersunk length includes the head. Source-local head face X=-3 and tip X=+2 retain 2 mm nominal motor insertion through the 3 mm mounting wall.',
      placement: {
        ...c.placement,
        translation: [-0.5, c.placement.translation[1], c.placement.translation[2]],
      },
    },
  };
}
function driveAppearance(piece: ConfiguredPiece): ConfiguredPiece {
  switch (piece.component.id) {
    case 'screw':
      return { ...piece, color: colors.shaft };
    case 'driven-gear':
    case 'motor-pinion':
      return { ...piece, color: colors.nut };
    default:
      return {
        ...piece,
        color: colors.steel,
        preserveLibraryAppearance: stockAppearance(piece.component.libraryId),
      };
  }
}
function rigid(rotation: Vec = [0, 0, 0], translation: Vec = [0, 0, 0]) {
  return new Matrix4()
    .makeRotationFromEuler(new Euler(...(rotation.map(radians) as Vec), 'ZYX'))
    .setPosition(...translation);
}
export function placePiece(
  piece: ConfiguredPiece,
  outer: Matrix4,
  id = piece.component.id,
): ConfiguredPiece {
  const component = { ...piece.component, id, placement: { ...piece.component.placement } };
  const frame = outer
    .clone()
    .multiply(rigid(component.placement.rotation, component.placement.translation));
  const e = new Euler().setFromRotationMatrix(frame, 'ZYX');
  component.placement = {
    translation: new Vector3().setFromMatrixPosition(frame).toArray() as Vec,
    rotation: [e.x, e.y, e.z].map((v) => (Math.abs(v) < 1e-12 ? 0 : (v * 180) / Math.PI)) as Vec,
  };
  return { ...piece, component };
}
function made(
  id: string,
  label: string,
  shape: Shape,
  color: number,
  processes: ManufacturingProcess[],
  requirements: string[],
): ConfiguredPiece {
  const component = detailComponent(id, label, shape, {
    edgeTolerance: 1e-6,
    preserveAuthoredFrame: id === roleIds.cover,
    meshConform: [
      roleIds.case,
      roleIds.cross,
      roleIds.fork,
      roleIds.shaft,
      roleIds.endDisc,
      roleIds.cover,
    ].includes(id as never),
  });
  component.manufacturing = {
    material: [roleIds.case, roleIds.cross, roleIds.endDisc].includes(id as never)
      ? id === roleIds.case || id === roleIds.endDisc
        ? 'Aluminium alloy 5052-O'
        : 'Aluminium alloy 6061-T6'
      : id === roleIds.cover
        ? 'PETG'
        : id === roleIds.nut
          ? 'Bearing bronze'
          : 'Steel; grade and treatment to drawing',
    blank:
      id === roleIds.case
        ? '3 mm 5052-O sheet; laser-cut and bend to the specified panel execution'
        : id === roleIds.endDisc
          ? '3 mm 5052-O sheet; laser-cut the disc, welding slots and reliefs before finishing cable ports'
          : id === roleIds.cover
            ? 'Dense PETG print with local mechanism pockets, acoustic seam overlaps and integral mounts'
            : id === roleIds.shaft
              ? 'Ø20 steel bar with integral output head'
              : 'Stock sized to the component drawing',
    processes,
    requirements,
  };
  return { component, label, color, requireSingleSolid: true };
}
function configured(
  part: PartDefinition,
  id: string,
  label: string,
  parameters: Parameters,
  position: Vec,
  rotation: Vec = [0, 0, 0],
): ConfiguredPiece {
  return {
    component: {
      id,
      name: label,
      libraryId: part.id,
      parameters,
      state: part.states?.[0]?.id ?? 'default',
      supply: part.product.supply,
      quantity: 1,
      placement: { translation: position, rotation },
    },
    label,
    color: colors.steel,
    preserveLibraryAppearance: stockAppearance(part.id),
  };
}
function bearing(inner: boolean): ConfiguredPiece {
  const preset = inner
    ? ballBearing.presets.find((p) => p.id === 'promteh-7439')!
    : promBearing('smb-mf106-2z');
  const p = configured(
    inner ? ballBearing : flangedBearing,
    inner ? roleIds.innerBearing : roleIds.outerBearing,
    inner
      ? 'EZO MR52ZZ · central joint · 2×5×2.5'
      : 'SMB MF106 2Z · wall-mounted output bearing · 6×10×3',
    { ...preset.parameters },
    [inner ? f.innerBearingR : f.outerBearingR, 0, 0],
    [0, 90, 0],
  );
  p.component.presetId = preset.id;
  p.component.procurement = {
    designation: inner ? 'EZO MR52ZZ' : 'SMB MF106 2Z',
    manufacturer: inner ? 'EZO' : 'SMB Bearings',
    source: preset.catalog!.sourceUrl,
  };
  if (!inner)
    p.component.notes =
      'The Ø10 bearing body enters the straight Ø10.02 wall hole. The 0.6 mm locating flange rests on the exterior wall face; no bearing chamfer or flange recess is cut into the panel.';
  return p;
}
function centerClip(): ConfiguredPiece {
  const preset = eRing.presets.find((p) => p.id === 'gvyntok-e-ring-1.2')!;
  const p = configured(
    eRing,
    roleIds.centerClip,
    'DIN 6799-1.2 E-Clip',
    { ...preset.parameters, installedGrooveDiameter: 1.2 },
    [f.innerClipCenter, 0, 0],
    [-90, 0, -90],
  );
  p.component.presetId = preset.id;
  p.component.procurement = {
    designation: 'DIN 6799-1.2 E-Clip',
    manufacturer: 'Standard hardware',
    standard: 'DIN 6799',
    source: preset.catalog!.sourceUrl,
  };
  return p;
}
function forkPin(): ConfiguredPiece {
  const preset = springPin.presets.find((p) => p.id === 'gvyntok-2b5602414d16')!;
  const p = configured(
    springPin,
    roleIds.forkPin,
    'DIN 1481 Ø2×10 · single inboard fork hub',
    { ...preset.parameters },
    [f.forkHubR, 0, 0],
    [0, 0, 0],
  );
  p.component.state = 'installed';
  p.component.presetId = preset.id;
  p.component.procurement = {
    designation: 'DIN 1481 Ø2×10',
    manufacturer: 'Standard hardware',
    standard: 'DIN 1481',
    source: preset.catalog!.sourceUrl,
  };
  return p;
}
const screwParameters = (length: number): Parameters => ({
  ...bolt.defaults,
  diameter: 3,
  shankDiameter: 3,
  length,
  head: 'socket-cap',
  headSize: 5.5,
  headHeight: 1.65,
  drive: 'hex',
  driveWidth: 2,
  driveDepth: 1,
  threadMode: 'envelope',
  threadSpan: 'full',
  pitch: 0.5,
  tip: 'flat',
});
function headBolts(): ConfiguredPiece[] {
  return headHoleCenters().map(([y, z], i) =>
    configured(
      bolt,
      `output-head-bolt-${i + 1}`,
      'M3×3 low-head output screw',
      screwParameters(3),
      [f.headEnd - 3 + (3 + 1.65) / 2, y, z],
      [0, 90, 0],
    ),
  );
}
function outputPieces(): ConfiguredPiece[] {
  return [
    made(
      roleIds.fork,
      'One-piece CNC fork · straight eye arm',
      forkShape(),
      colors.fork,
      ['milling', 'drilling'],
      [
        'Machine the Ø11 eye and 6 mm straight arm in one plane, tapering smoothly to the 8.4 mm rounded clevis web. Both 2.6 mm cheeks end flush with the shaft-facing web plane at local Y=9.8, using R1 rear corners. Retain the current slot root, mouth and lip geometry.',
        'Keep 0.5 mm follower-pin projection beyond the cheeks. Match-drill the single Ø2×10 hub/shaft pin at radius 11.1 through the arm guide bore. The pin is recessed 0.5 mm at the rounded eye entry and 8.2 mm at the opposite web face. Assign production fits and load limits.',
      ],
    ),
    made(
      roleIds.shaft,
      'Turned output shaft · wall journal · PCD14 head',
      shaftShape(),
      colors.shaft,
      ['turning', 'drilling'],
      [
        'Turn the Ø2 central journal, groove and uninterrupted Ø6 torque path. The outer MF106 journal is centered at radius17.6, with its flange outside the wall. Start the integral head at19.35, turn its Ø19 back to23.65 and retain the Ø20 front rim to the face at24.35. Keep0.25 mm clearance between the bearing and the head.',
        'The four M3 head holes retain ST3215 PCD14 locations. Qualify shaft bending and the single pin joint for the application.',
      ],
    ),
    bearing(true),
    bearing(false),
    forkPin(),
    centerClip(),
    ...headBolts(),
  ];
}
function housing(fold: 1 | -1 = 1): ConfiguredPiece {
  return made(
    roleIds.case,
    `Laser-cut wall panel · ${fold > 0 ? 'A/C' : 'B/D'} · one-sided motor seats`,
    casePanelShape(fold, fold),
    colors.case,
    ['cutting', 'bending', 'drilling'],
    [
      `Laser-cut 3 mm sheet and form the ${fold > 0 ? 'A/C' : 'B/D'} execution with ${fold > 0 ? '+' : '-'}90-degree bends. Use the actual bend radii and reliefs; do not add separate bosses, blocks or thickened tabs.`,
      'Use the supplied upper/lower panel placements and external M3 screws and nuts to clamp the formed flanges.',
      `Tap the cover mounting pilot M3×0.5 at local T=${fold > 0 ? '+' : '-'}${f.coverMountT}, Z=${f.coverMountZ}. This is a straight through thread; it has no countersink.`,
      `Tap ${standMountPattern.length} additional M3×0.5 through holes for the stand at local (T,Z)=${standMountPattern.map(([t, z]) => `(${t},${z})`).join(', ')} mm, using three panel-centerline stations above the output and two lateral stations at output height. Laser-cut the lateral mounting ears integrally with the same 3 mm sheet blank. Use Ø2.5 pilots and the full sheet thickness without countersinks; these are separate from the cover mounting thread.`,
      `Finish three straight Ø10.02 bearing holes without chamfers or flange recesses. Bearing flanges seat on the outside wall surface. Countersink only the motor screw heads from local N=${fold > 0 ? '18.5' : '15.5'}; leave the opposite face uncut. Inspect the bearing datums after welding the end discs.`,
      'Laser-cut the four circular and three capsule lightening contours. Retain at least 3 mm nominal lands to functional holes, stand threads, bend tangencies and cut edges.',
    ],
  );
}
function centralCross(): ConfiguredPiece {
  return made(
    roleIds.cross,
    'Central four-bearing shaft connector',
    centralCrossShape(),
    colors.case,
    ['milling', 'drilling'],
    [
      'This separate functional joint links the four inward shaft tips through four MR52ZZ bearings. It is captured by the shafts, not a fifth main housing wall.',
      'Finish four orthogonal Ø5 seats at radius4.75. Arm ends stop at6.5 to clear the inboard fork hubs. Keep the central clip access window.',
      'Assign measured bearing fits and four-shaft end float without preloading the stationary bearing races.',
    ],
  );
}
function caseHardware(): ConfiguredPiece[] {
  return [-1, 1].flatMap((x) =>
    [-1, 1].flatMap((y) => {
      const suffix = `${x < 0 ? 'w' : 'e'}${y < 0 ? 's' : 'n'}`;
      return [
        configured(
          bolt,
          `${roleIds.caseBolt}-${suffix}`,
          `M3×${f.clampLength} external housing clamp`,
          screwParameters(f.clampLength),
          [
            x * sheetPanel.clampOuter,
            y * sheetPanel.clampInner,
            f.tabThickness - f.clampLength + (f.clampLength + 1.65) / 2,
          ],
        ),
        configured(
          hexNut,
          `${roleIds.caseNut}-${suffix}`,
          'M3 DIN 934 housing nut',
          {
            ...hexNut.defaults,
            bore: 3,
            acrossFlats: 5.5,
            height: f.clampNutHeight,
            pitch: 0.5,
            threadAllowance: 0.04,
          },
          [
            x * sheetPanel.clampOuter,
            y * sheetPanel.clampInner,
            -f.tabThickness - f.clampNutHeight,
          ],
          [0, 0, 72],
        ),
      ];
    }),
  );
}
function endCaps(p: Parameters): ConfiguredPiece[] {
  const disc = made(
    roleIds.endDisc,
    `Ø${enclosureDiameter(p)} welding end disc · flush with plastic covers`,
    endDiscShape(p),
    colors.case,
    ['cutting', 'drilling'],
    [
      `Cut two identical Ø${enclosureDiameter(p)}×3 sheet discs, matching the cover outside diameter, with two50×3.15 welding slots, eight peripheral lightening holes and fourØ${f.endWireHoleDiameter} cable holes on radius${f.endWireHoleRadius} clocked${f.endWirePortAngle}degrees. Break cable-hole edges with0.5mm chamfers. Retain the center, weld-slot ribs and outside rim.`,
      'Slide the discs over the3.5mm panel tongues. Index the lower disc90degrees. The tongues project0.5mm past the disc faces for welding; no disc screws are used. Match disc and panel materials for the selected welding process.',
    ],
  );
  const upper = placePiece(disc, endDiscTransform(true), `upper-${roleIds.endDisc}`);
  const lower = placePiece(disc, endDiscTransform(false), `lower-${roleIds.endDisc}`);
  return [upper, lower];
}
function plasticCovers(p: Parameters): ConfiguredPiece[] {
  const v = coverValues(p);
  const shells = [0, 1, 2, 3].map((index) =>
    placePiece(
      made(
        roleIds.cover,
        `PETG acoustic cover quadrant · Ø${v.outerDiameter} · local mechanism pockets`,
        coverSectionShape(p, index),
        colors.plastic,
        ['printing'],
        [
          'Print the pocketed quarter as one connected PETG part. Keep dense perimeters and solid material in the available zones, including the mounting support, seam overlaps and close-fitting output collar.',
          'Make four quarters according to their actual BOM configurations. Seat the integral feet against the metal plates and secure each quarter with its recessed M3 screw. Keep the mechanism pockets, output access and cable exits open.',
          `Keep all ${4 * standMountPattern.length} Ø${f.standPassageDiameter} shank passages to the metal panels' M3 stand threads open; stand screw heads remain outside the PETG. The external fixture and its fasteners are selected separately.`,
          'Preserve the four motor lead grooves, rear collectors and eight upper/lower reserve grooves to the real end ports. Reserve grooves stop at separate inner service pockets near the waist. Orient purchased motor leads into the inboard rear collectors and check actual boots and cable bend requirements before printing.',
          'The enclosure uses mass and overlapped seams to reduce direct sound leakage. Its actual acoustic attenuation and operating temperature require measurements on the assembled actuator.',
        ],
      ),
      new Matrix4(),
      `cover-section-${index + 1}`,
    ),
  );
  const fasteners = coverMountStations(p).map((station) => {
    const preset = bolt.presets.find(
      (entry) =>
        entry.catalog?.standard === 'DIN 7991' &&
        Number(entry.parameters.diameter) === 3 &&
        Number(entry.parameters.length) === station.length,
    );
    if (!preset) throw new Error(`Missing sourced DIN7991 M3×${station.length} cover screw.`);
    const name = `DIN 7991 M3×${station.length} · recessed cover screw`;
    const piece = configured(
      bolt,
      `${roleIds.coverBolt}-${'abcd'[station.panelIndex]}`,
      name,
      { ...preset.parameters },
      station.worldPosition,
      station.rotation,
    );
    piece.component.presetId = preset.id;
    piece.component.procurement = {
      designation: `${preset.catalog!.designation} ${preset.catalog!.standard}`,
      manufacturer: preset.catalog!.manufacturer ?? 'Standard hardware',
      standard: preset.catalog!.standard,
      source: preset.catalog!.sourceUrl,
    };
    piece.component.notes =
      'The countersunk head is recessed inside the cylindrical cover envelope. The screw passes through the printed foot and engages the M3×0.5 thread in the 3 mm metal panel; no external nut is used.';
    return piece;
  });
  return [...shells, ...fasteners];
}
/** Source drive layout stays fixed; the two panel executions use their approved placement frames. */
export function pieces(p: Parameters, state = 'assembled'): ConfiguredPiece[] {
  const v = layout(p),
    out: ConfiguredPiece[] = [];
  const panels = [housing(1), housing(-1)];
  if (state === 'covers') return plasticCovers(p);
  if (state === 'quarter-a') return [panels[0]];
  if (state === 'housing')
    return [
      ...[0, 1, 2, 3].map((i) =>
        placePiece(panels[i % 2], panelTransform(i), `${'abcd'[i]}-${roleIds.case}`),
      ),
      ...caseHardware(),
      ...endCaps(p),
    ];
  const prototype = outputPieces();
  for (let i = 0; i < 4; i++) {
    if (state === 'quarter-a' && i !== 0) continue;
    const letter = 'abcd'[i],
      outer = channelTransform(i),
      driveP = driveParameters(p, i),
      sf = sourceTransform(i % 2 === 0);
    const drive = sourcePieces(driveP, 'drive').map((piece) =>
      placePiece(driveAppearance(compactDrive(countersunkMotorBolt(piece))), sf),
    );
    const nut = placePiece(
      made(
        roleIds.nut,
        'TR8x4(P2) nut · 16×12×12 · twin followers',
        move(nutShape(), [15.5 + v.channels[i].displacement, 0, 0]),
        colors.nut,
        ['turning', 'milling', 'drilling'],
        [
          'Use the public source two-start female thread and relieved16mm axial length; mill the radial body to12mm and machine two Ø4 integral followers.',
          'Keep15.2mm effective female engagement and stop contact at both ends of the31mm working thread; total travel15mm.',
        ],
      ),
      sf,
    );
    const rotation = rigid([v.channels[i].angle, 0, 0]);
    const local = [
      ...drive,
      nut,
      ...prototype.map((piece) =>
        [
          roleIds.fork,
          roleIds.shaft,
          roleIds.forkPin,
          roleIds.centerClip,
          ...[1, 2, 3, 4].map((j) => `output-head-bolt-${j}`),
        ].includes(piece.component.id)
          ? placePiece(piece, rotation)
          : piece,
      ),
    ];
    if (state !== 'drive' && state !== 'center')
      out.push(placePiece(panels[i % 2], panelTransform(i), `${letter}-${roleIds.case}`));
    for (const piece of local) {
      const id = piece.component.id;
      if (state === 'drive' && !drive.some((d) => d.component.id === id)) continue;
      if (
        state === 'center' &&
        ![roleIds.shaft, roleIds.innerBearing, roleIds.centerClip].includes(id as never)
      )
        continue;
      const next = placePiece(piece, outer, `${letter}-${id}`);
      out.push({ ...next, label: `${letter.toUpperCase()} · ${piece.label}` });
    }
  }
  if (state !== 'drive' && state !== 'quarter-a') out.push(centralCross());
  if (state === 'assembled' || state === 'uncovered') out.push(...caseHardware(), ...endCaps(p));
  if (state === 'assembled') out.push(...plasticCovers(p));
  return out;
}
