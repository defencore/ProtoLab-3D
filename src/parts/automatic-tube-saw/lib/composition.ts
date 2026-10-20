import type { Parameters } from '../../../core/types';
import { machineComposition } from '../../../core/machine-composition';
import { machinePieces } from './model';
export function composition(parameters: Parameters) {
  return machineComposition(
    machinePieces({ ...parameters, showGuards: true, strokePosition: 0, feedPosition: 0 }, 'ready'),
    [
      'Assign materials, blank stock, assembly methods and drawings to the frame and mounting details; a connected welded frame is a subassembly rather than one machined detail.',
      'Select actual purchased cylinders, bearings, drives, sensors, controls and stock fasteners. Confirm source mounting geometry, fits and cable/tube routes.',
      'Complete stock control, guard locking, standstill, scrap routing, load-holding and cut-quality qualification before unattended operation.',
    ],
  );
}
