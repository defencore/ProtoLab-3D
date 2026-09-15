import type { Parameters, Preset } from '../core/types';

export const gearReferenceFiles = {
  spur: 'references/spur-pinion-options.png',
  bevel: 'references/bevel-gear-dimensions.png',
};

export function miniaturePinionPresets(defaults: Parameters): Preset[] {
  return [11, 13, 15, 17].map((teeth) => ({
    id: `reference-m05-${teeth}t-298`,
    name: `Miniature pinion · m0.5 · ${teeth} teeth · 2.98 mm bore`,
    description:
      'Reference lists module, teeth and bore. The 5 mm width and 20° pressure angle are editable prototype assumptions; cutter undercut is not reproduced.',
    parameters: {
      ...defaults,
      module: 0.5,
      teeth,
      bore: 2.98,
      faceWidth: 5,
      pressureAngle: 20,
      backlash: 0.02,
      hub: false,
      profileMode: 'layout',
    },
    catalog: {
      designation: `m0.5 / ${teeth}T / 2.98 mm`,
      sourceName: 'User-supplied reference',
      sourceKind: 'attachment',
      sourceUrl: gearReferenceFiles.spur,
      verifiedParameters: ['module', 'teeth', 'bore'],
    },
  }));
}

export interface BevelReferenceRow {
  module: number;
  teeth: number;
  boreMin: number;
  boreMax: number;
  outer: number;
  largeTip: number;
  mounting: number;
  overall: number;
  face: number;
  hub: number;
  hubLength: number;
  bodyLength: number;
}

/** Dimensions transcribed from the supplied mounting drawing, in millimetres. */
export const bevelReferenceRows: BevelReferenceRow[] = [
  [1, 20, 6, 8, 21.79, 10.05, 29.6, 15.03, 5.7, 16, 8.6, 14],
  [1, 40, 8, 12, 40.89, 12.69, 21.8, 15.02, 5.7, 25, 8, 13],
  [1.5, 15, 6, 10, 26.11, 10.4, 32, 17.23, 8, 16, 7.88, 15.5],
  [1.5, 30, 8, 12, 45.88, 14.63, 25, 17.85, 8, 25, 9, 15],
  [1.5, 18, 8, 12, 29.68, 14.41, 40.74, 22.96, 9.8, 22, 12.5, 21],
  [1.5, 36, 10, 16, 55.34, 14.59, 26.75, 18.54, 9.8, 30, 10, 15.5],
  [1.5, 20, 8, 12, 33.61, 16.9, 46, 25.54, 10, 25, 14.8, 24],
  [1.5, 40, 12, 20, 60.88, 20.88, 35, 25.01, 10, 38, 15, 22],
  [2, 15, 8, 15, 34.81, 11.2, 40, 20.59, 11, 22, 8, 19],
  [2, 30, 14, 20, 61.17, 17.17, 31, 21.6, 11, 35, 10, 18],
  [2, 20, 12, 16, 44.81, 21.2, 60, 34.16, 15, 32, 18, 32],
  [2, 40, 16, 30, 81.17, 26.17, 45, 32.89, 15, 50, 18, 27],
].map(
  ([
    module,
    teeth,
    boreMin,
    boreMax,
    outer,
    largeTip,
    mounting,
    overall,
    face,
    hub,
    hubLength,
    bodyLength,
  ]) => ({
    module,
    teeth,
    boreMin,
    boreMax,
    outer,
    largeTip,
    mounting,
    overall,
    face,
    hub,
    hubLength,
    bodyLength,
  }),
);

export function bevelPairPresets(defaults: Parameters): Preset[] {
  return Array.from({ length: 6 }, (_, i) => {
    const pinion = bevelReferenceRows[i * 2],
      wheel = bevelReferenceRows[i * 2 + 1];
    const parameters: Parameters = {
      ...defaults,
      module: pinion.module,
      pinionTeeth: pinion.teeth,
      wheelTeeth: wheel.teeth,
    };
    for (const [prefix, row] of [
      ['pinion', pinion],
      ['wheel', wheel],
    ] as const) {
      parameters[`${prefix}Bore`] = row.boreMin;
      for (const key of [
        'outer',
        'largeTip',
        'mounting',
        'overall',
        'face',
        'hub',
        'hubLength',
        'bodyLength',
        'boreMin',
        'boreMax',
      ] as const)
        parameters[`${prefix}${key[0].toUpperCase()}${key.slice(1)}`] = row[key];
    }
    return {
      id: `reference-bevel-m${pinion.module}-${pinion.teeth}-${wheel.teeth}`,
      name: `Bevel pair · m${pinion.module} · ${pinion.teeth}/${wheel.teeth} teeth`,
      description: `2:1 mounting reference; pinion bore ${pinion.boreMin}–${pinion.boreMax} mm, wheel bore ${wheel.boreMin}–${wheel.boreMax} mm. Tooth flanks and set screw holes are prototype geometry.`,
      parameters,
      catalog: {
        designation: `${pinion.module}M ${pinion.teeth}T / ${pinion.module}M ${wheel.teeth}T`,
        sourceName: 'User-supplied reference',
        sourceKind: 'attachment',
        sourceUrl: gearReferenceFiles.bevel,
        parameterRanges: {
          pinionBore: { min: pinion.boreMin, max: pinion.boreMax },
          wheelBore: { min: wheel.boreMin, max: wheel.boreMax },
        },
        verifiedParameters: Object.keys(parameters).filter(
          (key) =>
            !/^(pinion|wheel)Bore(Shape|Angle|FlatDepth|Sides|KeyWidth|KeyDepth)$/.test(key) &&
            ![
              'pinionBore',
              'wheelBore',
              'pressureAngle',
              'backlash',
              'rotation',
              'setScrewDiameter',
              'setScrews',
            ].includes(key),
        ),
      },
    };
  });
}
