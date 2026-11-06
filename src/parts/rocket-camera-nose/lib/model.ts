import { isGuided, guidedLayout, guidedOuterRadius, guidedEthernetReserve } from './guided-layout';
import { guidedPieces } from './guided';
import { guidedOpticalInterface } from './guided-optics';
import { guidedNoseProfile } from './guided-profile';
import { guidedShellAnchorDatums, guidedShellShape } from './guided-shell';
import { guidedCsiReserve } from './guided-routing';
import { Box3, Mesh, MeshStandardMaterial } from 'three';
import { disposeModel } from '../../../core/mechanical';
import { tpuCoordinates, tpuPieces, tpuHousingShape, initializeTPU } from './tpu';
import {
  structuralCoordinates,
  structuralCoordinatesFor,
  structuralBodyAnchorAngles,
  structuralPieces,
  structuralHousingShape,
} from './structural';
import { hasOV9281, opticalOuterRadius } from './optical-layout';
import ov9281 from '../../waveshare-ov9281-110/part';
import { csiRibbonReserve } from './csi';
import { printingLayout } from './print-layout';
export { csiCablePlan } from './csi';
import type { Parameters, PartDefinition, Preset } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { componentGeometry, componentPython } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { n } from '../../../core/geometry';
import {
  box,
  cylinder,
  subtract,
  union,
  prism,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import detail from '../../manufactured-detail/part';
import pi from '../../raspberry-pi/part';
import ups from '../../waveshare-ups-3s/part';
import adapter from '../../waveshare-pcie-m2-d/part';
import camera from '../../board-camera-19/part';
import dome from '../../optical-dome-window/part';
import cell from '../../li-ion-cell/part';
import ssd from '../../m2-ssd/part';
import gps from '../../gps-tracker/part';
import finder from '../../jhe42b-finder/part';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import nyloc from '../../nyloc-nut/part';
import spacer from '../../spacer/part';
import washerPart from '../../washer/part';
import rod from '../../threaded-rod/part';

type Vec = [number, number, number];
type PhysicalPiece = ConfiguredPiece & { fixed: boolean };
export const libraries = [
  detail,
  pi,
  ups,
  adapter,
  camera,
  ov9281,
  dome,
  cell,
  ssd,
  gps,
  finder,
  bolt,
  nut,
  nyloc,
  spacer,
  washerPart,
  rod,
];
export const piHoles = [-39, 19].flatMap((x) =>
  [-24.5, 24.5].map((y) => [x, y] as [number, number]),
);
export function layout(p: Parameters) {
  const guided = isGuided(p),
    g = guidedLayout(p);
  const coords = structuralCoordinatesFor(p);
  const structural = p.packaging === 'structural-ogive';
  const internalWindow = structural && !guided;
  const tpu = p.packaging === 'tpu-compact';
  const compact = p.packaging === 'sandwich' || tpu || structural;
  const noseLength = n(p, 'noseLength'),
    shoulderLength = n(p, 'shoulderLength');
  const shoulderOD = n(p, 'tubeID') - n(p, 'shoulderClearance');
  return {
    tpu,
    guided,
    structural,
    internalWindow,
    compact,
    packaging: structural
      ? 'structural-ogive'
      : tpu
        ? 'tpu-compact'
        : compact
          ? 'sandwich'
          : 'tandem',
    tubeOD: n(p, 'tubeOD'),
    tubeID: n(p, 'tubeID'),
    noseLength,
    shoulderLength,
    wall: n(p, 'wall'),
    shoulderOD,
    shoulderID: shoulderOD - (guided ? 4.8 : structural ? 6 : 2 * n(p, 'wall')),
    frontRadius: guided ? guidedOpticalInterface.apertureRadius : internalWindow ? 13.4 : 16,
    cameraZ: guided ? g.cameraRear : noseLength - (structural ? 25 : 28.5),
    rearZ: tpu || structural ? -shoulderLength : -shoulderLength - 3,
    frontFrameZ: tpu || structural ? 10 : 46,
    extraction: guided
      ? g.extraction
      : tpu || structural
        ? noseLength + 15
        : noseLength + shoulderLength + 50,
    pi: {
      translation: [
        guided
          ? g.pi.translation[0]
          : structural
            ? coords.piX
            : tpu
              ? tpuCoordinates.piX
              : compact
                ? -6
                : 12,
        guided ? g.pi.translation[1] : 0,
        guided ? g.pi.translation[2] : structural ? coords.piZ : tpu ? tpuCoordinates.piZ : -25,
      ] as Vec,
      rotation: guided ? g.pi.rotation : structural ? coords.piRotation : ([0, -90, 0] as Vec),
    },
    adapter: {
      translation: [
        guided
          ? g.adapter.translation[0]
          : structural
            ? coords.adapterX
            : tpu
              ? tpuCoordinates.adapterX
              : compact
                ? -28
                : -10,
        guided ? g.adapter.translation[1] : 0.25,
        guided
          ? g.adapter.translation[2]
          : structural
            ? coords.piZ
            : tpu
              ? tpuCoordinates.piZ
              : -25,
      ] as Vec,
      rotation: guided ? g.adapter.rotation : ([180, 90, 0] as Vec),
    },
    ups: {
      translation: [
        guided
          ? g.ups.translation[0]
          : structural
            ? coords.upsX
            : tpu
              ? tpuCoordinates.upsX
              : compact
                ? 14
                : -5,
        0,
        guided
          ? g.ups.translation[2]
          : structural
            ? coords.upsZ
            : tpu
              ? tpuCoordinates.upsZ
              : compact
                ? -29
                : -155,
      ] as Vec,
      rotation: [0, -90, 0] as Vec,
    },
    ethernet: {
      axis: [0, 0, 1] as Vec,
      faceZ: guided
        ? g.pi.translation[2] + 45.55
        : structural
          ? coords.piZ + 45.55
          : tpu
            ? 5.55
            : 20.55,
      origin: [
        guided
          ? g.pi.translation[0] - 17
          : structural
            ? coords.piX - 1
            : tpu
              ? tpuCoordinates.piX - 17
              : compact
                ? -23
                : -5,
        guided ? -29.75 : structural ? 7.75 : -27.75,
        guided ? g.pi.translation[2] + 45.55 : structural ? coords.piZ + 45.55 : tpu ? 5.55 : 20.55,
      ] as Vec,
      size: [18, 20, 35] as Vec,
    },
  };
}
export function outerRadius(p: Parameters, z: number): number {
  const a = layout(p);
  if (isGuided(p)) return guidedOuterRadius(p, z);
  if (hasOV9281(p)) return opticalOuterRadius(p, z);
  if (a.internalWindow) {
    const radius = a.tubeOD / 2,
      rise = radius - a.frontRadius,
      rho = (a.noseLength ** 2 + rise ** 2) / (2 * rise);
    return Math.sqrt(Math.max(0, rho ** 2 - z ** 2)) + radius - rho;
  }
  return (
    a.frontRadius +
    (a.tubeOD / 2 - a.frontRadius) * Math.sqrt(Math.max(0, 1 - (z / a.noseLength) ** 2))
  );
}
export function ethernetKeepout(p: Parameters): Shape {
  const e = layout(p).ethernet;
  return box(e.size, e.origin);
}
/** Continuous loose-flex routing reserve; actual connector bends remain camera-specific. */
export function csiRoutingReserve(p: Parameters): Shape {
  if (isGuided(p)) return guidedCsiReserve(p);
  if (layout(p).structural) {
    return csiRibbonReserve(p);
  }
  if (layout(p).tpu) {
    const cam = layout(p).cameraZ;
    // Keep the long flex close to the optical axis as the ogive narrows.
    if (layout(p).internalWindow)
      return union(
        box([11.5, 2, 84], [-20, -32, -40]),
        box([28, 37, 2], [-20, -32, 42]),
        box([16, 10, cam - 44], [-8, -5, 44]),
      );
    return union(
      box([11.5, 2, cam - 5 + 40], [-20, -32, -40]),
      box([28, 37, 2], [-20, -32, cam - 5]),
      box([16, 10, 5], [-8, -5, cam - 5]),
    );
  }
  const a = layout(p),
    x = a.compact ? 38 : 24;
  return union(
    box([3, 12, 127], [x, 8, -75]),
    box([x + 9, 12, 4], [-6, 8, 50]),
    box([12, 12, a.cameraZ - 66], [-6, 8, 54]),
    box([12, 25, 2], [-6, -5, a.cameraZ - 12]),
    box([16, 10, 10], [-8, -5, a.cameraZ - 10]),
  );
}
function railCenters(p: Parameters): [number, number][] {
  return p.packaging === 'sandwich'
    ? [
        [0, -42],
        [0, 42],
      ]
    : [
        [-32, 0],
        [32, 0],
      ];
}
const retentionCenters = (p: Parameters) =>
  (p.packaging === 'sandwich' ? [0, 120, 240] : [90, 210, 330]).map((degrees) => {
    const t = (degrees * Math.PI) / 180;
    return [36 * Math.cos(t), 36 * Math.sin(t)] as [number, number];
  });
function hexCut(x: number, y: number, z: number, across: number, height: number): Shape {
  const r = across / Math.sqrt(3);
  return prism(
    Array.from(
      { length: 6 },
      (_, i) =>
        [
          x + r * Math.cos(Math.PI / 6 + (i * Math.PI) / 3),
          y + r * Math.sin(Math.PI / 6 + (i * Math.PI) / 3),
        ] as [number, number],
    ),
    height,
    z,
  );
}
export function shellShape(p: Parameters): Shape {
  if (isGuided(p)) return guidedShellShape(p);
  if (layout(p).structural) return structuralHousingShape(p, outerRadius);
  if (layout(p).tpu) return tpuHousingShape(p, outerRadius);
  const a = layout(p),
    r = a.shoulderOD / 2,
    inner = r - a.wall;
  const outside: Array<[number, number]> = [
    [r, -a.shoulderLength],
    [r, 0],
  ];
  for (let i = 0; i <= 64; i++) {
    const z = (a.noseLength * i) / 64;
    outside.push([outerRadius(p, z), z]);
  }
  const inside: Array<[number, number]> = [
    [8.7, a.noseLength],
    [8.7, a.noseLength - 3],
  ];
  for (let i = 0; i <= 64; i++) {
    const z = a.noseLength - 3 - ((a.noseLength - 3 - a.wall) * i) / 64;
    inside.push([outerRadius(p, z) - a.wall, z]);
  }
  inside.push([inner, a.wall], [inner, -a.shoulderLength]);
  const shell: Shape = { kind: 'revolve', segments: 48, profile: [...outside, ...inside] };
  const bosses = retentionCenters(p).map(([x, y]) => {
    const theta = Math.atan2(y, x),
      rad = a.shoulderOD / 2 + 0.1;
    const points = [
      [34, -4.5],
      [rad, -4.5],
      [rad, 4.5],
      [34, 4.5],
    ].map(
      ([u, v]) =>
        [u * Math.cos(theta) - v * Math.sin(theta), u * Math.sin(theta) + v * Math.cos(theta)] as [
          number,
          number,
        ],
    );
    return union(
      cylinder(4.5, 12, [x, y, -a.shoulderLength]),
      prism(points, 12, -a.shoulderLength),
    );
  });
  return subtract(
    union(shell, {
      kind: 'intersect',
      children: [union(...bosses), cylinder(r, 12, [0, 0, -a.shoulderLength])],
    }),
    ...retentionCenters(p).flatMap(([x, y]) => [
      cylinder(1.7, 14, [x, y, -a.shoulderLength - 1]),
      hexCut(x, y, -a.shoulderLength + 9.6, 6, 3.4),
    ]),
    ...[0, 120, 240].map((deg) => {
      const t = (deg * Math.PI) / 180;
      return cylinder(1.1, 6, [13 * Math.cos(t), 13 * Math.sin(t), a.noseLength - 4]);
    }),
  );
}
function custom(
  id: string,
  name: string,
  shape: Shape,
  fixed = false,
  meshBackend: 'jscad' | 'manifold' = 'jscad',
): PhysicalPiece {
  const component = detailComponent(id, name, shape, {
    meshBackend,
    meshConform: false,
    nativeRefine: true,
  });
  component.manufacturing = {
    material: 'Project-selected structural polymer or qualified metal',
    blank: 'Authored local solid',
    processes: ['printing'],
    requirements: [
      'Specify material, tolerances, joint fits and qualified loads on the released drawing.',
    ],
  };
  component.notes = fixed ? 'Fixed housing group' : 'Removable cassette group';
  return {
    component,
    label: name,
    color: fixed ? 0xba643c : 0x7a98a5,
    requireSingleSolid: true,
    fixed,
  };
}
function occurrence(
  part: PartDefinition,
  id: string,
  name: string,
  parameters: Parameters,
  translation: Vec,
  rotation: Vec,
  fixed = false,
  preset?: Preset,
): PhysicalPiece {
  const supply = part.product.supply;
  const component: AssemblyComponent = {
    id,
    name,
    libraryId: part.id,
    parameters,
    state: part.states?.[0]?.id ?? 'default',
    quantity: 1,
    supply,
    placement: { translation, rotation },
    notes: fixed ? 'Fixed housing group' : 'Removable cassette group',
  };
  if (preset) component.presetId = preset.id;
  if (supply === 'manufactured')
    component.manufacturing = {
      material: 'Project-selected spacer stock',
      blank: 'Cut and finish round stock to the configured length',
      processes: part.product.processes,
      requirements: ['Specify actual material, bore fit, end-face tolerance and deburring.'],
    };
  component.procurement = {
    designation: preset?.catalog?.designation ?? name,
    manufacturer: preset?.catalog?.manufacturer ?? 'Select actual supplier execution',
    source:
      preset?.catalog?.sourceUrl ??
      part.sources?.[0]?.url ??
      'Dimensionally configured library reference; select actual source',
  };
  return { component, label: name, color: 0x9ba5ad, preserveLibraryAppearance: true, fixed };
}
function catalogBolt(d: number, l: number): Preset {
  const found = bolt.presets.find(
    (s) =>
      +s.parameters.diameter === d &&
      +s.parameters.length === l &&
      s.parameters.head === 'socket-cap',
  );
  if (!found) throw new Error(`No library socket screw M${d} x ${l}.`);
  return found;
}
function screw(
  id: string,
  d: number,
  l: number,
  bearing: Vec,
  axis: 'x' | '-x' | 'y' | '-y' | 'z' | '-z',
  fixed = false,
): PhysicalPiece {
  const selected = catalogBolt(d, l),
    h = +selected.parameters.headHeight,
    offset = (l - h) / 2;
  const direction: Vec =
    axis === 'x'
      ? [1, 0, 0]
      : axis === '-x'
        ? [-1, 0, 0]
        : axis === 'y'
          ? [0, 1, 0]
          : axis === '-y'
            ? [0, -1, 0]
            : axis === 'z'
              ? [0, 0, 1]
              : [0, 0, -1];
  const rotation: Vec =
    axis === 'x'
      ? [0, 90, 0]
      : axis === '-x'
        ? [0, -90, 0]
        : axis === 'y'
          ? [-90, 0, 0]
          : axis === '-y'
            ? [90, 0, 0]
            : axis === 'z'
              ? [0, 0, 0]
              : [180, 0, 0];
  return occurrence(
    bolt,
    id,
    `M${d} x ${l} socket screw`,
    { ...selected.parameters },
    bearing.map((v, i) => v - direction[i] * offset) as Vec,
    rotation,
    fixed,
    selected,
  );
}
function hexNut(
  id: string,
  d: number,
  center: Vec,
  axis: 'x' | 'y' | 'z' = 'z',
  fixed = false,
): PhysicalPiece {
  const selected = nut.presets.find((s) => +s.parameters.bore === d);
  if (!selected) throw new Error('Missing metric nut.');
  return occurrence(
    nut,
    id,
    `M${d} hex nut`,
    { ...selected.parameters },
    center.map(
      (v, i) =>
        v -
        ((axis === 'x' ? i === 0 : axis === 'y' ? i === 1 : i === 2)
          ? +selected.parameters.height / 2
          : 0),
    ) as Vec,
    axis === 'x' ? [0, 90, 0] : axis === 'y' ? [-90, 0, 0] : [0, 0, 0],
    fixed,
    selected,
  );
}
function lockNut(
  id: string,
  d: number,
  center: Vec,
  axis: 'x' | '-x' | 'y' | '-y' | 'z' = 'z',
  fixed = false,
): PhysicalPiece {
  const selected = nyloc.presets.find((s) => +s.parameters.bore === d);
  if (!selected) throw new Error(`Missing nylon-insert locknut M${d}.`);
  const direction: Vec =
    axis === 'z'
      ? [0, 0, 1]
      : axis === 'x'
        ? [1, 0, 0]
        : axis === '-x'
          ? [-1, 0, 0]
          : axis === 'y'
            ? [0, 1, 0]
            : [0, -1, 0];
  return occurrence(
    nyloc,
    id,
    `M${d} DIN 985 nylon-insert locknut`,
    { ...selected.parameters },
    center.map((v, i) => v - (direction[i] * +selected.parameters.height) / 2) as Vec,
    axis === 'z'
      ? [0, 0, 0]
      : axis === 'x'
        ? [0, 90, 0]
        : axis === '-x'
          ? [0, -90, 0]
          : axis === 'y'
            ? [-90, 0, 0]
            : [90, 0, 0],
    fixed,
    selected,
  );
}
function washer(
  id: string,
  d: number,
  bore: number,
  thickness: number,
  center: Vec,
  axis: 'x' | 'y' | 'z' = 'z',
): PhysicalPiece {
  return occurrence(
    washerPart,
    id,
    `D${d} / D${bore} x ${thickness} pressure washer`,
    { outerDiameter: d, bore, thickness },
    center,
    axis === 'x' ? [0, 90, 0] : axis === 'y' ? [-90, 0, 0] : [0, 0, 0],
  );
}
function sleeve(
  id: string,
  d: number,
  bore: number,
  length: number,
  center: Vec,
  axis: 'x' | 'y' | 'z' = 'z',
): PhysicalPiece {
  return occurrence(
    spacer,
    id,
    `D${d} / D${bore} x ${length.toFixed(3)} spacer`,
    { outerDiameter: d, bore, length },
    center,
    axis === 'x' ? [0, 90, 0] : axis === 'y' ? [-90, 0, 0] : [0, 0, 0],
  );
}
function tieRod(id: string, d: number, length: number, center: Vec): PhysicalPiece {
  return occurrence(
    rod,
    id,
    `M${d} cut-to-length tie rod`,
    {
      diameter: d,
      length,
      pitch: d === 3 ? 0.5 : 0.7,
      handedness: 'right',
      threadMode: 'envelope',
    },
    center,
    [0, 0, 0],
  );
}
function bodyAnchorScrews(p: Parameters): PhysicalPiece[] {
  const a = layout(p),
    items: PhysicalPiece[] = [];
  const anchors = a.guided
    ? guidedShellAnchorDatums
    : structuralBodyAnchorAngles.map((angle) => ({ id: `body-anchor-${angle}`, angle, z: -20 }));
  for (const anchor of anchors) {
    const { id, angle, z: level } = anchor;
    const item = screw(
      id.replace('body-anchor-', 'body-anchor-screw-'),
      4,
      a.guided ? (angle === 0 ? 18 : 25) : 12,
      [a.tubeOD / 2, 0, level],
      'x',
    );
    const t = (angle * Math.PI) / 180;
    const [x, y, z] = item.component.placement.translation;
    item.component.placement.translation = [
      x * Math.cos(t) - y * Math.sin(t),
      x * Math.sin(t) + y * Math.cos(t),
      z,
    ];
    item.component.placement.rotation[2] = angle;
    item.component.notes =
      'Install radially through the mating tube after seating the cassette; remove body anchors before withdrawing the cassette from the tube.';
    items.push(item);
  }
  return items;
}
let anchorBoundsCache:
  { key: string; xMin: number; xMax: number; yMin: number; yMax: number } | undefined;
function bodyAnchorBounds(p: Parameters) {
  const key = JSON.stringify([n(p, 'tubeOD'), isGuided(p)]);
  if (!anchorBoundsCache || anchorBoundsCache.key !== key) {
    const model = componentGeometry(libraries, bodyAnchorScrews(p), true);
    try {
      model.updateMatrixWorld(true);
      const b = new Box3().setFromObject(model, true);
      anchorBoundsCache = { key, xMin: b.min.x, xMax: b.max.x, yMin: b.min.y, yMax: b.max.y };
    } finally {
      disposeModel(model);
    }
  }
  return anchorBoundsCache;
}
function rawPieces(p: Parameters): PhysicalPiece[] {
  const a = layout(p),
    items: PhysicalPiece[] = [];
  if (a.guided) {
    const pieces = guidedPieces(p, {
      custom,
      occurrence,
      screw,
      hexNut,
      lockNut,
      washer,
      sleeve,
      outerRadius,
    });
    const anchors = bodyAnchorScrews(p);
    for (const item of anchors) {
      item.fixed = true;
      item.component.notes =
        'Shared tube/case/cage pin; remove before withdrawing the prewired cassette.';
    }
    return [...pieces, ...anchors];
  }
  if (a.structural) {
    const items = structuralPieces(p, {
      custom,
      occurrence,
      screw,
      hexNut,
      lockNut,
      washer,
      sleeve,
      outerRadius,
    });
    items.push(...bodyAnchorScrews(p));
    return items;
  }
  if (a.tpu)
    return tpuPieces(p, {
      custom,
      occurrence,
      screw,
      hexNut,
      lockNut,
      washer,
      sleeve,
      outerRadius,
    });
  items.push(custom('nose-shell', 'Windowed deep-seat nose housing', shellShape(p), true));
  const bezel = union({
    kind: 'revolve',
    segments: 96,
    profile: [
      [12, 0],
      [16, 0],
      [16, 3],
      [8.75, 3],
      [8.75, 1],
      [12, 1],
    ],
  } as Shape);
  const bezelShape = subtract(
    bezel,
    ...[0, 120, 240].map((deg) => {
      const t = (deg * Math.PI) / 180;
      return cylinder(1.1, 5, [13 * Math.cos(t), 13 * Math.sin(t), -1]);
    }),
  );
  const bezelPiece = custom('window-retainer', 'Optical window retaining bezel', bezelShape, true);
  bezelPiece.component.placement.translation = [0, 0, a.noseLength];
  items.push(bezelPiece);
  items.push(
    occurrence(
      dome,
      'optical-window',
      'D23 / D17 optical dome window',
      { ...dome.defaults },
      [0, 0, a.noseLength],
      [0, 0, 0],
      true,
    ),
  );
  for (const [i, deg] of [0, 120, 240].entries()) {
    const t = (deg * Math.PI) / 180,
      x = 13 * Math.cos(t),
      y = 13 * Math.sin(t);
    items.push(
      screw(`window-screw-${i}`, 2, 8, [x, y, a.noseLength + 3], 'z', true),
      hexNut(`window-nut-${i}`, 2, [x, y, a.noseLength - 3.8], 'z', true),
    );
  }
  const rearPlate = subtract(
    cylinder((a.tubeID - 0.6) / 2, 3, [0, 0, a.rearZ]),
    cylinder(9, 5, [0, 0, a.rearZ - 1]),
    ...railCenters(p).map(([x, y]) => cylinder(2.25, 5, [x, y, a.rearZ - 1])),
    ...retentionCenters(p).map(([x, y]) => cylinder(1.7, 5, [x, y, a.rearZ - 1])),
  );
  items.push(custom('carrier-rear-bulkhead', 'Removable cassette rear bulkhead', rearPlate));
  for (const [i, [x, y]] of retentionCenters(p).entries())
    items.push(
      screw(`cassette-lock-screw-${i}`, 3, 16, [x, y, a.rearZ], '-z'),
      hexNut(`cassette-lock-nut-${i}`, 3, [x, y, -a.shoulderLength + 10.8], 'z', true),
    );
  const frontFrame = subtract(
    cylinder(a.compact ? 47.5 : 37.5, 4, [0, 0, 46]),
    cylinder(8, 6, [0, 0, 45]),
    ethernetKeepout(p),
    csiRoutingReserve(p),
    ...railCenters(p).map(([x, y]) => cylinder(2.25, 6, [x, y, 45])),
    ...[-13, 13].map((x) => cylinder(1.7, 6, [x, 0, 45])),
  );
  items.push(
    custom('carrier-front-frame', 'Cassette forward frame with Ethernet opening', frontFrame),
  );
  for (const x of [-32, 32]) {
    const id = x < 0 ? 'left' : 'right',
      start = a.rearZ - 4,
      end = 54;
    items.push(
      tieRod(`carrier-main-rod-${id}`, 4, end - start, [x, 0, (start + end) / 2]),
      hexNut(`carrier-rod-rear-nut-${id}`, 4, [x, 0, a.rearZ - 1.6]),
      hexNut(`carrier-rod-front-nut-${id}`, 4, [x, 0, 51.6]),
    );
  }
  const piFrame = subtract(
    union(
      box([3, 56, 66], [18, -28, -68]),
      ...[-64, -6].map((z) => box([17, 8, 6], [18, -4, z - 3])),
    ),
    box([5, 38, 40], [17, -19, -55]),
    ...piHoles.map(([x, y]) => cylinder(1.4, 5, [17, y, x - 25], 'x')),
    ...[-64, -6].map((z) => cylinder(2.25, 8, [32, 0, z - 4])),
  );
  items.push(custom('carrier-pi-frame', 'Pi and NVMe cassette mounting frame', piFrame));
  items.push(
    occurrence(
      pi,
      'pi5',
      'Raspberry Pi 5',
      { model: 'raspberry-pi-5', detail: 'lightweight' },
      [12, 0, -25],
      [0, -90, 0],
    ),
  );
  items.push(
    occurrence(
      adapter,
      'nvme-adapter',
      'Waveshare PCIe TO M.2 Board (D)',
      { ...adapter.defaults },
      [-10, 0.25, -25],
      [180, 90, 0],
    ),
  );
  items.push(
    occurrence(
      ssd,
      'nvme-ssd',
      'M.2 2280 NVMe module',
      { format: '2280' },
      [-14, -9.7, -22.5],
      [180, 90, 0],
    ),
  );
  items.push(
    sleeve('ssd-screw-washer', 4, 2.2, 1, [-15.5, -9.7, 17.5], 'x'),
    screw('ssd-retention-screw', 2, 4, [-16, -9.7, 17.5], '-x'),
  );
  for (const [i, [x, y]] of piHoles.entries()) {
    const z = x - 25;
    items.push(
      sleeve(`pi-frame-spacer-${i}`, 6, 2.8, 6.03, [14.985, y, z], 'x'),
      sleeve(`pi-adapter-spacer-${i}`, 6, 2.8, 20.694, [0.347, y, z], 'x'),
      screw(`pi-stack-screw-${i}`, 2.5, 40, [21, y, z], 'x'),
      hexNut(`pi-stack-nut-${i}`, 2.5, [-12.6, y, z], 'x'),
    );
  }
  for (const z of [-64, -6])
    for (const sign of [-1, 1])
      items.push(hexNut(`pi-frame-rail-nut-${z}-${sign}`, 4, [32, 0, z + sign * 4.6]));
  const upsFrame = subtract(
    union(
      box([3, 56, 94], [-17, -28, -202]),
      ...[-198, -112].map((z) => box([18, 8, 6], [-35, -4, z - 3])),
    ),
    box([5, 38, 64], [-18, -19, -187]),
    ...[-43, 43].flatMap((x) => [-23, 23].map((y) => cylinder(1.7, 5, [-18, y, -155 + x], 'x'))),
    ...[-198, -112].map((z) => cylinder(2.25, 8, [-32, 0, z - 4])),
  );
  items.push(custom('carrier-ups-frame', 'UPS battery-section mounting frame', upsFrame));
  items.push(
    occurrence(
      ups,
      'ups3s',
      'Waveshare UPS Module 3S',
      { ...ups.defaults },
      [-5, 0, -155],
      [0, -90, 0],
    ),
  );
  for (const [i, y] of [-19.5, 0, 19.5].entries())
    items.push(
      occurrence(
        cell,
        `ups-cell-${i}`,
        'Molicel P28A 18650 cell',
        { model: 'molicel-p28a' },
        [6.4, y, -187.6],
        [0, 0, 0],
      ),
    );
  for (const [i, x] of [-43, 43].entries())
    for (const [j, y] of [-23, 23].entries()) {
      const z = -155 + x,
        id = `${i}-${j}`;
      items.push(
        sleeve(`ups-frame-spacer-${id}`, 6, 3.4, 7.4, [-10.3, y, z], 'x'),
        screw(`ups-mount-screw-${id}`, 3, 16, [-5, y, z], 'x'),
        hexNut(`ups-mount-nut-${id}`, 3, [-18.2, y, z], 'x'),
      );
    }
  for (const z of [-198, -112])
    for (const sign of [-1, 1])
      items.push(hexNut(`ups-frame-rail-nut-${z}-${sign}`, 4, [-32, 0, z + sign * 4.6]));
  // The long camera support is entirely ahead of the computer and its Ethernet corridor.
  for (const x of [-13, 13]) {
    const id = x < 0 ? 'left' : 'right',
      bottom = 50,
      top = a.cameraZ - 2;
    items.push(
      custom(
        `camera-tower-tube-${id}`,
        `Camera support tube ${id}`,
        subtract(
          cylinder(3, top - bottom, [x, 0, bottom]),
          cylinder(1.7, top - bottom + 2, [x, 0, bottom - 1]),
        ),
      ),
    );
    const start = 42,
      end = a.cameraZ + 3;
    items.push(
      tieRod(`camera-tower-rod-${id}`, 3, end - start, [x, 0, (start + end) / 2]),
      hexNut(`camera-tower-bottom-nut-${id}`, 3, [x, 0, 44.8]),
      hexNut(`camera-tower-top-nut-${id}`, 3, [x, 0, a.cameraZ + 1.2]),
    );
  }
  const cage = subtract(
    union(
      box([28, 28, 12], [-14, -14, a.cameraZ]),
      box([28, 28, 2], [-14, -14, a.cameraZ + 12]),
      box([34, 28, 2], [-17, -14, a.cameraZ - 2]),
    ),
    box([19, 19, 12.1], [-9.5, -9.5, a.cameraZ - 0.05]),
    cylinder(6.2, 3, [0, 0, a.cameraZ + 11.5]),
    box([16, 16, 4], [-8, -8, a.cameraZ - 3]),
    ...[-13, 13].flatMap((x) => [
      cylinder(1.7, 8, [x, 0, a.cameraZ - 3]),
      cylinder(3.3, 4, [x, 0, a.cameraZ]),
    ]),
    ...[-11.5, 11.5].map((y) => cylinder(1.1, 36, [-18, y, a.cameraZ + 6], 'x')),
  );
  for (const side of [-1, 1]) {
    const half = subtract(
      cage,
      side < 0
        ? box([30, 40, 20], [-0.15, -20, a.cameraZ - 3])
        : box([30, 40, 20], [-29.85, -20, a.cameraZ - 3]),
    );
    items.push(
      custom(
        `camera-clamp-${side < 0 ? 'left' : 'right'}`,
        `Split camera body clamp ${side < 0 ? 'left' : 'right'}`,
        half,
      ),
    );
  }
  for (const [i, y] of [-11.5, 11.5].entries())
    items.push(
      screw(`camera-clamp-screw-${i}`, 2, 30, [14, y, a.cameraZ + 6], 'x'),
      hexNut(`camera-clamp-nut-${i}`, 2, [-14.8, y, a.cameraZ + 6], 'x'),
    );
  items.push(
    occurrence(
      camera,
      'csi-camera',
      '19 mm CSI camera body',
      { ...camera.defaults },
      [0, 0, a.cameraZ],
      [0, 0, 0],
    ),
  );
  if (a.compact) {
    const removed = new Set(['carrier-pi-frame', 'carrier-ups-frame']);
    const compactItems = items.filter(
      (piece) =>
        !removed.has(piece.component.id) &&
        !piece.component.id.startsWith('pi-frame-rail-nut-') &&
        !piece.component.id.startsWith('ups-frame-rail-nut-'),
    );
    for (const piece of compactItems) {
      const id = piece.component.id,
        t = piece.component.placement.translation;
      const piGroup =
        id === 'pi5' ||
        id === 'nvme-adapter' ||
        id === 'nvme-ssd' ||
        id.startsWith('ssd-') ||
        id.startsWith('pi-frame-spacer-') ||
        id.startsWith('pi-adapter-spacer-') ||
        id.startsWith('pi-stack-');
      const upsGroup =
        id === 'ups3s' ||
        id.startsWith('ups-cell-') ||
        id.startsWith('ups-frame-spacer-') ||
        id.startsWith('ups-mount-');
      if (piGroup) t[0] -= 18;
      if (upsGroup) {
        t[0] += 19;
        t[2] += 126;
      }
      if (id.startsWith('pi-stack-screw-')) t[0] += 3;
      if (id.startsWith('pi-frame-spacer-')) {
        piece.component.parameters.length = 2.03;
        t[0] = -5.015;
      }
      if (id.startsWith('ups-frame-spacer-')) {
        piece.component.parameters.length = 6.4;
        t[0] = 9.2;
      }
      if (id.startsWith('ups-mount-nut-')) t[0] = -2.4;
      if (
        id.startsWith('carrier-main-rod-') ||
        id.startsWith('carrier-rod-rear-nut-') ||
        id.startsWith('carrier-rod-front-nut-')
      ) {
        t[0] = 0;
        t[1] = id.endsWith('left') ? -42 : 42;
      }
    }
    const lugs = [-64, -6].flatMap((z) =>
      [-1, 1].map((sign) => box([10, 22, 6], [-4, sign > 0 ? 24 : -46, z - 3])),
    );
    const frame = subtract(
      union(box([6, 56, 102], [0, -28, -76]), ...lugs),
      box([8, 36, 68], [-1, -18, -58]),
      ...piHoles.map(([x, y]) => cylinder(1.4, 12, [-5, y, x - 25], 'x')),
      ...[-43, 43].flatMap((x) => [-23, 23].map((y) => cylinder(1.7, 8, [-1, y, x - 29], 'x'))),
      ...[-64, -6].flatMap((z) => [-42, 42].map((y) => cylinder(2.25, 8, [0, y, z - 4]))),
    );
    compactItems.push(
      custom('carrier-combined-frame', 'Compact shared Pi and UPS mounting frame', frame),
    );
    for (const z of [-64, -6])
      for (const y of [-42, 42])
        for (const sign of [-1, 1])
          compactItems.push(
            hexNut(`compact-frame-rail-nut-${z}-${y}-${sign}`, 4, [0, y, z + sign * 4.6]),
          );
    return compactItems;
  }
  return items;
}
export function configuredPieces(p: Parameters, state = 'assembled'): ConfiguredPiece[] {
  if (state === 'print-layout')
    return printingLayout(libraries, rawPieces(p), JSON.stringify(p)).pieces;
  const a = layout(p);
  return rawPieces(p).map((piece) => {
    if (a.guided && state === 'extracted' && piece.component.id.startsWith('body-anchor-screw-')) {
      const side = piece.component.placement.translation[0] > 0 ? 1 : -1;
      return { ...piece, position: [side * 30, 0, 0] };
    }
    if (a.structural && state === 'extracted' && piece.component.id === 'cassette-lock-screw')
      return { ...piece, position: [12, 0, 0] };
    if (state === 'extracted' && !piece.fixed) return { ...piece, position: [0, 0, -a.extraction] };
    if (state === 'cutaway' && piece.fixed) return { ...piece, position: [a.tubeOD + 20, 0, 0] };
    return piece;
  });
}
export function serviceKeepout(p: Parameters): { shape: Shape; componentIds: string[] } {
  const a = layout(p),
    e = a.ethernet;
  return {
    shape: box(e.size, [e.origin[0], e.origin[1], e.origin[2] - a.extraction]),
    componentIds: rawPieces(p)
      .filter(
        (piece) =>
          (!piece.fixed || (a.structural && piece.component.id === 'cassette-lock-screw')) &&
          piece.component.id !== 'pi5',
      )
      .map((piece) => piece.component.id),
  };
}
export function geometry(p: Parameters, s: string, nominal = false) {
  const model = componentGeometry(libraries, configuredPieces(p, s), nominal);
  if (layout(p).tpu || layout(p).structural)
    for (const child of model.children)
      if (
        child.name === 'One-piece TPU insert and camera carrier' ||
        child.name === 'Conformal PETG load frame'
      )
        child.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            if (material instanceof MeshStandardMaterial) {
              material.metalness = 0;
              material.roughness = 0.85;
              if (s === 'cutaway' && !nominal) {
                material.transparent = true;
                material.opacity = layout(p).structural ? 0.6 : 0.28;
                material.depthWrite = false;
              }
            }
        });
  return model;
}
export async function initializeGeometry(p: Parameters): Promise<void> {
  if (layout(p).tpu || layout(p).structural) await initializeTPU();
}
/** Envelope extrema are the circular shell, rear flange, tie-rod ends and window crown.
 * Avoid rebuilding every Boolean mesh just to report those known datums. */
