import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import modeling from '@jscad/modeling';
import { Box3, Group, Mesh, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import { n, num, numberParameter } from '../../core/geometry';
import { gearValues, involuteProfile } from './lib/core/gears';
import { disposeModel } from '../../core/mechanical';
import { booleans, primitives, transforms, solidUnionMesh } from '../../core/solid-union';
import { gearReferenceFiles } from './lib/catalog/reference-gears';
import { appendBevelEndCap } from './lib/core/end-cap';
import {
  shaftBoreOutline,
  shaftBoreParameters,
  shaftBorePython,
  shaftBoreRadius,
  shaftBoreValues,
  validateShaftBore,
} from './lib/core/shaft-bore';

const presets = modulePresets;
const defaults = presets[0].parameters;
type GearSide = 'pinion' | 'wheel';
type Point = [number, number, number];

function shaftRotation(p: Parameters, side: GearSide) {
  const rotation = (n(p, 'rotation') * Math.PI) / 180;
  return side === 'pinion' ? rotation : (-rotation * n(p, 'pinionTeeth')) / n(p, 'wheelTeeth');
}

function boreValues(p: Parameters, side: GearSide) {
  const bore = shaftBoreValues(p, side);
  bore.angle += shaftRotation(p, side);
  return bore;
}

export function bevelPairValues(p: Parameters, side: GearSide) {
  const get = (key: string) => n(p, `${side}${key}`);
  const teeth = get('Teeth'),
    mate = n(p, side === 'pinion' ? 'wheelTeeth' : 'pinionTeeth');
  const delta = Math.atan(teeth / mate),
    pitch = (n(p, 'module') * teeth) / 2;
  const cone = pitch / Math.sin(delta),
    scale = 1 - get('Face') / cone;
  const v = gearValues({
    module: n(p, 'module'),
    teeth,
    pressureAngle: n(p, 'pressureAngle'),
    backlash: n(p, 'backlash'),
    faceWidth: get('Overall'),
    bore: get('Bore'),
    hub: false,
  });
  v.tipRadius = get('Outer') / 2;
  v.rootRadius = Math.min(
    pitch - 1.25 * n(p, 'module') * Math.cos(delta),
    v.tipRadius - n(p, 'module'),
  );
  // The source gives envelope dimensions, not a generated bevel flank or cutter geometry.
  const source = involuteProfile(v);
  const outline = source.points.map((point) => point.toArray());
  const phase =
    side === 'pinion'
      ? Math.PI + Math.PI / teeth + (n(p, 'rotation') * Math.PI) / 180
      : (((-n(p, 'rotation') * Math.PI) / 180) * n(p, 'pinionTeeth')) / teeth;
  const rings = [false, true].map((small) =>
    outline.map(([x, y]): Point => {
      const radius = Math.hypot(x, y),
        t = (radius - v.rootRadius) / (v.tipRadius - v.rootRadius);
      const u = small
        ? get('BodyLength') + t * (get('Overall') - get('BodyLength'))
        : get('HubLength') + t * (get('LargeTip') - get('HubLength'));
      const s = small ? scale : 1,
        a = Math.atan2(y, x) + phase;
      return [radius * s * Math.cos(a), radius * s * Math.sin(a), u];
    }),
  );
  const points = [...rings[0], ...rings[1]];
  const count = rings[0].length,
    faces: number[][] = [];
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    faces.push([i, j, i + count], [j, j + count, i + count]);
  }
  return { get, delta, scale, v, points, faces, phase };
}

