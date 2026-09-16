import type { Parameters } from '../../../core/types';
import { cylinder, prism, roundedRect, type Shape, type Vec } from './shapes';
import { B, C, cut, union, move, rotate, ring, link, teeth } from './helpers';
import * as assembly from './assembly';
import type { Piece } from './assembly';
import { track, type Wheel } from './track';
import { bezier, sample, v } from './spring';
const black = 0x252b31,
  tyre = 0x343a3e,
  silver = 0xa2acb4,
  brass = 0xb2945f;
const cy = (d: number, h: number, x: number, y: number, z: number) =>
  cylinder(d / 2, h, [x, y, z], 'y');
const xz = (shape: Shape) => rotate(shape, 90);
function deck(length: number, width: number, t: number): Shape {
  const x = length / 2,
    y = width / 2;
  const outline: [number, number][] = [
    [-x + 16, -y],
    [x - 16, -y],
    [x, -y + 16],
    [x, y - 16],
    [x - 16, y],
    [-x + 16, y],
    [-x, y - 16],
    [-x, -y + 16],
  ];
  const holes: Shape[] = [];
  for (const xx of [-x + 25, x - 25])
    for (const yy of [-y + 9, y - 9]) holes.push(C(3.4, t + 2, -1, xx, yy));
  for (const xx of [-length * 0.28, 0, length * 0.28])
    for (const yy of [-width * 0.24, 0, width * 0.24])
      holes.push(move(roundedRect(28, 4, 2, -1, t + 2), xx, yy));
  for (const xx of [-length * 0.4, length * 0.4]) holes.push(C(10, t + 2, -1, xx));
  return cut(prism(outline, t, 0), ...holes);
}
/** One continuous open-hook extension spring. The two eye centres are at z=0 and z=L. */
function springPath(L: number): Vec[] {
  const r = 2,
    coil = 2.2,
    h = L - 12;
  const lower = sample((t) => {
    const a = ((430 - 250 * t) * Math.PI) / 180;
    return v(r * Math.cos(a), 0, r * Math.sin(a));
  }, 20);
  const helix = sample((t) => {
    const a = Math.PI + 16 * Math.PI * t;
    return v(coil * Math.cos(a), coil * Math.sin(a), 6 + h * t);
  }, 128);
  const upper = sample((t) => {
    const a = ((180 - 250 * t) * Math.PI) / 180;
    return v(r * Math.cos(a), 0, L + r * Math.sin(a));
  }, 20);
  const up = v(0, 0, 1),
    tangent = v(0, -coil * 16 * Math.PI, h).normalize();
  return [
    ...lower,
    ...bezier(lower.at(-1)!, up, helix[0], tangent, 2).slice(1),
    ...helix.slice(1),
    ...bezier(helix.at(-1)!, tangent, upper[0], up, 2).slice(1),
    ...upper.slice(1),
  ].map((p) => p.toArray() as Vec);
}
export function pieces(p: Parameters, state: string): Piece[] {
  const L = +p.length,
    W = +p.width,
    DW = +p.deckWidth,
    t = +p.plateThickness,
    TW = +p.trackWidth;
  const R = +p.driveDiameter / 2,
    roadR = +p.roadDiameter / 2,
    N = +p.roadCount;
  const deckZ = R * 2 + 22,
    half = DW / 2 - 10,
    yTrack = (W - TW) / 2,
    wheelWidth = TW - 4;
  const end = L / 2 - R - 6.05,
    endZ = R + 16,
    roadZ = roadR + 6.05;
  const travel = +p.idlerAdjustment,
    detail = p.detail === 'detailed';
  const endClearance = Math.sqrt(Math.max(0, (R + roadR + 2) ** 2 - (endZ - roadZ - 3) ** 2)) + 3;
  const floorZ = R - 3 - t;
  const result: Piece[] = [];
  const add = (
    label: string,
    shape: Shape,
    color = black,
    position: Vec = [0, 0, 0],
    rotation: Vec = [0, 0, 0],
  ) => result.push({ label, shape, color, position, rotation });
  const deckLift = state === 'exploded' ? 65 : 0;
  add('Main slotted mounting deck', deck(L, DW, t), black, [0, 0, deckZ + deckLift]);
  const floor = cut(
    B(L - 20, half * 2, t, 0, 0, floorZ),
    ...[-1, 1].flatMap((s) =>
      [-1, 1].map((a) => B(28, 6, t + 2, s * L * 0.28, a * half * 0.45, floorZ - 1)),
    ),
  );
  add('Lower chassis tray', floor);
  if (p.layers === 'double') {
    const gap = +p.upperDeckGap;
    for (const x of [-L / 2 + 25, L / 2 - 25])
      for (const y of [-DW / 2 + 9, DW / 2 - 9]) {
        add(
          `Upper deck standoff ${x < 0 ? 'rear' : 'front'} ${y < 0 ? 'right' : 'left'}`,
          ring(7, 3.4, gap),
          silver,
          [x, y, deckZ + t + deckLift],
        );
        add(
          `Upper deck screw ${x < 0 ? 'rear' : 'front'} ${y < 0 ? 'right' : 'left'}`,
          union(C(3, t + 5, -5), C(5.5, 2, t)),
          silver,
          [x, y, deckZ + t + gap + deckLift * 1.8],
        );
      }
    add('Upper slotted mounting deck', deck(L, DW, t), black, [
      0,
      0,
      deckZ + t + gap + deckLift * 1.8,
    ]);
  }
  for (const side of [-1, 1]) {
    const name = side === 1 ? 'Left' : 'Right',
      pose = (+(side === 1 ? p.leftAngle : p.rightAngle) * Math.PI) / 180;
    const explode = state === 'exploded' ? side * 55 : 0;
    const place = (label: string, shape: Shape, color = black) => {
      // Pre-reflect local X coordinates, then rotate 180° about Z to mirror the running gear across Y=0.
      add(`${name} · ${label}`, side === 1 ? shape : rotate(shape, 0, 0, 180), color, [
        0,
        explode,
        0,
      ]);
    };
    const sx = (x: number) => side * x;
    const roadXs = Array.from(
      { length: N },
      (_, i) => (i / (N - 1) - 0.5) * (2 * end - 2 * endClearance),
    );
    const pivotXs = roadXs.map((x) => sx(x + 12));
    const pivotZ = roadZ + 16;
    // Keep the tensioner above the complete ±8° arm sweep, even with smaller end wheels.
    const maxPose = (8 * Math.PI) / 180;
    const adjusterZ = Math.max(
      endZ + 5,
      pivotZ + 5 * Math.sin(maxPose) + 7 * Math.cos(maxPose) + 5.5,
    );
    const holes: Shape[] = [
      cy(12.5, t + 2, sx(-end), half - 1, endZ),
      // Sliding idler axle slot with its slider plate covering the opening.
      move(xz(link([sx(end), endZ], [sx(end + 4), endZ], 6.6, t + 2, 0)), 0, half + t + 1, 0),
      ...pivotXs.map((x) => cy(4.4, t + 2, x, half - 1, pivotZ)),
      ...pivotXs.map((x) => cy(3.2, t + 2, x - sx(23), half - 1, deckZ - 10)),
    ];
    const panel = cut(B(L - 30, t, deckZ - floorZ - t, 0, half + t / 2, floorZ + t), ...holes);
    // Side rails remain in position in the exploded view; components move outboard.
    add(`${name} · Suspension side plate`, side === 1 ? panel : rotate(panel, 0, 0, 180));
    if (state === 'frame') continue;
    const wheels: Wheel[] = [
      { x: sx(-end), z: endZ, radius: R },
      { x: sx(end + travel), z: endZ, radius: R },
    ];
    const wheelY = yTrack - wheelWidth / 2;
    for (let i = 0; i < N; i++) {
      const pivot = pivotXs[i],
        vx = side * (-12 * Math.cos(pose) + 16 * Math.sin(pose)),
        vz = -12 * Math.sin(pose) - 16 * Math.cos(pose);
      const wx = pivot + vx,
        wz = pivotZ + vz,
        ex = pivot + side * (5 * Math.cos(pose) - 7 * Math.sin(pose)),
        ez = pivotZ + 5 * Math.sin(pose) + 7 * Math.cos(pose);
      const ax = pivot - side * 23,
        az = deckZ - 10;
      wheels.push({ x: wx, z: wz, radius: roadR });
      const arm = union(
        link([pivot, pivotZ], [wx, wz], 8, 2.5, 0, 4.3),
        link([pivot, pivotZ], [ex, ez], 6, 2.5, 0, 3.2),
      );
      // The union above would fill the pivot bore: recut both pivots and the spring eye.
      place(
        `Trailing arm ${i + 1}`,
        move(
          xz(cut(arm, C(4.3, 5, -1, pivot, pivotZ), C(4.3, 5, -1, wx, wz), C(3.2, 5, -1, ex, ez))),
          0,
          half + t + 3.5,
          0,
        ),
        silver,
      );
      const armOut = half + t + 3.5;
      place(
        `Arm pivot pin ${i + 1}`,
        union(cy(4, armOut - half + 1, pivot, half, pivotZ), cy(6, 1, pivot, armOut + 1, pivotZ)),
        silver,
      );
      place(
        `Road axle ${i + 1}`,
        union(
          cy(4, yTrack + wheelWidth / 2 - armOut + 4, wx, armOut - 3, wz),
          cy(6, 1, wx, yTrack + wheelWidth / 2 + 1, wz),
        ),
        silver,
      );
      const hubD = +p.roadDiameter - 7;
      place(
        `Road wheel rim ${i + 1}`,
        cut(
          cy(hubD, wheelWidth, wx, wheelY, wz),
          cy(4.4, wheelWidth + 2, wx, wheelY - 1, wz),
          cy(10, 4.01, wx, wheelY + wheelWidth - 4, wz),
        ),
        silver,
      );
      place(
        `Road wheel tyre ${i + 1}`,
        cut(
          cy(roadR * 2, wheelWidth, wx, wheelY, wz),
          cy(hubD, wheelWidth + 2, wx, wheelY - 1, wz),
        ),
        tyre,
      );
      place(
        `Road wheel bearing ${i + 1} · 4 × 10 × 4 envelope`,
        cut(
          cy(10, 4, wx, wheelY + wheelWidth - 4, wz),
          cy(4.1, 6, wx, wheelY + wheelWidth - 5, wz),
        ),
        silver,
      );
      const springY = half + t + 6.5,
        springLen = Math.hypot(ax - ex, az - ez),
        springAngle = (Math.atan2(ax - ex, az - ez) * 180) / Math.PI;
      // Mount pins terminate outside the spring eyes and are connected to the frame/arm.
      place(
        `Spring upper anchor ${i + 1}`,
        union(cy(3, springY - half + 1.5, ax, half, az), cy(4.5, 0.8, ax, springY + 1.5, az)),
        brass,
      );
      place(
        `Spring lower anchor ${i + 1}`,
        union(
          cy(3, springY - armOut + 4.5, ex, armOut - 3, ez),
          cy(4.5, 0.8, ex, springY + 1.5, ez),
        ),
        brass,
      );
      if (detail) {
        const wire = springPath(springLen).map(([x, y, z]): Vec => {
          const a = (springAngle * Math.PI) / 180;
          return [
            side * (ex + x * Math.cos(a) + z * Math.sin(a)),
            side * (springY + y) + explode,
            ez - x * Math.sin(a) + z * Math.cos(a),
          ];
        });
        result.push({
          label: `${name} · Tension spring ${i + 1}`,
          wire: { points: wire, diameter: 0.7 },
          color: silver,
        });
      } else {
        // The smooth central coil envelope excludes both anchor eyes, preserving assembly clearance.
        place(
          `Tension spring ${i + 1} · simplified coil`,
          move(rotate(C(5.1, Math.max(2, springLen - 12), 6), 0, springAngle), ex, springY, ez),
          silver,
        );
      }
    }
    for (const kind of ['Drive', 'Idler']) {
      const drive = kind === 'Drive',
        xx = sx(drive ? -end : end + travel);
      let disk = drive
        ? move(rotate(teeth(R - 1.8, R, 18, wheelWidth), 90), xx, wheelY + wheelWidth, endZ)
        : cy(R * 2, wheelWidth, xx, wheelY, endZ);
      const relief = Array.from({ length: 6 }, (_, i) =>
        cy(
          7,
          wheelWidth + 2,
          xx + R * 0.62 * Math.cos((i * Math.PI) / 3),
          wheelY - 1,
          endZ + R * 0.62 * Math.sin((i * Math.PI) / 3),
        ),
      );
      disk = cut(disk, cy(6.2, wheelWidth + 2, xx, wheelY - 1, endZ), ...relief);
      if (drive)
        disk = cut(
          union(disk, cy(15, wheelY - (half + t + 5), xx, half + t + 5, endZ)),
          cy(6.2, W, xx, 0, endZ),
        );
      else disk = cut(disk, cy(12, 4.01, xx, wheelY, endZ));
      place(`${kind} wheel`, disk);
      if (!drive) {
        place(
          'Idler bearing · 6 × 12 × 4 envelope',
          cut(cy(12, 4, xx, wheelY, endZ), cy(6.1, 6, xx, wheelY - 1, endZ)),
          silver,
        );
        place(
          'Sliding idler axle',
          union(
            cy(6, yTrack + wheelWidth / 2 - half - 3, xx, half + 4, endZ),
            cy(9, 1, xx, yTrack + wheelWidth / 2 + 1, endZ),
          ),
          silver,
        );
        place(
          'Idler tensioner block',
          cut(
            B(19, 4, Math.max(19, adjusterZ - endZ + 13.5), xx, half + t + 2, endZ - 9.5),
            cy(6.2, 6, xx, half + t - 1, endZ),
            cylinder(1.6, 22, [xx - 11, half + t + 2, adjusterZ], 'x'),
          ),
          silver,
        );
        place(
          'Tension adjuster bracket',
          cut(
            B(5, 4, 16, sx(end - 15), half + t + 2, endZ - 3),
            cylinder(1.7, 7, [sx(end - 15) - 3, half + t + 2, adjusterZ], 'x'),
          ),
          silver,
        );
        place(
          'Tension adjustment screw',
          union(
            cylinder(
              1.5,
              14 + travel,
              [side === 1 ? end - 19 : -end - travel + 5, half + t + 2, adjusterZ],
              'x',
            ),
            cylinder(2, 2, [side === 1 ? end - 21 : -end + 19, half + t + 2, adjusterZ], 'x'),
          ),
          silver,
        );
      }
    }
    // Published motor envelope: 64.40×38 gearbox, 12.01 thick; Ø34×35.15 motor, 6 mm output.
    const driveX = sx(-end),
      gearX = driveX + side * 19.27;
    place(
      'JGB3865 gearbox housing',
      cut(B(64.4, 12.01, 38, gearX, half - 6.005, endZ - 19), cy(6.2, 14, driveX, half - 13, endZ)),
      silver,
    );
    place('JGB3865 motor can', cy(34, 35.15, gearX, half - 47.16, endZ), silver);
    const output = union(cy(6, 13.1, driveX, half, endZ), cy(11.8, 2.5, driveX, half, endZ));
    place('6 mm D output shaft', cut(output, B(8, 12, 2, driveX, half + 9, endZ + 2.5)), silver);
    if (state !== 'undercarriage') place('Continuous tread belt', track(wheels, TW, detail), tyre);
    // Belt is generated around local wheel coordinates and then translated to the track centre.
    if (state !== 'undercarriage') {
      const belt = result.at(-1)!;
      belt.position![1] += side * yTrack;
    }
  }
  return result;
}
export const geometry = (p: Parameters, state: string) => assembly.geometry(pieces(p, state));
export const python = (p: Parameters, state: string) => assembly.python(pieces(p, state));
export const dimensions = (p: Parameters, state: string) => assembly.dimensions(pieces(p, state));