export function dimensions(p: Parameters, s: string): [number, number, number] {
  if (s === 'print-layout')
    return printingLayout(libraries, rawPieces(p), JSON.stringify(p)).dimensions;
  const a = layout(p);
  if (a.guided) {
    const anchors = bodyAnchorBounds(p),
      l = guidedNoseProfile(p).tipZ + a.shoulderLength,
      ySpan = Math.max(a.tubeOD / 2, anchors.yMax) - Math.min(-a.tubeOD / 2, anchors.yMin);
    if (s === 'cutaway') {
      // The captured rear plate defines the cassette's leftmost material.
      const rearPlate = rawPieces(p).find((piece) => piece.component.id === 'rear-retainer')!;
      const model = componentGeometry(libraries, [rearPlate]);
      try {
        model.updateMatrixWorld(true);
        const minimumX = new Box3().setFromObject(model, true).min.x;
        return [a.tubeOD + 20 + anchors.xMax - minimumX, ySpan, l];
      } finally {
        disposeModel(model);
      }
    }
    if (s === 'extracted') return [anchors.xMax - anchors.xMin + 60, ySpan, l + a.extraction];
    return [anchors.xMax - anchors.xMin, ySpan, l];
  }
  if (a.structural) {
    const anchors = bodyAnchorBounds(p);
    const ySpan = Math.max(anchors.yMax, a.tubeOD / 2) - Math.min(anchors.yMin, -a.tubeOD / 2);
    const lockHeadX = 45 + a.shoulderOD / 2 - 42.8;
    if (s === 'cutaway')
      return [
        a.tubeOD + 20 + Math.max(a.tubeOD / 2, lockHeadX) - anchors.xMin,
        ySpan,
        a.noseLength + a.shoulderLength + 6,
      ];
    if (s === 'extracted')
      return [
        Math.max(anchors.xMax, lockHeadX + 12) - anchors.xMin,
        ySpan,
        a.noseLength + a.shoulderLength + 6 + a.extraction,
      ];
    return [anchors.xMax - anchors.xMin, ySpan, a.noseLength + a.shoulderLength + 6];
  }
  if (a.tpu || a.structural) {
    if (a.structural && s === 'extracted')
      return [a.tubeOD + 12, a.tubeOD + 8.4, a.noseLength + a.shoulderLength + 6 + a.extraction];
    if (s === 'cutaway')
      return [
        1.5 * a.tubeOD + 20 + a.shoulderOD / 2,
        a.tubeOD + (a.structural ? 8.4 : 0),
        a.noseLength + a.shoulderLength + 6,
      ];
    return [
      a.tubeOD + (a.structural ? 4.2 : 0),
      a.tubeOD + (a.structural ? 8.4 : 0),
      a.noseLength + a.shoulderLength + 6 + (s === 'extracted' ? a.extraction : 0),
    ];
  }
  if (s === 'cutaway')
    return [
      1.5 * a.tubeOD + 20 + (a.tubeID - 0.6) / 2,
      a.tubeOD,
      a.noseLength + a.shoulderLength + 13,
    ];
  if (s === 'extracted') return [a.tubeOD, a.tubeOD, 2 * a.noseLength + 2 * a.shoulderLength + 63];
  return [a.tubeOD, a.tubeOD, a.noseLength + a.shoulderLength + 13];
}
export const python = (p: Parameters, s: string) =>
  componentPython(libraries, configuredPieces(p, s === 'cutaway' ? 'assembled' : s));

export function shoulderFit(p: Parameters): { shape: Shape; componentIds: string[] } {
  const a = layout(p);
  return {
    shape: cylinder(a.shoulderID / 2, a.shoulderLength, [0, 0, -a.shoulderLength]),
    componentIds: rawPieces(p)
      .filter(
        (piece) =>
          !piece.fixed &&
          !['tpu-carrier', 'load-frame', 'cassette-lock-screw'].includes(piece.component.id) &&
          !piece.component.id.startsWith('body-anchor-screw-') &&
          // The separate rear closure and its fixings seat across the barrel wall.
          // They are checked against the actual tube bore with the load frame.
          piece.component.id !== 'rear-retainer' &&
          !piece.component.id.startsWith('rear-retainer-') &&
          piece.component.id !== 'rear-cap' &&
          !piece.component.id.startsWith('rear-cap-'),
      )
      .map((piece) => piece.component.id),
  };
}