function solid(p: Parameters, side: GearSide) {
  const { get, v, scale, points: toothPoints, faces: toothFaces } = bevelPairValues(p, side);
  const bore = shaftBoreOutline(boreValues(p, side));
  const count = toothPoints.length / 2;
  const points = [...toothPoints];
  const faces = [...toothFaces];
  const circle = (radius: number, z: number) =>
    Array.from({ length: 96 }, (_, i) => {
      const index = points.length,
        a = (2 * Math.PI * i) / 96;
      points.push([radius * Math.cos(a), radius * Math.sin(a), z]);
      return index;
    });
  const boreRing = (z: number) =>
    bore.map(({ x, y }) => {
      const index = points.length;
      points.push([x, y, z]);
      return index;
    });
  const bridge = (a: number[], b: number[], inward = false) => {
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      for (const face of [
        [a[i], a[j], b[i]],
        [a[j], b[j], b[i]],
      ])
        faces.push(inward ? face.reverse() : face);
    }
  };
  const hubTop = circle(get('Hub') / 2, get('HubLength'));
  const boreBase = boreRing(get('HubLength')),
    boreTop = boreRing(get('BodyLength'));
  appendBevelEndCap(
    points,
    faces,
    Array.from({ length: count }, (_, i) => i),
    hubTop,
    v.rootRadius,
    get('HubLength'),
    false,
  );
  appendBevelEndCap(
    points,
    faces,
    Array.from({ length: count }, (_, i) => i + count),
    boreTop,
    v.rootRadius * scale,
    get('BodyLength'),
    true,
  );
  bridge(boreBase, boreTop, true);
  const teeth = primitives.polyhedron({ points, faces, orientation: 'outward' });
  // Cut only the hub. Extending Boolean planes through narrow teeth creates sliver edges.
  const outer = Array.from({ length: 96 }, (_, i): [number, number] => [
    (get('Hub') / 2) * Math.cos((2 * Math.PI * i) / 96),
    (get('Hub') / 2) * Math.sin((2 * Math.PI * i) / 96),
  ]);
  const inner = [...bore].reverse().map(({ x, y }): [number, number] => [x, y]);
  const sides = [outer, inner].flatMap((ring) =>
    ring.map((point, index): [[number, number], [number, number]] => [
      point,
      ring[(index + 1) % ring.length],
    ]),
  );
  // Extrude the complete annulus to retain flats without Boolean slivers at the bore corners.
  let shape = modeling.extrusions.extrudeLinear(
    { height: get('HubLength') },
    modeling.geometries.geom2.create(sides),
  );
  if (p.setScrews) {
    const hole = transforms.translate(
      [0, get('Hub') / 4, get('HubLength') / 2],
      transforms.rotateX(
        Math.PI / 2,
        primitives.cylinder({
          radius: n(p, 'setScrewDiameter') / 2,
          height: get('Hub') / 2 + 2,
          segments: 40,
        }),
      ),
    );
    shape = booleans.subtract(shape, transforms.rotateZ(shaftRotation(p, side), hole));
  }
  const hubBoundary = modeling.geometries.geom3
    .toPolygons(shape)
    .filter(
      (polygon) => !polygon.vertices.every((point) => Math.abs(point[2] - get('HubLength')) < 1e-7),
    );
  return modeling.geometries.geom3.create([
    ...modeling.geometries.geom3.toPolygons(teeth),
    ...hubBoundary,
  ]);
}
function build(p: Parameters, state: string): Group {
  const group = new Group();
  for (const side of ['pinion', 'wheel'] as const) {
    if ((state === 'pinion' && side !== 'pinion') || (state === 'wheel' && side !== 'wheel'))
      continue;
    const get = (key: string) => n(p, `${side}${key}`),
      shape = solid(p, side);
    const bounds = modeling.measurements.measureBoundingBox(shape);
    // Radial holes can leave small real intersection facets beside shaft flats.
    const mesh = solidUnionMesh(shape, { minimumTriangleArea: 1e-10 }).children[0] as Mesh;
    mesh.position.set(...(bounds[0].map((x, i) => (x + bounds[1][i]) / 2) as Point));
    mesh.name = side === 'pinion' ? 'Bevel pinion' : 'Bevel wheel';
    const holder = new Group().add(mesh);
    if (state === 'pinion' || state === 'wheel') holder.position.z = -get('Overall') / 2;
    else {
      const distance = get('Mounting') + (state === 'exploded' ? n(p, 'module') * 12 : 0);
      if (side === 'pinion') {
        holder.rotation.y = -Math.PI / 2;
        holder.position.x = distance;
      } else holder.position.z = -distance;
    }
    group.add(holder);
  }
  return group;
}

