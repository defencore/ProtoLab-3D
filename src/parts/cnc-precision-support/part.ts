import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { box, cylinder, subtract, union, type Shape } from '../../core/assembly/boundary/shapes';
import { geometry, python, type Piece } from '../../core/assembly/boundary/assembly';
import { currentGeometryMode } from '../../core/geometry-mode';
import product from './product.json';
import presets from './presets.json';
export type PrecisionSupportModel = 'bk20-c3' | 'bf20-c3' | 'bk15-c3' | 'bf15-c3';
export const precisionSupportSource =
  'https://www.hiwin.com/wp-content/uploads/HIWIN-Ballscrew-Supports-Catalog.pdf';
export function precisionSupportParameters(model: PrecisionSupportModel = 'bk20-c3'): Parameters {
  return { model };
}
export function precisionSupportLayout(p: Parameters) {
  const large = String(p.model).includes('20'),
    fixed = String(p.model).startsWith('bk');
  const bodyLength = large ? (fixed ? 35 : 26) : fixed ? 27 : 20,
    bearingWidth = large ? 12 : 9;
  return {
    model: p.model as PrecisionSupportModel,
    fixed,
    shaftDiameter: large ? 20 : 15,
    bodyLength,
    width: large ? 88 : 70,
    height: large ? 60 : 48,
    bottom: large ? -34 : -28,
    top: large ? 26 : 20,
    wingTop: large ? 16 : 10,
    towerWidth: large ? 52 : 40,
    mountingPitchX: fixed ? (large ? 19 : 15) : 0,
    mountingPitchY: large ? 70 : 54,
    mountBore: large ? 9 : 6.6,
    counterbore: large ? 14 : 11,
    counterboreDepth: large ? 8.5 : 6.5,
    transverseBore: large ? 6.6 : 5.5,
    transversePitchZ: large ? 22 : 18,
    bearingDiameter: large ? 42 : 32,
    bearingWidth,
    bearingCount: fixed ? 2 : 1,
    collarDiameter: large ? 25.5 : 19.7,
    collarLength: large ? 8 : 6,
    shoulderContact: fixed ? bodyLength / 2 : -bearingWidth / 2,
    journalLength: fixed ? (large ? 53 : 40) : large ? 16 : 13,
    retentionLength: large ? 15 : 12,
    locknutLength: large ? 11 : 8,
    locknutOutside: large ? 35 : 25,
    locknutAF: large ? 30 : 22,
    bearingModel: fixed ? (large ? '7004A' : '7002A') : large ? '6004ZZ' : '6002ZZ',
    sourceMassKg: large ? (fixed ? 1.3 : 0.77) : fixed ? 0.6 : 0.4,
  };
}
export function precisionSupportMountingHoles(p: Parameters): [number, number, number][] {
  const v = precisionSupportLayout(p);
  return (v.fixed ? [-1, 1] : [0]).flatMap((x) =>
    [-1, 1].map(
      (y) =>
        [(x * v.mountingPitchX) / 2, (y * v.mountingPitchY) / 2, v.bottom] as [
          number,
          number,
          number,
        ],
    ),
  );
}
function annulus(outer: number, inner: number, start: number, length: number): Shape {
  return subtract(
    cylinder(outer / 2, length, [start, 0, 0], 'x'),
    cylinder(inner / 2, length + 2, [start - 1, 0, 0], 'x'),
  );
}
function bearingPieces(
  v: ReturnType<typeof precisionSupportLayout>,
  start: number,
  index: number,
): Piece[] {
  if (currentGeometryMode() === 'simple')
    return [
      {
        label: `${v.bearingModel} source bearing envelope${index}`,
        color: 0xb4bdc4,
        shape: annulus(v.bearingDiameter, v.shaftDiameter, start, v.bearingWidth),
      },
    ];
  const track = (v.shaftDiameter + v.bearingDiameter) / 4,
    ball = (v.bearingDiameter - v.shaftDiameter) / 10;
  const groove: Shape = {
    kind: 'transform',
    translation: [start + v.bearingWidth / 2, 0, 0],
    rotation: [0, 90, 0],
    child: { kind: 'torus', major: track, minor: ball + 0.05, origin: [0, 0, 0] },
  };
  const out: Piece[] = [
    {
      label: `${v.bearingModel} inner race${index}; internal profile illustrative`,
      color: 0xb7c0c8,
      shape: subtract(annulus((track - 1) * 2, v.shaftDiameter, start, v.bearingWidth), groove),
    },
    {
      label: `${v.bearingModel} outer race${index}; internal profile illustrative`,
      color: 0xaab4bc,
      shape: subtract(annulus(v.bearingDiameter, (track + 1) * 2, start, v.bearingWidth), groove),
    },
  ];
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    out.push({
      label: `Bearing${index} illustrative ball${i + 1}`,
      color: 0xc9d0d5,
      shape: {
        kind: 'sphere',
        radius: ball,
        origin: [start + v.bearingWidth / 2, track * Math.cos(a), track * Math.sin(a)],
      },
    });
  }
  return out;
}
function pieces(p: Parameters): Piece[] {
  const v = precisionSupportLayout(p),
    x = -v.bodyLength / 2;
  const tools: Shape[] = [
    cylinder(v.bearingDiameter / 2 + 0.025, v.bodyLength + 2, [x - 1, 0, 0], 'x'),
  ];
  for (const [hx, hy] of precisionSupportMountingHoles(p))
    tools.push(
      cylinder(v.mountBore / 2, v.height + 2, [hx, hy, v.bottom - 1]),
      cylinder(v.counterbore / 2, v.counterboreDepth + 1, [hx, hy, v.wingTop - v.counterboreDepth]),
    );
  for (const y of [-v.mountingPitchY / 2, v.mountingPitchY / 2])
    for (const z of [0, -v.transversePitchZ])
      tools.push(cylinder(v.transverseBore / 2, v.bodyLength + 2, [x - 1, y, z], 'x'));
  const out: Piece[] = [
    {
      label: `HIWIN${String(p.model).toUpperCase()} source housing envelope`,
      color: 0x3d4751,
      shape: subtract(
        union(
          box([v.bodyLength, v.width, v.wingTop - v.bottom], [x, -v.width / 2, v.bottom]),
          box([v.bodyLength, v.towerWidth, v.top - v.wingTop], [x, -v.towerWidth / 2, v.wingTop]),
        ),
        ...tools,
      ),
    },
  ];
  if (!v.fixed) {
    out.push(...bearingPieces(v, -v.bearingWidth / 2, 1));
    return out;
  }
  const front = v.bodyLength / 2,
    frontCollar = front - v.collarLength,
    rearCollar = frontCollar - 2 * v.bearingWidth - v.collarLength;
  out.push(
    ...bearingPieces(v, frontCollar - 2 * v.bearingWidth, 1),
    ...bearingPieces(v, frontCollar - v.bearingWidth, 2),
  );
  for (const start of [rearCollar, frontCollar])
    out.push({
      label: 'Source shaft collar',
      color: 0xadb6bd,
      shape: annulus(v.collarDiameter, v.shaftDiameter, start, v.collarLength),
    });
  const lidLength = largeSize(v) ? 8 : 6;
  out.push({
    label: 'Holding lid; source length, illustrative fixing contours',
    color: 0x47525e,
    shape: subtract(
      box(
        [lidLength, v.towerWidth, v.towerWidth],
        [x - lidLength, -v.towerWidth / 2, -v.towerWidth / 2],
      ),
      cylinder(v.locknutOutside / 2 + 0.05, lidLength + 2, [x - lidLength - 1, 0, 0], 'x'),
    ),
  });
  const nutStart = rearCollar - v.locknutLength;
  const square: Shape = {
    kind: 'transform',
    translation: [0, 0, 0],
    rotation: [45, 0, 0],
    child: box(
      [v.locknutLength, v.locknutAF, v.locknutAF],
      [nutStart, -v.locknutAF / 2, -v.locknutAF / 2],
    ),
  };
  const bore: Shape = {
    kind: 'cylinder',
    radius: v.shaftDiameter / 2,
    height: v.locknutLength,
    origin: [nutStart, 0, 0],
    axis: 'x',
    thread: {
      pitch: 1,
      internal: true,
      radialClearance: 0.05,
      designation: `M${v.shaftDiameter}x1`,
    },
  };
  out.push({
    label: `Source M${v.shaftDiameter}×1 locknut; radial fit allowance0.05`,
    color: 0x596773,
    shape: subtract(
      {
        kind: 'intersect',
        children: [square, cylinder(v.locknutOutside / 2, v.locknutLength, [nutStart, 0, 0], 'x')],
      },
      bore,
    ),
  });
  return out;
}
function largeSize(v: ReturnType<typeof precisionSupportLayout>) {
  return v.shaftDiameter === 20;
}
const part: PartDefinition = {
  id: 'cnc-precision-support',
  name: 'Precision ballscrew support',
  product: product as ProductProfile,
  category: 'LINEAR MOTION',
  subgroup: 'SHAFT & SCREW SUPPORTS',
  icon: 'bearing',
  complexity: 'HIWIN BK/BF15/20 ordered C3/P5',
  description:
    'Source-specific purchased HIWIN BK15/BF15/BK20/BF20 mounting and bearing journal interfaces, with C3/P5 as an explicit order requirement to match a C3 ground ballscrew. No delivered precision certificate is inferred.',
  keywords: [
    'HIWIN',
    'BK20',
    'BF20',
    'BK15',
    'BF15',
    'precision support',
    'ground ballscrew',
    'P5 bearing',
  ],
  defaults: precisionSupportParameters(),
  parameters: [
    {
      key: 'model',
      label: 'Support execution',
      type: 'select',
      group: 'Model',
      options: ['bk20-c3', 'bf20-c3', 'bk15-c3', 'bf15-c3'].map((value) => ({
        value,
        label: `HIWIN${value.toUpperCase()}`,
      })),
    },
  ],
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  catalogFilterFields: [
    {
      key: 'shaft',
      label: 'Source bearing bore',
      type: 'number',
      unit: 'mm',
      group: 'Source',
      catalogSummary: true,
    },
    {
      key: 'fixed',
      label: 'Fixed bearing unit',
      type: 'boolean',
      group: 'Source',
      catalogSummary: true,
    },
  ],
  validate: (p) =>
    ['bk20-c3', 'bf20-c3', 'bk15-c3', 'bf15-c3'].includes(String(p.model))
      ? []
      : ['Choose a source-specific HIWIN 15/20 support with requested C3 execution.'],
  buildGeometry: (p) => geometry(pieces(p)),
  python(p) {
    return `${python(pieces(p))}\ncomponent_manufactured=[False]*len(components)\nfor _pl_support_meta in component_metadata: _pl_support_meta.update(${JSON.stringify({ SupportSourceInterfaces: JSON.stringify(precisionSupportLayout(p)), OrderedExecution: 'RequestC3/P5 support execution and matched bearing preload; verify certificate and ordered assembly drawing. Not an inspected delivered rating.', GeometryQualification: 'Published external/shaft/bearing envelopes. Bearing race tracks, ball count, seals and lid fixing contours are representative; pairbearing axial stack is an authored reconstruction requiring maker approval. BF bearing is centered for the installation contract; unpublished OEM internal offset must be confirmed. BF drawing labels4vertical drills but lacks axial pitch and shows2visible top mounts; requested2centred mounts need order drawing approval.', ThreadFitAllowance: 'Locknut nominalM20/M15 retained;0.05mm radial inspection clearance is not supplier tolerance.' })})`;
  },
  dimensions: (p) => {
    const v = precisionSupportLayout(p);
    return [
      v.fixed ? 2 * v.collarLength + 2 * v.bearingWidth + v.locknutLength : v.bodyLength,
      v.width,
      v.height,
    ];
  },
  notes:
    'Native screw axis X, shaft center Z0, base Z−34/−28 for 20/15. Fixed housing centered X0, shoulder at +17.5/+13.5. Supported bearing centered X0, shoulder −6/−4.5. Fixed mounts ±9.5/±7.5 along X; ±35/±27 Y. BF visible mounts X0. Source BK/BF dimensions, bearings 7004A/6004ZZ 20×42×12 and 7002A/6002ZZ 15×32×9. C3/P5 is an explicit order requirement matching a C3 screw, not delivered certification. Axial internal bearing/lid stack and BF drill callout ambiguity remain supplier drawing acceptance requirements. Support unit is one purchased identity; visual subdivisions are not manufactured parts.',
  sources: [{ label: 'HIWIN B03TE03-1907 pp14/15/23/25/26', url: precisionSupportSource }],
};
export default part;
