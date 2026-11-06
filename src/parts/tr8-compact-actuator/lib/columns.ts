import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import standoff from '../../pcb-standoff/part';
import { configured, type Fastener, type Vec } from './components';
import { columnLines } from './drive-layout';

export const columnLayout = {
  lines: columnLines,
  frontBody: [-48, -18] as [number, number],
  rearBody: [-15, 15] as [number, number],
  middlePlate: [-18, -15] as [number, number],
  femalePreset: 'dremec-115x30',
  extensionPreset: 'dremec-215x30',
};
const female = standoff.presets.find((preset) => preset.id === columnLayout.femalePreset)!;
const extension = standoff.presets.find((preset) => preset.id === columnLayout.extensionPreset)!;

/** An 8 mm stock male stud crosses 3 mm steel and engages the front female end by 5 mm. */
export function columnPieces(): ConfiguredPiece[] {
  return columnLayout.lines.flatMap(([y, z], index) => {
    const number = index + 1;
    return [
      configured(
        standoff,
        `column-front-${number}`,
        `Front column ${number} · DREMEC 115x30 · M3 female/female`,
        { ...female.parameters },
        [-48, y, z],
        [0, 90, 0],
        'default',
        0xb6bec6,
        female.id,
      ),
      configured(
        standoff,
        `column-rear-${number}`,
        `Rear column ${number} · DREMEC 215x30 · M3 female/male`,
        { ...extension.parameters },
        [15, y, z],
        [0, -90, 0],
        'default',
        0xb6bec6,
        extension.id,
      ),
    ];
  });
}

/** Outer M3×8 screws pass through 3 mm steel and engage 5 mm of each stock female end. */
export function columnFasteners(): Fastener[] {
  return columnLayout.lines.flatMap(([y, z], index) => [
    {
      id: `column-motor-bolt-${index + 1}`,
      diameter: 3,
      length: 8,
      underHead: [-51, y, z] as Vec,
      direction: [1, 0, 0] as Vec,
    },
    {
      id: `column-end-bolt-${index + 1}`,
      diameter: 3,
      length: 8,
      underHead: [18, y, z] as Vec,
      direction: [-1, 0, 0] as Vec,
    },
  ]);
}
