import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
export type Vec = [number, number, number];
type Faceted = { kind: 'faceted'; points: Vec[]; faces: number[][] };
export type Shape = Faceted | { kind: 'loft'; rings: Vec[][] };
/** Explicit shell boundary avoids fragile subtraction between almost coincident thin lofts. */
export function hullShell(outer: Vec[][], inner: Vec[][]): Shape {
  const n = outer[0].length,
    count = outer.length,
    offset = n * count;
  const points = [...outer.flat(), ...inner.flat()];
  const faces: number[][] = [];
  const quad = (a: number, b: number, c: number, d: number) => faces.push([a, b, c], [a, c, d]);
  // Bottom/sides, leaving both upper edges open for the gunwale strips.
  for (let j = 0; j < count - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      quad(a, a + 1, a + n + 1, a + n);
      quad(a + offset, a + n + offset, a + n + 1 + offset, a + 1 + offset);
    }
    const a = j * n,
      b = a + n - 1;
    quad(a, a + n, a + n + offset, a + offset);
    quad(b, b + offset, b + n + offset, b + n);
  }
  // End bulkheads and their top rims. Triangle fans also define spoon-bow end surfaces.
  for (let i = 1; i < n - 1; i++) {
    faces.push([0, i + 1, i], [offset, offset + i, offset + i + 1]);
    const a = (count - 1) * n;
    faces.push([a, a + i, a + i + 1], [a + offset, a + i + 1 + offset, a + i + offset]);
  }
  quad(0, offset, offset + n - 1, n - 1);
  const a = (count - 1) * n;
  quad(a, a + n - 1, a + n - 1 + offset, a + offset);
  return orient({ kind: 'faceted', points, faces });
}
function orient(s: Extract<Shape, { kind: 'faceted' }>): Extract<Shape, { kind: 'faceted' }> {
  const volume = s.faces.reduce(
    (v, f) =>
      v +
      new Vector3(...s.points[f[0]]).dot(
        new Vector3(...s.points[f[1]]).cross(new Vector3(...s.points[f[2]])),
      ),
    0,
  );
  return { ...s, faces: volume < 0 ? s.faces.map((f) => [...f].reverse()) : s.faces };
}

/** Use identical planar faces in the preview and native CAD, including twisted ruled panels. */
function boundary(s: Shape): Faceted {
  if (s.kind === 'faceted') return s;
  const n = s.rings[0].length,
    points = s.rings.flat(),
    faces: number[][] = [];
  for (let j = 0; j < s.rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = j * n + i,
        b = j * n + ((i + 1) % n);
      faces.push([a, b, b + n], [a, b + n, a + n]);
    }
  for (let i = 1; i < n - 1; i++) {
    faces.push([0, i + 1, i]);
    const a = points.length - n;
    faces.push([a, a + i, a + i + 1]);
  }
  return orient({ kind: 'faceted', points, faces });
}
export function component(
  shape: Shape,
  label: string,
  color: number,
  position: Vec = [0, 0, 0],
  angle = 0,
): Group {
  const s = boundary(shape),
    geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(s.points.flat(), 3));
  geo.setIndex(s.faces.flat());
  geo.computeVertexNormals();
  geo.userData.nativeTopology = true;
  const mesh = new Mesh(geo, new MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.1 }));
  mesh.name = label;
  const group = new Group().add(mesh);
  group.name = label;
  group.position.set(...position);
  group.rotation.z = (angle * Math.PI) / 180;
  return group;
}
export function pythonShape(shape: Shape): string {
  const s = boundary(shape);
  return `Part.makeSolid(Part.makeShell([Part.Face(Part.makePolygon([App.Vector(*pts[i]) for i in face + [face[0]]])) for pts in [${JSON.stringify(s.points)}] for face in ${JSON.stringify(s.faces)}]))`;
}
