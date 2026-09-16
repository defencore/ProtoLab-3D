import { Group, Box3, Vector3, Mesh, MeshStandardMaterial } from 'three';
import { component, pythonShape, type Shape, type Vec } from './shapes';
import { wireGeometry, wireLoftPython } from './spring';
import { num } from '../../../core/geometry';
export interface Piece {
  shape?: Shape;
  wire?: { points: Vec[]; diameter: number };
  label: string;
  color: number;
  position?: Vec;
  rotation?: Vec;
}
export function geometry(pieces: Piece[]): Group {
  return new Group().add(
    ...pieces.map((p) => {
      const group = p.wire
        ? wireGeometry(
            p.wire.points.map((v) => new Vector3(...v)),
            p.wire.diameter,
          )
        : component(p.shape!, p.label, p.color);
      group.name = p.label;
      group.traverse((o) => {
        if (o instanceof Mesh) {
          o.name = p.label;
          (o.material as MeshStandardMaterial).color.setHex(p.color);
        }
      });
      const [x, y, z] = p.rotation ?? [0, 0, 0];
      group.rotation.set((x * Math.PI) / 180, (y * Math.PI) / 180, (z * Math.PI) / 180, 'ZYX');
      group.position.set(...(p.position ?? [0, 0, 0]));
      return group;
    }),
  );
}
export function python(pieces: Piece[]): string {
  const lines = [
    'def _pl_transform(shape, translation, rotation):',
    '    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)], rotation):',
    '        if angle: shape.rotate(App.Vector(0,0,0),axis,angle)',
    '    shape.translate(App.Vector(*translation))',
    '    return shape',
    'components = []',
  ];
  for (const p of pieces) {
    if (p.wire)
      lines.push(
        wireLoftPython(
          p.wire.points.map((v) => new Vector3(...v)),
          p.wire.diameter,
        ),
        'component = shape',
      );
    else lines.push(`component = (${pythonShape(p.shape!)}).removeSplitter()`);
    lines.push(
      `component = _pl_transform(component, ${JSON.stringify(p.position ?? [0, 0, 0])}, ${JSON.stringify(p.rotation ?? [0, 0, 0])})`,
      'components.append(component)',
    );
  }
  lines.push(
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(pieces.map((p) => p.label))}`,
    `component_colors = [${pieces.map((p) => `(${num(((p.color >> 16) & 255) / 255)},${num(((p.color >> 8) & 255) / 255)},${num((p.color & 255) / 255)})`).join(',')}]`,
  );
  return lines.join('\n');
}
export function dimensions(pieces: Piece[]): Vec {
  const model = geometry(pieces);
  const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec;
  model.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      (o.material as MeshStandardMaterial).dispose();
    }
  });
  return size;
}
