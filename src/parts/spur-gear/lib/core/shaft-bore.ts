import { Vector2 } from 'three';
import { n, num, numberParameter } from '../../../../core/geometry';
import type { ParameterDefinition, Parameters } from '../../../../core/types';

export const shaftBoreShapes = [
  ['round', 'Round'],
  ['hex', 'Hexagon'],
  ['d', 'D-shaft'],
  ['double-d', 'Double D'],
  ['square', 'Square'],
  ['polygon', 'Custom polygon'],
  ['keyway', 'Round with keyway'],
] as const;

const key = (prefix: string, suffix: string) =>
  prefix ? `${prefix}Bore${suffix}` : `bore${suffix}`;

export function shaftBoreDefaults(prefix = ''): Parameters {
  return Object.fromEntries(
    Object.entries({
      Shape: 'round',
      Angle: 0,
      FlatDepth: 1,
      Sides: 6,
      KeyWidth: 2,
      KeyDepth: 1,
    }).map(([suffix, value]) => [key(prefix, suffix), value]),
  );
}

export function shaftBoreParameters(
  group = 'Shaft connection',
  prefix = '',
  name = '',
): ParameterDefinition[] {
  const label = (value: string) => `${name ? `${name} ` : ''}${value}`;
  const active = (p: Parameters) => n(p, key(prefix, '')) > 0;
  const selected = (p: Parameters, shapes: string[]) =>
    active(p) && shapes.includes(String(p[key(prefix, 'Shape')]));
  return [
    {
      key: key(prefix, 'Shape'),
      label: label('Bore shape'),
      type: 'select',
      group,
      options: shaftBoreShapes.map(([value, label]) => ({ value, label })),
      visibleWhen: active,
      description:
        'Bore size is the shaft diameter for round, D and keyed holes; across flats for hexagon and square; and the inscribed-circle diameter for a custom polygon.',
    },
    {
      ...numberParameter(key(prefix, 'Angle'), label('Bore rotation'), 'θb', group, 0, 360, 1),
      unit: '°',
      visibleWhen: (p) => active(p) && p[key(prefix, 'Shape')] !== 'round',
      description: 'Rotates the shaft profile around its axis. D flats and keyways face +X at 0°.',
    },
    {
      ...numberParameter(
        key(prefix, 'FlatDepth'),
        label('Flat depth'),
        't',
        group,
        0.01,
        100,
        0.01,
      ),
      visibleWhen: (p) => selected(p, ['d', 'double-d']),
      description:
        'Material retained from the circular edge to each flat. Double D uses equal opposite flats.',
    },
    {
      ...numberParameter(key(prefix, 'Sides'), label('Polygon sides'), 'n', group, 3, 12, 1),
      unit: '',
      visibleWhen: (p) => selected(p, ['polygon']),
    },
    {
      ...numberParameter(
        key(prefix, 'KeyWidth'),
        label('Keyway width'),
        'b',
        group,
        0.01,
        80,
        0.01,
      ),
      visibleWhen: (p) => selected(p, ['keyway']),
    },
    {
      ...numberParameter(
        key(prefix, 'KeyDepth'),
        label('Keyway radial depth'),
        't2',
        group,
        0.01,
        40,
        0.01,
      ),
      visibleWhen: (p) => selected(p, ['keyway']),
      description:
        'Distance from the nominal circular edge to the outer keyway wall. This editable slot does not imply a standard key fit.',
    },
  ];
}

export interface ShaftBore {
  shape: string;
  radius: number;
  angle: number;
  flatDepth: number;
  sides: number;
  keyWidth: number;
  keyDepth: number;
}

export function shaftBoreValues(p: Parameters, prefix = ''): ShaftBore {
  const values = { ...shaftBoreDefaults(prefix), ...p };
  return {
    shape: String(values[key(prefix, 'Shape')]),
    radius: n(values, key(prefix, '')) / 2,
    angle: (n(values, key(prefix, 'Angle')) * Math.PI) / 180,
    flatDepth: n(values, key(prefix, 'FlatDepth')),
    sides: n(values, key(prefix, 'Sides')),
    keyWidth: n(values, key(prefix, 'KeyWidth')),
    keyDepth: n(values, key(prefix, 'KeyDepth')),
  };
}

