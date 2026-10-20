import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, union, type Shape } from '../../../core/assembly/boundary/shapes';
import type { DetailSpec } from './types';
import { layout } from './layout';

const aluminium = 0xb8c0c8;

/** A horizontal capsule with its total end-to-end length along global X. */
function slotX(
  x: number,
  y: number,
  diameter: number,
  length: number,
  z: number,
  height: number,
): Shape {
  const span = length - diameter;
  return union(
    box([span, diameter, height], [x - span / 2, y - diameter / 2, z]),
    cylinder(diameter / 2, height, [x - span / 2, y, z]),
    cylinder(diameter / 2, height, [x + span / 2, y, z]),
  );
}

/** Structural components in their installed coordinates; inspection offsets stay separate. */
export function frame(p: Parameters): DetailSpec[] {
  const m = layout(p),
    length = Number(p.baseLength),
    width = Number(p.baseWidth),
    posts = m.guideEnds.flatMap((x) => [-m.guideY, m.guideY].map((y) => ({ x, y }))),
    blockTop = m.contactZ + 8,
    blindTop = Math.min(m.contactZ - 3.5, m.deckTop + 13);
  const baseMounts = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) =>
      slotX(sx * (length / 2 - 15), sy * (width / 2 - 8), 4.5, 12, -1, m.baseThickness + 2),
    ),
  );
  const out: DetailSpec[] = [
    {
      id: 'base-plate',
      label: 'Common mounting base plate',
      shape: subtract(
        box([length, width, m.baseThickness], [-length / 2, -width / 2, 0]),
        ...baseMounts,
        ...[
          ...posts,
          ...[m.servoX - 16, m.servoX + 38].flatMap((x) => [-18, 18].map((y) => ({ x, y }))),
        ].flatMap(({ x, y }) => [
          cylinder(2.15, m.baseThickness + 2, [x, y, -1]),
          // Bottom-access M4 socket-head counterbores leave a 1.8 mm seat.
          cylinder(4.1, 4.3, [x, y, -0.1]),
        ]),
      ),
      color: aluminium,
      material: 'Aluminium 6061-T6',
      blank: `${length} × ${width} × 6 mm plate`,
      processes: ['cutting', 'milling', 'drilling'],
      requirements: [
        'Four external mounting slots are 4.5 mm wide and 12 mm long, aligned with X; confirm mounting-screw and enclosure-wall clearance on the actual installation.',
        'Eight support-screw passages are Ø4.3 mm with bottom Ø8.2 × 4.2 mm counterbores; retain the 1.8 mm screw-head seating web.',
        'Deburr slots and bores. Flatness, edge radii and hole-position tolerances require a released drawing; no actuation-force capacity is established.',
      ],
      explode: [0, 0, -12],
    },
  ];

  // Retain a 1.9 mm wide tongue reaching 0.9 mm into the round opening at -X.
  // The switch's source bushing groove is 1.95 mm wide and ends at X=-5.1 mm;
  // this tongue ends at X=-5.2 mm, leaving nominal lateral and radial clearance.
  const keyedOpening = subtract(
    cylinder(6.1, 5, [m.switchX, 0, m.deckBottom - 1]),
    box([1, 1.9, 7], [m.switchX - 6.2, -0.95, m.deckBottom - 2]),
  );
  out.push({
    id: 'switch-deck',
    label: 'Keyed switch mounting deck',
    shape: subtract(
      box([90, 62, 3], [-11, -31, m.deckBottom]),
      keyedOpening,
      ...posts.map(({ x, y }) => slotX(x, y, 4.3, 8, m.deckBottom - 1, 5)),
    ),
    color: aluminium,
    material: 'Aluminium 6061-T6',
    blank: '90 × 62 × 3 mm plate',
    processes: ['cutting', 'milling', 'drilling'],
    requirements: [
      'The Ø12.2 mm switch opening retains a 1.9 × 0.9 mm orientation tongue towards -X, matching the source ASW-07D bushing groove direction.',
      'Four Ø4.3 × 8 mm X-aligned slots permit ±1.85 mm deck adjustment about the nominal support coordinates; align the keyed switch and guide rods before clamping.',
      'Maintain the 3 mm panel thickness between the switch retaining nuts. Check the actual purchased bushing, key clearance and locking-nut engagement.',
    ],
    explode: [0, 0, 18],
  });

  for (const [index, { x, y }] of posts.entries()) {
    const suffix = `${index + 1}`;
    out.push({
      id: `deck-spacer-${suffix}`,
      label: `Lower deck spacer ${suffix}`,
      shape: subtract(
        cylinder(6, m.deckBottom - m.baseThickness, [x, y, m.baseThickness]),
        cylinder(2.15, m.deckBottom - m.baseThickness + 2, [x, y, m.baseThickness - 1]),
      ),
      color: aluminium,
      material: 'Aluminium 6061-T6',
      blank: `Ø12 mm round bar; finished length ${(m.deckBottom - m.baseThickness).toFixed(2)} mm`,
      processes: ['cutting', 'turning', 'drilling'],
      requirements: [
        'OD12 mm, through Ø4.3 mm. Face both ends square and finish the four spacers to equal lengths.',
        'The through screw clamps base, spacer and deck into the bottom threaded hole of the upper guide block; the spacer is a compression member.',
      ],
      explode: [0, Math.sign(y) * 10, 8],
    });
    out.push({
      id: `rod-guide-${suffix}`,
      label: `Upper rod guide and clamp block ${suffix}`,
      shape: subtract(
        box([18, 16, blockTop - m.deckTop], [x - 9, y - 8, m.deckTop]),
        cylinder(3.05, 20, [x - 10, y, m.contactZ], 'x'),
        // Nominal tapped envelopes: full thread profiles are not substituted for
        // tap-drill diameters, and the lower bore stops below the rod passage.
        cylinder(2, blindTop - m.deckTop + 0.1, [x, y, m.deckTop - 0.1]),
        cylinder(1.5, blockTop - m.contactZ - 1.6, [x, y, m.contactZ + 2.6]),
      ),
      color: 0x91a0ac,
      material: 'Aluminium 6061-T6',
      blank: `20 × 20 mm bar; machine to 18 × 16 × ${(blockTop - m.deckTop).toFixed(2)} mm`,
      processes: ['cutting', 'milling', 'drilling'],
      requirements: [
        'Ø6.1 mm rod passage runs along global X. Keep both blocks on each rod coaxial, and align the two rod axes at Y=±22 mm.',
        `Bottom M4 × 0.7 blind thread has nominal major-diameter envelope Ø4 mm from Z=${m.deckTop.toFixed(2)} to ${blindTop.toFixed(2)} mm; select the retention-screw length without reaching the rod passage.`,
        'Top M3 × 0.5 rod-clamping thread has a nominal Ø3 mm envelope and opens into the rod passage; use the separate clamp screw to retain the rod.',
        'Thread helices, tap-drill sizes and drill-point cones are omitted. Apply the M4/M3 thread callouts and machining depths from a released drawing, rather than treating the nominal envelopes as drill diameters.',
        'Remove burrs from intersecting bores before inserting rods. The guide blocks are fixed rod supports; the sliding fork runs between them.',
      ],
      explode: [0, Math.sign(y) * 14, 22],
    });
  }
  return out;
}
