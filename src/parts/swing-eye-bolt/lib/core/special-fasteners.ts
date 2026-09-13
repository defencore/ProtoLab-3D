import { Box3, Group, Vector2, Vector3 } from 'three';
import { BoundaryMesh, circleSection, disposeModel } from '../../../../core/mechanical';
import { num } from '../../../../core/geometry';

export interface ProfileHead {
  outline: Vector2[];
  holes: Vector2[][];
  thickness: (height: number) => number;
  shaftLength: number;
  diameter: number;
}

/** Join a round shank to an extruded head with an explicit shared boundary. */
export function profileHeadGeometry(head: ProfileHead): Group {
  const { outline, holes, shaftLength, diameter, thickness } = head;
  const boundary = new BoundaryMesh();
  const halfWidth = Math.abs(outline[0].x),
    depth = thickness(0);
  const radius = diameter / 2;
  const joinRadius = Math.min(radius, halfWidth - 0.05, depth / 2 - 0.05);
  const transition = Math.min(diameter * 0.2, shaftLength * 0.2);
  const circles = [
    circleSection(radius, new Vector3(0, 0, 0), 'z', 96),
    circleSection(radius, new Vector3(0, 0, shaftLength - transition), 'z', 96),
    circleSection(joinRadius, new Vector3(0, 0, shaftLength), 'z', 96),
  ];
  boundary.face(circles[0], [], new Vector3(0, 0, -1));
  boundary.bridge(circles[0], circles[1]);
  boundary.bridge(circles[1], circles[2]);
  const plane = (points: Vector2[], side: number) =>
    points.map((p) => new Vector3(p.x, (side * thickness(p.y)) / 2, p.y + shaftLength));
  const front = plane(outline, 1),
    back = plane(outline, -1);
  const frontHoles = holes.map((hole) => plane(hole, 1)),
    backHoles = holes.map((hole) => plane(hole, -1));
  boundary.face(front, frontHoles, new Vector3(0, 1, 0));
  boundary.face(back, backHoles, new Vector3(0, -1, 0));
  for (let i = 1; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const normal = front[j].clone().sub(front[i]).cross(back[i].clone().sub(front[i])).normalize();
    boundary.face([front[i], front[j], back[j], back[i]], [], normal);
  }
  boundary.face([front[0], back[0], back[1], front[1]], [circles[2]], new Vector3(0, 0, -1));
  for (let i = 0; i < holes.length; i++) boundary.bridge(frontHoles[i], backHoles[i], true);
  const mesh = boundary.build();
  mesh.geometry.computeBoundingBox();
  const center = mesh.geometry.boundingBox!.getCenter(new Vector3());
  mesh.geometry.translate(-center.x, -center.y, -center.z);
  return new Group().add(mesh);
}

export function profileHeadDimensions(head: ProfileHead): [number, number, number] {
  const model = profileHeadGeometry(head);
  const size = new Box3().setFromObject(model).getSize(new Vector3()).toArray();
  disposeModel(model);
  return size;
}

export function profileHeadPython(head: ProfileHead): string {
  const { outline, holes, shaftLength, diameter, thickness } = head;
  const radius = diameter / 2,
    joinRadius = Math.min(radius, Math.abs(outline[0].x) - 0.05, thickness(0) / 2 - 0.05);
  const transition = Math.min(diameter * 0.2, shaftLength * 0.2);
  const wire = (points: Vector2[], side: number) =>
    `Part.makePolygon([${[...points, points[0]].map((p) => `App.Vector(${num(p.x)}, ${num((side * thickness(p.y)) / 2)}, ${num(p.y + shaftLength)})`).join(',')}])`;
  const lines = [
    '# Smooth nominal thread envelope; the small head transition is a prototype fillet envelope.',
    `shape = Part.makeCylinder(${num(radius)}, ${num(shaftLength - transition)})`,
    Math.abs(radius - joinRadius) < 1e-8
      ? `shape = shape.fuse(Part.makeCylinder(${num(radius)}, ${num(transition)}, App.Vector(0,0,${num(shaftLength - transition)})))`
      : `shape = shape.fuse(Part.makeCone(${num(radius)}, ${num(joinRadius)}, ${num(transition)}, App.Vector(0,0,${num(shaftLength - transition)})))`,
    `head = Part.makeLoft([${wire(outline, -1)}, ${wire(outline, 1)}], True, True)`,
  ];
  for (const hole of holes)
    lines.push(`head = head.cut(Part.makeLoft([${wire(hole, -1)}, ${wire(hole, 1)}], True, True))`);
  lines.push(
    'shape = shape.fuse(head).removeSplitter()',
    'if len(shape.Solids) != 1: raise ValueError("The head and shank must form one connected solid.")',
    'bounds = shape.BoundBox',
    'shape.translate(App.Vector(-(bounds.XMin+bounds.XMax)/2, -(bounds.YMin+bounds.YMax)/2, -(bounds.ZMin+bounds.ZMax)/2))',
  );
  return lines.join('\n');
}

export function eyeOutline(outer: number, bore: number, baseHalfWidth: number) {
  const radius = outer / 2,
    centerHeight = Math.sqrt(radius * radius - baseHalfWidth * baseHalfWidth);
  const start = Math.atan2(-centerHeight, baseHalfWidth),
    end = Math.PI - start;
  const angles = Array.from({ length: 129 }, (_, index) => start + ((end - start) * index) / 128);
  angles.push(0, Math.PI / 2, Math.PI);
  angles.sort((a, b) => a - b);
  const outline = [
    new Vector2(-baseHalfWidth, 0),
    ...angles
      .filter((angle, index) => index === 0 || angle - angles[index - 1] > 1e-8)
      .slice(0, -1)
      .map(
        (angle) => new Vector2(radius * Math.cos(angle), centerHeight + radius * Math.sin(angle)),
      ),
  ];
  const hole = Array.from({ length: 96 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 96;
    return new Vector2((bore / 2) * Math.cos(angle), centerHeight + (bore / 2) * Math.sin(angle));
  });
  return { outline, hole, centerHeight };
}
