import { detailComponent } from '../../../core/component-recipes';
import type { AssemblyDefinition } from '../../../core/product-types';
import type { Shape as DetailShape } from '../../../core/assembly/boundary/shapes';
import type { Shape } from './shapes';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';

function detailShape(shape: Shape): DetailShape {
  if (shape.kind === 'prism')
    return {
      kind: 'prism',
      points: shape.points.map(([x, y]) => [x, y]),
      depth: shape.height,
      origin: shape.y,
      axis: 'y',
    };
  if ('children' in shape) return { kind: shape.kind, children: shape.children.map(detailShape) };
  return { ...shape, origin: [...shape.origin] };
}

export function rodPieces(
  pieces: readonly {
    shape: Shape;
    label: string;
    color: number;
    shift: [number, number, number];
  }[],
): ConfiguredPiece[] {
  return pieces.map((piece, i) => ({
    component: detailComponent(`rod-component-${i + 1}`, piece.label, detailShape(piece.shape), {
      edgeTolerance: 1e-6,
    }),
    label: piece.label,
    color: piece.color,
    requireSingleSolid: true,
    position: [...piece.shift],
  }));
}

export function rodComposition(
  pieces: readonly { shape: Shape; label: string }[],
): AssemblyDefinition {
  return {
    components: pieces.map((piece, i) =>
      detailComponent(`rod-component-${i + 1}`, piece.label, detailShape(piece.shape), {
        edgeTolerance: 1e-6,
      }),
    ),
    issues: [
      'Rod and cap geometry are custom machining definitions. Specify alloy, blank or forging, heat treatment, fillets, bore tolerances and inspection before fabrication.',
      'Bushing, bearing shells and cap fasteners are dimensional prototypes; choose supplier executions or provide complete fabrication, retention and lubrication definitions.',
      'Verify bolt preload, running clearance, balance, fatigue strength and the intended engine or linkage interfaces. No engine fit is established by the source illustrations.',
    ],
  };
}
