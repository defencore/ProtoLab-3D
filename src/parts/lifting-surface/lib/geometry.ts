import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three';
import type { Parameters } from '../../../core/types';
import { material, n } from '../../../core/geometry';
import { sectionProfile, type Point } from './profiles';

type Vec = [number, number, number];
export type Panel = { label: string; rings: Vec[][]; profiles: Point[][] };
const radians = (degrees: number) => (degrees * Math.PI) / 180;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export function station(p: Parameters, u: number) {
  const root = n(p, 'rootChord'),
    tip = n(p, 'tipChord'),
    span = n(p, 'semiSpan');
  const kink = n(p, 'kinkPosition') / 100;
  let chord = lerp(root, tip, u),
    sweep = u * span * Math.tan(radians(n(p, 'sweep')));
  if (p.planform === 'elliptic') chord = tip + (root - tip) * Math.sqrt(Math.max(0, 1 - u * u));
  if (p.planform === 'cranked') {
    chord =
      u <= kink
        ? lerp(root, n(p, 'kinkChord'), u / kink)
        : lerp(n(p, 'kinkChord'), tip, (u - kink) / (1 - kink));
    sweep =
      Math.min(u, kink) * span * Math.tan(radians(n(p, 'sweep'))) +
      Math.max(0, u - kink) * span * Math.tan(radians(n(p, 'outerSweep')));
  }
  return {
    chord,
    sweep,
    y: u * span,
    z: u * span * Math.tan(radians(n(p, 'dihedral'))),
    angle: radians(n(p, 'incidence') + u * n(p, 'twist')),
  };
}

export function panels(p: Parameters, state: string): Panel[] {
  if (state !== 'surface') {
    const u = state === 'root-section' ? 0 : 1,
      chord = station(p, u).chord;
    const profile = sectionProfile(p, u, chord);
    return [
      {
        label: state === 'root-section' ? 'Root profile sample' : 'Tip profile sample',
        profiles: [profile, profile],
        rings: [-n(p, 'sectionDepth') / 2, n(p, 'sectionDepth') / 2].map((y) =>
          profile.map(([x, z]): Vec => [(x - 0.25) * chord, y, z * chord]),
        ),
      },
    ];
  }
  const count = n(p, 'spanSegments');
  const us = Array.from({ length: count + 1 }, (_, i) => i / count);
  if (p.planform === 'cranked') us.push(n(p, 'kinkPosition') / 100);
  const stations = [...new Set(us)].sort((a, b) => a - b);
  return (p.layout === 'pair' ? [1, -1] : [1]).map((side) => {
    const profiles = stations.map((u) => sectionProfile(p, u, station(p, u).chord));
    const rings = profiles.map((profile, j) => {
      const s = station(p, stations[j]);
      return profile.map(([x, z]): Vec => {
        const xc = (x - 0.25) * s.chord,
          zc = z * s.chord;
        const X = s.sweep + xc * Math.cos(s.angle) + zc * Math.sin(s.angle);
        const Y = side * (s.y + (p.layout === 'pair' ? n(p, 'rootGap') / 2 : 0));
        const Z = s.z - xc * Math.sin(s.angle) + zc * Math.cos(s.angle);
        return p.orientation === 'vertical' ? [X, -Z, Y] : [X, Y, Z];
      });
    });
    return {
      label:
        p.layout === 'pair'
          ? side > 0
            ? 'Positive-span panel'
            : 'Negative-span panel'
          : 'Lifting surface',
      rings,
      profiles,
    };
  });
}

