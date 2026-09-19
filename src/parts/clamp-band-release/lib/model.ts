import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { box, cylinder, prism, ring, subtract, union, type Shape, type Vec } from './shapes';
const metal = 0xaeb9c3,
  green = 0x89986a,
  bronze = 0xb19a66,
  dark = 0x48515c;
const turn = (s: Shape, a: number, translation: Vec = [0, 0, 0], axis: 'y' | 'z' = 'z'): Shape => ({
  kind: 'transform',
  child: s,
  translation,
  rotation: axis === 'z' ? [0, 0, a] : [0, a, 0],
});
const sector = (profile: [number, number][], start: number, sweep: number): Shape =>
  turn({ kind: 'revolve', profile, sweep }, start);
const annular = (r: number, inner: number, z: number, h: number, start: number, sweep: number) =>
  sector(
    [
      [inner, z],
      [r, z],
      [r, z + h],
      [inner, z + h],
    ],
    start,
    sweep,
  );
const xy = (r: number, degrees: number): [number, number] => [
  r * Math.cos((degrees * Math.PI) / 180),
  r * Math.sin((degrees * Math.PI) / 180),
];
export function motion(p: Parameters, state: string) {
  const q = state === 'released' ? 100 : +p.release;
  return {
    pin: Math.min(1, q / (p.layout === 'pivot' ? 25 : 15)),
    opening: Math.max(
      0,
      Math.min(1, (q - (p.layout === 'pivot' ? 25 : 15)) / (p.layout === 'pivot' ? 30 : 40)),
    ),
    lift: Math.max(0, (q - 55) / 45) * +p.separation,
    exploded: state === 'exploded',
  };
}
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [],
    r = +p.diameter / 2,
    b = +p.bore / 2,
    k = +p.diameter / 90;
  const { pin, opening, lift, exploded } = motion(p, state);
  const e = exploded ? 14 * k : 0,
    rise = lift + 2 * e;
  const pivot = p.layout === 'pivot',
    count = +p.segments;
  const add = (label: string, shape: Shape, color = metal, position?: Vec) =>
    out.push({ label, shape, color, position });
  // Matching tapered lips capture the joint, with the through passage kept unobstructed.
  let lower: Shape = {
    kind: 'revolve',
    profile: [
      [b, -12 * k],
      [r, -12 * k],
      [r, -4 * k],
      [r + 3 * k, -1 * k],
      [r + 3 * k, 0],
      [b, 0],
    ],
  };
  let upper: Shape = {
    kind: 'revolve',
    profile: [
      [b, 0.2 * k],
      [r + 3 * k, 0.2 * k],
      [r + 3 * k, 1.2 * k],
      [r, 4.2 * k],
      [r, 12 * k],
      [b, 12 * k],
    ],
  };
  const interfaceRelief = union(
    { ...lower, profile: lower.profile.map(([v, z]) => [v + 0.25 * k, z] as [number, number]) },
    { ...upper, profile: upper.profile.map(([v, z]) => [v + 0.25 * k, z] as [number, number]) },
  );
  const springR = r + (pivot ? 33 : 38) * k,
    baseOffset = pivot ? 12 * k : 0;
  // The bearing arms are integral features, not coincident standalone solids.
  if (p.springs)
    for (let i = 0; i < 6; i++) {
      const a = 30 + i * 60;
      lower = union(
        lower,
        turn(
          subtract(
            box([springR - r + 8 * k, 10 * k, 4 * k], [r - 2 * k, -5 * k, -16 * k - baseOffset]),
            cylinder(4.2 * k, 6 * k, [springR, 0, -17 * k - baseOffset]),
          ),
          a,
        ),
      );
      upper = union(
        upper,
        turn(box([springR - r + 8 * k, 10 * k, 4 * k], [r - 2 * k, -5 * k, 8 * k]), a),
      );
    }
  if (!pivot) {
    const hingeX = -(r + 16 * k),
      latchX = r + 16 * k;
    const pose = (s: Shape, side: number): Shape =>
      turn(turn(s, 0, [-hingeX, 0, 0]), side * opening * 20, [hingeX, 0, 0]);
    lower = union(
      lower,
      subtract(
        box([22 * k, 8 * k, 4 * k], [hingeX - 4 * k, -4 * k, -16 * k]),
        cylinder(1.7, 6 * k, [hingeX, 0, -17 * k]),
      ),
      ring(3 * k, 1.7, -12 * k, 5 * k, hingeX, 0),
    );
    for (const side of [1, -1]) {
      const start = side === 1 ? 6 : 186;
      let strip = annular(r + 8 * k, r + 7 * k, -6 * k, 12 * k, start, 168);
      // Fork and tongue alternate in Z. Both end pins have actual clearance bores.
      for (const sign of [-1, 1]) {
        const arm: [number, number][] = [
          [sign * (r + 6 * k), side * 5.2 * k],
          [sign * (r + 6 * k), side * 11 * k],
          [sign * (r + 19 * k), side * 3 * k],
          [sign * (r + 19 * k), -side * 3 * k],
          [sign * (r + 13 * k), -side * 3 * k],
        ];
        for (const [z, h] of side === 1
          ? [
              [-6 * k, 3 * k],
              [3 * k, 3 * k],
            ]
          : [[-2.7 * k, 5.4 * k]])
          strip = union(
            strip,
            subtract(prism(arm, h, z), cylinder(1.7, h + 2, [sign * (r + 16 * k), 0, z - 1])),
          );
      }
      for (let i = 0; i < count / 2; i++) {
        const a = (side === 1 ? 18 : 198) + ((i + 0.5) * 144) / (count / 2),
          width = 144 / (count / 2) - 3;
        let block = sector(
          [
            [r + 0.3 * k, -5 * k],
            [r + 7 * k, -5 * k],
            [r + 7 * k, 5.2 * k],
            [r + 0.3 * k, 5.2 * k],
            [r + 0.3 * k, 4.5 * k],
            [r + 3.4 * k, 1.3 * k],
            [r + 3.4 * k, -1.1 * k],
            [r + 0.3 * k, -4.3 * k],
          ],
          a - width / 2,
          width,
        );
        for (const z of [-2.7 * k, 2.7 * k]) {
          const bore = turn(cylinder(1.05 * k, 5 * k, [r + 4.5 * k, 0, z], 'x'), a);
          strip = subtract(strip, bore);
          block = subtract(block, bore);
          add(
            `Band rivet ${side}/${i + 1}/${z < 0 ? 'lower' : 'upper'} · steel · clearance fit`,
            pose(
              turn(
                union(
                  cylinder(0.9 * k, 3.2 * k, [r + 5 * k, 0, z], 'x'),
                  cylinder(1.4 * k, 0.6 * k, [r + 8.2 * k, 0, z], 'x'),
                ),
                a,
              ),
              side,
            ),
            dark,
          );
        }
        add(
          `CB-04 V-clamp ${side === 1 ? i + 1 : i + 1 + count / 2} · Al7075 · relieved profile`,
          pose(block, side),
        );
      }
      add(
        `CB-03 Tension band ${side === 1 ? 'A' : 'B'} · stainless · integral end fittings`,
        pose(strip, side),
        bronze,
      );
    }
    add(
      'CB-06 Captive hinge pin · steel · nominal diameter 3',
      union(cylinder(1.5, 25 * k, [hingeX, 0, -18 * k]), cylinder(2.8, 1 * k, [hingeX, 0, 7 * k])),
      dark,
    );
    add(
      'CB-07 Hinge lower retaining collar · steel',
      ring(2.8, 1.55, -17 * k, 1 * k, hingeX, 0),
      dark,
    );
    add(
      'Removable release pin · steel · withdraw 20 mm scaled before opening',
      pose(
        union(
          cylinder(1.5, 13 * k, [latchX, 0, -6 * k + pin * 20 * k]),
          cylinder(3.8 * k, 2 * k, [latchX, 0, 7 * k + pin * 20 * k]),
        ),
        1,
      ),
      dark,
    );
  } else {
    // The alternative reference uses captive jaws on tangential pivots, not free V blocks.
    lower = union(lower, ring(r + 17 * k, b, -28 * k, 4 * k), ring(r, b, -24 * k, 12 * k));
    for (let i = 0; i < count; i++) {
      const a = 20 + ((i + 0.5) * 320) / count,
        span = Math.min(6 * k, (((r + 5 * k) * Math.PI) / count) * 0.65);
      const pivotR = r + 7 * k,
        pivotZ = -20 * k;
      const bore = cylinder(1.7, 2 * span + 4, [pivotR, -span - 2, pivotZ], 'y');
      const foot = union(
        box([6 * k, span * 2 + 2 * k, 2 * k], [pivotR - 3 * k, -span - k, -26 * k]),
        box([6 * k, 1.5 * k, 7 * k], [pivotR - 3 * k, -span - k, -24 * k]),
        box([6 * k, 1.5 * k, 7 * k], [pivotR - 3 * k, span - 0.5 * k, -24 * k]),
      );
      lower = subtract(
        lower,
        turn(
          box([20 * k, span * 1.6 + 0.8 * k, 11 * k], [r - 14 * k, -span * 0.8 - 0.4 * k, -18 * k]),
          a,
        ),
      );
      lower = union(lower, turn(subtract(foot, bore), a));
      const jawProfile = prism(
        [
          [-2 * k, 0],
          [2 * k, 0],
          [2 * k, 25 * k],
          [-6.5 * k, 25 * k],
          [-6.5 * k, 23 * k],
          [-1 * k, 23 * k],
          [-1 * k, 21 * k],
          [-3 * k, 21 * k],
          [-3 * k, 17 * k],
          [-2 * k, 17 * k],
        ],
        span * 1.6,
        -span * 0.8,
        'y',
      );
      const jaw = subtract(
        union(
          jawProfile,
          cylinder(2.5 * k, span * 1.6, [0, -span * 0.8, 0], 'y'),
          box([12.5 * k, span * 1.6, 1.3 * k], [-12.5 * k, -span * 0.8, 2.5 * k]),
        ),
        cylinder(1.7, span * 2 + 2, [0, -span - 1, 0], 'y'),
      );
      // Positive Y rotation moves the upper lip radially out, away from the departing flange.
      add(
        `CB-12 Captive clamp jaw ${i + 1} · Al7075 · concept`,
        turn(
          turn(
            subtract(jaw, turn(interfaceRelief, 0, [-pivotR, 0, -pivotZ])),
            opening * 42,
            [pivotR, 0, pivotZ],
            'y',
          ),
          a,
        ),
        metal,
      );
      add(
        `Pivot pin ${i + 1} · steel · nominal diameter 3`,
        turn(cylinder(1.5, 2 * span + 2, [pivotR, -span - 1, pivotZ], 'y'), a),
        dark,
      );
    }
    // Constant neutral-axis arc length: the gap closes instead of stretching the band.
    const sweep = 332 + 20 * pin,
      ringR = ((r - 5 * k) * 332) / sweep,
      gap = (360 - sweep) / 2;
    const [ex, ey] = xy(ringR, gap),
      linkLength = 12 * k,
      sliderX = ex - Math.sqrt(linkLength ** 2 - ey ** 2);
    let driveRing = annular(ringR + k, ringR - k, -16 * k, 4 * k, gap, sweep);
    for (const side of [-1, 1]) {
      driveRing = subtract(
        union(driveRing, cylinder(2.3 * k, 4 * k, [ex, side * ey, -16 * k])),
        cylinder(1.3 * k, 6 * k, [ex, side * ey, -17 * k]),
      );
      const dx = ex - sliderX,
        dy = side * ey,
        angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const z = side === 1 ? -11.6 * k : -9.2 * k;
      const link = subtract(
        union(
          box([linkLength, 3 * k, 2 * k], [0, -1.5 * k, z]),
          cylinder(1.5 * k, 2 * k, [0, 0, z]),
          cylinder(1.5 * k, 2 * k, [linkLength, 0, z]),
        ),
        cylinder(1.3 * k, 4 * k, [0, 0, z - k]),
        cylinder(1.3 * k, 4 * k, [linkLength, 0, z - k]),
      );
      add(
        `CB-14 Actuation link ${side < 0 ? 'A' : 'B'} · steel · constant length`,
        turn(link, angle, [sliderX, 0, 0]),
        bronze,
      );
      add(
        `Ring link pin ${side} · steel`,
        cylinder(1.1 * k, 9 * k, [ex, side * ey, -16 * k]),
        dark,
      );
    }
    add('CB-13 Split actuation ring · stainless · constant arc length', driveRing, bronze);
    // Sliding trunnion and a bored guide, both supported by the lower carrier.
    const slideZ = -21 * k;
    const slider = subtract(
      box([5 * k, 5 * k, 5 * k], [sliderX - 2.5 * k, -2.5 * k, slideZ]),
      cylinder(1.7, 7 * k, [sliderX - 3.5 * k, 0, slideZ + 2.5 * k], 'x'),
    );
    add(
      'CB-15 Linkage slider · Al7075 · bored trunnion',
      subtract(
        union(slider, cylinder(2.5 * k, 3 * k, [sliderX, 0, -16 * k])),
        cylinder(1.3 * k, 4 * k, [sliderX, 0, -16 * k]),
      ),
      green,
    );
    add('Linkage common pin · steel', cylinder(1.1 * k, 8 * k, [sliderX, 0, -15 * k]), dark);
    let guide = subtract(
      box([24 * k, 9 * k, 7 * k], [r - 27 * k, -4.5 * k, -23 * k]),
      box([26 * k, 5.4 * k, 5.4 * k], [r - 28 * k, -2.7 * k, -21.2 * k]),
    );
    for (const x of [r - 29 * k, r - 3 * k])
      guide = union(
        guide,
        subtract(
          box([2 * k, 9 * k, 7 * k], [x, -4.5 * k, -23 * k]),
          cylinder(1.7, 4 * k, [x - k, 0, -18.5 * k], 'x'),
        ),
      );
    lower = union(lower, box([29 * k, 9 * k, 2 * k], [r - 27 * k, -4.5 * k, -25 * k]), guide);
    add(
      'Adjustment screw · M3 nominal envelope',
      cylinder(1.5, 28 * k, [r - 29 * k, 0, -18.5 * k], 'x'),
      dark,
    );
    // Three C-shaped guides capture the flexible ring without entering its radial sweep.
    for (const a of [0.25, 0.5, 0.75].map((f) => 20 + (Math.floor(count * f) * 320) / count))
      lower = union(
        lower,
        turn(
          union(
            box([16 * k, 2 * k, 2 * k], [r - 15 * k, -k, -26 * k]),
            box([3 * k, 2 * k, 13 * k], [r - 15 * k, -k, -24 * k]),
            box([12.8 * k, 2 * k, 0.8 * k], [r - 15 * k, -k, -17 * k]),
            box([12.8 * k, 2 * k, 0.8 * k], [r - 15 * k, -k, -11.8 * k]),
          ),
          a,
        ),
      );
  }
  if (pivot) lower = subtract(lower, cylinder(1.7, 32 * k, [r - 30 * k, 0, -18.5 * k], 'x'));
  add(`CB-01 Lower interface · Al6061 · bore ${p.bore} mm · integral supports`, lower, green);
  add(`CB-02 Upper interface · Al6061 · bore ${p.bore} mm · integral seats`, upper, green, [
    0,
    0,
    rise,
  ]);
  if (p.springs)
    for (let i = 0; i < 6; i++) {
      const a = 30 + i * 60,
        [x, y] = xy(springR, a),
        travel = Math.min(lift, 8 * k);
      // The entire spring's swept wire envelope is between the two seat faces.
      const wire = 0.45 * k,
        bottom = -16.5 * k - baseOffset + wire,
        top = 6.5 * k + travel - wire;
      add(
        `Spring ${i + 1} · steel · rate unspecified`,
        { kind: 'spring', radius: 2.2 * k, wire, height: top - bottom, turns: 7 },
        metal,
        [x, y, bottom],
      );
      const sleeve = union(
        ring(4 * k, 3.1 * k, -16.5 * k - baseOffset, 13.5 * k + baseOffset, x, y),
        ring(5.5 * k, 1.4 * k, -18 * k - baseOffset, 1.5 * k, x, y),
        ring(5.5 * k, 3.1 * k, -16.5 * k - baseOffset, 0.5 * k, x, y),
      );
      add(
        `CB-22 Spring guide sleeve ${i + 1} · steel · bore ${(6.2 * k).toFixed(2)} mm · open top`,
        sleeve,
        bronze,
      );
      add(
        `CB-23 Sleeve retaining collar ${i + 1} · steel · nominal thread envelope`,
        ring(5.5 * k, 4.1 * k, -12 * k - baseOffset, 2 * k, x, y),
        dark,
      );
      add(
        `Spring plunger ${i + 1} · steel · captive lower stop`,
        union(
          cylinder(1.2 * k, 32.5 * k + baseOffset, [x, y, -26 * k - baseOffset + travel]),
          cylinder(3 * k, 1.5 * k, [x, y, 6.5 * k + travel]),
          cylinder(2.5 * k, 2 * k, [x, y, -28 * k - baseOffset + travel]),
        ),
        dark,
      );
    }
  return out;
}
