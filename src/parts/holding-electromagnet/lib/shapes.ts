import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { solidUnionMesh } from '../../../core/solid-union';
import { num } from '../../../core/geometry';

type Vec = [number, number, number];
type Cylinder = {
  kind: 'cylinder';
  radius: number;
  height: number;
  origin: Vec;
};
type Revolved = { kind: 'revolved'; points: [number, number][] };
type Difference = { kind: 'difference'; base: Shape; tools: Shape[] };
export type Shape = Cylinder | Revolved | Difference;

export const cylinder = (radius: number, height: number, origin: Vec): Cylinder => ({
  kind: 'cylinder',
  radius,
  height,
  origin,
});
export const revolved = (points: [number, number][]): Revolved => ({
  kind: 'revolved',
  points,
});
export const difference = (base: Shape, ...tools: Shape[]): Difference => ({
  kind: 'difference',
  base,
  tools,
});

function solid(s: Shape): Geom3 {
  switch (s.kind) {
    case 'cylinder':
      return modeling.primitives.cylinder({
        radius: s.radius,
        height: s.height,
        center: [s.origin[0], s.origin[1], s.origin[2] + s.height / 2],
        segments: 96,
      });
    case 'revolved':
      return modeling.extrusions.extrudeRotate(
        { segments: 96 },
        modeling.primitives.polygon({ points: s.points }),
      );
    case 'difference':
      return modeling.booleans.subtract(solid(s.base), ...s.tools.map(solid));
  }
}

// State changes reuse the expensive cup triangulation. Each returned model owns its buffers.
const cache = new Map<string, Group>();
export function component(shape: Shape, label: string, color: number): Group {
  const key = JSON.stringify(shape);
  let template = cache.get(key);
  if (!template) {
    const value = solid(shape);
    const bounds = modeling.measurements.measureBoundingBox(value);
    template = solidUnionMesh(value);
    template.position.set(...(bounds[0].map((v, i) => (v + bounds[1][i]) / 2) as Vec));
    cache.set(key, template);
    if (cache.size > 20) {
      const oldest = cache.keys().next().value!;
      cache.get(oldest)!.traverse((child) => {
        if (child instanceof Mesh) {
          child.geometry.dispose();
          (child.material as MeshStandardMaterial).dispose();
        }
      });
      cache.delete(oldest);
    }
  }
  const output = template.clone(true);
  output.name = label;
  output.traverse((child) => {
    if (child instanceof Mesh) {
      child.name = label;
      child.geometry = child.geometry.clone();
      child.material = (child.material as MeshStandardMaterial).clone();
      (child.material as MeshStandardMaterial).color.setHex(color);
    }
  });
  return output;
}

const vector = (v: Vec) => `App.Vector(${v.map(num).join(', ')})`;
export function pythonShape(s: Shape): string {
  switch (s.kind) {
    case 'cylinder':
      return `Part.makeCylinder(${num(s.radius)}, ${num(s.height)}, ${vector(s.origin)})`;
    case 'revolved': {
      const points = s.points.map(([r, z]) => vector([r, 0, z]));
      return `Part.Face(Part.makePolygon([${[...points, points[0]].join(', ')}])).revolve(App.Vector(0, 0, 0), App.Vector(0, 0, 1), 360)`;
    }
    case 'difference':
      return s.tools.reduce((out, tool) => `${out}.cut(${pythonShape(tool)})`, pythonShape(s.base));
  }
}
