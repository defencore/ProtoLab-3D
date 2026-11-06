import { Box3, Group, Vector3 } from 'three';
import type { Parameters, Preset } from '../../../core/types';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  component,
  pythonShape,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { detailComponent, parseDetailRecipe } from '../../../core/component-recipes';
import { disposeModel } from '../../../core/mechanical';
import { caseElectronicsAdapterDetails } from '../../servo-toggle-actuator/lib/case-electronics';
import { defaults as mechanismDefaults } from '../../servo-toggle-actuator/configurator';
import mechanismPresets from '../../servo-toggle-actuator/presets.json';
import { adapterModels, defaults } from '../configurator';

const casePreset = (mechanismPresets as Preset[]).find(
  (p) => p.parameters.mechanism === 'case-panel',
);
if (!casePreset) throw new Error('Missing case-panel adapter configuration.');
const caseParameters: Parameters = { ...mechanismDefaults, ...casePreset.parameters, phase: 'off' };
const numericKeys = [
  'mountSpanX',
  'mountSpanY',
  'boardWidth',
  'boardDepth',
  'boardThickness',
  'seatHeight',
  'clearance',
] as const;
export function validateAdapter(p: Parameters): string[] {
  const errors: string[] = [];
  if (Object.keys(p).some((k) => !Object.hasOwn(defaults, k)))
    errors.push('Unsupported adapter setting.');
  if (!adapterModels.some((m) => m.value === p.model))
    errors.push('Choose a supported module adapter.');
  if (numericKeys.some((k) => typeof p[k] !== 'number' || !Number.isFinite(p[k])))
    return [...errors, 'Adapter dimensions must be finite numbers.'];
  const [sx, sy, w, d, t, h, c] = numericKeys.map((k) => Number(p[k]));
  if (!String(p.model).startsWith('universal-') && numericKeys.some((k) => p[k] !== defaults[k]))
    errors.push(
      'Fitted adapters have fixed dimensions. Select a universal template for an editable different PCB.',
    );
  if (sx < 20 || sx > 120 || sx % 20 || ![20, 60, 100].includes(sy))
    errors.push('X span must use the 20 mm grid; Y row spacing must be 20, 60 or 100 mm to leave a clear central strap lane.');
  if (
    w < 12 ||
    w > 120 ||
    d < 8 ||
    d > 120 ||
    t < 0.6 ||
    t > 3.2 ||
    h < 6 ||
    h > 30 ||
    c < 0.15 ||
    c > 1
  )
    errors.push('Module dimensions are outside the supported adapter range.');
  return errors;
}
const hex = (af: number, height: number, [x, y, z]: Vec): Shape => ({
  kind: 'transform',
  child: prism(
    Array.from({ length: 6 }, (_, i): [number, number] => {
      const angle = ((i + 0.5) * Math.PI) / 3;
      return [(af / Math.sqrt(3)) * Math.cos(angle), (af / Math.sqrt(3)) * Math.sin(angle)];
    }),
    height,
    z,
  ),
  translation: [x, y, 0],
  rotation: [0, 0, 0],
});
function beam(
  a: readonly number[],
  b: readonly number[],
  width: number,
  height: number,
  z = 0,
): Shape {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = Math.hypot(dx, dy);
  if (length < 1e-6) return cylinder(width / 2, height, [a[0], a[1], z]);
  return {
    kind: 'transform',
    child: box([length, width, height], [0, -width / 2, z]),
    translation: [a[0], a[1], 0],
    rotation: [0, 0, (Math.atan2(dy, dx) * 180) / Math.PI],
  };
}
function universalShape(p: Parameters): Shape {
  const sx = Number(p.mountSpanX),
    sy = Number(p.mountSpanY),
    w = Number(p.boardWidth),
    d = Number(p.boardDepth),
    t = Number(p.boardThickness),
    h = Number(p.seatHeight),
    c = Number(p.clearance),
    vertical = p.model === 'universal-vertical',
    anchors: [number, number][] = [-sx / 2, sx / 2].flatMap((x): [number, number][] =>
      [-sy / 2, sy / 2].map((y) => [x, y]),
    ),
    outerW = w + 2 * c + 4,
    outerD = d + 2 * c + 4,
    solids: Shape[] = anchors.flatMap(([x, y]) => [
      cylinder(4.8, 2, [x, y, 0]),
      cylinder(4.8, 2.7, [x, y, 2]),
    ]),
    cuts: Shape[] = [],
    height = vertical ? h + d + 2 : h + t;
  // Four feet leave the central strap lane between rows of the matching base grid.
  solids.push(beam(anchors[0], anchors.at(-1)!, 5, 2), beam(anchors[1], anchors.at(-2)!, 5, 2));
  for (const x of [-sx / 2, sx / 2]) solids.push(beam([x, -sy / 2], [x, sy / 2], 5, 2));
  if (!vertical) {
    solids.push(beam([-outerW / 2 + 1, 0], [outerW / 2 - 1, 0], 4, 2));
    solids.push(
      subtract(
        box([outerW, outerD, h], [-outerW / 2, -outerD / 2, 0]),
        box([Math.max(4, w - 4), Math.max(3, d - 4), h + 2], [-(w - 4) / 2, -(d - 4) / 2, -1]),
      ),
    );
    for (const [x, y] of anchors) solids.push(beam([x, y], [0, 0], 4, 2));
    for (const sign of [-1, 1]) {
      solids.push(box([2, outerD, t], [sign < 0 ? -outerW / 2 : outerW / 2 - 2, -outerD / 2, h]));
      const x = sign * (outerW / 2 + 1.6);
      solids.push(box([5, 7, 3], [x - 2.5, -3.5, 0]));
      cuts.push(box([1.4, 3.2, 5], [x - 0.7, -1.6, -1]));
    }
  } else {
    const wallW = Math.max(w + 14, sx + 9.6),
      wallH = h + d + 2;
    solids.push(box([wallW, 3, wallH], [-wallW / 2, -3, 0]));
    cuts.push(box([Math.max(4, w - 8), 5, Math.max(3, d - 8)], [-(w - 8) / 2, -4, h + 4]));
    solids.push(box([outerW, t + c + 2, 2], [-outerW / 2, 0, h - 2]));
    for (const x of [-wallW / 2 + 1.5, wallW / 2 - 1.5]) {
      solids.push({
        kind: 'transform',
        child: prism(
          [
            [-Math.max(8, sy / 2), 2],
            [0, 2],
            [0, Math.min(wallH - 2, h + 12)],
          ],
          3,
          0,
          'y',
        ),
        translation: [x + 1.5, 0, 0],
        rotation: [0, 0, 90],
      });
      solids.push(beam([x, -sy / 2], [x, sy / 2], 4, 2));
    }
    // Horizontal wrap bands pass beside the PCB and between the outer gussets.
    // The short-board variant uses one band so separate slots retain a broad web.
    const strapLevels = d < 12 ? [h + d / 2] : [h + 2.5, h + d - 2.5];
    for (const z of strapLevels)
      for (const sign of [-1, 1])
        cuts.push(box([1.4, 5, 3.2], [sign * (w / 2 + 2.6) - 0.7, -4, z - 1.6]));
  }
  for (const [x, y] of anchors)
    cuts.push(cylinder(1.7, height + 3, [x, y, -1]), hex(5.8, height + 1, [x, y, 2]));
  return subtract(union(...solids), ...cuts);
}

