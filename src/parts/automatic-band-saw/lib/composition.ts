import type { Parameters } from '../../../core/types';
import { machineComposition } from '../../../core/machine-composition';
import { machinePieces } from './model';
export function composition(parameters: Parameters) {
  return machineComposition(
    machinePieces(
      { ...parameters, showGuards: true, strokePosition: 0, feedPosition: 0 },
      'clamped',
    ),
    [
      'Confirm actual bearing, fastener, pneumatic, reducer, sensor and control order codes and supplier mounting evidence. Unidentified purchased envelopes are explicit supplier configurations, not fabrication instructions.',
      'Resolve whether joined frame members are single details or bolted/welded subassemblies; assign materials, section stock, interfaces and detail drawings to custom configurations.',
      'Verify cut-length acceptance, pressure-loss retention, guarding, contactor/standstill chain and motion clearances before production release.',
    ],
  );
}
