import type { Parameters } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { box, subtract, union, type Shape } from '../../../core/assembly/boundary/shapes';

export function layout(p: Parameters) {
  const W = Number(p.width),
    D = Number(p.depth),
    H = Number(p.height),
    t = Number(p.wall),
    lid = Number(p.lidThickness),
    e = Number(p.rimDepth),
    r = Number(p.rimThickness),
    c = Number(p.clearance),
    groove = p.model === 'groove',
    outerInset = groove ? (t - r) / 2 : t - r,
    rimW = W - 2 * outerInset,
    rimD = D - 2 * outerInset,
    rimInnerW = rimW - 2 * r,
    rimInnerD = rimD - 2 * r,
    lidHeight = e + c + lid;
  return {
    W,
    D,
    H,
    t,
    lid,
    e,
    r,
    c,
    groove,
    outerInset,
    rimW,
    rimD,
    rimInnerW,
    rimInnerD,
    lidHeight,
    cavityW: W - 2 * t,
    cavityD: D - 2 * t,
    skirtWall: outerInset - c,
    openingW: p.model === 'labyrinth' ? W - 2 * t - 2 * c - 2 * r : W - 2 * t,
    openingD: p.model === 'labyrinth' ? D - 2 * t - 2 * c - 2 * r : D - 2 * t,
  };
}
const block = (W: number, D: number, h: number, z: number) => box([W, D, h], [-W / 2, -D / 2, z]);
export function ring(W: number, D: number, t: number, h: number, z: number): Shape {
  return subtract(block(W, D, h, z), block(W - 2 * t, D - 2 * t, h + 2, z - 1));
}
export function shapes(p: Parameters): [Shape, Shape] {
  const d = layout(p);
  const shell = subtract(block(d.W, d.D, d.H, 0), block(d.cavityW, d.cavityD, d.H + 1, d.t));
  const raised = ring(d.rimW, d.rimD, d.r, d.e + 0.1, d.H - 0.1);
  const base = union(shell, raised);
  let lid: Shape;
  if (d.groove) {
    const cutter = ring(d.rimW + 2 * d.c, d.rimD + 2 * d.c, d.r + 2 * d.c, d.e + d.c + 1, -1);
    lid = subtract(block(d.W, d.D, d.lidHeight, 0), cutter);
  } else {
    const cap = block(d.W, d.D, d.lid, d.e + d.c);
    const skirt = ring(d.W, d.D, d.skirtWall, d.e + d.c + 0.1, 0);
    lid = union(cap, skirt);
    if (p.model === 'labyrinth') {
      const inner = ring(d.cavityW - 2 * d.c, d.cavityD - 2 * d.c, d.r, d.e + d.c + 0.1, 0);
      lid = union(lid, inner);
    }
  }
  return [base, lid];
}
export function components(p: Parameters): AssemblyComponent[] {
  const d = layout(p);
  return shapes(p).map((shape, i) => ({
    ...detailComponent(
      i === 0 ? 'base' : 'lid',
      i === 0 ? 'Printed enclosure base and raised rim' : 'Printed mating enclosure lid',
      shape,
      { preserveAuthoredFrame: true },
    ),
    placement: { translation: [0, 0, i === 0 ? 0 : d.H], rotation: [0, 0, 0] },
    manufacturing: {
      material: 'Project-selected printing polymer; qualify grade and build settings',
      blank: 'Individually printed empty enclosure part',
      processes: ['printing'],
      requirements: [
        i === 0
          ? 'Print the base floor on the build plate.'
          : 'Print the outer lid face down with the mating recesses facing upward.',
        'Measure walls and mating gaps; qualify dimensional compensation, warpage, support removal and application loads.',
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
      component.placement = { translation: [d.W + 8, 0, d.lidHeight], rotation: [180, 0, 0] };
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
  if (!['stepped', 'groove', 'labyrinth'].includes(String(p.model)))
    errors.push('Choose a supported rim construction.');
  if (d.H <= d.t + d.e)
    errors.push('The base must leave usable cavity depth below the raised rim.');
  if (d.skirtWall < 1.2 - 1e-9)
    errors.push(
      'Increase base wall or reduce rim thickness / clearance to leave at least 1.2 mm beside the lid recess.',
    );
  if (d.groove && (d.t - d.r) / 2 - d.c < 1.2 - 1e-9)
    errors.push('The tongue groove must leave at least 1.2 mm on each shoulder.');
  if (Math.min(d.openingW, d.openingD) < 12)
    errors.push('The selected rim must leave at least 12 mm of clear opening in each direction.');
  return errors;
}
