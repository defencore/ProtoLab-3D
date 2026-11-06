import type { Parameters } from '../../../core/types';
import type { Shape } from '../../../core/assembly/mechanical/shapes';
import { B, C, cut, move, poly, ring, union } from '../../../core/assembly/mechanical/helpers';
import { daierColours, type SwitchModel } from './catalog';

const metal = 0xb7bec6,
  plastic = 0x272e35,
  copper = 0xc8b68b;

/** Assumed installation envelope; these dimensions are not manufacturer CAD. */
export function bermButton(
  m: SwitchModel,
  p: Parameters,
  add: (label: string, shape: Shape, color?: number) => void,
) {
  const [bodyDiameter, , rearDepth] = m.body,
    barrelDepth = m.bushingHeight!,
    front = m.height!,
    head = m.bermHead!,
    headWidth = head === 'rectangular' ? 24 : 18,
    headDepth = 18,
    stroke = p.position === 'last' ? 1.5 : 0,
    colour = daierColours.find((colour) => colour.value === p.colour)!;
  const headSection = (inset: number, height: number, z: number): Shape =>
    head === 'round'
      ? C(headWidth - inset * 2, height, z)
      : B(headWidth - inset * 2, headDepth - inset * 2, height, 0, 0, z);

  add(
    'BEM-LA16 insulating body · assumed envelope',
    C(bodyDiameter, rearDepth - barrelDepth, -rearDepth),
    plastic,
  );
  // The low collar joins the bezel to the circular barrel. The broad head stays
  // above it throughout the illustrative stroke; only the smaller stem enters it.
  add(
    'BEM-LA16 mounting barrel and bezel · assumed nominal thread envelope',
    cut(
      union(C(m.bushing!, barrelDepth, -barrelDepth), headSection(0, 2, 0)),
      C(11.2, barrelDepth + 4, -barrelDepth - 1),
      headSection(1.2, 3, 0.65),
    ),
    plastic,
  );
  add(
    'BEM-LA16 coloured illuminated cap · assumed envelope and stroke',
    move(union(C(11, 5.2, -3), headSection(1.3, front - 2.2, 2.2)), 0, 0, -stroke),
    colour.color,
  );

  // Fixed inspection pose behind an illustrative 2 mm panel; the bore clears
  // the barrel and the two separate hardware pieces meet at Z=-3.
  add('BEM-LA16 panel washer · assumed 2 mm panel pose', ring(20, 16, 1, -3), metal);
  const hexPoints = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI * i) / 3,
      radius = 19 / Math.sqrt(3);
    return [radius * Math.cos(angle), radius * Math.sin(angle)] as [number, number];
  });
  add(
    'BEM-LA16 retaining nut · assumed profile and 2 mm panel pose',
    cut(poly(hexPoints, 3, -6), C(16, 5, -7)),
    metal,
  );

  const terminals: [number, number][] = [
    [-4, -3],
    [0, -3],
    [4, -3],
    [-3, 3],
    [3, 3],
  ];
  terminals.forEach(([x, y], index) =>
    add(
      `BEM-LA16 ${index < 3 ? 'switch' : 'lamp'} solder lug ${index < 3 ? index + 1 : index - 2} · assumed arrangement`,
      B(2.8, 0.5, 6, x, y, -rearDepth - 6),
      copper,
    ),
  );
}
