import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Box3, Group, Mesh, MeshStandardMaterial, Vector2, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import { n, num } from '../../../core/geometry';
import { solidUnionMesh } from '../../../core/solid-union';
import { BoundaryMesh, unionPolygons } from '../../../core/mechanical';

const { primitives, booleans, transforms, extrusions } = modeling;
export type Point = [number, number];
export function armDirections(p: Parameters) {
  if (p.form === 'disc') return [];
  return Array.from(
    { length: p.form === 'single' ? 1 : p.form === 'double' ? 2 : p.form === 'cross' ? 4 : 6 },
    (_, i) => {
      const count = p.form === 'cross' ? 4 : p.form === 'six' ? 6 : 2;
      const perpendicular = p.form === 'cross' && i % 2 === 1;
      return {
        angle: (i * 2 * Math.PI) / count,
        reach:
          p.form === 'single'
            ? n(p, 'armLength') - n(p, 'hubDiameter') / 2 - (p.clamp ? n(p, 'clampExtension') : 0)
            : n(p, perpendicular ? 'perpendicularLength' : 'armLength') / 2,
        count: n(p, perpendicular ? 'perpendicularHoleCount' : 'holeCount'),
        start: n(p, perpendicular ? 'perpendicularFirstHole' : 'firstHoleRadius'),
        spacing: n(p, perpendicular ? 'perpendicularHoleSpacing' : 'holeSpacing'),
      };
    },
  );
}
export function holeCenters(p: Parameters): Point[] {
  if (p.form === 'disc')
    return Array.from({ length: n(p, 'discHoleCount') }, (_, i) => {
      const a = (i * 2 * Math.PI) / n(p, 'discHoleCount');
      return [
        (Math.cos(a) * n(p, 'discPitchDiameter')) / 2,
        (Math.sin(a) * n(p, 'discPitchDiameter')) / 2,
      ];
    });
  return armDirections(p).flatMap((arm) =>
    Array.from({ length: arm.count }, (_, i) => {
      const r = arm.start + i * arm.spacing;
      return [r * Math.cos(arm.angle), r * Math.sin(arm.angle)] as Point;
    }),
  );
}
function armPoints(reach: number, rootWidth: number, tipWidth: number, angle: number): Point[] {
  const points: Point[] = [[0, -rootWidth / 2]];
  const r = tipWidth / 2,
    x = reach - r;
  for (let i = 0; i <= 32; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 32;
    points.push([x + r * Math.cos(a), r * Math.sin(a)]);
  }
  points.push([0, rootWidth / 2]);
  return points.map(([x0, y0]) => [
    x0 * Math.cos(angle) - y0 * Math.sin(angle),
    x0 * Math.sin(angle) + y0 * Math.cos(angle),
  ]);
}
export function hornOutline(p: Parameters): Point[] {
  if (p.form === 'disc')
    return Array.from({ length: 96 }, (_, i) => [
      (Math.cos((i * Math.PI) / 48) * n(p, 'armLength')) / 2,
      (Math.sin((i * Math.PI) / 48) * n(p, 'armLength')) / 2,
    ]);
  const outlines: Point[][] = [
    Array.from({ length: 96 }, (_, i) => [
      (Math.cos((i * Math.PI) / 48) * n(p, 'hubDiameter')) / 2,
      (Math.sin((i * Math.PI) / 48) * n(p, 'hubDiameter')) / 2,
    ]),
    ...armDirections(p).map((arm) =>
      armPoints(arm.reach, n(p, 'armWidth'), n(p, 'tipWidth'), arm.angle),
    ),
  ];
  if (p.clamp) {
    const back = -(n(p, 'hubDiameter') / 2 + n(p, 'clampExtension')),
      w = n(p, 'clampWidth') / 2;
    outlines.push([
      [back, -w],
      [0, -w],
      [0, w],
      [back, w],
    ]);
  }
  return unionPolygons(outlines.map((loop) => loop.map(([x, y]) => new Vector2(x, y)))).map((v) => [
    v.x,
    v.y,
  ]);
}
/** Editable straight-flank serrations; no proprietary servo spline fit is inferred. */
export function splinePoints(p: Parameters): Point[] {
  return Array.from({ length: n(p, 'splineTeeth') * 4 }, (_, i) => {
    const r = n(p, i % 4 === 1 || i % 4 === 2 ? 'splineMajorDiameter' : 'splineMinorDiameter') / 2;
    const a = (i * Math.PI) / (2 * n(p, 'splineTeeth'));
    return [r * Math.cos(a), r * Math.sin(a)];
  });
}
function cyl(radius: number, z: number, height: number, x = 0, y = 0) {
  return primitives.cylinder({ radius, height, center: [x, y, z + height / 2], segments: 32 });
}
function prism(points: Point[], z: number, height: number) {
  return transforms.translate(
    [0, 0, z],
    extrusions.extrudeLinear({ height }, primitives.polygon({ points })),
  );
}
export function clampValues(p: Parameters) {
  const x = -(n(p, 'hubDiameter') / 2 + n(p, 'clampExtension') / 2);
  const z = n(p, 'hubHeight') / 2,
    width = n(p, 'clampWidth'),
    d = n(p, 'clampScrewDiameter');
  return { x, z, width, d, head: d * 1.7, headHeight: d * 0.6 };
}
function alongY(radius: number, y0: number, length: number, x: number, z: number, segments = 32) {
  return transforms.translate(
    [x, y0 + length / 2, z],
    transforms.rotateX(Math.PI / 2, primitives.cylinder({ radius, height: length, segments })),
  );
}
export function hornSolid(p: Parameters): Geom3 {
  const height = n(p, 'hubHeight'),
    t = n(p, 'plateThickness');
  const base = [prism(hornOutline(p), 0, t), cyl(n(p, 'hubDiameter') / 2, 0, height)];
  const holes = [
    prism(splinePoints(p), -0.1, n(p, 'socketDepth') + 0.1),
    cyl(n(p, 'screwBore') / 2, -0.1, height + 0.2),
    ...holeCenters(p).map(([x, y]) => cyl(n(p, 'holeDiameter') / 2, -0.1, height + 0.2, x, y)),
  ];
  if (n(p, 'counterboreDepth') > 0)
    holes.push(
      cyl(
        n(p, 'counterboreDiameter') / 2,
        height - n(p, 'counterboreDepth'),
        n(p, 'counterboreDepth') + 0.1,
      ),
    );
  if (p.clamp) {
    const c = clampValues(p),
      back = -(n(p, 'hubDiameter') / 2 + n(p, 'clampExtension'));
    base.push(
      primitives.cuboid({ size: [-back, c.width, height], center: [back / 2, 0, height / 2] }),
    );
    holes.push(
      primitives.cuboid({
        size: [-back + 0.2, n(p, 'clampSlit'), height + 0.2],
        center: [(back - 0.2) / 2, 0, height / 2],
      }),
      alongY(c.d / 2 + 0.1, -c.width, c.width * 2, c.x, c.z),
    );
  }
  return booleans.subtract(booleans.union(...base), ...holes);
}
function clampScrew(p: Parameters): Geom3 {
  const c = clampValues(p),
    top = -c.width / 2 - c.headHeight;
  return booleans.subtract(
    booleans.union(
      alongY(c.head / 2, top, c.headHeight + 0.02, c.x, c.z),
      alongY(c.d / 2, -c.width / 2, c.width, c.x, c.z),
    ),
    alongY(c.d * 0.32, top - 0.05, c.headHeight * 0.6, c.x, c.z, 6),
  );
}
export const finishes: Record<string, number> = {
  red: 0xbc3647,
  blue: 0x2585c7,
  silver: 0xb8bec5,
  black: 0x272b31,
  white: 0xe7e8e3,
};
function mesh(solid: Geom3, name: string, color: number, nylon = false) {
  const bounds = modeling.measurements.measureBoundingBox(solid),
    model = solidUnionMesh(solid);
  model.position.set(
    ...(bounds[0].map((v, i) => (v + bounds[1][i]) / 2) as [number, number, number]),
  );
  model.name = name;
  model.traverse((child) => {
    if (child instanceof Mesh) {
      const m = child.material as MeshStandardMaterial;
      m.color.setHex(color);
      m.metalness = nylon ? 0 : 0.6;
      m.roughness = nylon ? 0.65 : 0.3;
    }
  });
  return model;
}
/** Build the stepped plate and socket directly; only split clamps need solid booleans. */
function plainHornMesh(p: Parameters) {
  const boundary = new BoundaryMesh(),
    t = n(p, 'plateThickness'),
    h = n(p, 'hubHeight'),
    depth = n(p, 'socketDepth');
  const outline = hornOutline(p),
    spline = splinePoints(p),
    holeRadius = n(p, 'holeDiameter') / 2;
  const circle = (radius: number, x = 0, y = 0, segments = 64): Point[] =>
    Array.from({ length: segments }, (_, i) => [
      x + radius * Math.cos((i * 2 * Math.PI) / segments),
      y + radius * Math.sin((i * 2 * Math.PI) / segments),
    ]);
  const lift = (loop: Point[], z: number) => loop.map(([x, y]) => new Vector3(x, y, z));
  const top = new Vector3(0, 0, 1),
    bottom = new Vector3(0, 0, -1);
  const hubCircle = circle(n(p, 'hubDiameter') / 2, 0, 0, 96),
    screw = circle(n(p, 'screwBore') / 2);
  const hub = hubCircle.flatMap((a, i) => {
    const b = hubCircle[(i + 1) % hubCircle.length],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = dx * dx + dy * dy;
    const cuts = outline
      .map((point) => ({ point, t: ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length }))
      .filter(
        ({ point, t }) =>
          t > 1e-7 &&
          t < 1 - 1e-7 &&
          Math.abs((point[0] - a[0]) * dy - (point[1] - a[1]) * dx) < 1e-7,
      )
      .sort((a, b) => a.t - b.t);
    return [a, ...cuts.map((c) => c.point)];
  });
  const holes = holeCenters(p).map(([x, y]) => circle(holeRadius, x, y, 32));
  boundary.bridge(lift(outline, 0), lift(outline, t));
  for (const hole of holes) boundary.bridge(lift(hole, 0), lift(hole, t), true);
  boundary.face(lift(outline, 0), [lift(spline, 0), ...holes.map((hole) => lift(hole, 0))], bottom);
  if (h > t) {
    boundary.face(lift(outline, t), [lift(hub, t), ...holes.map((hole) => lift(hole, t))], top);
    boundary.bridge(lift(hub, t), lift(hub, h));
  }
  boundary.bridge(lift(spline, 0), lift(spline, depth), true);
  boundary.face(lift(spline, depth), [lift(screw, depth)], bottom);
  const cbDepth = n(p, 'counterboreDepth'),
    seat = h - cbDepth;
  boundary.bridge(lift(screw, depth), lift(screw, seat), true);
  const boreTop = cbDepth > 0 ? circle(n(p, 'counterboreDiameter') / 2) : screw;
  if (cbDepth > 0) {
    boundary.face(lift(boreTop, seat), [lift(screw, seat)], top);
    boundary.bridge(lift(boreTop, seat), lift(boreTop, h), true);
  }
  boundary.face(
    lift(h > t ? hub : outline, h),
    [lift(boreTop, h), ...(h > t ? [] : holes.map((hole) => lift(hole, h)))],
    top,
  );
  const raw = boundary.build(finishes[String(p.finish)]),
    position = raw.geometry.getAttribute('position');
  const polygons = [];
  for (let i = 0; i < position.count; i += 3) {
    const vertices = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(position, i + j));
    if (
      vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).lengthSq() >
      1e-18
    )
      polygons.push(
        modeling.geometries.poly3.create(
          vertices.map((v) => v.toArray() as [number, number, number]),
        ),
      );
  }
  raw.geometry.dispose();
  (raw.material as MeshStandardMaterial).dispose();
  return mesh(
    modeling.geometries.geom3.create(polygons),
    'Servo horn body',
    finishes[String(p.finish)],
    p.finish === 'black' || p.finish === 'white',
  );
}
export function buildHorn(p: Parameters, state: string): Group {
  const group = new Group().add(
    p.clamp
      ? mesh(
          hornSolid(p),
          'Servo horn body',
          finishes[String(p.finish)],
          p.finish === 'black' || p.finish === 'white',
        )
      : plainHornMesh(p),
  );
  if (p.clamp && p.showClampScrew) group.add(mesh(clampScrew(p), 'Clamp screw', 0x444b54));
  if (state === 'socket-up') group.rotation.x = Math.PI;
  group.updateMatrixWorld(true);
  group.position.sub(new Box3().setFromObject(group, true).getCenter(new Vector3()));
  return group;
}
export function hornDimensions(p: Parameters): [number, number, number] {
  const points = hornOutline(p),
    xs = points.map((q) => q[0]),
    ys = points.map((q) => q[1]);
  if (p.clamp && p.showClampScrew) {
    const c = clampValues(p);
    ys.push(-c.width / 2 - c.headHeight);
    xs.push(c.x - c.head / 2, c.x + c.head / 2);
  }
  return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), n(p, 'hubHeight')];
}
function pythonPrism(points: Point[], z: number, h: number) {
  const ps = [...points, points[0]].map(([x, y]) => `App.Vector(${num(x)},${num(y)},${num(z)})`);
  return `Part.Face(Part.makePolygon([${ps.join(',')}])).extrude(App.Vector(0,0,${num(h)}))`;
}
export function hornPython(p: Parameters, state: string) {
  const height = n(p, 'hubHeight'),
    t = n(p, 'plateThickness');
  const lines = [
    '# Socket serrations use editable straight flanks; confirm the servo fit before manufacture.',
    `body = ${pythonPrism(hornOutline(p), 0, t)}`,
    `body = body.fuse(Part.makeCylinder(${num(n(p, 'hubDiameter') / 2)},${num(height)}))`,
  ];
  if (p.clamp) {
    const c = clampValues(p),
      back = -(n(p, 'hubDiameter') / 2 + n(p, 'clampExtension'));
    lines.push(
      `body = body.fuse(Part.makeBox(${num(-back)},${num(c.width)},${num(height)},App.Vector(${num(back)},${num(-c.width / 2)},0)))`,
    );
  }
  lines.push(
    `body = body.cut(${pythonPrism(splinePoints(p), -0.1, n(p, 'socketDepth') + 0.1)})`,
    `body = body.cut(Part.makeCylinder(${num(n(p, 'screwBore') / 2)},${num(height + 0.2)},App.Vector(0,0,-0.1)))`,
  );
  if (n(p, 'counterboreDepth') > 0)
    lines.push(
      `body = body.cut(Part.makeCylinder(${num(n(p, 'counterboreDiameter') / 2)},${num(n(p, 'counterboreDepth') + 0.1)},App.Vector(0,0,${num(height - n(p, 'counterboreDepth'))})))`,
    );
  for (const [x, y] of holeCenters(p))
    lines.push(
      `body = body.cut(Part.makeCylinder(${num(n(p, 'holeDiameter') / 2)},${num(height + 0.2)},App.Vector(${num(x)},${num(y)},-0.1)))`,
    );
  if (p.clamp) {
    const c = clampValues(p),
      back = -(n(p, 'hubDiameter') / 2 + n(p, 'clampExtension'));
    lines.push(
      `body = body.cut(Part.makeBox(${num(-back + 0.2)},${num(n(p, 'clampSlit'))},${num(height + 0.2)},App.Vector(${num(back - 0.2)},${num(-n(p, 'clampSlit') / 2)},-0.1)))`,
      `body = body.cut(Part.makeCylinder(${num(c.d / 2 + 0.1)},${num(c.width * 2)},App.Vector(${num(c.x)},${num(-c.width)},${num(c.z)}),App.Vector(0,1,0)))`,
    );
  }
  lines.push(
    'body = body.removeSplitter()',
    'if len(body.Solids) != 1: raise ValueError("The servo horn must remain one connected body.")',
    'components = [body]',
    'component_labels = ["Servo horn body"]',
  );
  const color = finishes[String(p.finish)];
  lines.push(
    `component_colors = [(${num((color >> 16) / 255)},${num(((color >> 8) & 255) / 255)},${num((color & 255) / 255)})]`,
  );
  if (p.clamp && p.showClampScrew) {
    const c = clampValues(p),
      top = -c.width / 2 - c.headHeight;
    lines.push(
      `screw = Part.makeCylinder(${num(c.head / 2)},${num(c.headHeight + 0.02)},App.Vector(${num(c.x)},${num(top)},${num(c.z)}),App.Vector(0,1,0)).fuse(Part.makeCylinder(${num(c.d / 2)},${num(c.width)},App.Vector(${num(c.x)},${num(-c.width / 2)},${num(c.z)}),App.Vector(0,1,0)))`,
    );
    const hex = Array.from(
      { length: 6 },
      (_, i) =>
        `App.Vector(${num(c.x + c.d * 0.32 * Math.cos((i * Math.PI) / 3))},${num(top - 0.05)},${num(c.z + c.d * 0.32 * Math.sin((i * Math.PI) / 3))})`,
    );
    lines.push(
      `socket = Part.Face(Part.makePolygon([${[...hex, hex[0]].join(',')}])).extrude(App.Vector(0,${num(c.headHeight * 0.6)},0))`,
      'components.append(screw.cut(socket).removeSplitter())',
      'component_labels.append("Clamp screw")',
      'component_colors.append((0.27,0.29,0.33))',
    );
  }
  if (state === 'socket-up')
    lines.push('for item in components: item.rotate(App.Vector(0,0,0),App.Vector(1,0,0),180)');
  lines.push(
    'shape = Part.makeCompound(components) if len(components) > 1 else body',
    'center = shape.optimalBoundingBox(False, False).Center',
    'shape.translate(-center)',
  );
  return lines.join('\n');
}
