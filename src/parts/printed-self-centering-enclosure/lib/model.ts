import type { Parameters } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { box, cylinder, subtract, union, type Shape } from '../../../core/assembly/boundary/shapes';

export function layout(p: Parameters) {
  const W = Number(p.width),
    D = Number(p.depth),
    H = Number(p.height),
    t = Number(p.wall),
    lid = Number(p.lidThickness),
    e = Number(p.rimDepth),
    r = Number(p.rimThickness),
    a = Number(p.leadIn),
    relief = Number(p.cornerRelief),
    c = Number(p.clearance),
    pilotW = W - 2 * t - 2 * c,
    pilotD = D - 2 * t - 2 * c;
  return {
    W,
    D,
    H,
    t,
    lid,
    e,
    r,
    a,
    relief,
    c,
    pilotW,
    pilotD,
    pilotInnerW: pilotW - 2 * r,
    pilotInnerD: pilotD - 2 * r,
    tipW: pilotW - 2 * a,
    tipD: pilotD - 2 * a,
    straight: e - a,
    capture: c + a,
  };
}
const block = (W: number, D: number, h: number, z: number): Shape =>
  box([W, D, h], [-W / 2, -D / 2, z]);
const ring = (W: number, D: number, t: number, h: number, z: number): Shape =>
  subtract(block(W, D, h, z), block(W - 2 * t, D - 2 * t, h + 2, z - 1));

/** Six intentional planar faces; no preview triangles become native CAD facets. */
export function rectangularFrustum(
  W0: number,
  D0: number,
  W1: number,
  D1: number,
  z0: number,
  z1: number,
): Shape {
  return {
    kind: 'boundary',
    points: [
      [-W0 / 2, -D0 / 2, z0],
      [W0 / 2, -D0 / 2, z0],
      [W0 / 2, D0 / 2, z0],
      [-W0 / 2, D0 / 2, z0],
      [-W1 / 2, -D1 / 2, z1],
      [W1 / 2, -D1 / 2, z1],
      [W1 / 2, D1 / 2, z1],
      [-W1 / 2, D1 / 2, z1],
    ],
    faces: [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
    ],
  };
}
export function shapes(p: Parameters): [Shape, Shape] {
  const d = layout(p);
  const base = subtract(block(d.W, d.D, d.H, 0), block(d.W - 2 * d.t, d.D - 2 * d.t, d.H + 1, d.t));
  const transition = -d.e + d.a;
  const tapered = subtract(
    rectangularFrustum(d.tipW, d.tipD, d.pilotW, d.pilotD, -d.e, transition),
    rectangularFrustum(
      d.pilotInnerW - 2 * d.a - 0.2,
      d.pilotInnerD - 2 * d.a - 0.2,
      d.pilotInnerW + 0.2,
      d.pilotInnerD + 0.2,
      -d.e - 0.1,
      transition + 0.1,
    ),
  );
  const pilot = union(tapered, ring(d.pilotW, d.pilotD, d.r, d.straight + 0.1, transition));
  const relieved = subtract(
    pilot,
    ...[-1, 1].flatMap((x) =>
      [-1, 1].map((y) =>
        cylinder(d.relief, d.straight + 0.2, [
          (x * d.pilotW) / 2,
          (y * d.pilotD) / 2,
          transition - 0.1,
        ]),
      ),
    ),
  );
  const lid = union(block(d.W, d.D, d.lid, 0), relieved);
  return [base, lid];
}
export function components(p: Parameters): AssemblyComponent[] {
  const d = layout(p);
  return shapes(p).map((shape, i) => ({
    ...detailComponent(
      i === 0 ? 'base' : 'lid',
      i === 0 ? 'Printed open enclosure base' : 'Printed taper-guided lid and locating skirt',
      shape,
      { preserveAuthoredFrame: true },
    ),
    placement: { translation: [0, 0, i === 0 ? 0 : d.H], rotation: [0, 0, 0] },
    manufacturing: {
      material: 'Project-selected printing polymer; qualify grade, shrinkage and warpage',
      blank: 'Individually printed empty enclosure part',
      processes: ['printing'],
      requirements: [
        i === 0
          ? 'Print the base floor down.'
          : 'Print the outer lid face down; its pilot grows upward and tapers inward at its tip.',
        'Measure actual mating dimensions and verify the tapered entry, corner relief, planar stop, final play and complete service path.',
      ],
    },
  }));
}
export function pieces(p: Parameters, state: string): ConfiguredPiece[] {
  const d = layout(p);
  return components(p).map((source, i) => {
    const component: AssemblyComponent = {
      ...source,
      placement: {
        translation: [...source.placement.translation],
        rotation: [...source.placement.rotation],
      },
    };
    if (i === 1 && state === 'exploded') component.placement.translation[2] += d.e + 12;
    if (i === 1 && state === 'print')
      component.placement = { translation: [d.W + 8, 0, d.lid], rotation: [180, 0, 0] };
    return {
      component,
      label: component.name,
      color: i === 0 ? 0x457b85 : 0xe9ac45,
      requireSingleSolid: true,
    };
  });
}
export function validate(p: Parameters, state: string): string[] {
  const d = layout(p),
    errors: string[] = [];
  if (!['assembled', 'exploded', 'print'].includes(state))
    errors.push('Choose an implemented model state.');
  if (d.straight < 1)
    errors.push(
      'The pilot must retain at least 1 mm of straight locating length after the lead-in.',
    );
  if (d.H - d.t <= d.e + 1)
    errors.push('The pilot tip must remain at least 1 mm above the base floor.');
  if (d.relief >= d.r / 2)
    errors.push('Corner relief radius must be smaller than half the pilot thickness.');
  if (Math.min(d.pilotInnerW - 2 * d.a, d.pilotInnerD - 2 * d.a) < 12)
    errors.push('The tapered pilot must retain at least 12 mm of clear internal opening.');
  return errors;
}