function pythonGear(p: Parameters, side: GearSide): string {
  const get = (key: string) => n(p, `${side}${key}`);
  const polygons = modeling.geometries.geom3.toPolygons(solid({ ...p, setScrews: false }, side));
  const vertices: Point[] = [],
    indices = new Map<string, number>();
  const faces = polygons.map((polygon) =>
    polygon.vertices.map((point) => {
      const key = point.map((value) => num(value)).join(',');
      let index = indices.get(key);
      if (index === undefined) {
        index = vertices.length;
        vertices.push(point as Point);
        indices.set(key, index);
      }
      return index;
    }),
  );
  return `# The same closed boundary defines preview and native mounting envelopes.
points = [App.Vector(*point) for point in ${JSON.stringify(vertices)}]
faces = ${JSON.stringify(faces)}
surfaces = [Part.Face(Part.makePolygon([points[i] for i in face] + [points[face[0]]])) for face in faces]
shape = Part.makeSolid(Part.makeShell(surfaces))
# Keep circles analytic while preserving the selected shaft flats and keyway.
${shaftBorePython(boreValues(p, side), get('Overall') + 2, -1)}
shape = shape.cut(bore)
${
  p.setScrews
    ? `set_screw_hole = Part.makeCylinder(${num(n(p, 'setScrewDiameter') / 2)},${num(get('Hub') / 2 + 2)},App.Vector(0,-1,${num(get('HubLength') / 2)}),App.Vector(0,1,0))
set_screw_hole.rotate(App.Vector(0,0,0),App.Vector(0,0,1),${num((shaftRotation(p, side) * 180) / Math.PI)})
shape = shape.cut(set_screw_hole)`
    : ''
}
# Preserve triangular patches instead of merging narrow bevel root wires.
${side} = shape`;
}
const fields = (side: GearSide) => {
  const group = side === 'pinion' ? 'Pinion dimensions' : 'Wheel dimensions';
  const name = side === 'pinion' ? 'Pinion' : 'Wheel';
  return [
    { ...numberParameter(`${side}Teeth`, `${name} teeth`, 'z', group, 8, 80, 1), unit: '' },
    {
      ...numberParameter(`${side}Bore`, `${name} bore`, 'd', group, 1, 80, 0.01),
      description:
        'Diameter for round / D / keyed holes; across flats for hex / square; inscribed diameter for custom polygons. The m2 15/30 stock options specify a round pinion and keyed wheel.',
    },
    ...shaftBoreParameters(group, side, name).map((field) =>
      field.key === `${side}BoreKeyDepth`
        ? {
            ...field,
            description:
              'Editable prototype depth from the nominal circular edge to the outer slot wall. The supplied m2 drawing specifies keyway width only; it does not specify this depth.',
          }
        : field,
    ),
    ...(
      [
        ['Outer', 'Outside diameter', 'D', 2, 200],
        ['Mounting', 'Back face to shaft intersection', 'A', 2, 200],
        ['Overall', 'Overall axial length', 'F', 1, 100],
        ['LargeTip', 'Large-end tooth-tip position', 'G', 1, 100],
        ['Face', 'Slant face width', 'Z', 1, 50],
        ['Hub', 'Hub diameter', 'N', 2, 150],
        ['HubLength', 'Hub / large-root length', 'H', 1, 80],
        ['BodyLength', 'Small-end root position', 'L', 1, 100],
        ['BoreMin', 'Reference bore minimum', 'd min', 1, 80],
        ['BoreMax', 'Reference bore maximum', 'd max', 1, 80],
      ] as const
    ).map(([key, label, symbol, min, max]) => ({
      ...numberParameter(
        `${side}${key}`,
        `${name} ${label.toLowerCase()}`,
        symbol,
        group,
        min,
        max,
        0.01,
      ),
      description:
        key === 'BoreMin' || key === 'BoreMax'
          ? 'Bounds from the supplied listing; the bore is freely adjustable within this interval.'
          : 'Measured from the back hub face where an axial position is specified.',
    })),
  ];
};

