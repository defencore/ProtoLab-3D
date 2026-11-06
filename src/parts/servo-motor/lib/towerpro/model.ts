import type { Parameters } from '../../../../core/types';
import { Box3, Group, Vector3 } from 'three';
import { disposeModel } from '../../../../core/mechanical';
import { num } from '../../../../core/geometry';
import {
  box,
  cylinder,
  subtract,
  union,
  component,
  pythonShape,
  type Shape,
  type Vec,
} from '../standard/shapes';

type Piece = { shape: Shape; label: string; color: number; shift: Vec; angle: number };

/** Fixed external fit references; no undocumented internal motor or gears are modeled. */
function pieces(p: Parameters, state: string): Piece[] {
  const length = +p.bodyLength,
    width = +p.bodyWidth,
    height = +p.bodyHeight,
    shaftX = +p.shaftOffset,
    mountZ = +p.mountBottom,
    mountT = +p.mountThickness;
  const rows = p.variant === 'mg90s' ? [0] : [-+p.mountPitchY / 2, +p.mountPitchY / 2];
  const housing = subtract(
    union(
      box([length, width, height], [-length / 2, -width / 2, 0]),
      box([+p.mountSpan, width, mountT], [-+p.mountSpan / 2, -width / 2, mountZ]),
    ),
    ...[-1, 1].flatMap((side) =>
      rows.map((y) =>
        cylinder(+p.mountHoleDiameter / 2, mountT + 2, [
          (side * +p.mountPitchX) / 2,
          y,
          mountZ - 1,
        ]),
      ),
    ),
  );
  const out: Piece[] = [
    {
      label: 'Servo housing and mounting ears · fit reference',
      color: 0x292e35,
      shape: housing,
      shift: [0, 0, 0],
      angle: 0,
    },
  ];
  if (state === 'body') return out;
  const separated = state === 'exploded';
  out.push({
    label: 'Smooth output shaft · unverified fit reference',
    color: 0xa6afb9,
    shape: subtract(
      cylinder(+p.shaftDiameter / 2, +p.shaftHeight, [0, 0, height]),
      cylinder(1.1, +p.shaftHeight + 2, [0, 0, height - 1]),
    ),
    shift: [shaftX, 0, separated ? 12 : 0],
    angle: +p.outputAngle,
  });
  if (p.showHorn)
    out.push({
      label: 'Illustrative single-arm horn',
      color: 0xc8a349,
      shape: subtract(
        union(
          cylinder(4, 2, [0, 0, height + 1]),
          box([+p.hornLength, 5, 2], [0, -2.5, height + 1]),
          cylinder(2.5, 2, [+p.hornLength, 0, height + 1]),
        ),
        cylinder(+p.shaftDiameter / 2 + 0.15, 4, [0, 0, height]),
        cylinder(1, 4, [+p.hornLength, 0, height]),
      ),
      shift: [shaftX, 0, separated ? 25 : 0],
      angle: +p.outputAngle,
    });
  return out;
}
export function geometry(p: Parameters, state: string): Group {
  const group = new Group();
  for (const piece of pieces(p, state)) {
    const placed = new Group();
    placed.name = piece.label;
    placed.add(component(piece.shape, piece.label, piece.color, [0, 0, 0]));
    placed.rotation.z = (piece.angle * Math.PI) / 180;
    placed.position.set(...piece.shift);
    group.add(placed);
  }
  return group;
}
export function dimensions(p: Parameters, state: string): Vec {
  const model = geometry(p, state);
  try {
    return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec;
  } finally {
    disposeModel(model);
  }
}
export function python(p: Parameters, state: string): string {
  const authored = pieces(p, state);
  const lines = ['components = []'];
  for (const piece of authored) {
    lines.push(`component = (${pythonShape(piece.shape)}).removeSplitter()`);
    if (piece.angle)
      lines.push(`component.rotate(App.Vector(),App.Vector(0,0,1),${num(piece.angle)})`);
    lines.push(
      `component.translate(App.Vector(${piece.shift.map(num).join(',')}))`,
      'components.append(component)',
    );
  }
  lines.push(
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(authored.map((piece) => piece.label))}`,
    `component_colors = ${JSON.stringify(authored.map((piece) => [((piece.color >> 16) & 255) / 255, ((piece.color >> 8) & 255) / 255, (piece.color & 255) / 255]))}`,
  );
  return lines.join('\n');
}
