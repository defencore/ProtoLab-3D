import { Box3, Group, Mesh, Vector3 } from 'three';
import type { Parameters } from '../../../../core/types';
import { n, num } from '../../../../core/geometry';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  component,
  pythonShape,
  type Shape,
  type Vec,
} from './shapes';

type Component = {
  label: string;
  color: number;
  rgb: Vec;
  shape: Shape;
  position: Vec;
  angle: number;
};
export function mountingPoints(p: Parameters): Vec[] {
  const pitch = n(p, 'mountingPitch'),
    top = n(p, 'bodyHeight') - n(p, 'mountingTopOffset');
  return p.variant === 'a'
    ? [
        [-pitch / 2, 0, top],
        [pitch / 2, 0, top],
        [-pitch / 2 + n(p, 'lowerHoleOffset'), 0, top - n(p, 'lowerHolePitch')],
      ]
    : [
        [-pitch / 2, 0, top],
        [pitch / 2, 0, top],
      ];
}
export function assembly(p: Parameters, state: string): Component[] {
  const l = n(p, 'bodyLength'),
    w = n(p, 'bodyWidth'),
    h = n(p, 'bodyHeight');
  const span = n(p, 'mountingSpan'),
    thickness = n(p, 'earThickness');
  const mount = mountingPoints(p),
    holeRadius = n(p, 'mountingHoleDiameter') / 2;
  // The undimensioned lower case relief is an envelope approximation; mounting bores are real.
  const relief = n(p, 'caseRelief');
  let casing: Shape = prism(
    relief > 0
      ? [
          [-l / 2, relief],
          [-l / 2, h],
          [l / 2, h],
          [l / 2, 0],
          [0, 0],
          [-l * 0.2, relief],
        ]
      : [
          [-l / 2, 0],
          [-l / 2, h],
          [l / 2, h],
          [l / 2, 0],
        ],
    w,
    -w / 2,
    'y',
  );
  if (p.variant === 'a') {
    casing = union(
      casing,
      box([span, thickness, n(p, 'earHeight')], [-span / 2, -thickness / 2, h - n(p, 'earHeight')]),
      cylinder(n(p, 'lowerEarRadius'), thickness, [mount[2][0], -thickness / 2, mount[2][2]], 'y'),
    );
    // X10 V8's lower tab projects below its rectangular case. Connect the
    // rounded tab to the case before drilling its transverse mounting hole.
    if (mount[2][2] < 0)
      casing = union(
        casing,
        box(
          [2 * n(p, 'lowerEarRadius'), thickness, 1 - mount[2][2]],
          [mount[2][0] - n(p, 'lowerEarRadius'), -thickness / 2, mount[2][2]],
        ),
      );
    casing = subtract(
      casing,
      ...mount.map(([x, , z]) => cylinder(holeRadius, w + 2, [x, -w / 2 - 1, z], 'y')),
    );
  } else {
    casing = union(casing, box([span, w, thickness], [-span / 2, -w / 2, mount[0][2] - thickness]));
    casing = subtract(
      casing,
      ...mount.map(([x, y, z]) => cylinder(holeRadius, thickness + 2, [x, y, z - thickness - 1])),
    );
  }
  const color = Number.parseInt(String(p.caseColor).slice(1), 16);
  const result: Component[] = [
    {
      label: 'KST aluminium case and mounting ears',
      color,
      rgb: [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255],
      shape: casing,
      position: [0, 0, 0],
      angle: 0,
    },
  ];
  if (state === 'body') return result;
  const shaftHeight = n(p, 'shaftHeight'),
    major = n(p, 'shaftDiameter') / 2,
    minor = n(p, 'shaftRootDiameter') / 2;
  const teeth = n(p, 'splineTeeth');
  const points: [number, number][] = [];
  // Straight-flank approximation: published diameters and tooth count, no guaranteed mating fit.
  for (let t = 0; t < teeth; t++)
    for (const [offset, radius] of [
      [0, minor],
      [0.3, major],
      [0.7, major],
      [1, minor],
    ]) {
      if (offset === 1) continue;
      const a = ((t + offset) * Math.PI * 2) / teeth;
      points.push([radius * Math.cos(a), radius * Math.sin(a)]);
    }
  const shaft = subtract(
    prism(points, shaftHeight, 0),
    cylinder(n(p, 'retainingBore') / 2, shaftHeight + 2, [0, 0, -1]),
  );
  const x = -l / 2 + n(p, 'shaftOffset'),
    angle = n(p, 'outputAngle');
  result.push({
    label: '25T output shaft',
    color: 0x777d83,
    rgb: [0.467, 0.49, 0.514],
    shape: shaft,
    position: [x, 0, h + (state === 'exploded' ? 6 : 0)],
    angle,
  });
  if (p.showHorn === true) {
    const width = n(p, 'hornWidth'),
      reach = n(p, 'hornReach'),
      plate = n(p, 'hornThickness');
    const socket = major + n(p, 'hornClearance'),
      hub = Math.max(socket + 1.5, width / 2);
    const z = shaftHeight + 0.1,
      tip = reach - width / 2;
    const outer = union(
      cylinder(hub, z + plate - 0.5, [0, 0, 0.5]),
      box([tip, width, plate], [0, -width / 2, z]),
      cylinder(width / 2, plate, [tip, 0, z]),
    );
    const horn = subtract(
      outer,
      cylinder(socket, z + 1, [0, 0, -1]),
      cylinder(n(p, 'retainingBore') / 2 + 0.1, z + plate + 2, [0, 0, -1]),
      ...[tip, reach * 0.55].map((r) =>
        cylinder(n(p, 'hornHoleDiameter') / 2, plate + 2, [r, 0, z - 1]),
      ),
    );
    result.push({
      label: 'Illustrative single-arm horn',
      color: 0xe1e3e1,
      rgb: [0.882, 0.89, 0.882],
      shape: horn,
      position: [x, 0, h + (state === 'exploded' ? 16 : 0)],
      angle,
    });
  }
  return result;
}
export function geometry(p: Parameters, state: string): Group {
  return new Group().add(
    ...assembly(p, state).map((c) => component(c.shape, c.label, c.color, c.position, c.angle)),
  );
}

export function python(p: Parameters, state: string) {
  const entries = assembly(p, state);
  return [
    ...entries.flatMap((c, i) => [
      `component_${i} = ${pythonShape(c.shape)}.removeSplitter()`,
      `component_${i}.rotate(App.Vector(0,0,0), App.Vector(0,0,1), ${num(c.angle)})`,
      `component_${i}.translate(App.Vector(${c.position.map(num).join(',')}))`,
    ]),
    `shape = Part.makeCompound([${entries.map((_, i) => `component_${i}`).join(',')}])`,
    `component_labels = ${JSON.stringify(entries.map((c) => c.label))}`,
    `component_colors = ${JSON.stringify(entries.map((c) => c.rgb))}`,
  ].join('\n');
}

export function dimensions(p: Parameters, state: string): [number, number, number] {
  const group = geometry(p, state),
    size = new Box3().setFromObject(group, true).getSize(new Vector3());
  group.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
  return [size.x, size.y, size.z];
}