/** Both case and standalone catalogue use the same authored fitted-adapter shapes. */
export function adapterShape(p: Parameters): Shape {
  const errors = validateAdapter(p);
  if (errors.length) throw new Error(errors.join(' '));
  if (String(p.model).startsWith('universal-')) return universalShape(p);
  const id = `case-electronics-${p.model}-adapter`,
    fitted = caseElectronicsAdapterDetails(caseParameters).find((piece) => piece.id === id);
  if (!fitted) throw new Error(`Missing fitted adapter ${id}.`);
  const occurrence = detailComponent(id, fitted.label, fitted.shape);
  return parseDetailRecipe(String(occurrence.parameters.recipe));
}
export function adapterGeometry(p: Parameters): Group {
  return new Group().add(component(adapterShape(p), 'Module adapter', 0x687f91));
}
export function adapterDimensions(p: Parameters): [number, number, number] {
  const model = adapterGeometry(p);
  model.updateMatrixWorld(true);
  try {
    return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as [
      number,
      number,
      number,
    ];
  } finally {
    disposeModel(model);
  }
}
export function adapterPython(p: Parameters): string {
  return `def _pl_transform(shape, translation, rotation):\n    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)], rotation):\n        if angle: shape.rotate(App.Vector(0,0,0),axis,angle)\n    shape.translate(App.Vector(*translation))\n    return shape\nshape = (${pythonShape(adapterShape(p))}).removeSplitter()`;
}
