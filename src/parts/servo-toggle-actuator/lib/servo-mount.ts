import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, union, type Shape } from '../../../core/assembly/boundary/shapes';
import { layout } from './layout';
import type { DetailSpec } from './types';

const aluminium = 0xb7c2ce;
const clearanceRadius = 4.3 / 2;

/** An external compression cage retains the case; the small OEM pilot holes carry no fasteners. */
export function servoMount(p: Parameters): DetailSpec[] {
  const m = layout(p);
  const plateLeft = m.servoX - 22;
  const plateRight = plateLeft + 66;
  const tieAxes: [number, number][] = [
    [m.servoX - 16, -18],
    [m.servoX - 16, 18],
    [m.servoX + 38, -18],
    [m.servoX + 38, 18],
  ];
  const rearWebBottom = m.servoZ - 7.5;
  const rearWebTop = m.servoZ - 4.5;
  const rearContact = m.servoZ - 1.5;
  const frontContact = m.servoZ + 30.5;
  const frontWebBottom = m.servoZ + 32;
  const frontWebTop = m.servoZ + 35;
  const lowerHeight = rearWebBottom - m.baseThickness;
  if (!Number.isFinite(lowerHeight) || lowerHeight <= 0)
    throw new Error('The servo clamp support height must be positive.');

  const throughHoles = (bottom: number, height: number): Shape[] =>
    tieAxes.map(([x, y]) => cylinder(clearanceRadius, height + 2, [x, y, bottom - 1]));
  const pads = (bottom: number, top: number, innerY = 9, width = 2): Shape[] =>
    [-innerY - width, innerY].map((y) => box([8, width, top - bottom], [m.servoX + 19, y, bottom]));
  // The rear case projects below the nominal contact plane. The recessed web clears it,
  // while integral pads meet independently measured continuous exterior face patches.
  const rearPlate = subtract(
    union(
      box([66, 48, 3], [plateLeft, -24, rearWebBottom]),
      ...pads(rearWebTop - 0.1, rearContact, 9.5, 1.5),
    ),
    cylinder(11, 8, [m.servoX, 0, rearWebBottom - 1]),
    ...throughHoles(rearWebBottom, 6),
  );
  const frontBridge = subtract(
    union(
      box([66, 48, 3], [plateLeft, -24, frontWebBottom]),
      ...pads(frontContact, frontWebBottom + 0.1),
    ),
    cylinder(13, 7, [m.servoX, 0, frontContact - 1]),
    ...throughHoles(frontContact, frontWebTop - frontContact),
  );
  const commonRequirements = [
    'Retain the case by controlled compression between the external plates; do not tap or load the OEM diameter 1.6 mm pilot holes.',
    'Measure the delivered case contact-face spacing before final fitting. Match the hard-stop column stack with fitted shims so tightening does not distort the case.',
    'Deburr and smooth contact edges. Tighten opposite tie bolts progressively and verify free servo motion after clamping.',
  ];
  const out: DetailSpec[] = [
    {
      id: 'servo-rear-clamp',
      label: 'Servo rear clamp plate · integral contact pads',
      shape: rearPlate,
      color: aluminium,
      material: 'Aluminium 6061-T6',
      blank: '66 × 48 × 6 mm plate; 3 mm web with integral 3 mm contact pads',
      processes: ['cutting', 'milling', 'drilling'],
      requirements: [
        ...commonRequirements,
        'Two 8 × 1.5 mm pads contact the supplier rear face at local Z -1.5 mm, X 19–27 mm and Y -11 to -9.5 / 9.5–11 mm. The inset inner edges clear the source casting fillets beneath the face.',
        'Maintain the diameter 22 mm central clearance and the recessed web below local Z -4.5 mm for the rear idler, pivot and case projection.',
        'Four diameter 4.3 mm through-bores are clearance holes for separate M4 tie hardware; no threads are cut into this plate.',
      ],
      explode: [0, 0, -12],
    },
    {
      id: 'servo-front-clamp',
      label: 'Servo front clamp bridge · diameter 26 mm output clearance',
      shape: frontBridge,
      color: aluminium,
      material: 'Aluminium 6061-T6',
      blank: '66 × 48 × 5 mm plate; finish to 3 mm web with integral 1.5 mm contact pads',
      processes: ['cutting', 'milling', 'drilling'],
      requirements: [
        ...commonRequirements,
        'Two 8 × 2 mm pads contact the supplier front face at local Z 30.5 mm, X 19–27 mm and Y -11 to -9 / 9–11 mm.',
        'Maintain the diameter 26 mm through-window for the diameter 19.2 mm supplier disc and diameter 24 mm drive adapter.',
        `Four diameter 4.3 mm through-bores accept separate M4 tie hardware. The right edge is X ${plateRight.toFixed(2)} mm and must stay clear of the guide blocks and switch-driving fork.`,
      ],
      explode: [0, 0, 28],
    },
  ];
  const column = (bottom: number, height: number, x: number, y: number): Shape =>
    subtract(
      cylinder(5, height, [x, y, bottom]),
      cylinder(clearanceRadius, height + 2, [x, y, bottom - 1]),
    );
  tieAxes.forEach(([x, y], i) => {
    out.push(
      {
        id: `servo-lower-post-${i + 1}`,
        label: `Servo lower support post ${i + 1}`,
        shape: column(m.baseThickness, lowerHeight, x, y),
        color: aluminium,
        material: 'Aluminium 6061-T6',
        blank: `Diameter 10 mm round stock; finished length ${lowerHeight.toFixed(2)} mm`,
        processes: ['turning', 'drilling'],
        requirements: [
          'Diameter 10 mm outside, diameter 4.3 mm through-bore. Both end faces square to the bore; no internal thread.',
          'Finish the four lower posts to equal length and keep all support axes aligned with the base and clamp plates.',
        ],
        explode: [0, 0, -6],
      },
      {
        id: `servo-tie-column-${i + 1}`,
        label: `Servo clamp hard-stop column ${i + 1}`,
        shape: column(rearWebTop, frontWebBottom - rearWebTop, x, y),
        color: aluminium,
        material: 'Aluminium 6061-T6',
        blank: 'Diameter 10 mm round stock; finished nominal length 36.50 mm',
        processes: ['turning', 'drilling'],
        requirements: [
          'Diameter 10 mm outside, diameter 4.3 mm through-bore. Separate M4 tie bolts pass through the complete stack; no internal thread.',
          'Match all four hard-stop column lengths after measuring the delivered servo and fitted contact pads. Case compression must remain controlled.',
        ],
        explode: [0, 0, 12],
      },
    );
  });
  return out;
}
