import { Group, LatheGeometry, Mesh, Vector2 } from 'three';
import type { Parameters } from '../../../core/types';
import { material, num } from '../../../core/geometry';
// Only pin length is dimensioned. Spacing follows the existing CA281A layout
// reconstruction; diameter is illustrative, not a contact standard.
export const PIN_LENGTH = 7.3;
export const PIN_PITCH = 4;
export const PIN_DIAMETER = 1;
type Profile = [number, number][];
interface Piece {
  label: string;
  color: number;
  x: number;
  profile: Profile;
}
export function pieces(p: Parameters): Piece[] {
  const d = Number(p.bodyDiameter),
    h = Number(p.overallHeight);
  const capR = Number(p.capDiameter) / 2,
    capH = Number(p.capHeight);
  const collarR = Number(p.collarDiameter) / 2,
    baseR = Number(p.baseDiameter) / 2;
  const bodyH = h - PIN_LENGTH - capH,
    z0 = -h / 2 + PIN_LENGTH;
  const z = (fraction: number) => z0 + fraction * bodyH;
  const housing: Profile = [
    [0, z0],
    [baseR, z0],
    [baseR, z(0.23)],
    [d / 2, z(0.42)],
    [d / 2, z(0.65)],
    [collarR, z(0.75)],
    [collarR, z(1)],
    [0, z(1)],
  ];
  const capBase = z(1),
    top = h / 2;
  const radius = Math.min(0.45, capH / 4, capR / 4);
  const cap: Profile = [
    [0, capBase],
    [capR, capBase],
    [capR, top - radius],
  ];
  for (let i = 1; i <= 12; i++) {
    const a = (i * Math.PI) / 24;
    cap.push([capR - radius + radius * Math.cos(a), top - radius + radius * Math.sin(a)]);
  }
  cap.push([0, top]);
  const pinR = PIN_DIAMETER / 2,
    bottom = -h / 2;
  const pin: Profile = [[0, bottom]];
  for (let i = 1; i <= 12; i++) {
    const a = (i * Math.PI) / 24;
    pin.push([pinR * Math.sin(a), bottom + pinR * (1 - Math.cos(a))]);
  }
  pin.push([pinR, z0], [0, z0]);
  return [
    { label: 'Housing exterior (solid layout volume)', color: 0x444b55, x: 0, profile: housing },
    { label: 'Metal cap exterior (solid layout volume)', color: 0xb9bdc2, x: 0, profile: cap },
    ...[-1, 1].map((sign, i) => ({
      label: `Reference pin ${i + 1} (illustrative)`,
      color: 0xb9a275,
      x: (sign * PIN_PITCH) / 2,
      profile: pin,
    })),
  ];
}
export function geometry(p: Parameters) {
  const group = new Group();
  for (const piece of pieces(p)) {
    const g = new LatheGeometry(
      piece.profile.map(([r, z]) => new Vector2(r, z)),
      96,
    );
    g.rotateX(Math.PI / 2);
    const mesh = new Mesh(g, material(piece.color));
    mesh.position.x = piece.x;
    mesh.name = piece.label;
    group.add(mesh);
  }
  return group;
}
export function python(p: Parameters) {
  const items = pieces(p);
  const lines = [
    '# Solid exterior layout components; no internal or mating geometry.',
    'components = []',
  ];
  for (const piece of items) {
    lines.push(
      `points = [${[...piece.profile, piece.profile[0]].map(([r, z]) => `App.Vector(${num(r)}, 0, ${num(z)})`).join(', ')}]`,
      'component = Part.Face(Part.makePolygon(points)).revolve(App.Vector(0,0,0), App.Vector(0,0,1), 360)',
      `component.translate(App.Vector(${num(piece.x)},0,0))`,
      'components.append(component)',
    );
  }
  lines.push(
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(items.map((p) => p.label))}`,
    `component_colors = [${items.map((p) => `(${num(((p.color >> 16) & 255) / 255)},${num(((p.color >> 8) & 255) / 255)},${num((p.color & 255) / 255)})`).join(',')}]`,
  );
  return lines.join('\n');
}
