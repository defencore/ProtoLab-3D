import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Shape, Path, Vector2 } from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { n, num, numberParameter, extrude } from '../../core/geometry';
import { modelBounds } from './lib/core/hardware';
import { annularSector, unionPolygons, pythonWire } from '../../core/mechanical';

function values(p: Parameters) {
  const r = n(p, 'outerDiameter') / 2,
    inner = n(p, 'innerDiameter') / 2,
    thickness = n(p, 'thickness');
  const band = r - inner,
    earRadius = n(p, 'earDiameter') / 2,
    a = (n(p, 'gapAngle') * Math.PI) / 360;
  const centerRadius = p.mounting === 'external' ? r - band * 0.3 : inner + band * 0.3;
  return {
    r,
    inner,
    thickness,
    earRadius,
    a,
    cx: centerRadius * Math.cos(a),
    cy: centerRadius * Math.sin(a),
  };
}
function ringOutline(p: Parameters) {
  const v = values(p),
    points = annularSector(v.r, v.inner, n(p, 'gapAngle'));
  for (let i = points.length / 2; i < points.length; i++) points[i].x += n(p, 'eccentricity');
  return points;
}

function previewOutline(points: Vector2[]): Vector2[] {
  // Boolean intersections can fall almost on an existing arc vertex. Merge
  // submicron edges before extrusion to avoid sliver faces in the preview mesh.
  const toleranceSquared = 0.0002 ** 2;
  const outline: Vector2[] = [];
  for (const point of points) {
    if (!outline.length || point.distanceToSquared(outline.at(-1)!) > toleranceSquared)
      outline.push(point);
  }
  if (outline.at(-1)!.distanceToSquared(outline[0]) <= toleranceSquared) outline.pop();
  return outline;
}
const defaults = {
  mounting: 'external',
  outerDiameter: 22,
  innerDiameter: 18,
  thickness: 1.2,
  eccentricity: 0.5,
  gapAngle: 40,
  earDiameter: 4,
  holeDiameter: 1.5,
};
const part: PartDefinition = {
  id: 'retaining-ring',
  name: 'Retaining ring',
  category: 'FASTENERS & THREADS',
  subgroup: 'RETAINING RINGS',
  icon: 'bearing',
  complexity: 'External / internal',
  description: 'An open retaining ring with inward or outward lugs and real plier holes.',
  keywords: ['snap ring', 'circlip', 'retaining', 'DIN 471', 'DIN 472', 'shaft', 'bore', 'ring'],
  parameters: [
    {
      key: 'mounting',
      label: 'Ring type',
      type: 'select',
      group: 'Type',
      options: [
        { value: 'external', label: 'External · shaft' },
        { value: 'internal', label: 'Internal · bore' },
      ],
    },
    numberParameter('outerDiameter', 'Body outside diameter', 'D', 'Ring', 3, 600),
    numberParameter('innerDiameter', 'Body inside diameter', 'd', 'Ring', 1, 590),
    numberParameter('eccentricity', 'Bore offset toward opening', 'e', 'Ring', 0, 30),
    numberParameter('thickness', 'Thickness', 's', 'Ring', 0.3, 12),
    {
      ...numberParameter('gapAngle', 'Opening angle', 'α', 'Opening & lugs', 12, 100, 1),
      unit: '°',
    },
    numberParameter('earDiameter', 'Lug diameter', 'e', 'Opening & lugs', 1, 40),
    numberParameter('holeDiameter', 'Plier hole diameter', 'h', 'Opening & lugs', 0.3, 20),
  ],
  presetMatchKeys: ['mounting', 'thickness'],
  defaults,
  presets: modulePresets,
  validate(p) {
    const v = values(p),
      errors: string[] = [];
    if (n(p, 'eccentricity') >= v.r - v.inner)
      errors.push('Bore offset must leave a continuous ring band.');
    if (v.r <= v.inner + 0.4)
      errors.push('Outside diameter must leave at least 0.4 mm of radial ring width.');
    if (n(p, 'holeDiameter') >= n(p, 'earDiameter') - 0.5)
      errors.push('Lugs need at least 0.25 mm of material around each plier hole.');
    if (v.cy <= v.earRadius + 0.1)
      errors.push('Increase the opening angle or reduce lug diameter so the lugs stay separated.');
    if (v.earRadius < (v.r - v.inner) * 0.45)
      errors.push('Increase lug diameter to connect it securely to the ring ends.');
    if (v.earRadius >= v.inner * 0.8) errors.push('Lugs are too large for the ring bore.');
    return errors;
  },
  buildGeometry(p) {
    const v = values(p);
    const circle = (radius: number, sign: number) =>
      Array.from(
        { length: 72 },
        (_, i) =>
          new Vector2(
            v.cx + radius * Math.cos((i * Math.PI * 2) / 72),
            sign * v.cy + radius * Math.sin((i * Math.PI * 2) / 72),
          ),
      );
    const outline = previewOutline(
      unionPolygons([ringOutline(p), circle(v.earRadius, -1), circle(v.earRadius, 1)]),
    );
    const shape = new Shape(outline);
    shape.closePath();
    for (const sign of [-1, 1]) {
      const hole = new Path(circle(n(p, 'holeDiameter') / 2, sign).reverse());
      hole.closePath();
      shape.holes.push(hole);
    }
    const group = new Group();
    group.add(extrude(shape, v.thickness));
    return group;
  },
  python(p) {
    const v = values(p);
    return `shape = Part.Face(${pythonWire(ringOutline(p), -v.thickness / 2)}).extrude(App.Vector(0, 0, ${num(v.thickness)}))\nfor sign in [-1, 1]:\n    lug = Part.makeCylinder(${num(v.earRadius)}, ${num(v.thickness)}, App.Vector(${num(v.cx)}, sign * ${num(v.cy)}, ${num(-v.thickness / 2)}))\n    shape = shape.fuse(lug)\n    hole = Part.makeCylinder(${num(n(p, 'holeDiameter') / 2)}, ${num(v.thickness + 2)}, App.Vector(${num(v.cx)}, sign * ${num(v.cy)}, ${num(-v.thickness / 2 - 1)}))\n    shape = shape.cut(hole)\nshape = shape.removeSplitter()`;
  },
  dimensions(p) {
    return modelBounds(part.buildGeometry(p, 'default'));
  },
  notes:
    'Editable circlip geometry with round lugs. Source presets use supplier free-ring diameters and thicknesses. Bore offset, lug rounding and unspecified holes are prototype settings, not DIN groove-fit specifications. Check the mating groove and free-ring size separately. External/internal chooses lug direction; elastic installation is not simulated.',
  sources: [
    {
      label: 'Gvyntok · external DIN 471 and internal DIN 472 families',
      url: 'https://gvyntok.com/product-category/shajby-koltsa/',
    },
    { label: 'User reference · GrabCAD Ring', url: 'https://grabcad.com/library/ring-355' },
  ],
};
export default { ...part, presets: modulePresets };
