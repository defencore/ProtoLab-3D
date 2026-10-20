import { detailComponent } from '../../../core/component-recipes';
import type { AssemblyDefinition } from '../../../core/product-types';
import type { Shape as DetailShape } from '../../../core/assembly/boundary/shapes';
import type { Shape } from './shapes';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';

function detailShape(shape: Shape): DetailShape {
  if (shape.kind === 'thread')
    return {
      kind: 'cylinder',
      radius: shape.radius,
      height: shape.height,
      origin: [...shape.origin],
      axis: 'z',
      segments: 64,
      thread: { pitch: shape.pitch, internal: shape.internal, left: shape.hand < 0 },
    };
  if ('children' in shape) return { kind: shape.kind, children: shape.children.map(detailShape) };
  return { ...shape, origin: [...shape.origin] };
}

export function clevisPieces(
  pieces: readonly {
    shape: Shape;
    label: string;
    color: number;
    shift: [number, number, number];
  }[],
): ConfiguredPiece[] {
  return pieces.map((piece, i) => ({
    component: detailComponent(`clevis-component-${i + 1}`, piece.label, detailShape(piece.shape), {
      edgeTolerance: 1e-6,
      meshConform: true,
    }),
    label: piece.label,
    color: piece.color,
    requireSingleSolid: true,
    position: [...piece.shift],
  }));
}

export function clevisComposition(
  pieces: readonly { shape: Shape; label: string }[],
): AssemblyDefinition {
  return {
    components: pieces.map((piece, i) =>
      detailComponent(`clevis-component-${i + 1}`, piece.label, detailShape(piece.shape), {
        edgeTolerance: 1e-6,
        meshConform: true,
      }),
    ),
    issues: [
      'The fork, pin and fastener envelopes are authored custom details. Select actual fasteners or issue toleranced fabrication drawings; generic proportions do not establish DIN/ISO hardware compliance.',
      'Threaded variants require the recorded thread callout, fit, engagement length and machining runout. Simple uses nominal thread surfaces with callouts; Full exports the declared helical flanks.',
      'Assign material grades, blanks and machining operations; verify fork alignment, pin retention and the complete linkage load before release.',
    ],
  };
}
