import type { Parameters } from '../../../core/types';
import {
  configureRecoveryPieces,
  recoveryComposition,
} from '../../../core/recovery-feature-recipes';
import { recoveryPiecesComposition } from '../../rocket-release/lib/composition';
import { pieces } from './model';
export const configuredFabric = (authored: ReturnType<typeof pieces>['flex']) =>
  configureRecoveryPieces(authored, 96);
export function composition(p: Parameters) {
  const physical = pieces({ ...p, sequence: 0 }, 'stowed');
  const rigid = recoveryPiecesComposition(physical.rigid);
  const fabric = recoveryComposition(configuredFabric(physical.flex), [
    'Select rated main and drogue parachutes, deployment bag and tether; qualify stitching, lines, knots, packing and extraction with the actual recovery system.',
  ]);
  return {
    components: [
      ...rigid.components,
      ...fabric.components.map((component, index) => ({
        ...component,
        id: 'fabric-' + (index + 1),
      })),
    ],
    issues: [...rigid.issues, ...fabric.issues],
  };
}
