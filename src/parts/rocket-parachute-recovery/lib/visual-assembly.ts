import { Group, Box3, Vector3, Mesh, MeshStandardMaterial } from 'three';
import { component, pythonShape, type Shape, type Vec } from './shapes';
import { num } from '../../../core/geometry';
export interface Piece {
  shape: Shape;
  label: string;
  color: number;
  z?: number;
  position?: Vec;
  angle?: number;
}
export function geometry(pieces: Piece[]): Group {
  return new Group().add(
    ...pieces.map((p) =>
      component(p.shape, p.label, p.color, p.position ?? [0, 0, p.z ?? 0], p.angle ?? 0),
    ),
  );
}
export function python(pieces: Piece[]): string {
  const lines = [
    'def _cb_spring(radius,wire,height,turns):',
    '    spine=Part.Wire(Part.makeHelix(height/turns,height,radius).Edges)',
    '    section=Part.Wire([Part.makeCircle(wire,App.Vector(radius,0,0),App.Vector(0,radius*2*math.pi,height/turns))])',
    '    return spine.makePipeShell([section],True,True)',
    'def _pl_transform(shape, translation, rotation):',
    '    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)], rotation):',
    '        if angle: shape.rotate(App.Vector(0,0,0),axis,angle)',
    '    shape.translate(App.Vector(*translation))',
    '    return shape',
    'components = []',
  ];
  for (const p of pieces)
    lines.push(
      `component = (${pythonShape(p.shape)}).removeSplitter()`,
      `component.rotate(App.Vector(0,0,0),App.Vector(0,0,1),${num(p.angle ?? 0)})`,
      `component.translate(App.Vector(${(p.position ?? [0, 0, p.z ?? 0]).map(num).join(',')}))`,
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
