import type { Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { n } from '../../../core/geometry';

export function layout(p: Parameters) {
  const L = n(p, 'length'),
    b = n(p, 'width'),
    t = n(p, 'thickness'),
    e = n(p, 'hook'),
    r = n(p, 'rootRadius'),
    w = n(p, 'wall'),
    c = n(p, 'clearance'),
    a = n(p, 'anchor'),
    tab = n(p, 'releaseTab');
  const bottom = w + c + e,
    top = bottom + t,
    rear = r + L,
    tip = rear + e + tab,
    receiverStart = r + L / 3,
    receiverEnd = rear + e + c,
    receiverHeight = top + e + c;
  const tipLength = L + e + tab;
  return {
    L,
    b,
    t,
    e,
    r,
    w,
    c,
    a,
    tab,
    bottom,
    top,
    rear,
    tip,
    receiverStart,
    receiverEnd,
    receiverHeight,
    strainPercent: (100 * 1.5 * t * e) / (L * L),
    tabLiftEstimate: (e * 2 * tipLength ** 3) / (L * L * (3 * tipLength - L)),
  };
}

export function shapes(
  p: Parameters,
): { id: string; label: string; shape: Shape; color: number }[] {
  const d = layout(p),
    { L, b, t, e, r, w, c, a, bottom, top, rear, tip, receiverStart, receiverEnd, receiverHeight } =
      d;
  // Concave quarter-circle root webs: preview cylinders and true native CAD cylinders.
  const web = (upper: boolean): Shape => {
    const z = upper ? top : bottom - r;
    return subtract(
      box([r, b, r], [0, -b / 2, z]),
      cylinder(r, b + 2, [r, -b / 2 - 1, upper ? top + r : bottom - r], 'y'),
    );
  };
  const hook = prism(
    [
      [rear, bottom],
      [rear, bottom - e],
      [rear + e, bottom],
    ],
    b,
    -b / 2,
    'y',
  );
  const male = union(
    box([a, b, t + 2 * r], [-a, -b / 2, bottom - r]),
    box([r + L + e + n(p, 'releaseTab'), b, t], [0, -b / 2, bottom]),
    hook,
    web(false),
    web(true),
  );
  const floor = box(
    [receiverEnd - receiverStart, b + 2 * (c + w), w],
    [receiverStart, -b / 2 - c - w, 0],
  );
  const rails = [-1, 1].map((side) =>
    box(
      [receiverEnd - receiverStart, w, receiverHeight - w],
      [receiverStart, side < 0 ? -b / 2 - c - w : b / 2 + c, w],
    ),
  );
  const catchBar = box([w, b + 2 * c, bottom - c - w], [rear - c - w, -b / 2 - c, w]);
  const receiver = union(floor, ...rails, catchBar);
  return [
    {
      id: 'snap-arm',
      label: 'Printed cantilever arm and release tab',
      shape: male,
      color: 0xe5a546,
    },
    {
      id: 'snap-receiver',
      label: 'Printed open receiver and catch',
      shape: receiver,
      color: 0x578ea6,
    },
  ];
}

export function configured(p: Parameters, state = 'assembled'): ConfiguredPiece[] {
  const d = layout(p);
  return shapes(p).map((piece, index) => {
    const component = detailComponent(piece.id, piece.label, piece.shape);
    component.manufacturing = {
      material: 'Specify and qualify the actual printed polymer grade and orientation',
      blank: 'Separately printed coupon',
      processes: ['printing'],
      requirements: [
        'Calibrate mating clearances and verify hook engagement, release access and service cycles on printed samples.',
        index === 0
          ? 'Print the arm on its side, with beam length and bending plane in the build XY plane.'
          : 'Print the receiver with its broad floor on the build plate.',
      ],
    };
    let position: [number, number, number] = [0, 0, 0];
    if (state === 'exploded' && index === 0) position = [-d.tip - d.a - 8, 0, 0];
    if (state === 'print' && index === 0) {
      const [x, y, z] = component.placement.translation;
      const offset = d.b / 2 + d.c + d.w + d.top + d.r + 8;
      component.placement = { translation: [x, offset - z, y + d.b / 2], rotation: [90, 0, 0] };
    }
    return {
      component,
      label: piece.label,
      color: piece.color,
      position,
      requireSingleSolid: true,
    };
  });
}

export function validate(p: Parameters, state: string): string[] {
  const d = layout(p),
    errors: string[] = [];
  if (!['assembled', 'exploded', 'print'].includes(state))
    errors.push('Choose an available model state.');
  if (d.r < d.t / 2) errors.push('Root radius must be at least half the beam thickness.');
  if (d.r > d.e + d.c + d.w)
    errors.push('Root fillet must leave the anchor block above the assembly datum.');
  if (d.e <= d.c)
    errors.push('Hook rise must exceed the mating clearance for positive catch engagement.');
  if (d.L < 10 * d.t || d.L < 10 * d.e)
    errors.push(
      'The beam screening model requires length at least ten times thickness and release lift.',
    );
  if (d.strainPercent > n(p, 'strainLimit'))
    errors.push(
      'Estimated nominal beam strain exceeds the user screening limit. Increase length or reduce thickness / hook rise.',
    );
  if (d.rear - d.c - d.w <= d.receiverStart)
    errors.push('The catch must fit beyond the receiver entry.');
  if (d.tab <= d.c + 2) errors.push('Release tab must project at least 2 mm beyond the receiver.');
  return errors;
}
