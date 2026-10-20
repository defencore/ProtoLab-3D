import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import type { DetailSpec } from './types';
import { layout } from './layout';

const rad = Math.PI / 180;
const pose = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
const centered = (x: number, y: number, z: number, at: Vec) =>
  box([x, y, z], [at[0] - x / 2, at[1] - y / 2, at[2] - z / 2]);
const circleCut = (diameter: number, height: number, at: Vec) => cylinder(diameter / 2, height, at);

export function kinematics(p: Parameters) {
  const h = Number(p.contactHeight),
    gap = Number(p.padGap),
    sweep = Number(p.servoSweep);
  const travel = 7 * Math.sin(sweep * rad);
  const direction = p.phase === 'press-on' ? 1 : p.phase === 'press-off' ? -1 : 0;
  const workingStroke = gap / 2 + h * Math.tan(12 * rad) - 3.5 / Math.cos(12 * rad);
  return {
    servoAngle: -direction * sweep,
    slide: direction * travel,
    travel,
    workingStroke,
    neutralClearance: gap / 2 - ((h + 2) * Math.tan(12 * rad) + 3.5 / Math.cos(12 * rad)),
    maxPadCompression: travel - workingStroke + 2 * Math.tan(12 * rad),
    switchPosition: p.phase === 'on' || p.phase === 'press-on' ? 'last' : 'first',
    direction,
  };
}

/** Hexagonal clearance pocket for the same M2 nut used by the composition. */
function nutPocket(at: Vec, sign: number): Shape {
  const radius = 4.2 / Math.sqrt(3);
  const points: [number, number][] = Array.from({ length: 6 }, (_, i) => {
    const a = ((i + 0.5) * Math.PI) / 3;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  });
  return pose(prism(points, 1.8, 0), at, [0, sign * 90, 0]);
}

