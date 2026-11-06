import { Group } from 'three';
import {
  component,
  cylinder,
  subtract,
  pythonShape,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import type { Parameters } from '../../../core/types';
export const motorDimensions = {
  diameter: 28,
  length: 47,
  shaft: 3.175,
  projection: 15,
  mountX: 16,
  mountY: 19,
};
export const shaftMachining = { diameter: 1, centerZ: 13, axis: 'x' } as const;
export const motorDrawing = 'https://images-na.ssl-images-amazon.com/images/I/51uWegAEAqL.jpg';
export const motorCatalog =
  'https://www.ytk-group.co.jp/products/wp-content/uploads/2021/02/Catalog-from-Suprass-Hobby_compressed-1-1.pdf';
export const mountHoles = [
  [-8, 0],
  [8, 0],
  [0, -9.5],
  [0, 9.5],
] as const;
export function pieces(p: Parameters = {}, state = 'assembled') {
  // External installation envelope only. Cap seams and nominal blind-hole depth
  // are illustrative; the dimensional source does not specify these details.
  const bore = cylinder(1.65, 48, [0, 0, -47.5]);
  const holes = mountHoles.map(([x, y]) => cylinder(1.5, 2.6, [x, y, -2.5]));
  const piece = (label: string, shape: Shape, color: number) => ({ label, shape, color });
  const rows = [
    piece(
      'Red motor can · Ø28×47 external envelope',
      subtract(cylinder(14, 45, [0, 0, -46]), bore, ...holes),
      0xb83b46,
    ),
    piece(
      'Front mounting face · M3 on16/19 mm cross',
      subtract(cylinder(14, 1, [0, 0, -1]), bore, ...holes),
      0x30343a,
    ),
    piece('Rear cap · external envelope', subtract(cylinder(14, 1, [0, 0, -47]), bore), 0x30343a),
    piece(
      'Ø3.175 shaft ·15 mm projection · conservative round envelope',
      cylinder(3.175 / 2, 62, [0, 0, -47]),
      0xb7bec7,
    ),
  ];
  if (state !== 'cross-drilled') return rows;
  const shaft = rows.at(-1)!;
  const cutLength = motorDimensions.shaft + 0.4;
  return [
    ...rows.slice(0, -1),
    piece(
      'Custom cross-drilled shaft · Ø1 at 13 mm from mounting face',
      {
        kind: 'transform',
        child: subtract(
          shaft.shape,
          cylinder(
            shaftMachining.diameter / 2,
            cutLength,
            [-cutLength / 2, 0, shaftMachining.centerZ],
            shaftMachining.axis,
          ),
        ),
        translation: [0, 0, 0],
        rotation: [0, 0, Number(p.shaftAngle ?? 0)],
      },
      shaft.color,
    ),
  ];
}
export function geometry(p: Parameters = {}, state = 'assembled') {
  return new Group().add(...pieces(p, state).map((p) => component(p.shape, p.label, p.color)));
}
export function python(p: Parameters = {}, state = 'assembled') {
  const rows = pieces(p, state);
  return [
    ...(state === 'cross-drilled'
      ? [
          'def _pl_transform(shape, translation, rotation):',
          '    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],rotation):',
          '        if angle: shape.rotate(App.Vector(),axis,angle)',
          '    shape.translate(App.Vector(*translation))',
          '    return shape',
        ]
      : []),
    'components = []',
    ...rows.flatMap((p) => [
      `item = (${pythonShape(p.shape)}).removeSplitter()`,
      'components.append(item)',
    ]),
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(rows.map((p) => p.label))}`,
    `component_colors = ${JSON.stringify(rows.map((p) => [16, 8, 0].map((s) => ((p.color >> s) & 255) / 255)))}`,
  ].join('\n');
}
