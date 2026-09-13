import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  ShapeUtils,
  Vector2,
  Vector3,
  Group,
} from 'three';
import { material, num } from './geometry';

export function annularSector(
  outer: number,
  inner: number,
  gapDegrees: number,
  segments = 96,
): Vector2[] {
  const start = (gapDegrees * Math.PI) / 360;
  const points: Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + ((Math.PI * 2 - start * 2) * i) / segments;
    points.push(new Vector2(outer * Math.cos(a), outer * Math.sin(a)));
  }
  for (let i = segments; i >= 0; i--) {
    const a = start + ((Math.PI * 2 - start * 2) * i) / segments;
    points.push(new Vector2(inner * Math.cos(a), inner * Math.sin(a)));
  }
  return points;
}

/** Closed polyhedral loft with matching CCW section vertices and outward caps. */
export function loftMesh(sections: { points: Vector2[]; z: number }[], color = 0x777f89): Mesh {
  const count = sections[0].points.length;
  const positions = sections.flatMap((section) =>
    section.points.flatMap((p) => [p.x, p.y, section.z]),
  );
  const indices: number[] = [];
  for (let level = 0; level < sections.length - 1; level++)
    for (let i = 0; i < count; i++) {
      const a = level * count + i,
        b = level * count + ((i + 1) % count),
        c = b + count,
        d = a + count;
      indices.push(a, b, d, b, c, d);
    }
  for (const triangle of ShapeUtils.triangulateShape(sections[0].points, []))
    indices.push(triangle[2], triangle[1], triangle[0]);
  const offset = (sections.length - 1) * count;
  for (const triangle of ShapeUtils.triangulateShape(sections.at(-1)!.points, []))
    indices.push(...triangle.map((index) => offset + index));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new Mesh(geometry, material(color));
}

export function pythonWire(points: Vector2[], z: number): string {
  return `Part.makePolygon([${[...points, points[0]].map((point) => `App.Vector(${num(point.x)}, ${num(point.y)}, ${num(z)})`).join(', ')}])`;
}

export function sectionBounds(points: Vector2[]): [number, number] {
  return [
    Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
    Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)),
  ];
}

export function disposeModel(model: Group) {
  model.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry.dispose();
      (Array.isArray(child.material) ? child.material : [child.material]).forEach((item) =>
        item.dispose(),
      );
    }
  });
}

export function circleSection(
  radius: number,
  center: Vector3,
  axis: 'x' | 'z' = 'z',
  segments = 72,
): Vector3[] {
  return Array.from({ length: segments }, (_, i) => {
    const angle = (i * Math.PI * 2) / segments;
    return axis === 'z'
      ? new Vector3(
          center.x + radius * Math.cos(angle),
          center.y + radius * Math.sin(angle),
          center.z,
        )
      : new Vector3(
          center.x,
          center.y + radius * Math.cos(angle),
          center.z + radius * Math.sin(angle),
        );
  });
}

/** Boundary faces keep holes manifold without iterative triangle Boolean operations. */
export class BoundaryMesh {
  private positions: number[] = [];
  face(outer: Vector3[], holes: Vector3[][], normal: Vector3): void {
    const project = (p: Vector3): Vector2 =>
      Math.abs(normal.x) > 0.5
        ? new Vector2(p.y, p.z)
        : Math.abs(normal.y) > 0.5
          ? new Vector2(p.z, p.x)
          : new Vector2(p.x, p.y);
    const vertices = [...outer, ...holes.flat()];
    for (const indices of ShapeUtils.triangulateShape(
      outer.map(project),
      holes.map((loop) => loop.map(project)),
    )) {
      const [a, b, c] = indices.map((index) => vertices[index]);
      if (b.clone().sub(a).cross(c.clone().sub(a)).dot(normal) >= 0)
        this.positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
      else this.positions.push(...a.toArray(), ...c.toArray(), ...b.toArray());
    }
  }
  bridge(first: Vector3[], second: Vector3[], inward = false): void {
    for (let i = 0; i < first.length; i++) {
      const j = (i + 1) % first.length;
      const a = first[i],
        b = first[j],
        c = second[j],
        d = second[i];
      if (inward)
        this.positions.push(
          ...a.toArray(),
          ...d.toArray(),
          ...b.toArray(),
          ...b.toArray(),
          ...d.toArray(),
          ...c.toArray(),
        );
      else
        this.positions.push(
          ...a.toArray(),
          ...b.toArray(),
          ...d.toArray(),
          ...b.toArray(),
          ...c.toArray(),
          ...d.toArray(),
        );
    }
  }
  build(color = 0x85898e): Mesh {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.computeVertexNormals();
    return new Mesh(geometry, material(color));
  }
}

/** Union of overlapping simple CCW polygons; used for the three planar circlip pieces. */
export function unionPolygons(polygons: Vector2[][]): Vector2[] {
  const epsilon = 1e-7;
  const cross = (a: Vector2, b: Vector2) => a.x * b.y - a.y * b.x;
  const inside = (point: Vector2, polygon: Vector2[]) => {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i],
        b = polygon[j];
      if (
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      )
        result = !result;
    }
    return result;
  };
  const edges: [Vector2, Vector2][] = [];
  for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex++) {
    const polygon = polygons[polygonIndex];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        direction = b.clone().sub(a),
        cuts = [0, 1];
      for (let otherIndex = 0; otherIndex < polygons.length; otherIndex++) {
        if (otherIndex === polygonIndex) continue;
        const other = polygons[otherIndex];
        for (let j = 0; j < other.length; j++) {
          const c = other[j],
            edge = other[(j + 1) % other.length].clone().sub(c),
            divisor = cross(direction, edge);
          if (Math.abs(divisor) < epsilon) continue;
          const offset = c.clone().sub(a),
            t = cross(offset, edge) / divisor,
            u = cross(offset, direction) / divisor;
          if (t > epsilon && t < 1 - epsilon && u >= -epsilon && u <= 1 + epsilon) cuts.push(t);
        }
      }
      cuts.sort((x, y) => x - y);
      const unique = cuts.filter((value, i) => !i || value - cuts[i - 1] > epsilon);
      for (let j = 1; j < unique.length; j++) {
        const midpoint = a.clone().addScaledVector(direction, (unique[j - 1] + unique[j]) / 2);
        if (!polygons.some((other, index) => index !== polygonIndex && inside(midpoint, other)))
          edges.push([
            a.clone().addScaledVector(direction, unique[j - 1]),
            a.clone().addScaledVector(direction, unique[j]),
          ]);
      }
    }
  }
  if (!edges.length) throw new Error('The planar components do not form a boundary.');
  const result = [edges[0][0]],
    start = edges[0][0];
  let end = edges.shift()![1];
  while (end.distanceToSquared(start) > epsilon * epsilon) {
    result.push(end);
    const next = edges.findIndex(([point]) => point.distanceToSquared(end) < epsilon * epsilon);
    if (next < 0) throw new Error('The planar boundary is disconnected.');
    end = edges.splice(next, 1)[0][1];
  }
  if (edges.length) throw new Error('The planar components must form one connected outline.');
  return result;
}
