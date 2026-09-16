import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { B, C, T, move, rotate, union, cut, ring, link, finish } from './helpers';
import { cylinder, type Shape } from './shapes';

// Z is vertical; the wheel axles and all brace pivots are parallel to Y.
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0x8999aa) => out.push({ label, shape, color });
  const d = n(p, 'wheel'),
    w = n(p, 'width'),
    L = n(p, 'strut'),
    r = n(p, 'rod');
  const axle = n(p, 'axle'),
    t = n(p, 'forkWall'),
    c = n(p, 'clearance');
  const plate = n(p, 'plate'),
    span = n(p, 'braceSpan'),
    gap = 0.2;
  const twin = p.wheels === 'twin',
    braced = p.form !== 'fork',
    folding = p.form === 'folding';
  const tyreSpan = twin ? 2 * w + c : w;
  const inner = tyreSpan + 2 * c,
    outer = inner + 2 * t;
  const crown = d / 2 + c,
    tubeBottom = crown + t + (L - crown - t) * 0.28;
  const pin = axle * 0.75,
    eyeWidth = r * 0.6,
    bt = t * 0.75;
  const yzCylinder = (diam: number, length: number, x: number, y: number, z: number) =>
    cylinder(diam / 2, length, [x, y, z], 'y');
  const bar = (
    a: [number, number],
    b: [number, number],
    width: number,
    depth: number,
    y: number,
    bore = 0,
  ) => move(rotate(link(a, b, width, depth, 0, bore), 90), 0, y + depth / 2);
  const pivot = (name: string, x: number, z: number, lo: number, hi: number) =>
    add(name, yzCylinder(pin, hi - lo, x, lo, z), 0xc6ced5);
  const mount = (name: string, x: number, y: number, memberWidth: number) => {
    const z = L + r * 0.75 + gap;
    const cheekY = memberWidth / 2 + gap + t / 2;
    const body = union(
      B(plate, plate, t, x, y, z),
      bar([x, L], [x, z + t / 2], pin * 2.2, t, y - cheekY),
      bar([x, L], [x, z + t / 2], pin * 2.2, t, y + cheekY),
    );
    const holes = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) => C(pin * 0.7, t + 2, z - 1, x + sx * plate * 0.34, y + sy * plate * 0.34)),
    );
    add(name, cut(body, yzCylinder(pin + gap, plate + 2, x, y - plate / 2 - 1, L), ...holes));
    pivot(name + ' · pivot pin', x, L, y - cheekY - t / 2, y + cheekY + t / 2);
  };
  const centres = twin ? [-(w + c) / 2, (w + c) / 2] : [0];
  centres.forEach((y, i) => {
    const label = twin ? (i ? 'Right wheel' : 'Left wheel') : 'Wheel';
    const bead = d * 0.24;
    const tyre = T([
      [bead, -w / 2],
      [d * 0.43, -w / 2],
      [d * 0.49, -w * 0.34],
      [d / 2, -w * 0.16],
      [d / 2, w * 0.16],
      [d * 0.49, w * 0.34],
      [d * 0.43, w / 2],
      [bead, w / 2],
    ]);
    add(label + ' · rounded tyre', move(rotate(tyre, 90), 0, y), 0x303942);
    add(
      label + ' · bored hub',
      move(rotate(ring(bead * 2 - gap, axle + gap, w), 90), 0, y + w / 2),
      0xbbc4cf,
    );
  });
  const fork = union(
    B(r * 1.8, outer, t, 0, 0, crown),
    bar([0, 0], [0, crown + t / 2], axle * 2.3, t, -(inner + t) / 2),
    bar([0, 0], [0, crown + t / 2], axle * 2.3, t, (inner + t) / 2),
  );
  add(
    'Wheel fork · bored cheeks and crown',
    cut(fork, yzCylinder(axle + gap, outer + 2, 0, -outer / 2 - 1, 0)),
  );
  add('Wheel axle', yzCylinder(axle, outer + 2 * gap, 0, -outer / 2 - gap, 0), 0xd5dce3);
  for (const side of [-1, 1])
    add(
      (side < 0 ? 'Left' : 'Right') + ' axle retainer',
      yzCylinder(
        axle * 1.8,
        t * 0.4,
        0,
        side < 0 ? -outer / 2 - gap - t * 0.4 : outer / 2 + gap,
        0,
      ),
      0x647586,
    );
  add(
    'Lower sliding strut',
    C(r * 0.65, (L - tubeBottom) * 0.45 + tubeBottom - crown - t, crown + t),
    0xd3dce5,
  );
  const lugX = r * 1.4,
    lugZ = tubeBottom + (L - tubeBottom) * 0.32;
  let tube = union(
    C(r, L - r * 0.75 - tubeBottom, tubeBottom),
    C(r * 1.2, t, tubeBottom),
    bar([0, L - r * 0.4], [0, L], r * 1.5, eyeWidth, 0),
  );
  if (braced) tube = union(tube, bar([0, lugZ], [lugX, lugZ], pin * 2.2, eyeWidth, 0));
  // Blind axial bore leaves a solid head beneath the upper pivot.
  tube = cut(
    tube,
    C(r * 0.65 + gap, L - r - tubeBottom + 1, tubeBottom - 1),
    yzCylinder(pin + gap, r * 2, 0, -r, L),
  );
  if (braced) tube = cut(tube, yzCylinder(pin + gap, r * 2, lugX, -r, lugZ));
  add('Upper strut · collar and pivot eyes', tube);
  mount('Upper strut clevis mount', 0, 0, eyeWidth);
  if (braced) {
    const y1 = eyeWidth / 2 + gap + bt / 2,
      y2 = folding ? y1 + bt + gap : y1;
    const a: [number, number] = [lugX, lugZ],
      b: [number, number] = [span, L];
    if (folding) {
      const knee: [number, number] = [(lugX + span) / 2 + n(p, 'kneeOffset'), (lugZ + L) / 2];
      add('Drag brace · lower link', bar(a, knee, pin * 2.2, bt, y1, pin + gap), 0x567389);
      add('Drag brace · upper link', bar(knee, b, pin * 2.2, bt, y2, pin + gap), 0x567389);
      pivot('Drag brace · knee pin', knee[0], knee[1], y1 - bt / 2, y2 + bt / 2);
    } else add('Diagonal drag brace', bar(a, b, pin * 2.2, bt, y1, pin + gap), 0x567389);
    pivot('Drag brace · lower pivot pin', lugX, lugZ, -eyeWidth / 2, y1 + bt / 2);
    mount('Drag brace clevis mount', span, y2, bt);
  }
  return finish(out, state);
}