/** Counterclockwise constant shaft section, shared by both end caps and bore walls. */
export function shaftBoreOutline(v: ShaftBore): Vector2[] {
  if (v.radius <= 0) return [];
  const points: Vector2[] = [];
  const point = (x: number, y: number) => points.push(new Vector2(x, y));
  const arc = (start: number, end: number) => {
    const steps = Math.max(2, Math.ceil(((end - start) * 96) / (2 * Math.PI)));
    for (let i = 0; i <= steps; i++) {
      const a = start + ((end - start) * i) / steps;
      point(v.radius * Math.cos(a), v.radius * Math.sin(a));
    }
  };
  if (['hex', 'square', 'polygon'].includes(v.shape)) {
    const sides = v.shape === 'hex' ? 6 : v.shape === 'square' ? 4 : v.sides;
    const radius = v.radius / Math.cos(Math.PI / sides);
    for (let i = 0; i < sides; i++) {
      const a = ((2 * i + 1) * Math.PI) / sides;
      point(radius * Math.cos(a), radius * Math.sin(a));
    }
  } else if (v.shape === 'd' || v.shape === 'double-d') {
    const a = Math.acos((v.radius - v.flatDepth) / v.radius);
    if (v.shape === 'd') arc(a, Math.PI * 2 - a);
    else {
      arc(a, Math.PI - a);
      arc(Math.PI + a, Math.PI * 2 - a);
    }
  } else if (v.shape === 'keyway') {
    const a = Math.asin(v.keyWidth / (2 * v.radius));
    arc(a, Math.PI * 2 - a);
    point(v.radius + v.keyDepth, -v.keyWidth / 2);
    point(v.radius + v.keyDepth, v.keyWidth / 2);
  } else {
    for (let i = 0; i < 96; i++) {
      const a = (2 * Math.PI * i) / 96;
      point(v.radius * Math.cos(a), v.radius * Math.sin(a));
    }
  }
  return points.map((point) => point.rotateAround(new Vector2(), v.angle));
}

export function shaftBoreRadius(v: ShaftBore): number {
  if (v.radius <= 0) return 0;
  if (['hex', 'square', 'polygon'].includes(v.shape)) {
    const sides = v.shape === 'hex' ? 6 : v.shape === 'square' ? 4 : v.sides;
    return v.radius / Math.cos(Math.PI / sides);
  }
  return v.shape === 'keyway' ? Math.hypot(v.radius + v.keyDepth, v.keyWidth / 2) : v.radius;
}

export function validateShaftBore(v: ShaftBore): string[] {
  const errors: string[] = [];
  if (!shaftBoreShapes.some(([shape]) => shape === v.shape))
    errors.push('Choose a valid bore shape.');
  if (v.radius <= 0) return errors;
  if (['d', 'double-d'].includes(v.shape) && (v.flatDepth <= 0 || v.flatDepth >= v.radius))
    errors.push('Bore flat depth must be greater than zero and less than the shaft radius.');
  if (v.shape === 'polygon' && (!Number.isInteger(v.sides) || v.sides < 3 || v.sides > 12))
    errors.push('A custom bore polygon must have 3 to 12 whole sides.');
  if (v.shape === 'keyway' && (v.keyWidth <= 0 || v.keyWidth >= 2 * v.radius || v.keyDepth <= 0))
    errors.push(
      'Keyway width must be less than the shaft diameter, and its width and radial depth must be positive.',
    );
  return errors;
}

/** Exact circles and planar flats in OpenCascade, extending past both gear faces. */
export function shaftBorePython(
  v: ShaftBore,
  length: number,
  z: number,
  variable = 'bore',
): string {
  if (v.radius <= 0) return '';
  if (['hex', 'square', 'polygon'].includes(v.shape)) {
    const points = shaftBoreOutline(v).map(({ x, y }) => [Number(num(x)), Number(num(y))]);
    return `${variable}_points = [App.Vector(x,y,${num(z)}) for x,y in ${JSON.stringify(points)}]\n${variable} = Part.Face(Part.makePolygon(${variable}_points + [${variable}_points[0]])).extrude(App.Vector(0,0,${num(length)}))`;
  }
  const chunks = [
    `${variable} = Part.makeCylinder(${num(v.radius)},${num(length)},App.Vector(0,0,${num(z)}))`,
  ];
  const r = v.radius,
    c = r - v.flatDepth;
  if (v.shape === 'd' || v.shape === 'double-d') {
    const left = v.shape === 'd' ? -r - 1 : -c;
    chunks.push(
      `${variable} = ${variable}.common(Part.makeBox(${num(c - left)},${num(2 * r + 2)},${num(length + 2)},App.Vector(${num(left)},${num(-r - 1)},${num(z - 1)})))`,
    );
  } else if (v.shape === 'keyway') {
    chunks.push(
      `${variable} = ${variable}.fuse(Part.makeBox(${num(r + v.keyDepth)},${num(v.keyWidth)},${num(length)},App.Vector(0,${num(-v.keyWidth / 2)},${num(z)}))).removeSplitter()`,
    );
  }
  if (v.angle)
    chunks.push(
      `${variable}.rotate(App.Vector(0,0,0),App.Vector(0,0,1),${num((v.angle * 180) / Math.PI)})`,
    );
  return chunks.join('\n');
}
