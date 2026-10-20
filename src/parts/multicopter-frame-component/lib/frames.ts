import one from './source.json';
import additional from './additional.json';
import multirotors from './multirotors.json';
import fabrication from './fabrication.json';
import sourceVFitChecks from './source-v-fit-checks.json';

export type SourceComponent = (typeof one.parts)[number] & {
  frameId: string;
  meshCompression?: string;
  previewNotes?: string[];
  printPose?: { rotation: number[]; min: number[]; size: number[] };
  sourceFile?: { file: string; url: string; sha256: string };
};
export interface SourceFrame {
  id: string;
  name: string;
  description: string;
  source: { url: string; repository: string; revision: string; sha256: string };
  parts: SourceComponent[];
  body: number;
  arms: number[];
  root: number[];
  minimumMotorSpacing: number;
  armTop: number;
  deckTop: number;
  mass: number;
  motorThrust: number;
  motorCount: 4 | 6 | 8;
  motorsPerArm: 1 | 2;
  topology: string;
  propDiameter: number;
  rotorHeight: number;
  motorStations: {
    x: number;
    y: number;
    upperMountZ: number;
    lowerMountZ: number;
    upperPart: number;
    lowerPart: number;
  }[];
  hardware: string[];
  changes: string[];
  knownSourceInterferences: { a: string; b: string; volumeMm3: number }[];
}
const details: Record<
  string,
  Omit<
    SourceFrame,
    | 'id'
    | 'source'
    | 'parts'
    | 'body'
    | 'arms'
    | 'root'
    | 'knownSourceInterferences'
    | 'motorStations'
  >