export function panelMesh(panel: Panel): Mesh {
  const points = panel.rings.flat(),
    stride = panel.rings[0].length,
    indices: number[] = [];
  for (let j = 0; j < panel.rings.length - 1; j++)
    for (let i = 0; i < stride; i++) {
      const a = j * stride + i,
        b = j * stride + ((i + 1) % stride),
        c = b + stride,
        d = a + stride;
      indices.push(a, b, c, a, c, d);
    }
  for (const end of [0, panel.rings.length - 1]) {
    const profile = panel.profiles[end];
    // Triangulate a reduced contour, then restore all boundary vertices. This
    // keeps wedge-to-curved transitions watertight without zero-area cap faces.
    const kept = profile
      .map((_, i) => i)
      .filter((i) => {
        const a = profile[(i + stride - 1) % stride],
          b = profile[i],
          c = profile[(i + 1) % stride];
        return Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-12;
      });
    const triangles = ShapeUtils.triangulateShape(
      kept.map((i) => new Vector2(...profile[i])),
      [],
    );
    const boundary = new Map<string, number[]>();
    const edgeKey = (a: number, b: number) => [a, b].sort((x, y) => x - y).join(':');
    kept.forEach((a, j) => {
      const b = kept[(j + 1) % kept.length],
        chain = [a];
      for (let i = (a + 1) % stride; i !== b; i = (i + 1) % stride) chain.push(i);
      chain.push(b);
      boundary.set(edgeKey(a, b), chain);
    });
    for (const t of triangles) {
      const local = t.map((i) => kept[i]);
      const outline: number[] = [];
      local.forEach((a, j) => {
        const b = local[(j + 1) % 3],
          chain = boundary.get(edgeKey(a, b)) ?? [a, b];
        outline.push(...(chain[0] === a ? chain : [...chain].reverse()).slice(0, -1));
      });
      const ids = local.map((i) => end * stride + i);
      // Orient each end relative to its adjacent span, independently of mirror/rotation.
      const [a, b, c] = ids.map((i) => new Vector3(...points[i]));
      const inward = new Vector3(...panel.rings[end === 0 ? 1 : end - 1][0]).sub(
        new Vector3(...panel.rings[end][0]),
      );
      const reverse = b.clone().sub(a).cross(c.clone().sub(a)).dot(inward) > 0;
      if (outline.length === 3) indices.push(...(reverse ? ids.reverse() : ids));
      else {
        const centreIndex = points.length;
        points.push(
          a
            .add(b)
            .add(c)
            .multiplyScalar(1 / 3)
            .toArray() as Vec,
        );
        for (let i = 0; i < outline.length; i++) {
          const face = [
            centreIndex,
            end * stride + outline[i],
            end * stride + outline[(i + 1) % outline.length],
          ];
          indices.push(...(reverse ? face.reverse() : face));
        }
      }
    }
  }
  // The ring ordering gives consistent sides; choose the orientation using a
  // side normal against a point just inside the same local section.
  const a = new Vector3(...points[0]),
    b = new Vector3(...points[1]),
    c = new Vector3(...points[stride + 1]);
  const centre = panel.rings[0]
    .reduce((sum, v) => sum.add(new Vector3(...v)), new Vector3())
    .multiplyScalar(1 / stride);
  if (b.sub(a).cross(c.sub(a)).dot(centre.sub(a)) > 0) {
    const sideCount = (panel.rings.length - 1) * stride * 6;
    for (let i = 0; i < sideCount; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, material(0xa6b5c2));
  mesh.name = panel.label;
  return mesh;
}

export function geometry(p: Parameters, state: string) {
  return new Group().add(...panels(p, state).map(panelMesh));
}
export function dimensions(p: Parameters, state: string): [number, number, number] {
  const box = new Box3();
  panels(p, state).forEach((panel) =>
    panel.rings.flat().forEach((v) => box.expandByPoint(new Vector3(...v))),
  );
  return box.getSize(new Vector3()).toArray() as [number, number, number];
}
export function python(p: Parameters, state: string): string {
  const pieces = panels(p, state);
  return `# Polygonal sections sampled from the documented profile equations.
# Ruled native CAD lofts retain the selected stations; these are not CFD meshes.
panel_sections = ${JSON.stringify(pieces.map((panel) => panel.rings))}
component_labels = ${JSON.stringify(pieces.map((panel) => panel.label))}
components = []
for sections in panel_sections:
    wires = []
    for section in sections:
        points = [App.Vector(*point) for point in section]
        wires.append(Part.makePolygon(points + [points[0]]))
    solid = Part.makeLoft(wires, True, True)
    if solid.isNull() or not solid.isValid() or len(solid.Solids) != 1:
        raise ValueError('The lifting-surface loft is not a valid solid.')
    components.append(solid)
shape = Part.makeCompound(components)`;
}
