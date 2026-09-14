import { Float32BufferAttribute, Vector3 } from 'three';

/** Conform tiny Boolean junctions before Float32 mesh output; the tolerance is 0.2 micrometre. */
export function conformThreadMesh(group: import('three').Group) {
  group.traverse((child) => {
    if (!('isMesh' in child) || !child.isMesh) return;
    const mesh = child as import('three').Mesh;
    const geometry = mesh.geometry;
    const source = geometry.getAttribute('position');
    const indices = geometry.index?.array ?? Array.from({ length: source.count }, (_, i) => i);
    const vertices: Vector3[] = [];
    const cells = new Map<string, number[]>();
    const epsilon = 2e-4;
    const map = Array.from({ length: source.count }, (_, i) => {
      const point = new Vector3().fromBufferAttribute(source, i);
      const grid = point.toArray().map((v) => Math.floor(v / epsilon));
      for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
          for (let z = -1; z <= 1; z++) {
            const found = cells
              .get([grid[0] + x, grid[1] + y, grid[2] + z].join(','))
              ?.find((id) => vertices[id].distanceToSquared(point) < epsilon * epsilon);
            if (found !== undefined) return found;
          }
      const id = vertices.length;
      vertices.push(point);
      const key = grid.join(',');
      cells.set(key, [...(cells.get(key) ?? []), id]);
      return id;
    });
    let triangles: number[][] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const triangle = [map[indices[i]], map[indices[i + 1]], map[indices[i + 2]]];
      if (new Set(triangle).size === 3) triangles.push(triangle);
    }
    const uniqueFaces = (faces: number[][]) => {
      const unique = new Map<string, { face: number[]; balance: number }>();
      for (const face of faces) {
        if (new Set(face).size !== 3) continue;
        const [a, b, c] = face.map((id) => vertices[id]);
        if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-20) continue;
        const smallest = face.indexOf(Math.min(...face));
        const sign = face[(smallest + 1) % 3] < face[(smallest + 2) % 3] ? 1 : -1;
        const key = [...face].sort((a, b) => a - b).join(':');
        const value = unique.get(key) ?? { face, balance: 0 };
        value.balance += sign;
        unique.set(key, value);
      }
      return [...unique.values()]
        .filter((v) => v.balance !== 0)
        .map(({ face, balance }) => {
          const smallest = face.indexOf(Math.min(...face));
          const sign = face[(smallest + 1) % 3] < face[(smallest + 2) % 3] ? 1 : -1;
          return sign === Math.sign(balance) ? face : [...face].reverse();
        });
    };
    triangles = uniqueFaces(triangles);
    for (let pass = 0; pass < 3; pass++) {
      const edges = new Map<string, { count: number; a: number; b: number }>();
      const key = (a: number, b: number) => [a, b].sort((x, y) => x - y).join(':');
      for (const triangle of triangles)
        for (let i = 0; i < 3; i++) {
          const a = triangle[i],
            b = triangle[(i + 1) % 3],
            id = key(a, b);
          const edge = edges.get(id) ?? { count: 0, a, b };
          edge.count++;
          edges.set(id, edge);
        }
      const open = [...edges.values()].filter((edge) => edge.count !== 2);
      if (!open.length) break;
      const candidates = [...new Set(open.flatMap((edge) => [edge.a, edge.b]))];
      const splits = new Map<string, number[]>();
      for (const edge of open) {
        const start = vertices[edge.a],
          vector = vertices[edge.b].clone().sub(start),
          length = vector.lengthSq();
        const between = candidates
          .filter((id) => id !== edge.a && id !== edge.b)
          .map((id) => {
            const offset = vertices[id].clone().sub(start),
              t = offset.dot(vector) / length;
            return { id, t, distance: offset.addScaledVector(vector, -t).lengthSq() };
          })
          .filter((v) => v.t > 1e-7 && v.t < 1 - 1e-7 && v.distance < epsilon * epsilon)
          .sort((a, b) => a.t - b.t);
        if (between.length)
          splits.set(key(edge.a, edge.b), [edge.a, ...between.map((v) => v.id), edge.b]);
      }
      if (!splits.size) break;
      const next: number[][] = [];
      for (const triangle of triangles) {
        const boundary: number[] = [];
        for (let i = 0; i < 3; i++) {
          const a = triangle[i],
            b = triangle[(i + 1) % 3],
            split = splits.get(key(a, b));
          boundary.push(
            ...(split ? (split[0] === a ? split : [...split].reverse()) : [a, b]).slice(0, -1),
          );
        }
        if (boundary.length === 3) next.push(triangle);
        else {
          const center = triangle
            .reduce((sum, id) => sum.add(vertices[id]), new Vector3())
            .multiplyScalar(1 / 3);
          const id = vertices.length;
          vertices.push(center);
          for (let i = 0; i < boundary.length; i++)
            next.push([id, boundary[i], boundary[(i + 1) % boundary.length]]);
        }
      }
      triangles = uniqueFaces(next);
    }
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        vertices.flatMap((v) => v.toArray()),
        3,
      ),
    );
    geometry.setIndex(triangles.flat());
    geometry.computeVertexNormals();
  });
  return group;
}
