import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from 'three';

// CSG can leave sub-micron slivers where the circular mounting notches meet
// the case. Weld only points within 0.0001 mm and conform the resulting seam.
// This affects tessellation precision, not the analytic FreeCAD dimensions.
export function conformMesh(group: Group): Group {
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    const vertices: Vector3[] = [],
      cells = new Map<string, number[]>();
    const tolerance = 1e-4;
    const vertex = (index: number): number => {
      const point = new Vector3().fromBufferAttribute(positions, index);
      const cell = point.toArray().map((v) => Math.floor(v / tolerance));
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const key = [cell[0] + dx, cell[1] + dy, cell[2] + dz].join(',');
            for (const candidate of cells.get(key) ?? [])
              if (point.distanceToSquared(vertices[candidate]) < tolerance ** 2) return candidate;
          }
      const key = cell.join(','),
        id = vertices.length;
      vertices.push(point);
      cells.set(key, [...(cells.get(key) ?? []), id]);
      return id;
    };
    const unique = new Map<string, { face: number[]; balance: number }>();
    for (let i = 0; i < positions.count; i += 3) {
      const face = [vertex(i), vertex(i + 1), vertex(i + 2)];
      if (new Set(face).size < 3) continue;
      const [a, b, c] = face.map((id) => vertices[id]);
      if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-18) continue;
      const key = [...face].sort((a, b) => a - b).join(',');
      const first = face.indexOf(Math.min(...face)),
        direction = face[(first + 1) % 3] < face[(first + 2) % 3] ? 1 : -1;
      const entry = unique.get(key) ?? { face, balance: 0 };
      entry.balance += direction;
      unique.set(key, entry);
    }
    const faces = [...unique.values()].filter((e) => e.balance !== 0).map((e) => e.face);
    const edges = new Map<string, number>();
    const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
    for (const face of faces)
      for (let j = 0; j < 3; j++) {
        const key = edgeKey(face[j], face[(j + 1) % 3]);
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    const open = [...edges]
      .filter(([, count]) => count === 1)
      .map(([key]) => key.split(':').map(Number));
    const candidates = [...new Set(open.flat())],
      split = new Map<string, number[]>();
    for (const [first, last] of open) {
      const a = vertices[first],
        direction = vertices[last].clone().sub(a),
        lengthSq = direction.lengthSq();
      const inner = candidates
        .filter((i) => i !== first && i !== last)
        .map((i) => {
          const delta = vertices[i].clone().sub(a),
            t = delta.dot(direction) / lengthSq;
          return {
            i,
            t,
            distance: delta.addScaledVector(direction, -t).lengthSq(),
          };
        })
        .filter((p) => p.t > 1e-6 && p.t < 1 - 1e-6 && p.distance < tolerance ** 2)
        .sort((a, b) => a.t - b.t);
      if (inner.length) split.set(edgeKey(first, last), [first, ...inner.map((p) => p.i), last]);
    }
    const output: number[] = [];
    for (const face of faces) {
      const outline: number[] = [];
      for (let j = 0; j < 3; j++) {
        const first = face[j],
          last = face[(j + 1) % 3],
          seam = split.get(edgeKey(first, last));
        const ordered = seam ? (seam[0] === first ? seam : [...seam].reverse()) : [first, last];
        outline.push(...ordered.slice(0, -1));
      }
      if (outline.length === 3) output.push(...face.flatMap((i) => vertices[i].toArray()));
      else {
        const center = face
          .reduce((sum, i) => sum.add(vertices[i]), new Vector3())
          .multiplyScalar(1 / 3);
        for (let j = 0; j < outline.length; j++)
          output.push(
            ...center.toArray(),
            ...vertices[outline[j]].toArray(),
            ...vertices[outline[(j + 1) % outline.length]].toArray(),
          );
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(output, 3));
    geometry.computeVertexNormals();
    object.geometry.dispose();
    object.geometry = geometry;
  });
  return group;
}