const part: PartDefinition = {
  id: 'bevel-gear-pair',
  name: 'Bevel gear pair · mounting layout',
  category: 'MOTION',
  subgroup: 'GEARS & RACKS',
  icon: 'gear',
  complexity: 'Perpendicular shaft pair',
  description:
    'Two bevel gears with the supplied hub, tooth and mounting envelopes, independent bores and radial set screw holes.',
  keywords: [
    'bevel',
    'pair',
    'mounting',
    'pinion',
    'right angle',
    '2:1',
    '1:2',
    '45# steel',
    'keyway',
    'miter',
    'mitre',
    'transmission',
  ],
  defaults,
  presets: modulePresets,
  presetMatchKeys: ['module', 'pinionTeeth', 'wheelTeeth', 'pinionBore', 'wheelBore'],
  parameters: [
    numberParameter('module', 'Large-end module', 'm', 'Transmission', 0.3, 5, 0.1),
    {
      ...numberParameter(
        'pressureAngle',
        'Prototype pressure angle',
        'α',
        'Transmission',
        14.5,
        25,
        0.5,
      ),
      unit: '°',
      description: 'Not specified in the reference. Changes the sampled layout flank.',
    },
    {
      ...numberParameter(
        'backlash',
        'Prototype tooth thinning',
        'j',
        'Transmission',
        0.01,
        1,
        0.01,
      ),
      description:
        'Tangential tooth-thickness allowance; not a measured backlash or a contact guarantee.',
    },
    {
      ...numberParameter('rotation', 'Pinion rotation', 'θ', 'Transmission', 0, 360, 1),
      unit: '°',
      description: 'The wheel follows the tooth-count ratio. This is a motion illustration.',
    },
    { key: 'setScrews', label: 'Radial set screw holes', type: 'boolean', group: 'Mounting' },
    {
      ...numberParameter(
        'setScrewDiameter',
        'Nominal set screw hole',
        'ds',
        'Mounting',
        1,
        12,
        0.1,
      ),
      visibleWhen: (p) => Boolean(p.setScrews),
      description: 'Editable smooth bore; thread size is not supplied in the drawing.',
    },
    ...fields('pinion'),
    ...fields('wheel'),
  ],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description:
        'Perpendicular axes intersect at the origin; mounting dimensions locate both back faces.',
    },
    {
      id: 'exploded',
      label: 'Separated',
      description: 'Moves both gears away from the shaft intersection.',
    },
    {
      id: 'pinion',
      label: 'Pinion only',
      description: 'Independent pinion centered on its bore axis.',
    },
    {
      id: 'wheel',
      label: 'Wheel only',
      description: 'Independent wheel centered on its bore axis.',
    },
  ],
  validate(p) {
    const errors: string[] = [];
    for (const side of ['pinion', 'wheel'] as const) {
      const { get, scale, v } = bevelPairValues(p, side);
      const bore = boreValues(p, side);
      errors.push(...validateShaftBore(bore).map((error) => `${side}: ${error}`));
      if (!Number.isInteger(get('Teeth'))) errors.push(`${side}: tooth count must be an integer.`);
      if (v.tipRadius <= v.baseRadius)
        errors.push(
          `${side}: outside diameter must exceed the base-circle diameter for the chosen module and tooth count.`,
        );
      if (scale <= 0.35 || scale >= 1)
        errors.push(`${side}: reduce slant face width to retain at least 35% of the large end.`);
      if (get('Bore') < get('BoreMin') || get('Bore') > get('BoreMax'))
        errors.push(`${side}: bore must stay within the selected reference interval.`);
      if (shaftBoreRadius(bore) + 0.2 >= Math.min(v.rootRadius * scale, get('Hub') / 2))
        errors.push(
          `${side}: the bore leaves too little material inside the hub or small tooth roots.`,
        );
      if (get('Hub') / 2 >= v.rootRadius)
        errors.push(`${side}: the hub must fit within the large-end tooth roots.`);
      if (
        get('HubLength') >= get('LargeTip') ||
        get('LargeTip') >= get('Overall') ||
        get('HubLength') >= get('BodyLength') ||
        get('BodyLength') >= get('Overall')
      )
        errors.push(`${side}: axial dimensions must satisfy H < G < F and H < L < F.`);
      if (get('Mounting') <= get('Overall'))
        errors.push(`${side}: the mounting distance must exceed the overall gear length.`);
      if (p.setScrews && n(p, 'setScrewDiameter') >= get('HubLength') * 0.8)
        errors.push(`${side}: reduce the set screw hole to fit within the hub length.`);
      if (n(p, 'backlash') >= (Math.PI * n(p, 'module')) / 3)
        errors.push('Reduce tooth thinning below one third of the circular pitch.');
      if (
        v.halfThickness +
          Math.tan(v.angle) -
          v.angle -
          (Math.sqrt((v.tipRadius / v.baseRadius) ** 2 - 1) -
            Math.acos(v.baseRadius / v.tipRadius)) <=
        0.001
      )
        errors.push(
          `${side}: the requested outside diameter produces pointed teeth; reduce pressure angle or tooth thinning.`,
        );
    }
    return [...new Set(errors)];
  },
  buildGeometry: build,
  python(p, state) {
    const chunks: string[] = [],
      objects: string[] = [];
    for (const side of ['pinion', 'wheel'] as const) {
      if ((state === 'pinion' && side !== 'pinion') || (state === 'wheel' && side !== 'wheel'))
        continue;
      chunks.push(pythonGear(p, side));
      objects.push(side);
      if (state === 'pinion' || state === 'wheel')
        chunks.push(`${side}.translate(App.Vector(0,0,${num(-n(p, `${side}Overall`) / 2)}))`);
      else {
        const distance = n(p, `${side}Mounting`) + (state === 'exploded' ? n(p, 'module') * 12 : 0);
        chunks.push(
          side === 'pinion'
            ? `pinion.rotate(App.Vector(0,0,0),App.Vector(0,1,0),-90)\npinion.translate(App.Vector(${num(distance)},0,0))`
            : `wheel.translate(App.Vector(0,0,${num(-distance)}))`,
        );
      }
    }
    return (
      chunks.join('\n') +
      `\nshape = Part.makeCompound([${objects.join(',')}])\ncomponent_labels = ${JSON.stringify(objects.map((name) => (name === 'pinion' ? 'Pinion' : 'Wheel')))}`
    );
  },
  dimensions(p, state) {
    const model = build(p, state);
    try {
      return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Point;
    } finally {
      disposeModel(model);
    }
  },
  notes:
    'Six mounting references cover twelve table rows. The m2 15/30 listing adds 25 configurations of separately sold gears: pinion bores 8/10/12/14/15 mm without a keyway, and wheel bores 14/15/16 mm with a 5 mm keyway or 18/20 mm with a 6 mm keyway. Keyway depth remains an editable prototype dimension. The origin is the intersection of the 90° shaft axes. Teeth use a faceted, tapered involute-like layout profile; pressure angle, tooth corrections, root fillets and set screw thread sizes are unspecified. This geometry does not establish conjugate contact or supplier interchangeability.',
  sources: [
    { label: 'User-supplied bevel mounting drawing', url: gearReferenceFiles.bevel },
    { label: 'Additional mounting size table', url: gearReferenceFiles.mounting },
    { label: '1:2 bevel pair · separately sold gears', url: gearReferenceFiles.pairPhoto },
    { label: 'm2 15T / 30T · bore and keyway options', url: gearReferenceFiles.m2Options },
  ],
};
export default { ...part, presets: modulePresets };
