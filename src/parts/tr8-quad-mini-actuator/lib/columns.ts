import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { cylinder, subtract } from '../../../core/assembly/boundary/shapes';
import standoff from '../../pcb-standoff/part';
import {
  configureActuatorPiece as configured,
  actuatorFastenerPiece as fastenerPiece,
  alignActuatorThreads,
} from '../../tr8-compact-actuator/part';
import { packing } from './placement';
import { frameLayout } from './layout';

export const plateStations = frameLayout.plateStations;
export const columnStages = [
  { preset: 'dremec-115x30', origin: -49, rotation: 90 },
  { preset: 'dremec-215x30', origin: 16, rotation: -90 },
] as const;
export function columnLines(): [number, number][] {
  return [0, 1, 2, 3].map((i) => {
    const a = (packing.columnClock + i * 90) * Math.PI / 180;
    return [packing.columnRadius * Math.cos(a), packing.columnRadius * Math.sin(a)];
  });
}
/** Standard 30 mm bodies and a 2 mm spacer capture the three round discs. */
export function frameColumnPieces(): ConfiguredPiece[] {
  const result: ConfiguredPiece[] = [];
  for (const [index, [y, z]] of columnLines().entries()) {
    result.push(...columnStages.map((stage, n) => {
      const preset = standoff.presets.find((p) => p.id === stage.preset)!;
      return configured(standoff, `frame-column-${index + 1}-${n + 1}`,
        `Frame column ${index + 1}/${n + 1} · ${preset.name}`, { ...preset.parameters },
        [stage.origin, y, z], [0, stage.rotation, 0], 'default', 0xb6bec6, preset.id);
    }));
    const spacer = detailComponent(`frame-column-${index + 1}-spacer`, 'Frame spacer · 3.4×7×2',
      subtract(cylinder(3.5, 2, [-16, y, z], 'x'), cylinder(1.7, 2.2, [-16.1, y, z], 'x')));
    spacer.manufacturing = { material: 'Steel', blank: 'Precision Ø7 tube or round stock', processes: ['turning', 'drilling'], requirements: ['Face to 2 mm and deburr; verify the fitted stack.'] };
    result.push({ component: spacer, label: spacer.name, color: 0xaeb5be, requireSingleSolid: true });
    result.push(
      fastenerPiece({ id: `frame-column-front-bolt-${index + 1}`, diameter: 3, length: 8, underHead: [-52, y, z], direction: [1, 0, 0] }),
      fastenerPiece({ id: `frame-column-rear-bolt-${index + 1}`, diameter: 3, length: 8, underHead: [19, y, z], direction: [-1, 0, 0] }),
    );
  }
  return alignActuatorThreads(result);
}