> = {
  'source-one-v5': {
    name: 'SOURCE ONE V5',
    description: '5 inch freestyle frame; 6 mm replaceable arms, keyed roots and camera cheeks.',
    minimumMotorSpacing: 145.2692,
    armTop: 6,
    deckTop: 34,
    mass: 0.65,
    motorThrust: 12,
    motorCount: 4,
    motorsPerArm: 1,
    topology: 'Quad X',
    propDiameter: 127,
    rotorHeight: 38,
    hardware: [
      'Native source screws, standoffs and eight press inserts are included. Confirm grades and final thread engagement.',
    ],
    changes: [
      'The assembly uses the CAD lower plate thickness of 2.5 mm. Lower screw bearing planes are moved down 0.5 mm; the two floating front deck screws are moved down 2 mm. Source component shapes remain unchanged.',
      'The CAD-matched cutting layout labels the lower plate 2.5 mm; upstream DXF names it 2 mm.',
    ],
  },
  'source-two-v01': {
    name: 'SOURCE TWO V0.1',
    description:
      '5 inch racing frame; 4 mm individual arms, 3 mm main plate and 2 mm reinforcement plates.',
    minimumMotorSpacing: 139.5134,
    armTop: 7,
    deckTop: 36,
    mass: 0.5,
    motorThrust: 10,
    motorCount: 4,
    motorsPerArm: 1,
    topology: 'Quad X',
    propDiameter: 127,
    rotorHeight: 38,
    hardware: [
      'Upstream bill: 12 M3 x 12 screws, four M3 lock nuts, four 25 mm M3 standoffs and four silicone camera mounts. Reconcile the CAD camera mounts with the purchased kit.',
    ],
    changes: [
      '30 frame occurrences retained. Four overlapping action-camera/accessory solids (source indices 30–33) are excluded from this frame assembly.',
      'Only a rigid axis/origin change is applied; source fastener shapes and placements are retained.',
    ],
  },
  'source-v-v1': {
    name: 'SOURCE V V1 · upgraded arms',
    description:
      '5 inch vertical-web racing frame; interlocking 2 mm carbon sheets and 30 mm standoffs.',
    minimumMotorSpacing: 155.5588,
    armTop: 12,
    deckTop: 34,
    mass: 0.5,
    motorThrust: 10,
    motorCount: 4,
    motorsPerArm: 1,
    topology: 'Quad X',
    propDiameter: 127,
    rotorHeight: 38,
    hardware: [
      'Four M3 x 30 standoffs are present in CAD. Add the 24 M3 x 14 screws specified by the author; screws and threads are not modelled in the source.',
    ],
    changes: [
      '18 closed upstream shells are wrapped as solids without sewing, scaling or contour repair.',
      'Vertical sheets are rotated only in the cutting inspection/layout. The assembly retains the native interfaces.',
      'SOURCE V source CAD has 20 small tab interferences (0.165–0.560 mm3). These are retained and reported, not declared clearance fits. Cut a stock/tool-specific fit coupon and resolve tab/slot allowance before fabrication.',
    ],
  },
  'source-podracer-v1': {
    name: 'SOURCE PODRACER V1 · 5 inch',
    description:
      'Light 200 mm frame; four 5 mm carbon arms, 1.5 mm clamp plates and a separate nylon pod.',
    minimumMotorSpacing: 141.421356,
    armTop: 0,
    deckTop: 40.302,
    mass: 0.25,
    motorThrust: 4,
    motorCount: 4,
    motorsPerArm: 1,
    topology: 'Quad X',
    propDiameter: 127,
    rotorHeight: 48,
    hardware: [
      'Source CAD contains seven carbon/pod solids and no hardware. Author hardware: eight M2 x 10 and four M2 x 12 countersunk screws, two M2 x 6 socket screws and 24 M2 x 10 socket screws.',
      'Preserve the bottom-plate countersinks as a separate finishing operation. Print the pod in the specified nylon; the carbon arms remain carbon.',
    ],
    changes: [
      'The four-arm 5 inch STEP configuration is used. The two-arm/Y-arm alternatives and 4 inch drawings are not mixed into this build.',
      'Original countersinks and the native nylon pod are retained.',
      'Pod mounting axes are at (+/-24, 0) and (0, +/-24) mm; four feet bear on the 1.5 mm top plate. The rear accessory extension intentionally overhangs the plate.',
    ],
  },
  'comet-y6': {
    name: 'COMET Y6 · hexacopter',
    description:
      'Printed PC/CF Y6 frame: three arms, six coaxial motor blocks, two core plates and three landing legs.',
    minimumMotorSpacing: 258.23572379,
    armTop: 18.4,
    deckTop: 18.4,
    mass: 0.8,
    motorThrust: 8,
    motorCount: 6,
    motorsPerArm: 2,
    topology: 'Y6 coaxial · 3 arms / 6 motors',
    propDiameter: 129.54,
    rotorHeight: 25,
    hardware: [
      '17 original printed occurrences; electronics, motors, fasteners and heat-set inserts are not modelled. Complete them from the pinned author bill and build manual.',
      'Core and motor blocks: 15 M3 x 25 screws (six roots, six block halves, three block-to-arm), washers, nine block lock nuts and six M3 root inserts in the landing mounts. Landing legs: three M3 x 10 screws, washers and M3 inserts. Use inserts matched to the author pockets.',
      'Six author motor interfaces: 2004 motors with 12 mm mounting circle; four M2 x 5 screws and washers per motor. Add the author spacers when supplied screws are longer. Verify winding clearance.',
      'Use the author PC/CF print profiles and dry material. Imported geometry is solid CAD, not a claim of 100% infill. Battery holder, flight-controller mounts and wiring accessories remain separate author equipment.',
    ],
    changes: [
      'Individual pinned STEP parts are unchanged. Their assembly is reconstructed from the author manual and measured 35 mm root-hole pairs; front arms are not a 120-degree radial copy.',
      'Upper/lower motor mounting faces are at Z=18.4/-0.4 mm. Paired motors face outward. Printed-parts inspection restores each source printing orientation.',
      'Six-rotor demand assumes equal load sharing. Coaxial motor/prop interference and motor-out handling require measured data; summed isolated thrust is not installed thrust.',
    ],
  },
  'source-one-x8': {
    name: 'SOURCE ONE V4 X8 LIFTER · octocopter',
    description:
      'Carbon X8: four 5 mm arms, four 3 mm lower motor covers, V4 decks and eight coaxial motor interfaces.',
    minimumMotorSpacing: 137.42846948,
    armTop: 6,
    deckTop: 41,
    mass: 0.9,
    motorThrust: 10,
    motorCount: 8,
    motorsPerArm: 2,
    topology: 'X8 coaxial · 4 arms / 8 motors',
    propDiameter: 127,
    rotorHeight: 40,
    hardware: [
      '23 original CAD occurrences including ten M3 x 30 standoffs. Screws, nuts, motors and electronics are not modelled. Use SOURCE ONE V4 donor parts; V5 is a different interface.',
      'Author conversion bill: two Arm 1, two Arm 2, eight covers, 32 M3 x 6 motor screws, ten M3 x 12 cover screws, ten lock nuts and four M3 x 40 stack screws, plus V4 donor hardware. Reconcile this with the STEP: it contains four lower motor covers and one root clamp. The author eight-cover count is not silently replaced by CAD quantities.',
      'CAD stock: 5 mm arms, 3 mm covers/root clamp/lower deck, 2 mm upper deck and camera cheeks. Lower motors mount on the covers; upper motors mount on the arms.',
    ],
    changes: [
      'Pinned full V4 X8 STEP retained without rescaling, repositioning individual parts or mixing V5 components. The origin is the mean of four native motor shaft axes.',
      'Eight physical motor interfaces occupy four coaxial stations. Propeller clearance is checked between stations, with the lower motor faces at Z=-2 mm and upper faces at Z=6 mm.',
      'Source V4 camera cheeks retain two small tab interferences with the lower deck (0.660 and 0.017 mm3). Resolve the stock/tool-specific cheek slot fit before cutting; the motor arms and covers have no nominal overlap.',
      'Eight-rotor demand assumes equal sharing; coaxial installed thrust and one-motor-out behaviour remain unqualified.',
    ],
  },
};
const raw = [
  {
    id: 'source-one-v5',
    source: one.source,
    parts: one.parts,
    body: 2,
    arms: [53, 54, 55, 56],
    root: [2, 4, 52, 53, 54, 55, 56, 44, 45, 46, 47, 48, 49, 50, 51],
  },
  ...additional,
  ...multirotors,
];
export const frames: SourceFrame[] = raw.map((f) => ({
  ...f,
  ...details[f.id],
  motorStations: 'motorStations' in f ? f.motorStations : [],
  parts: f.parts.map((m) => ({ ...m, frameId: f.id })),
  knownSourceInterferences:
    f.id === 'source-v-v1'
      ? sourceVFitChecks
      : f.id === 'source-one-x8'
        ? [
            { a: 'source-one-x8-01', b: 'source-one-x8-13', volumeMm3: 0.6599016603623986 },
            { a: 'source-one-x8-02', b: 'source-one-x8-13', volumeMm3: 0.017311328185150486 },
          ]
        : [],
}));
export const models = frames.flatMap((f) => f.parts);
export const source = one.source;
export const beam = one.beam;
export const sheetFabrication = fabrication as unknown as Record<
  string,
  {
    rotation: [number, number, number];
    min: [number, number, number];
    size: [number, number, number];
    thickness: number;
  }
>;
export function sourceFrame(id: unknown): SourceFrame {
  const frame = frames.find((f) => f.id === id);
  if (!frame) throw new Error('Choose a pinned source frame.');
  return frame;
}
/** Correct the source hardware datums without modifying any component shape. */
export function assemblyPlacement(m: SourceComponent): [number, number, number] {
  const placement = [...m.placement] as [number, number, number];
  if (m.frameId === 'source-one-v5') {
    if ([19, 24, 25, 28, 29, 30, 31, 36, 39, 40, 41, 42].includes(m.sourceIndex))
      placement[2] -= 0.5;
    if ([23, 35].includes(m.sourceIndex)) placement[2] -= 2;
  }
  return placement;
}
