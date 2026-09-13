import { Mesh, Vector3 } from 'three';
import { annulusPython, num } from '../../../../core/geometry';
import { BoundaryMesh } from '../../../../core/mechanical';

export interface CageLayout {
  pitch: number;
  radius: number;
  count: number;
  center: number;
  halfWindow: number;
  band: number;
  rowPhase: number;
}
function values(v: CageLayout) {
  const inner = v.pitch - v.radius * 0.12,
    outer = v.pitch + v.radius * 0.12,
    beta = Math.asin(Math.min(0.95, (v.radius * 1.055) / inner));
  return { inner, outer, beta };
}
/** A continuous cage shell, with one full-height window around each rolling element. */
export function cageMesh(v: CageLayout): Mesh {
  const d = values(v),
    z = [
      v.center - v.halfWindow - v.band,
      v.center - v.halfWindow,
      v.center + v.halfWindow,
      v.center + v.halfWindow + v.band,
    ];
  const angles: number[] = [];
  for (let i = 0; i < v.count; i++) {
    const a = (i * Math.PI * 2) / v.count + v.rowPhase;
    for (let j = 0; j < 8; j++) angles.push(a - d.beta + (2 * d.beta * j) / 8);
    for (let j = 0; j < 4; j++)
      angles.push(a + d.beta + (((Math.PI * 2) / v.count - 2 * d.beta) * j) / 4);
  }
  const occupied = (layer: number, cell: number) =>
    layer >= 0 &&
    layer < 3 &&
    (layer !== 1 || (((cell % angles.length) + angles.length) % angles.length) % 12 >= 8);
  const mesh = new BoundaryMesh(),
    point = (radius: number, a: number, h: number) =>
      new Vector3(radius * Math.cos(a), radius * Math.sin(a), h);
  for (let layer = 0; layer < 3; layer++)
    for (let cell = 0; cell < angles.length; cell++) {
      if (!occupied(layer, cell)) continue;
      const a = angles[cell],
        b = cell + 1 === angles.length ? angles[0] + 2 * Math.PI : angles[cell + 1],
        lo = z[layer],
        hi = z[layer + 1];
      for (const [radius, sign] of [
        [d.inner, -1],
        [d.outer, 1],
      ])
        mesh.face(
          [point(radius, a, lo), point(radius, b, lo), point(radius, b, hi), point(radius, a, hi)],
          [],
          new Vector3(sign * Math.cos((a + b) / 2), sign * Math.sin((a + b) / 2), 0),
        );
      for (const [adjacent, height, sign] of [
        [layer - 1, lo, -1],
        [layer + 1, hi, 1],
      ])
        if (!occupied(adjacent, cell))
          mesh.face(
            [
              point(d.inner, a, height),
              point(d.outer, a, height),
              point(d.outer, b, height),
              point(d.inner, b, height),
            ],
            [],
            new Vector3(0, 0, sign),
          );
      for (const [adjacent, angle, sign] of [
        [cell - 1, a, -1],
        [cell + 1, b, 1],
      ])
        if (!occupied(layer, adjacent))
          mesh.face(
            [
              point(d.inner, angle, lo),
              point(d.outer, angle, lo),
              point(d.outer, angle, hi),
              point(d.inner, angle, hi),
            ],
            [],
            new Vector3(-sign * Math.sin(angle), sign * Math.cos(angle), 0),
          );
    }
  const result = mesh.build(0xb39b66);
  result.name = 'Windowed rolling-element cage';
  return result;
}
export function cagePython(v: CageLayout, name: string): string {
  const d = values(v),
    bottom = v.center - v.halfWindow - v.band;
  return `${name} = ${annulusPython(d.outer, d.inner, 2 * (v.halfWindow + v.band), bottom)}\nfor i in range(${v.count}):\n    angle = i * ${num((2 * Math.PI) / v.count)} + ${num(v.rowPhase)}\n    a = angle - ${num(d.beta)}\n    b = angle + ${num(d.beta)}\n    r0 = ${num(Math.max(0.01, d.inner - v.radius * 0.05))}\n    r1 = ${num((d.outer + v.radius * 0.1) / Math.cos(d.beta))}\n    points = [App.Vector(r0*math.cos(a),r0*math.sin(a),${num(v.center - v.halfWindow)}),App.Vector(r1*math.cos(a),r1*math.sin(a),${num(v.center - v.halfWindow)}),App.Vector(r1*math.cos(b),r1*math.sin(b),${num(v.center - v.halfWindow)}),App.Vector(r0*math.cos(b),r0*math.sin(b),${num(v.center - v.halfWindow)})]\n    cutter = Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,0,${num(v.halfWindow * 2)}))\n    ${name} = ${name}.cut(cutter)\n${name} = ${name}.removeSplitter()`;
}
