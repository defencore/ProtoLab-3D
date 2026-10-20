import type { Shape } from '../../../core/assembly/boundary/shapes';

/**
 * Evaluate coincident pocket/bore cuts as one cutter set. (A \ B) \ C = A \ (B union C).
 * The moving saddle has an overlapping barrel bore at its integral boss floor;
 * sequential CSG subtraction otherwise leaves duplicate, open cap fragments.
 * This changes evaluation order only, never stock, cutter dimensions or native CAD.
 */
export function movingSaddlePreviewShape(shape: Shape): Shape {
  if (shape.kind === 'transform') return { ...shape, child: movingSaddlePreviewShape(shape.child) };
  if (!('children' in shape)) return shape;
  const children = shape.children.map(movingSaddlePreviewShape);
  if (shape.kind !== 'subtract') return { ...shape, children };
  let base = children[0];
  let cutters = children.slice(1);
  while (base.kind === 'subtract') {
    cutters = [...base.children.slice(1), ...cutters];
    base = base.children[0];
  }
  return {
    kind: 'subtract',
    children: [base, cutters.length === 1 ? cutters[0] : { kind: 'union', children: cutters }],
  };
}
