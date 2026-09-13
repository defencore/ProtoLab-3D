import { Group, Vector2, Vector3, Box3, BufferGeometry, Mesh } from 'three';
import { BoundaryMesh, pythonWire } from '../../../../core/mechanical';
import { num } from '../../../../core/geometry';

export type ShellSection = { z: number; outer: Vector2[]; bore: number };

export function outline(radius: number, sides = 0): Vector2[] {
  return Array.from({ length: 96 }, (_, i) => {
    const angle = (i * Math.PI) / 48;
    const sector = sides ? (Math.PI * 2) / sides : 0;
    const r = sides
      ? (radius * Math.cos(Math.PI / sides)) /
        Math.cos(((angle + sector / 2) % sector) - sector / 2)
      : radius;
    return new Vector2(r * Math.cos(angle), r * Math.sin(angle));
  });
}

/** Closed surfaces share the same sections in the preview and the CAD loft. */
export function shellMesh(sections: ShellSection[], color?: number) {
  const mesh = new BoundaryMesh();
  const outer = sections.map((s) => s.outer.map((v) => new Vector3(v.x, v.y, s.z)));
  const inner = sections.map((s) => outline(s.bore / 2).map((v) => new Vector3(v.x, v.y, s.z)));
  for (let i = 1; i < sections.length; i++) {
    mesh.bridge(outer[i - 1], outer[i]);
    mesh.bridge(inner[i - 1], inner[i], true);
  }
  mesh.face(outer[0], [inner[0]], new Vector3(0, 0, -1));
  mesh.face(outer.at(-1)!, [inner.at(-1)!], new Vector3(0, 0, 1));
  return mesh.build(color);
}

export function shellPython(sections: ShellSection[]) {
  const outer = sections.map((s) => pythonWire(s.outer, s.z)).join(',');
  const inner = sections.map((s) => pythonWire(outline(s.bore / 2), s.z)).join(',');
  return `Part.makeLoft([${outer}], True, True).cut(Part.makeLoft([${inner}], True, True))`;
}

export function modelBounds(model: Group): [number, number, number] {
  const size = new Box3().setFromObject(model).getSize(new Vector3());
  model.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry.dispose();
      (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) =>
        m.dispose(),
      );
    }
  });
  return [size.x, size.y, size.z];
}

/** A revolved profile meeting its axis has redundant pole triangles. */
export function removeDegenerateTriangles(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position');
  const source = geometry.index?.array ?? Array.from({ length: position.count }, (_, i) => i);
  const indices: number[] = [];
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  for (let i = 0; i < source.length; i += 3) {
    a.fromBufferAttribute(position, source[i]);
    b.fromBufferAttribute(position, source[i + 1]);
    c.fromBufferAttribute(position, source[i + 2]);
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18)
      indices.push(source[i], source[i + 1], source[i + 2]);
  }
  geometry.setIndex(indices);
}

export function polygonPython(points: Vector2[], height: number, z = 0) {
  return `Part.Face(${pythonWire(points, z)}).extrude(App.Vector(0, 0, ${num(height)}))`;
}
