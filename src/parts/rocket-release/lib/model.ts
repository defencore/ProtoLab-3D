import { transmissionMetadata } from './transmission';
import type { Parameters } from '../../../core/types';
import { originalPieces } from './original-model';
import { st3215Pieces } from './st3215-model';
export { sector, studAngles, keyhole } from './original-model';
export function pieces(p: Parameters, state: string) {
  const result = ['st3215-nose', 'wing-mini-nose'].includes(String(p.drive))
    ? st3215Pieces(p, state)
    : originalPieces(p, state);
  const metadata = transmissionMetadata(p);
  return result.map((piece) =>
    /^(Body locking ring|Rotating release disk|Servo input pinion|MG996R input pinion|Idler pinion|Drive pinion)/.test(
      piece.label,
    )
      ? { ...piece, metadata: { ...piece.metadata, ...metadata } }
      : piece,
  );
}
