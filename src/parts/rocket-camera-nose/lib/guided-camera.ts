import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import {
  box,
  cylinder,
  union,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import camera19 from '../../board-camera-19/part';
import ov9281, { ov9281Interface, rearContactInterface } from '../../waveshare-ov9281-110/part';
import { guidedOptics, guidedOpticalInterface } from './guided-optics';
import { guidedCsiReserve } from './guided-routing';

export const guidedCameraCommonInterface = {
  apertureRadius: guidedOpticalInterface.apertureRadius,
  bodyRadius: 21.6,
  splitRadius: 19.4,
  shroudOuterRadius: guidedOpticalInterface.linerOuterRadius,
  rearStopThickness:
    guidedOpticalInterface.rearStopBackOffset - guidedOpticalInterface.rearStopFrontOffset,
  minimumTpuPerimeter: 2,
  minimumPetgBacking: 3,
  ovRearChamberDepth: 3,
  ovRearLocatorDiameter: 1.8,
  ovRearLocatorHeight: 0.4,
} as const;

type Pose = { translation: Vec; rotation: Vec };
const intersect = (...children: Shape[]): Shape => ({ kind: 'intersect', children });
const at = (shape: Shape, pose: Pose): Shape => ({ kind: 'transform', child: shape, ...pose });
/** Optional installation clock, viewed from the optical front toward the body.
 * Negative angles are clockwise in that view. The source camera stays unmodified. */
export const guidedCameraClockDegrees = (p: Parameters) =>
  p.cameraSetup === 'camera-19' ? Number(p.cameraClockDegrees ?? 0) : 0;
export const guidedCameraClocked = (shape: Shape, p: Parameters): Shape => {
  const clock = guidedCameraClockDegrees(p);
  return clock === 0 ? shape : at(shape, { translation: [0, 0, 0], rotation: [0, 0, clock] });
};
const execution = (ov: boolean) => {
  const source = ov ? ov9281 : camera19,
    id = ov ? 'waveshare-21653' : 'imx577-19x19-rear-mipi-m25',
    preset = source.presets.find((item) => item.id === id);
  if (!preset) throw new Error('Missing source camera execution ' + source.id + ':' + id);
  return { source, preset };
};

/** Optical axis is centered; purchased dimensions come from the actual library execution. */
export function guidedCameraProfile(p: Parameters) {
  const ov = p.cameraSetup === 'ov9281',
    l = n(p, 'noseLength'),
    optics = guidedOptics(p),
    { source, preset } = execution(ov),
    cp = preset.parameters,
    lensRadius = ov ? ov9281Interface.lensDiameter / 2 : n(cp, 'lensDiameter') / 2,
    projection = ov
      ? ov9281Interface.boardThickness + ov9281Interface.fixedProjection + n(cp, 'focusExtension')
      : n(cp, 'bodyDepth') + n(cp, 'lensLength'),
    front = optics.front,
    rear = optics.rear,
    bodyFront = rear + (ov ? ov9281Interface.boardThickness : n(cp, 'bodyDepth')),
    rearContactZ = rear + (ov ? rearContactInterface.pcbRearZ : 0),
    rearChamberDepth = ov ? guidedCameraCommonInterface.ovRearChamberDepth : 0,
    rearPedestalFrontZ = rearContactZ - rearChamberDepth,
    rearStopFront = optics.rearStopFront,
    splitZ = l - 12.2,
    clockDegrees = guidedCameraClockDegrees(p),
    clockRadians = (clockDegrees * Math.PI) / 180,
    clockXY = (x: number, y: number): [number, number] => [
      x * Math.cos(clockRadians) - y * Math.sin(clockRadians),
      x * Math.sin(clockRadians) + y * Math.cos(clockRadians),
    ];
  if (Math.abs(front - rear - projection) > 1e-9)
    throw new Error('Shared optical pose no longer matches the selected source camera projection.');
  const localMouth: Vec = ov
    ? [...ov9281Interface.connector.mouth]
    : [
        n(cp, 'bodyWidth') / 2 - n(cp, 'rearConnectorRightInset') - n(cp, 'rearConnectorWidth') / 2,
        n(cp, 'bodyHeight') / 2 - n(cp, 'rearConnectorTopInset') - n(cp, 'rearConnectorHeight') / 2,
        -n(cp, 'rearConnectorProjection'),
      ];
  return {
    setup: ov ? 'ov9281' : 'camera-19',
    libraryId: source.id,
    presetId: preset.id,
    sourceParameters: { ...cp },
    pose: {
      translation: optics.translation,
      rotation: ov ? optics.rotation : ([0, 0, clockDegrees] as Vec),
    },
    clockDegrees,
    rear,
    bodyFront,
    lensFront: front,
    lensRadius,
    sleeveFront: optics.linerFront,
    splitZ,
    rearContactZ,
    rearPedestalFrontZ,
    rearChamberDepth,
    rearContactPoints: ov
      ? rearContactInterface.mountingHoles.map((hole) => ({
          x: -hole.x,
          y: -hole.y,
          z: rearContactZ,
          diameter: rearContactInterface.contactButtonDiameter,
        }))
      : [],
    rearStopFront,
    rearStopRear: optics.rearStopBack,
    tpuCompressionDepth: rearContactZ - rearStopFront,
    rearPedestalDepth: rearPedestalFrontZ - rearStopFront,
    usesSideScrews: !ov,
    rearContactBasis: ov
      ? 'Four outer PCB mounting annuli from the official rear photograph; pad OD and rear heights require fitting'
      : 'Source user-reference rear housing face',
    connector: {
      localMouth,
      mouth: [
        ov ? -localMouth[0] : clockXY(localMouth[0], localMouth[1])[0],
        ov ? -localMouth[1] : clockXY(localMouth[0], localMouth[1])[1],
        rear + localMouth[2],
      ] as Vec,
      exit: (ov ? [0, 1, 0] : [0, 0, -1]) as Vec,
      approach: (ov ? [0, -1, 0] : [0, 0, 1]) as Vec,
      widthAxis: (ov ? [-1, 0, 0] : [...clockXY(1, 0), 0]) as Vec,
    },
  };
}

/** Shared outside; source-specific internal forms do not change the common physical cage. */
function rearBlank(p: Parameters, clearance: number): Shape {
  const a = guidedCameraProfile(p),
    l = n(p, 'noseLength'),
    r = guidedCameraCommonInterface.bodyRadius + clearance;
  const silhouette: Shape = {
    kind: 'revolve',
    segments: 96,
    profile: [
      [0, a.rearStopFront],
      [r, a.rearStopFront],
      [r, l - 15],
      [guidedCameraCommonInterface.splitRadius + clearance, a.splitZ],
      [0, a.splitZ],
    ],
  };
  return intersect(
    silhouette,
    box(
      [30 + 2 * clearance, 29.7 + 2 * clearance, a.splitZ - a.rearStopFront],
      [-15 - clearance, -12.2 - clearance, a.rearStopFront],
    ),
  );
}

function linerCap(p: Parameters, clearance: number): Shape {
  const a = guidedCameraProfile(p),
    l = n(p, 'noseLength');
  return {
    kind: 'revolve',
    segments: 96,
    profile: [
      [0, a.splitZ],
      [guidedCameraCommonInterface.splitRadius + clearance, a.splitZ],
      [guidedCameraCommonInterface.shroudOuterRadius + clearance, l - 4],
      [guidedCameraCommonInterface.shroudOuterRadius + clearance, a.sleeveFront + clearance],
      [0, a.sleeveFront + clearance],
    ],
  };
}

/** Keep actual and lifted Ethernet service envelopes below the complete circular sleeve. */
function ethernetRelief(p: Parameters): Shape {
  const l = n(p, 'noseLength');
  return box([18.6, 30, l - 8 - 90], [-12.8, -39.45, 90]);
}

function originalMipiChannel(p: Parameters): Shape {
  const a = guidedCameraProfile({ ...p, cameraSetup: 'camera-19' });
  return guidedCameraClocked(
    box([18.2, 4.4, a.rear + 0.8 - (a.rearStopRear - 0.2)], [-8.1, 3.3, a.rearStopRear - 0.2]),
    p,
  );
}

function ovFfcChannel(p: Parameters): Shape {
  const a = guidedCameraProfile({ ...p, cameraSetup: 'ov9281' });
  return box([18.2, 12, a.rear + 5.2 - (a.rearStopRear - 0.2)], [-9.1, 11.9, a.rearStopRear - 0.2]);
}

/** Open toward +Z: place the rigid purchased camera, then close with its separate front liner. */
export function guidedCameraRearPocketShape(p: Parameters): Shape {
  const a = guidedCameraProfile(p),
    ov = a.setup === 'ov9281';
  const bodyVoid = ov
    ? box(
        [25.4, 24.26, a.splitZ + 0.3 - a.rearPedestalFrontZ],
        [-12.7, -9.06, a.rearPedestalFrontZ],
      )
    : box([19.4, 19.4, a.splitZ + 0.3 - a.rear], [-9.7, -9.7, a.rear]);
  const pocket = subtract(
    rearBlank(p, 0),
    bodyVoid,
    ethernetRelief(p),
    ov ? ovFfcChannel(p) : originalMipiChannel(p),
    ...(ov
      ? [
          // Open the sub-millimetre lower skin into the fitting cavity.
          box(
            [18.6, 30, a.splitZ + 0.2 - a.rearPedestalFrontZ],
            [-12.8, -39, a.rearPedestalFrontZ],
          ),
          // Above the final PCB, remove the taper's feathered +Y corner rims.
          box(
            [42, 20, a.splitZ + 0.2 - (n(p, 'noseLength') - 15)],
            [-21, 10.8, n(p, 'noseLength') - 15],
          ),
        ]
      : []),
    ...(!ov ? [guidedCameraClocked(cylinder(2.1, 32, [-16, 0, a.rear + 7.5], 'x'), p)] : []),
  );
  if (!ov) return pocket;
  return subtract(
    union(
      pocket,
      ...a.rearContactPoints.map(({ x, y, z, diameter }) =>
        union(
          // Solid buttons overlap the massive pedestal; only 3 mm is unsupported.
          cylinder(diameter / 2, z - a.rearPedestalFrontZ + 0.05, [
            x,
            y,
            a.rearPedestalFrontZ - 0.05,
          ]),
          cylinder(
            guidedCameraCommonInterface.ovRearLocatorDiameter / 2,
            guidedCameraCommonInterface.ovRearLocatorHeight + 0.02,
            [x, y, z - 0.02],
          ),
        ),
      ),
    ),
    guidedCsiReserve(p),
  );
}

/** Broad front compression ring, followed by a thick shroud around the actual objective. */
export function guidedCameraFrontLinerShape(p: Parameters): Shape {
  const a = guidedCameraProfile(p),
    ov = a.setup === 'ov9281',
    stub = ov
      ? box([25.2, 24.06, a.splitZ - a.bodyFront], [-12.6, -8.96, a.bodyFront])
      : box([19.2, 19.2, a.splitZ - a.bodyFront], [-9.6, -9.6, a.bodyFront]);
  const blank = union(
    linerCap(p, 0),
    intersect(
      stub,
      cylinder(guidedCameraCommonInterface.splitRadius, a.splitZ - a.bodyFront, [
        0,
        0,
        a.bodyFront,
      ]),
    ),
  );
  const lensCuts = ov
    ? [
        box([14.4, 14.4, 7.6], [-7.2, -7.2, a.bodyFront - 0.2]),
        cylinder(7.2, a.sleeveFront + 0.8 - (a.rear + 8.6), [0, 0, a.rear + 8.6]),
        box([18.2, 7.1, 3.6], [-9.1, 10.9, a.bodyFront - 0.2]),
        ovFfcChannel(p),
        // The 1.76 mm lower PCB-ring strip is an opening, not a functional lip.
        box([14.4, 22.8, a.splitZ - a.bodyFront + 0.2], [-7.2, -30, a.bodyFront - 0.2]),
      ]
    : [
        // The measured IMX577 front uses 0.1 mm total diametral fitting clearance.
        cylinder(
          a.lensRadius + (a.sourceParameters.lensProfile === 'stepped' ? 0.05 : 0.2),
          a.sleeveFront + 0.8 - (a.bodyFront - 0.2),
          [0, 0, a.bodyFront - 0.2],
        ),
        ...(a.sourceParameters.lensProfile === 'stepped'
          ? [
              cylinder(
                n(a.sourceParameters, 'lensCollarDiameter') / 2 + 0.1,
                n(a.sourceParameters, 'lensCollarHeight') + 0.3,
                [0, 0, a.bodyFront - 0.2],
              ),
            ]
          : []),
      ];
  return subtract(blank, ...lensCuts, ethernetRelief(p), ...(ov ? [guidedCsiReserve(p)] : []));
}

/** Union reserve is invariant between both camera selections; it preserves the Z112 bearing plane. */
export function guidedCameraMountEnvelope(p: Parameters, clearance = 0.2): Shape {
  return union(rearBlank(p, clearance), linerCap(p, clearance));
}

/** Common 4 mm rear bearing plate and broad side gussets, split with the existing cage halves. */
export function guidedCameraRearStopShape(
  p: Parameters,
  half: 'base' | 'cover' | 'complete' = 'complete',
): Shape {
  const a = guidedCameraProfile(p),
    stock = union(
      box([38, 29.5, 4], [-19, -9.45, a.rearStopRear]),
      box([4, 26, 12], [-19, -9, a.rearStopRear - 8]),
      box([4, 26, 12], [15, -9, a.rearStopRear - 8]),
    ),
    relieved = subtract(stock, originalMipiChannel(p), ovFfcChannel(p));
  if (half === 'complete') return relieved;
  return intersect(
    relieved,
    box([49.9, 100, 60], [half === 'base' ? -50 : 0.1, -50, a.rearStopRear - 20]),
  );
}

export const guidedCameraRequirements = [
  'One common PETG cage/shell accepts both source cameras through replaceable two-piece TPU cartridges. Both axes are centered and both objective fronts are Z=142 in the 140/98 execution.',
  'The rear cradle is open toward +Z. Place the actual camera rigidly into it, then place the separate front liner axially over the objective. Elastic insertion through an undersized closed pocket is not assumed.',
  'The common PETG rear shoe bears at Z112 with 4 mm plate stock and broad 4 mm side gussets. The original rear housing has 3 mm TPU compression stock. OV uses the massive pedestal Z112..120.2 and four solid 3 mm-long rear buttons ending on PCB mounting annuli at Z123.2.',
  'OV button diameter D3 comes from the registered authored rearContactInterface, not a published pad OD. A 3 mm rear chamber clears the rest of the populated back and both factory lens screwheads; actual component heights and pad dimensions remain fitting evidence. Never replace this relief with a whole-board compression pad.',
  'Original rear MIPI and rotated OV front FFC channels remain open. The negative-Y Ethernet relief is asymmetric and extends to Z132 for the side approach followed by 5 mm rearward seating.',
  'The original two M2.5 side screws retain their source compression tubes/washer planes at X=+/-15. OV retention uses its outline between formed rear and front TPU contacts; no invented threaded board holes are added.',
  'Add the rear shoe to both cage halves before their shared source-joint bore cuts, so the front cage bolt remains clear. The half selector leaves a 0.2 mm split; the complete stop is a geometric interface, not another opaque assembly occurrence.',
  'Native source fit, real contact areas, all six retention directions, rigid cartridge assembly, common-case insertion, final cable routes and print layers require integrated verification. Geometry and 250 m/s alone do not establish a pressure or flight rating.',
];