/** A stock-disc crank and transverse slot give X = -R*sin(angle), without a rigid pivot coupling. */
export function drive(p: Parameters): DetailSpec[] {
  const m = layout(p),
    k = kinematics(p),
    cx = m.switchX + k.slide;
  const result: DetailSpec[] = [];
  const add = (
    id: string,
    label: string,
    shape: Shape,
    color: number,
    material: string,
    blank: string,
    processes: DetailSpec['processes'],
    explode: Vec,
  ) => result.push({ id, label, shape, color, material, blank, processes, explode });

  // The shaft ends are held in the four separate guide blocks, outside the moving fork envelope.
  for (const y of [-m.guideY, m.guideY])
    add(
      `guide-shaft-${y < 0 ? 'front' : 'rear'}`,
      'Ground guide shaft · Ø6 × 72',
      cylinder(3, m.guideEnds[1] - m.guideEnds[0], [m.guideEnds[0], y, m.contactZ], 'x'),
      0x9da7b1,
      'Hardened ground steel',
      'Ø6 h6 ground shaft, cut to 72 mm',
      ['cutting'],
      [0, y < 0 ? -30 : 30, 0],
    );

  const outer = centered(36, 62, 12, [cx, 0, m.contactZ]);
  const window = centered(26, 30, 16, [cx, 0, m.contactZ]);
  const spine = box([m.switchX - m.servoX - 9, 12, 4], [m.servoX - 8 + k.slide, 0, m.contactZ - 2]);
  const driveEye = centered(20, 28, 4, [m.servoX + k.slide, 6, m.contactZ]);
  const guideBores = [-m.guideY, m.guideY].map((y) =>
    cylinder(3.1, 40, [cx - 20, y, m.contactZ], 'x'),
  );
  // Slot accommodates all Y positions of the R7 pin, including neutral. Closed ends retain the drive.
  const slot = union(
    box([4.3, 12, 8], [m.servoX + k.slide - 2.15, 0, m.contactZ - 4]),
    circleCut(4.3, 8, [m.servoX + k.slide, 0, m.contactZ - 4]),
    circleCut(4.3, 8, [m.servoX + k.slide, 12, m.contactZ - 4]),
  );
  // Use a symmetric full-width cutter; the screw threads are kept out of the sliding guide bores.
  const screwClearance = [-5, 5].map((y) => cylinder(1.1, 44, [cx - 22, y, m.contactZ], 'x'));
  const padHeadClearance = [-5, 5].map((y) =>
    cylinder(2.05, 2.02, [cx - 20.01, y, m.contactZ], 'x'),
  );
  add(
    'fork-carriage',
    'POM sliding fork and transverse drive slot',
    subtract(union(outer, spine, driveEye), window, slot, ...guideBores, ...screwClearance, ...padHeadClearance),
    0x406b86,
    'POM-C',
    'POM-C plate 12 mm, stepped spine milled to 4 mm',
    ['milling', 'drilling'],
    [0, 0, 35],
  );

  // In a press pose the soft pad is shown with the measured-lever clearance removed. This is a
  // deformed contact envelope, not an elastic analysis or a specified force limit.
  const leverClearance = pose(
    cylinder(3.55, 26, [0, 0, 0]),
    [m.switchX, 0, m.switchZ + 12.5],
    [0, k.switchPosition === 'last' ? 12 : -12, 0],
  );
  for (const sign of [-1, 1]) {
    const face = Number(p.padGap) / 2;
    const x1 = sign > 0 ? face : -13;
    const contact = box([13 - face, 8, 4], [cx + x1, -4, m.contactZ - 2]);
    const flange = box([3, 16, 6], [cx + (sign > 0 ? 10 : -13), -8, m.contactZ - 3]);
    const holes = [-5, 5].flatMap((y) => [
      cylinder(1.1, 8, [cx + (sign > 0 ? 6 : -14), y, m.contactZ], 'x'),
      nutPocket([cx + sign * 10, y, m.contactZ], sign),
    ]);
    const blank = union(contact, flange);
    add(
      `contact-pad-${sign < 0 ? 'left' : 'right'}`,
      'Replaceable soft contact pad · TPU 95A',
      subtract(blank, ...holes, ...(k.direction === -sign ? [leverClearance] : [])),
      0xdfa34f,
      'Unfilled TPU 95A; qualify printed compression and creep',
      'Printed pad with captive M2 nuts; nominal contact thickness 4 mm',
      ['printing'],
      [sign * 25, 0, 25],
    );
  }

  const discZ = m.servoZ + 33.7;
  const adapter = subtract(
    cylinder(12, 2, [0, 0, discZ]),
    cylinder(4, 4, [0, 0, discZ - 1]),
    ...[
      [7, 0],
      [0, 7],
      [-7, 0],
      [0, -7],
    ].map(([x, y]) => cylinder(1.15, 4, [x, y, discZ - 1])),
  );
  add(
    'crank-adapter',
    'Output-disc adapter · four Ø2.3 clearance holes on PCD14',
    pose(adapter, [m.servoX, 0, 0], [0, 0, k.servoAngle]),
    0x9facba,
    'Al6061-T6',
    'Ø24 × 2 mm plate, central Ø8 retaining-screw clearance',
    ['cutting', 'drilling'],
    [0, 0, 22],
  );
  const pinX = m.servoX + k.slide,
    pinY = 7 * Math.cos(k.servoAngle * rad);
  const sleeve = subtract(
    union(cylinder(2, 9.5, [pinX, pinY, discZ + 2]), cylinder(3, 0.5, [pinX, pinY, discZ + 11])),
    cylinder(1.1, 12, [pinX, pinY, discZ + 1]),
  );
  add(
    'crank-sleeve',
    'Flanged crank sleeve · Ø4 / Ø2.2 × 9.5',
    sleeve,
    0xcbb47b,
    'Brass CW614N',
    'Turned flanged sleeve, running fit in 4.3 mm slot',
    ['turning', 'drilling'],
    [0, 0, 32],
  );
  return result;
}
