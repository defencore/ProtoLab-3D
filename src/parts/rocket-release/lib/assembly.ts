import { Group, Box3, Vector3, Mesh, MeshStandardMaterial } from 'three';
import { component, pythonShape, type Shape, type Vec } from './shapes';
import { num } from '../../../core/geometry';
import { springPython } from './spring';
export interface Piece {
  shape: Shape;
  label: string;
  color: number;
}
export function geometry(pieces: Piece[]): Group {
  return new Group().add(...pieces.map((p) => component(p.shape, p.label, p.color)));
}
export function python(pieces: Piece[]): string {
  const lines = [
    ...springPython,
    'def _release_place(shape, angle, offset):',
    '    shape.rotate(App.Vector(0,0,0),App.Vector(0,0,1),angle)',
    '    shape.translate(App.Vector(*offset))',
    '    return shape',
    'components = []',
  ];
  for (const p of pieces)
    lines.push(
      `component = (${pythonShape(p.shape)}).removeSplitter()`,
      'components.append(component)',
    );
  lines.push(
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(pieces.map((p) => p.label))}`,
    `component_colors = [${pieces.map((p) => `(${num(((p.color >> 16) & 255) / 255)},${num(((p.color >> 8) & 255) / 255)},${num((p.color & 255) / 255)})`).join(',')}]`,
  );
  return lines.join('\n');
}
export function dimensions(pieces: Piece[]): Vec {
  const model = geometry(pieces);
  model.updateMatrixWorld(true);
  const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec;
  model.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      (object.material as MeshStandardMaterial).dispose();
    }
  });
  return size;
}
