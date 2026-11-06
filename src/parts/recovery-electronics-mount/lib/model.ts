import type { Parameters } from '../../../core/types';
import pads from './pads-native.json';
import {
  supplierGeometry,
  supplierPython,
  supplierDimensions,
  type SupplierAsset,
} from '../../../core/manufacturer-cad';
import {
  box,
  cylinder,
  union,
  subtract,
  component,
  pythonShape,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';

export const platformAxes: [number, number][] = [67.5, 157.5, 247.5, 337.5].map((angle) => [
  36 * Math.cos((angle * Math.PI) / 180),
  36 * Math.sin((angle * Math.PI) / 180),
]);
export const gpsCentre: [number, number] = [-8.419035512031975, 20.325349715248308];
export const gpsAngle = 22.5;
export const usbCentre: [number, number] = [7, -18.49390183434757];
export const buzzerCentre: [number, number] = [-21, -12];
export const reserveHoles: [number, number][] = [
  [-22, -30],
  [-22, 22],
  [22, -22],
  [22, 22],
];
const centredBox = (w: number, d: number, h: number, x = 0, y = 0, z = 0): Shape =>
  box([w, d, h], [x - w / 2, y - d / 2, z]);
const placed = (shape: Shape, centre: [number, number], angle: number): Shape => ({
  kind: 'transform',
  child: shape,
  translation: [...centre, 0],
  rotation: [0, 0, angle],
});
export const transformedXY = (
  x: number,
  y: number,
  centre: [number, number],
  angle: number,
): [number, number] => {
  const a = (angle * Math.PI) / 180;
  return [
    centre[0] + x * Math.cos(a) - y * Math.sin(a),
    centre[1] + x * Math.sin(a) + y * Math.cos(a),
  ];
};
export const usbMountAxes: [number, number][] = [8, -8].map((y) =>
  transformedXY(9.45, y, usbCentre, 90),
);
const bores = (points: [number, number][], diameter: number, height = 5.2): Shape[] =>
  points.map(([x, y]) => cylinder(diameter / 2, height, [x, y, -0.1]));
// Fine browser tessellation resolves the short radial notches; native discs remain true cylinders.
const disc = (height: number, z = 0): Shape => ({
  kind: 'cylinder',
  radius: 40.5,
  height,
  origin: [0, 0, z],
  axis: 'z',
  previewSegments: 512,
});
const clippedWall = (shape: Shape): Shape => ({
  kind: 'intersect',
  children: [shape, disc(2, 3)],
});

/** Exact current platform-access construction plus the later assembly edge notches. */
export function lowerPlatform(): Shape {
  const baseCuts: Shape[] = [
    ...bores(platformAxes, 3.3),
    ...bores(usbMountAxes, 2.7),
    cylinder(9, 3.2, [14.5, 6, -0.1]),
    ...[-30.7, -11.3].map((x) => centredBox(2, 6, 3.2, x, -13, -0.1)),
  ];
  for (const x of [-8, 8])
    for (const y of [-10.8, 10.8])
      baseCuts.push(placed(centredBox(4, 1.4, 3.2, x, y, -0.1), buzzerCentre, 90));
  const base = subtract(disc(3), ...baseCuts);
  const gps = subtract(
    centredBox(39, 24, 2, 0, 0, 3),
    centredBox(35.4, 20.4, 2.2, 0, 0, 2.9),
    centredBox(4, 12.6, 2.2, -19.5, -2.3, 2.9),
    centredBox(4, 12.6, 2.2, 19.5, 0, 2.9),
  );
  const buzzer = subtract(
    placed(
      subtract(centredBox(30.4, 21.4, 2, 0, 0, 3), centredBox(26.4, 17.4, 2.2, 0, 0, 2.9)),
      buzzerCentre,
      90,
    ),
    ...[-30.7, -11.3].map((x) => centredBox(2, 6, 2.2, x, -13, 2.9)),
  );
  const usbWall = subtract(
    centredBox(28.3, 25.3, 2, 0, 0, 3),
    centredBox(25.1, 22.1, 2.2, 0, 0, 2.9),
    centredBox(4, 12.6, 2.2, -14.15, -4.2, 2.9),
    centredBox(10, 4, 2.2, 2, -12.65, 2.9),
    centredBox(4, 11, 2.2, 14.15, 0, 2.9),
  );
  const usbSupports = [-8, 8].flatMap((y) => [
    cylinder(2.25, 2, [9.45, y, 3]),
    centredBox(4.7, 4.5, 2, (9.45 + 14.15) / 2, y, 3),
  ]);
  const all = union(
    base,
    clippedWall(placed(gps, gpsCentre, gpsAngle)),
    clippedWall(buzzer),
    clippedWall(placed(union(usbWall, ...usbSupports), usbCentre, 90)),
  );
  // These four notches are the final current_assembly overlay, after the access revision.
  const edgeNotches = [0, 90, 180, 270].map((angle) =>
    placed(box([10, 3.6, 5.2], [38.7, -1.8, -0.1]), [0, 0], angle),
  );
  return subtract(all, ...bores(platformAxes, 3.3), ...bores(usbMountAxes, 2.7), ...edgeNotches);
}
export function upperDisc(): Shape {
  return subtract(
    disc(3),
    ...bores([...platformAxes, ...reserveHoles], 3.3, 3.2),
    placed(centredBox(28, 19, 3.2, 0, 0, -0.1), buzzerCentre, 90),
    centredBox(24, 2.5, 3.2, 15, 4.5, -0.1),
    ...[
      [2, -5],
      [14.5, -16],
    ].map(([x, y]) => cylinder(2.5, 3.2, [x, y, -0.1])),
    ...[-43.7, 43.7].map((y) => centredBox(3.6, 10, 3.2, 0, y, -0.1)),
  );
}
export function mountShape(p: Parameters): Shape {
  if (p.model === 'lower-platform-current') return lowerPlatform();
  if (p.model === 'upper-clamp-disc-current') return upperDisc();
  throw new Error('Select a supported source mounting detail.');
}
const nativePads = pads as Record<string, SupplierAsset>;
const padPlacement = (p: Parameters) => [
  { key: String(p.model), label: 'Source GPS compliant retainer', translation: [0, 0, 0] },
];
const isPad = (p: Parameters) => Object.hasOwn(nativePads, String(p.model));
export const geometry = (p: Parameters) =>
  isPad(p)
    ? supplierGeometry(nativePads, padPlacement(p))
    : component(mountShape(p), 'Recovery electronics mounting detail', 0x687f91);
export const dimensions = (p: Parameters): Vec =>
  isPad(p)
    ? supplierDimensions(nativePads, padPlacement(p))
    : p.model === 'lower-platform-current'
      ? [2 * Math.sqrt(40.5 ** 2 - 1.8 ** 2), 2 * Math.sqrt(40.5 ** 2 - 1.8 ** 2), 5]
      : [81, 2 * Math.sqrt(40.5 ** 2 - 1.8 ** 2), 3];
export const python = (p: Parameters) =>
  isPad(p)
    ? supplierPython(nativePads, padPlacement(p))
    : [
        'def _pl_transform(shape, translation, rotation):',
        '    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)], rotation):',
        '        if angle: shape.rotate(App.Vector(0,0,0),axis,angle)',
        '    shape.translate(App.Vector(*translation))',
        '    return shape',
        `shape=(${pythonShape(mountShape(p))}).removeSplitter()`,
      ].join('\n');
