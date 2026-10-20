import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  box,
  cylinder,
  subtract,
  union,
  boundaryThreadCallouts,
  type Shape,
} from '../../core/assembly/boundary/shapes';
import { geometry, python, dimensions, type Piece } from '../../core/assembly/boundary/assembly';
import { currentGeometryMode } from '../../core/geometry-mode';
import { threadMetadata } from '../../core/thread-callouts';
import product from './product.json';
import presets from './presets.json';
export type ScrewSupportModel = 'bk12' | 'bf12';
export const supportSource =
  'https://www.hiwin.com/wp-content/uploads/HIWIN-Ballscrew-Supports-Catalog.pdf';
export function screwSupportParameters(model: ScrewSupportModel = 'bk12'): Parameters {
  return { model };
}
export function screwSupportLayout(p: Parameters) {
  const fixed = p.model === 'bk12';
  return {
    fixed,
    model: p.model as ScrewSupportModel,
    width: 60,
    height: 43,
    bottom: -25,
    top: 18,
    wingTop: 7.5,
    bodyLength: fixed ? 25 : 20,
    mountingPitchX: fixed ? 13 : 0,
    mountingPitchY: 46,
    mountBore: 6.6,
    counterbore: 10.8,
    counterboreDepth: 1.5,
    transverseBore: 5.5,
    bearingBore: fixed ? 12 : 10,
    bearingOutside: fixed ? 28 : 26,
    bearingWidth: 8,
    bearingCount: fixed ? 2 : 1,
    bearingCenter: fixed ? -0.5 : 0,
    shoulderContact: fixed ? 13 : -4,
    fixedJournalLength: 36,
    freeJournalLength: 11,
    retentionThread: 'M12x1',
    retentionLength: 12,
    grooveDiameter: 9.6,
    grooveStart: 8,
    grooveEnd: 9.15,
  };
}
export function supportMountingHoles(p: Parameters): [number, number, number][] {
  const v = screwSupportLayout(p);
  return (v.fixed ? [-1, 1] : [0]).flatMap((x) =>
    [-1, 1].map((y) => [(x * v.mountingPitchX) / 2, y * 23, v.bottom] as [number, number, number]),
  );
}
function annulus(outer: number, inner: number, start: number, length: number): Shape {
  return subtract(
    cylinder(outer / 2, length, [start, 0, 0], 'x'),
    cylinder(inner / 2, length + 2, [start - 1, 0, 0], 'x'),
  );
}
function bearingPieces(bore: number, outside: number, start: number, index: number): Piece[] {
  if (currentGeometryMode() === 'simple')
    return [
      {
        label: `Bearing ${index} nominal envelope`,
        color: 0xb0b7bc,
        shape: annulus(outside, bore, start, 8),
      },
    ];
  const inside = bore / 2,
    outer = outside / 2,
    track = (inside + outer) / 2,
    ball = bore === 10 ? 2.381 : 1.05;
  const torus: Shape = {
    kind: 'transform',
    translation: [start + 4, 0, 0],
    rotation: [0, 90, 0],
    child: { kind: 'torus', major: track, minor: ball + 0.05, origin: [0, 0, 0] },
  };
  const result: Piece[] = [
    {
      label: `Bearing ${index} inner race`,
      color: 0xb8bec3,
      shape: subtract(annulus((track - 1) * 2, bore, start, 8), torus),
    },
    {
      label: `Bearing ${index} outer race`,
      color: 0xa5afb6,
      shape: subtract(annulus(outside, (track + 1) * 2, start, 8), torus),
    },
  ];
  const count = bore === 10 ? 7 : 12;
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count;
    result.push({
      label: `Bearing ${index} rolling ball ${i + 1}`,
      color: 0xcbd2d6,
      shape: {
        kind: 'sphere',
        radius: ball,
        origin: [start + 4, track * Math.cos(a), track * Math.sin(a)],
      },
    });
  }
  return result;
}
function pieces(p: Parameters, state: string): Piece[] {
  const v = screwSupportLayout(p),
    x = -v.bodyLength / 2;
  const tools: Shape[] = v.fixed
    ? [
        cylinder(14, 20, [x, 0, 0], 'x'),
        cylinder(7.8, v.bodyLength + 2, [x - 1, 0, 0], 'x'),
        cylinder(11.1, 2.5, [10, 0, 0], 'x'),
      ]
    : [cylinder(13, v.bodyLength + 2, [x - 1, 0, 0], 'x')];
  if (v.fixed)
    for (const y of [-12, 12])
      for (const z of [-12, 12]) tools.push(cylinder(1.6, 5.5, [-13.5, y, z], 'x'));
  for (const [hx, hy] of supportMountingHoles(p))
    tools.push(cylinder(3.3, 34.5, [hx, hy, -26]), cylinder(5.4, 2.5, [hx, hy, 6]));
  for (const y of [-23, 23])
    for (const z of [-18, 0]) tools.push(cylinder(2.75, v.bodyLength + 2, [x - 1, y, z], 'x'));
  let housing = subtract(
    union(
      box([v.bodyLength, 60, 32.5], [x, -30, -25]),
      box([v.bodyLength, 34, 10.5], [x, -17, 7.5]),
    ),
    ...tools,
  );
  if (state === 'cutaway')
    housing = subtract(housing, box([v.bodyLength + 2, 31, 44], [x - 1, 0, -25]));
  const result: Piece[] = [
    { label: `${v.fixed ? 'BK12' : 'BF12'} bearing housing`, color: 0x313a43, shape: housing },
  ];
  if (v.fixed) {
    result.push(...bearingPieces(12, 28, -8.5, 1), ...bearingPieces(12, 28, -0.5, 2));
    result.push(
      {
        label: 'BK12 inner collar, source Ø12/15.5×5.5',
        color: 0xa7b0b6,
        shape: annulus(15.5, 12, -14, 5.5),
      },
      {
        label: 'BK12 outer collar, source Ø12/15.5×5.5',
        color: 0xa7b0b6,
        shape: annulus(15.5, 12, 7.5, 5.5),
      },
    );
    for (const start of [-12.5, 10])
      result.push({
        label: 'BK12 bearing seal, illustrative dimensions',
        color: 0x272d30,
        shape: annulus(22.1, 15.6, start, 2.5),
      });
    let lid = union(
      subtract(box([4.5, 34, 34], [-17, -17, -17]), cylinder(11.1, 6.5, [-18, 0, 0], 'x')),
      annulus(28, 22.2, -12.5, 4),
    );
    for (const y of [-12, 12])
      for (const z of [-12, 12]) lid = subtract(lid, cylinder(1.6, 6.5, [-18, y, z], 'x'));
    if (state === 'cutaway') lid = subtract(lid, box([6.5, 18, 36], [-18, 0, -18]));
    result.push({
      label: 'BK12 holding lid; screw pattern illustrative',
      color: 0x3c4650,
      shape: lid,
    });
    const square: Shape = {
      kind: 'transform',
      translation: [0, 0, 0],
      rotation: [45, 0, 0],
      child: box([8, 19, 19], [-22, -9.5, -9.5]),
    };
    const blank: Shape = {
      kind: 'intersect',
      children: [square, cylinder(11, 8, [-22, 0, 0], 'x')],
    };
    const threaded: Shape = {
      kind: 'cylinder',
      radius: 6.05,
      height: 8,
      origin: [-22, 0, 0],
      axis: 'x',
      thread: { pitch: 1, internal: true, designation: 'M12x1' },
    };
    const radialHoles: Shape[] = [];
    for (const axis of ['y', 'z'] as const) {
      const origin: [number, number, number] = axis === 'y' ? [-16.5, 6.05, 0] : [-16.5, 0, 6.05];
      radialHoles.push({
        kind: 'transform',
        translation: [0, 0, 0],
        rotation: [45, 0, 0],
        child: {
          kind: 'cylinder',
          radius: 2.05,
          height: 4,
          origin,
          axis,
          thread: { pitch: 0.7, internal: true, designation: 'M4' },
        },
      });
      result.push({
        label: 'BK12 locknut M4 radial set screw, illustrative length',
        color: 0xaeb8c0,
        shape: {
          kind: 'transform',
          translation: [0, 0, 0],
          rotation: [45, 0, 0],
          child: {
            kind: 'cylinder',
            radius: 2,
            height: 3.3,
            origin,
            axis,
            thread: { pitch: 0.7, designation: 'M4' },
          },
        },
      });
    }
    const nut = subtract(blank, threaded, ...radialHoles);
    result.push({
      label: 'BK12 lock nut M12×1, source D22 / AF19 / h8',
      color: 0x58636b,
      shape: nut,
    });
    for (const y of [-12, 12])
      for (const z of [-12, 12])
        result.push({
          label: 'BK12 lid screw; illustrative M3 installation',
          color: 0x939da5,
          shape: union(
            {
              kind: 'cylinder',
              radius: 1.5,
              height: 6,
              origin: [-17, y, z],
              axis: 'x',
              thread: { pitch: 0.5, designation: 'M3' },
            },
            cylinder(2.5, 1.5, [-18.5, y, z], 'x'),
          ),
        });
  } else {
    result.push(...bearingPieces(10, 26, -4, 1));
    // Installed JIS-style S10 outline is illustrative; groove interface comes from the supplier tables.
    const ring = subtract(annulus(13.2, 9.6, 4.05, 1), box([3, 3, 8], [3.5, -1.5, 0]));
    result.push({ label: 'BF12 S10 external retaining ring', color: 0xbac2c8, shape: ring });
  }
  return result;
}
const part: PartDefinition = {
  id: 'cnc-screw-support',
  name: 'Ballscrew bearing support',
  product: product as ProductProfile,
  category: 'LINEAR MOTION',
  subgroup: 'SHAFT & SCREW SUPPORTS',
  icon: 'bearing',
  complexity: 'HIWIN BK12 / BF12 mounting interfaces',
  description:
    'One purchased fixed or supported screw-end unit with source mounting holes, actual unequal journal bores, bearings and retention parts.',
  keywords: ['CNC', 'BK12', 'BF12', 'HIWIN', 'bearing', 'screw support', 'fixed', 'supported'],
  defaults: screwSupportParameters(),
  catalogFilterFields: [
    ...[
      'width',
      'height',
      'bodyLength',
      'axisHeight',
      'journalDiameter',
      'mountPitchX',
      'mountPitchY',
      'mountBore',
      'counterbore',
      'counterboreDepth',
    ].map((key) => ({
      key,
      label: (
        {
          width: 'Mounting width',
          height: 'Housing height',
          bodyLength: 'Housing axial length',
          axisHeight: 'Shaft height from mounting base',
          journalDiameter: 'Journal diameter',
          mountPitchX: 'Axial mounting pitch',
          mountPitchY: 'Transverse mounting pitch',
          mountBore: 'Mounting bore',
          counterbore: 'Counterbore diameter',
          counterboreDepth: 'Counterbore depth',
        } as Record<string, string>
      )[key],
      type: 'number' as const,
      group: 'Source dimensions',
      unit: 'mm',
      catalogSummary: ['width', 'height', 'journalDiameter'].includes(key),
    })),
    {
      key: 'bearing',
      label: 'Bearing type',
      type: 'select',
      group: 'Source construction',
      options: [
        { value: '7001A pair', label: '7001A pair' },
        { value: '6000ZZ', label: '6000ZZ' },
      ],
    },
  ],
  parameters: [
    {
      key: 'model',
      label: 'Support unit',
      type: 'select',
      group: 'Model',
      options: [
        { value: 'bk12', label: 'HIWIN BK12, fixed Ø12 journal' },
        { value: 'bf12', label: 'HIWIN BF12, supported Ø10 journal' },
      ],
    },
  ],
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Complete purchased support unit.' },
    {
      id: 'cutaway',
      label: 'Cutaway',
      description: 'Open half the housing/lid to inspect bearings, seats and collars.',
    },
  ],
  validate: (p) => (['bk12', 'bf12'].includes(String(p.model)) ? [] : ['Choose BK12 or BF12.']),
  buildGeometry: (p, s) => geometry(pieces(p, s)),
  python: (p, s) => {
    const components = pieces(p, s);
    // The cutting tool includes an illustrative allowance; the drawing callout retains the source nominal.
    const sourceNominals = new Map([
      ['M12x1', 12],
      ['M4', 4],
    ]);
    const metadata = components.map(({ shape }) => {
      const features = boundaryThreadCallouts(shape);
      const allowances = features.flatMap((feature) => {
        const nominal = sourceNominals.get(feature.designation);
        return feature.internal && nominal && feature.nominalDiameter !== nominal
          ? [
              `${feature.designation}: modeled female tool diameter ${feature.nominalDiameter} mm; nominal ${nominal} mm. Clearance is illustrative; no production fit class is specified.`,
            ]
          : [];
      });
      return {
        ...threadMetadata(
          features.map((feature) => ({
            ...feature,
            nominalDiameter: sourceNominals.get(feature.designation) ?? feature.nominalDiameter,
          })),
        ),
        ...(allowances.length ? { ThreadFitAllowance: [...new Set(allowances)].join(' ') } : {}),
      };
    });
    return `${python(components)}\ncomponent_metadata = ${JSON.stringify(metadata)}`;
  },
  dimensions: (p, s) => dimensions(pieces(p, s)),
  notes:
    'Native screw axis X; shaft centre Y0/Z0; mounting bottomZ−25 and housing topZ18. HIWIN B03TE03-1907 printed pp14–15 gives W60/H43, BK L25 or BF L20, 46 mm transverse mounting pitch, Ø6.6/Ø10.8 counterbore×1.5, and front Ø5.5 holes. BK has four top holes at axial±6.5; the BF side view and photograph show one centred top bore per wing, but its generic drill-count leader says four. The BF model follows the centred drawing/photo and retains this conflict for supplier verification. BK shaft interface uses Ø12 and two 7001A bearings; BF12 uses Ø10 and 6000ZZ. Collars Ø12/15.5×5.5 and locknut M12×1 D22/AF19/h8 are sourced. Bearing boundary dimensions are sourced; internal raceways, balls, seal thickness, bearing axial seating and lid screw pattern are reconstruction assumptions, not certified supplier CAD or fabrication dimensions. The purchased kit remains one procurement identity. See GUIDE for shaft-end drawings and retention interface.',
  sources: [
    { label: 'HIWIN support-unit catalog B03TE03-1907', url: supportSource },
    {
      label: 'MISUMI JIS B2804 S10 groove dimensions',
      url: 'https://sg.misumi-ec.com/pdf/tech/mech/p2855.pdf',
    },
    {
      label: 'NSK 7001A bearing boundary dimensions',
      url: 'https://www.nsk.com/au-en/engineering/7001a-sp-acbb-st-a.html',
    },
    {
      label: 'NSK 6000ZZ bearing boundaries and ball count/diameter',
      url: 'https://www.nsk.com/ph-en/engineering/products/bearings/ball-bearings/deep-groove-ball-bearings/single-row-deep-groove-ball-bearings/6000zz-apn.html',
    },
  ],
};
export default part;
