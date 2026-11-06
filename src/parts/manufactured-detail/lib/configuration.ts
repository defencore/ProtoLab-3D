import type { Parameters } from '../../../core/types';
import type { Shape } from '../../../core/assembly/boundary/shapes';
import { parseDetailRecipe } from '../../../core/component-recipes';

const familyControls = [
  'length',
  'width',
  'height',
  'thickness',
  'diameter',
  'boreDiameter',
  'holePattern',
  'holeDiameter',
  'holeMargin',
  'crossHoleDiameter',
  'crossHolePosition',
  'bracketHoleDiameter',
];

/** Only the resolved local feature definition identifies a physical family execution. */
export function detailIdentityParameters(p: Parameters): Parameters {
  const previewKeys = new Set(['previewSamples', 'previewBoreSegments', 'previewSegments']);
  // Manufacture identifies the physical detail; its declared installed form is
  // an operating state of that same detail, not another supplied product.
  const installed = detailRecipe(p);
  const physical = readManufacturingRecipe(p) ?? installed;
  return {
    recipe: JSON.stringify(physical, (_key, value: unknown) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).filter(([key]) => !previewKeys.has(key)))
        : value,
    ),
  };
}

/** Only an explicit authored free form enables the manufacturing model state. */
export function hasManufacturingRecipe(p: Parameters): boolean {
  return Object.hasOwn(p, 'manufacturingRecipe');
}

function readManufacturingRecipe(p: Parameters): Shape | undefined {
  if (!hasManufacturingRecipe(p)) return undefined;
  if (p.mode !== undefined && p.mode !== 'recipe')
    throw new Error('A manufacturing form is supported only for an authored component.');
  if (typeof p.manufacturingRecipe !== 'string' || !p.manufacturingRecipe.trim())
    throw new Error('Provide a complete authored manufacturing recipe or omit it.');
  return parseDetailRecipe(p.manufacturingRecipe);
}

/** Both forms share the authored local basis and one physical configuration. */
export function detailRecipe(p: Parameters, state = 'default'): Shape {
  const installed = installedRecipe(p);
  const manufacturing = readManufacturingRecipe(p);
  if (state === 'default') return installed;
  if (state === 'manufacturing' && manufacturing) return manufacturing;
  throw new Error('Choose an available detail model state.');
}

/** Authored assembly recipes and editable size families share one geometry definition. */
function installedRecipe(p: Parameters): Shape {
  // Sparse authored components have no family controls. A dimensional configuration
  // must retain its explicit family rather than silently changing to an authored recipe.
  if (p.mode === undefined && familyControls.some((key) => Object.hasOwn(p, key)))
    throw new Error('Choose a manufactured detail family for the dimensional configuration.');
  const mode = p.mode === undefined ? 'recipe' : p.mode;
  if (mode === 'recipe') return parseDetailRecipe(String(p.recipe));
  const size = (key: string, minimum = 0.1, maximum = 1000): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
      throw new Error(`${key} must be a finite number between ${minimum} and ${maximum} mm.`);
    return value;
  };
  const cut = (body: Shape, holes: Shape[]): Shape =>
    holes.length ? { kind: 'subtract', children: [body, ...holes] } : body;
  let shape: Shape;
  if (mode === 'plate') {
    const length = size('length'),
      width = size('width'),
      thickness = size('thickness');
    const body: Shape = { kind: 'box', size: [length, width, thickness], origin: [0, 0, 0] };
    const pattern = p.holePattern;
    if (!['none', 'center', 'four'].includes(String(pattern)))
      throw new Error('Choose a supported plate hole pattern.');
    const centers: [number, number][] = [];
    if (pattern !== 'none') {
      const diameter = size('holeDiameter');
      if (pattern === 'center') {
        if (diameter >= Math.min(length, width))
          throw new Error('The hole must fit inside the plate.');
        centers.push([length / 2, width / 2]);
      } else {
        const margin = size('holeMargin');
        if (margin <= diameter / 2 || 2 * margin + diameter >= Math.min(length, width))
          throw new Error('Four holes need positive edge clearance and separate centres.');
        for (const x of [margin, length - margin])
          for (const y of [margin, width - margin]) centers.push([x, y]);
      }
      shape = cut(
        body,
        centers.map(([x, y]) => ({
          kind: 'cylinder',
          radius: diameter / 2,
          height: thickness + 2,
          origin: [x, y, -1],
          axis: 'z',
        })),
      );
    } else shape = body;
  } else if (mode === 'sleeve' || mode === 'shaft') {
    const diameter = size('diameter'),
      length = size('length');
    const body: Shape = {
      kind: 'cylinder',
      radius: diameter / 2,
      height: length,
      origin: [0, 0, 0],
      axis: 'z',
    };
    if (mode === 'sleeve') {
      const bore = size('boreDiameter');
      if (bore >= diameter)
        throw new Error('The sleeve bore must be smaller than its outside diameter.');
      shape = cut(body, [
        {
          kind: 'cylinder',
          radius: bore / 2,
          height: length + 2,
          origin: [0, 0, -1],
          axis: 'z',
        },
      ]);
    } else {
      const hole = size('crossHoleDiameter', 0);
      if (hole) {
        const position = size('crossHolePosition');
        if (hole >= diameter || position <= hole / 2 || position + hole / 2 >= length)
          throw new Error(
            'The cross hole must fit within the shaft diameter and stay clear of its ends.',
          );
        shape = cut(body, [
          {
            kind: 'cylinder',
            radius: hole / 2,
            height: diameter + 2,
            origin: [-diameter / 2 - 1, 0, position],
            axis: 'x',
          },
        ]);
      } else shape = body;
    }
  } else if (mode === 'bracket') {
    const width = size('width'),
      depth = size('length'),
      height = size('height'),
      thickness = size('thickness');
    if (2 * thickness >= Math.min(depth, height))
      throw new Error('Bracket legs must extend beyond twice the wall thickness.');
    const body: Shape = {
      kind: 'union',
      children: [
        { kind: 'box', size: [width, depth, thickness], origin: [0, 0, 0] },
        { kind: 'box', size: [width, thickness, height], origin: [0, 0, 0] },
      ],
    };
    const diameter = size('bracketHoleDiameter', 0);
    if (diameter >= Math.min(width, depth - thickness, height - thickness))
      throw new Error('Bracket holes must fit within both legs with positive edge clearance.');
    shape = cut(
      body,
      diameter
        ? [
            {
              kind: 'cylinder',
              radius: diameter / 2,
              height: thickness + 2,
              origin: [width / 2, (depth + thickness) / 2, -1],
              axis: 'z',
            },
            {
              kind: 'cylinder',
              radius: diameter / 2,
              height: thickness + 2,
              origin: [width / 2, -1, (height + thickness) / 2],
              axis: 'y',
            },
          ]
        : [],
    );
  } else throw new Error('Choose a supported manufactured detail family.');
  return parseDetailRecipe(JSON.stringify(shape));
}
