import { Group, Path, Shape, Vector2, Vector3 } from 'three';
import { annulusPython, extrude, n, num, ring } from '../../../../core/geometry';
import { pythonWire } from '../../../../core/mechanical';
import type { Parameters } from '../../../../core/types';
import { ballMeshes, ballPython, roundCircuit } from './guide-circuits';

function section(p: Parameters, cutaway: boolean) {
  const v = roundCircuit(p),
    bore = v.shaft + n(p, 'clearance');
  const inner = (a: number) => {
    let radius = bore;
    for (const row of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const delta = Math.atan2(Math.sin(a - row), Math.cos(a - row));
      if (Math.cos(delta) > 0)
        radius = Math.max(
          radius,
          Math.min(
            (v.returned + v.radius * 1.1) / Math.cos(delta),
            (v.radius * 1.1) / Math.max(1e-12, Math.abs(Math.sin(delta))),
          ),
        );
    }
    return radius;
  };
  const arc = (r: (a: number) => number, reverse = false) =>
    Array.from({ length: cutaway ? 129 : 256 }, (_, i) => {
      const a = cutaway
        ? Math.PI / 2 + (Math.PI * (reverse ? 128 - i : i)) / 128
        : (Math.PI * 2 * (reverse ? 255 - i : i)) / 256;
      return new Vector2(r(a) * Math.cos(a), r(a) * Math.sin(a));
    });
  const clean = (points: Vector2[]) =>
    points.filter((point, i) => {
      if (cutaway && (i === 0 || i === points.length - 1)) return true;
      const a = point.clone().sub(points[(i + points.length - 1) % points.length]),
        b = points[(i + 1) % points.length].clone().sub(point);
      return Math.abs(a.x * b.y - a.y * b.x) > 1e-10;
    });
  return { outerPoints: arc(() => v.outer), inner: clean(arc(inner, true)), ...v };
}
export function roundInsert(p: Parameters, cutaway: boolean): Group {
  const v = section(p, cutaway),
    group = new Group();
  const shape = cutaway ? new Shape([...v.outerPoints, ...v.inner]) : new Shape(v.outerPoints);
  if (!cutaway) shape.holes.push(new Path(v.inner));
  const sleeve = extrude(shape, n(p, 'blockLength') - 2 * v.radius, 0x7c858d);
  // Local X/Y map to assembly Y/Z; local Z follows the shaft X axis.
  sleeve.quaternion.setFromAxisAngle(new Vector3(1, 1, 1).normalize(), (Math.PI * 2) / 3);
  sleeve.position.set(v.x, 0, v.z);
  sleeve.name = 'Ball-bushing return cage';
  group.add(sleeve);
  for (const side of [-1, 1]) {
    const seal = ring(v.outer, v.shaft + n(p, 'clearance'), v.radius, 0x242b32);
    seal.rotation.y = Math.PI / 2;
    seal.position.set(v.x + side * (n(p, 'blockLength') / 2 - v.radius / 2), 0, v.z);
    seal.name = 'End wiper';
    group.add(seal);
  }
  group.add(...ballMeshes(v.points, v.radius));
  return group;
}
export function roundInsertPython(p: Parameters, cutaway: boolean): string {
  const v = section(p, cutaway),
    length = n(p, 'blockLength') - 2 * v.radius;
  let code = cutaway
    ? `cage = Part.Face(${pythonWire([...v.outerPoints, ...v.inner], -length / 2)})`
    : `cage = Part.Face(${pythonWire(v.outerPoints, -length / 2)}).cut(Part.Face(${pythonWire(v.inner, -length / 2)}))`;
  code += `\ncage = cage.extrude(App.Vector(0,0,${num(length)}))\ncage.rotate(App.Vector(0,0,0),App.Vector(1,1,1),120)\ncage.translate(App.Vector(${num(v.x)},0,${num(v.z)}))\ninsert_parts = [cage]`;
  for (const side of [-1, 1])
    code += `\nwiper = ${annulusPython(v.outer, v.shaft + n(p, 'clearance'), v.radius)}\nwiper.rotate(App.Vector(0,0,0),App.Vector(0,1,0),90)\nwiper.translate(App.Vector(${num(v.x + side * (n(p, 'blockLength') / 2 - v.radius / 2))},0,${num(v.z)}))\ninsert_parts.append(wiper)`;
  return code + `\ninsert_parts.extend([${ballPython(v.points, v.radius).join(', ')}])`;
}
