import type { Parameters, PartDefinition } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import bearing, { promBearing } from '../../flanged-ball-bearing/part';
import motor, { motorDimensions as motor2845Dimensions } from '../../surpass-2845/part';
import motor2838, { motorDimensions as motor2838Dimensions } from '../../surpass-2838/part';
import bolt from '../../bolt-screw/part';
import detail from '../../manufactured-detail/part';
import pin from '../../spring-pin/part';
import eClip from '../../e-ring/part';
import { layout, fixed as f } from './layout';
import { defaults, motorModels } from '../configurator';
import {
  screwShape,
  nutShape,
  forkShape,
  shaftShape,
  gearShape,
  frameShape,
  move,
  outputHoleCenters,
} from './shapes';

export const libraries: PartDefinition[] = [detail, bearing, motor, motor2838, bolt, pin, eClip];
export function selectedMotor(p: Parameters) {
  const model = String(p.motor ?? defaults.motor);
  const part = model.startsWith('surpass-2838-') ? motor2838 : motor;
  const name = motorModels.find((choice) => choice.value === model)?.label ?? model;
  return {
    part,
    parameters: { ...part.defaults, model },
    name,
    dimensions: part === motor2838 ? motor2838Dimensions : motor2845Dimensions,
    source: part.sources![0].url,
  };
}
const colors = {
  frame: 0xc39797,
  screw: 0x729663,
  nut: 0xd8a04c,
  fork: 0x30353d,
  shaft: 0x6597ce,
  steel: 0xb4bdc6,
};
export function made(
  id: string,
  label: string,
  shape: Shape,
  color = colors.steel,
  translation: Vec = [0, 0, 0],
  rotation: Vec = [0, 0, 0],
): ConfiguredPiece {
  const component = detailComponent(id, label, move(shape, translation, rotation), {
    edgeTolerance: 1e-6,
    meshConform: id === 'driven-gear' || id === 'motor-pinion',
  });
  component.manufacturing = {
    material:
      color === colors.nut
        ? 'Bearing bronze'
        : color === colors.frame
          ? 'Aluminium alloy 6061-T6'
          : 'Steel; grade and heat treatment to drawing',
    blank:
      id === 'screw'
        ? 'Unthreaded Ø8 steel blank; cut the two-start thread between intact Ø6 journals'
        : id === 'output-shaft'
          ? 'Ø20 steel bar; turn the continuous Ø6 journal, neck and integral head'
          : 'Stock sized to the configured component drawing',
    processes:
      id === 'output-shaft'
        ? ['turning', 'drilling']
        : id === 'frame'
          ? ['milling', 'drilling']
          : ['turning', 'milling', 'drilling'],
    requirements: ['Assign fits, finish and material to the toleranced production drawing.'],
  };
  if (id === 'driven-gear')
    component.manufacturing.requirements.push(
      'Match-drill the Ø2 transverse hub/shaft hole and install the recessed Ø2×10 spring pin for torque and axial retention. The hole is entirely outside the tooth face.',
      'Keep the gear clear of the bearing clip and carrier; do not use the gear to preload the screw bearings.',
    );
  if (id === 'motor-pinion')
    component.manufacturing.requirements.push(
      'Match-drill the Ø1 transverse gear/motor-shaft hole and install the recessed Ø1×10 spring pin. Support the shaft and keep drilling debris out of the motor.',
    );
  return { component, label, color, requireSingleSolid: true };
}
function configured(
  part: PartDefinition,
  id: string,
  label: string,
  parameters: Parameters,
  translation: Vec,
  rotation: Vec = [0, 0, 0],
): ConfiguredPiece {
  return {
    component: {
      id,
      name: label,
      libraryId: part.id,
      parameters,
      state: part.states?.[0]?.id ?? 'default',
      quantity: 1,
      supply: part.product.supply,
      placement: { translation, rotation },
    },
    label,
    color: colors.steel,
    preserveLibraryAppearance: true,
  };
}
function mf106(id: string, translation: Vec, rotation: Vec = [0, 0, 0]) {
  const preset = promBearing('smb-mf106-2z');
  const piece = configured(
    bearing,
    id,
    'SMB MF106 2Z · 6×10×3 · ' + id,
    { ...preset.parameters },
    translation,
    rotation,
  );
  piece.component.presetId = preset.id;
  piece.component.procurement = {
    designation: 'SMB MF106 2Z',
    manufacturer: 'SMB Bearings',
    source: preset.catalog!.sourceUrl,
  };
  return piece;
}
function clip(id: string, translation: Vec, rotation: Vec = [0, 0, 0]) {
  const preset = eClip.presets.find((p) => p.id === 'gvyntok-e-ring-3.2')!;
  const piece = configured(
    eClip,
    id,
    `DIN 6799-3.2 E-Clip · Ø5 neck · ${id}`,
    { ...preset.parameters, installedGrooveDiameter: 3.2 },
    translation,
    rotation,
  );
  piece.component.presetId = preset.id;
  piece.component.procurement = {
    designation: 'DIN 6799-3.2 E-Clip',
    manufacturer: 'Standard hardware',
    standard: 'DIN 6799',
    source: preset.catalog!.sourceUrl,
  };
  piece.component.notes =
    'Standard size3.2 identifies the groove. Install radially on the short Ø5 neck, with the bearing-side face directly at the Ø6 bearing edge. Maximum OD7.3 clears the stationary race. Shaft range and groove drawing: https://www.rotorclip.com/product/de-3-2/ . Installed lug transitions are illustrative.';
  return piece;
}
function screwBolt(id: string, length: number, translation: Vec, rotation: Vec = [0, 0, 0]) {
  const parameters = {
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
  };
  const piece = configured(
    bolt,
    id,
    `M3×${length} low-head socket screw · ${id}`,
    parameters,
    translation,
    rotation,
  );
  piece.component.procurement = {
    designation: `M3×${length} low-head socket screw`,
    manufacturer: 'Standard hardware',
    source: 'Select the supplier drawing and verify head height and motor insertion depth',
  };
  return piece;
}
function crossPin(
  id: string,
  translation: Vec,
  angle: number,
  diameter = 2,
  length = 10,
  gear = false,
): ConfiguredPiece {
  const preset = pin.presets.find(
    (p) => +p.parameters.diameter === diameter && +p.parameters.length === length,
  );
  if (!preset && !(diameter === 1 && length === 10))
    throw new Error('Missing sourced cross-pin configuration.');
  const parameters = preset?.parameters ?? {
    diameter: 1,
    length: 10,
    oversize: 0.1,
    wall: 0.2,
    slotAngle: 32,
    installedSlotAngle: 8,
    chamfer: 0.2,
  };
  const designation = `DIN 1481 Ø${diameter}×${length}`;
  const piece = configured(
    pin,
    id,
    designation + ' spring cross-pin',
    { ...parameters },
    translation,
    gear ? [angle, 0, 0] : [0, 90, angle],
  );
  piece.component.state = 'installed';
  if (preset) piece.component.presetId = preset.id;
  piece.component.procurement = {
    designation,
    manufacturer: preset ? 'Standard hardware' : 'REYHER',
    source:
      preset?.catalog!.sourceUrl ??
      'https://www.stuermer-werkzeuge.de/product/view/2319285/2971748',
  };
  if (!preset)
    piece.component.notes =
      'REYHER article 001481960000010010, DIN 1481 1×10, 1.4310. Wall, slit, chamfer and free oversize are illustrative installation geometry.';
  return piece;
}
function preparedMotor(p: Parameters, angle: number): ConfiguredPiece {
  const selected = selectedMotor(p);
  const piece = configured(
    selected.part,
    'motor',
    selected.name + ' · cross-drilled Ø1 shaft',
    { ...selected.parameters, shaftAngle: -angle },
    [0, f.motorY, 0],
    [0, -90, 0],
  );
  piece.component.state = 'cross-drilled';
  piece.component.supply = 'manufactured';
  piece.component.manufacturing = {
    material: 'Purchased ' + selected.name + ' motor',
    blank: 'One complete ' + selected.name + ' motor, stock Ø3.175×15 output shaft',
    processes: ['drilling'],
    requirements: [
      'Match-drill a Ø1 transverse hole through the exposed shaft at 13 mm from the mounting face. This is a secondary machining operation, not a manufacturer feature.',
      'Support the exposed shaft in a guided fixture; keep chips and pin insertion force out of the motor bearings. Qualify cross-hole strength for the intended torque and duty.',
      'Source motor reference: ' + selected.source,
    ],
  };
  return piece;
}
function forkPlate(id: string, z: number, angle: number): ConfiguredPiece {
  const piece = made(
    id,
    'Laser-cut fork plate · 3 mm · Ø6.05 round bore',
    forkShape(),
    colors.fork,
    [f.outputX, f.outputY, z],
    [0, 0, angle],
  );
  piece.label = `${z > 0 ? 'Upper' : 'Lower'} laser-cut fork plate · 3 mm`;
  piece.component.manufacturing = {
    material: '3 mm steel sheet',
    blank: 'One flat 3 mm laser-cut blank',
    processes: ['cutting', 'drilling'],
    requirements: [
      'Laser-cut the supplied 1:1 outline and round shaft opening; deburr and finish the bore to its assigned fit.',
      'Match-drill the transverse Ø2 hole through the plate edge and round shaft after aligning both fork plates. This edge hole is a secondary operation.',
      'Support the plate hub during spring-pin insertion. Qualify the cross-drilled joint for the application load.',
    ],
  };
  return piece;
}
/** Local recipes are neutral; output angle belongs only to assembly occurrence placement. */
export function pieces(p: Parameters, state = 'assembled'): ConfiguredPiece[] {
  const v = layout(p, state),
    output: Vec = [f.outputX, f.outputY, 0];
  const frame = made(
    'frame',
    'One-piece open bearing carrier · no case screws',
    frameShape(),
    colors.frame,
  );
  const drive: ConfiguredPiece[] = [
    made(
      'screw',
      'Custom TR8×4(P2) RH screw · round Ø6 journals · Ø2 gear cross-hole',
      screwShape(),
      colors.screw,
      [0, 0, 0],
      [v.screwAngle, 0, 0],
    ),
    made(
      'driven-gear',
      '24-tooth module 1 driven gear · Ø6.02 bore · pinned',
      gearShape(),
      colors.nut,
      [0, 0, 0],
      [v.screwAngle, 0, 0],
    ),
    made(
      'motor-pinion',
      '24-tooth module 1 pinion · Ø3.175 bore · pinned',
      gearShape(true),
      colors.nut,
      [0, 24, 0],
      [f.motorGearPhase + v.motorAngle, 0, 0],
    ),
    preparedMotor(p, f.motorGearPhase + v.motorAngle),
    mf106('screw-front-bearing', [f.frontBearingX, 0, 0], [0, -90, 0]),
    mf106('screw-rear-bearing', [f.rearBearingX, 0, 0], [0, 90, 0]),
    clip('gear-clip', [f.frontGroove.clipCenter, 0, 0], [0, 90, 0]),
    clip('screw-rear-clip', [f.rearGroove.clipCenter, 0, 0], [0, 90, 0]),
    crossPin(
      'screw-gear-pin',
      [f.gearPinX, 0, 0],
      v.screwAngle,
      f.screwGearPinDiameter,
      f.screwGearPinLength,
      true,
    ),
    crossPin(
      'motor-gear-pin',
      [f.gearPinX, f.motorY, 0],
      f.motorGearPhase + v.motorAngle,
      f.motorGearPinDiameter,
      f.motorGearPinLength,
      true,
    ),
    ...[-8, 8].map((z, i) => screwBolt(`motor-bolt-${i + 1}`, 5, [-1.325, 24, z], [0, -90, 0])),
  ];
  const driven: ConfiguredPiece[] = [
    made('nut', 'TR8×4(P2) bronze nut · two integral Ø4 trunnions', nutShape(), colors.nut, [
      v.nutX,
      0,
      0,
    ]),
    forkPlate('fork-upper-plate', f.forkInnerZ, v.angle),
    forkPlate('fork-lower-plate', -f.forkOuterZ, v.angle),
    made(
      'output-shaft',
      'Turned round output shaft · Ø6 · ST3215 PCD14 head',
      shaftShape(),
      colors.shaft,
      output,
      [0, 0, v.angle],
    ),
    mf106('output-upper-bearing', [f.outputX, f.outputY, f.outputBearingZ]),
    mf106('output-lower-bearing', [f.outputX, f.outputY, -f.outputBearingZ], [180, 0, 0]),
    ...[-f.forkCrossPinZ, f.forkCrossPinZ].map((z, i) =>
      crossPin(`fork-cross-pin-${i + 1}`, [f.outputX, f.outputY, z], v.angle),
    ),
    clip('output-clip', [f.outputX, f.outputY, f.outputGroove.clipCenter]),
    ...outputHoleCenters().map(([x, y], i) => {
      const a = v.radians;
      return screwBolt(
        `output-head-bolt-${i + 1}`,
        3,
        [
          f.outputX + x * Math.cos(a) - y * Math.sin(a),
          f.outputY + x * Math.sin(a) + y * Math.cos(a),
          f.outputHeadTop - 3 + (3 + 1.65) / 2,
        ],
        [0, 0, v.angle],
      );
    }),
  ];
  if (state === 'drive') return drive;
  if (state === 'output') return driven;
  return [frame, ...drive, ...driven];
}
