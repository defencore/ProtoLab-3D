/** Generate native CAD kernel cases without changing preview tessellation. */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as mechanical from '../src/core/assembly/mechanical/shapes';
import * as boundary from '../src/core/assembly/boundary/shapes';
import * as electronics from '../src/core/assembly/electronics/shapes';
import * as airframe from '../src/core/assembly/airframe/shapes';
import { arcBand, torus } from '../src/core/assembly/mechanical/helpers';

const cases: { name: string; source: string; volume: number; maxFaces: number }[] = [];
for (const [name, lib] of Object.entries({ mechanical, boundary, electronics, airframe })) {
  const selections: [string, [number, number, number, number, number]][] = [
    ['rounded', [20, 12, 2, 0, 3]],
    ['stadium', [20, 8, 4, 0, 3]],
    ['round', [8, 8, 4, 0, 3]],
  ];
  for (const [label, args] of selections) {
    const [w, h, r, , d] = args;
    cases.push({
      name: `${name}/${label}`,
      source: 'shape = ' + lib.pythonShape(lib.roundedRect(...args)),
      volume: (w * h - (4 - Math.PI) * r * r) * d,
      maxFaces: 10,
    });
  }
  const bored = lib.subtract(lib.roundedRect(20, 12, 2, 0, 3), lib.cylinder(2, 5, [0, 0, -1]));
  cases.push({
    name: `${name}/bored-rounded`,
    source: 'shape = ' + lib.pythonShape(bored),
    volume: (240 - (4 - Math.PI) * 4 - Math.PI * 4) * 3,
    maxFaces: 11,
  });
  const profile: [number, number][] = Array.from({ length: 49 }, (_, i) => [
    10 + 1.5 * Math.cos((i * Math.PI) / 24),
    1.5 * Math.sin((i * Math.PI) / 24),
  ]);
  cases.push({
    name: `${name}/circular-revolve`,
    source: 'shape = ' + lib.pythonShape({ kind: 'revolve', profile }),
    volume: 2 * Math.PI ** 2 * 10 * 1.5 ** 2,
    maxFaces: 2,
  });
}
for (const [start, end] of [
  [15, 345],
  [10, 170],
  [345, 15],
]) {
  cases.push({
    name: `sector/${start}/${end}`,
    source: 'shape = ' + mechanical.pythonShape(arcBand(3, 1, 2, start, end)),
    volume: (Math.PI * (16 - 9) * 2 * Math.abs(end - start)) / 360,
    maxFaces: 8,
  });
}
cases.push({
  name: 'torus',
  source: 'shape = ' + mechanical.pythonShape(torus(10, 1.5)),
  volume: 2 * Math.PI ** 2 * 10 * 1.5 ** 2,
  maxFaces: 1,
});
const destination = process.argv[2] ?? 'test-results/analytic-geometry/kernels/after.json';
mkdirSync(path.dirname(destination), { recursive: true });
writeFileSync(destination, JSON.stringify(cases, null, 2));
console.log(JSON.stringify({ cases: cases.length, output: destination }));
