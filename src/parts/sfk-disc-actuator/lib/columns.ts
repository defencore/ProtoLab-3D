import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import standoff from '../../pcb-standoff/part';
import { configured, type Fastener, type Vec } from './components';

export const columnLayout = {
  lines: [
    [-20, 48],
    [20, 48],
    [0, 6],
  ] as [number, number][],
  frontBody: [-68.1, -18.1] as [number, number],
  rearBody: [-14.1, 40.9] as [number, number],
  middlePlate: [-18.1, -14.1] as [number, number],
  femalePreset: 'dremec-115x50',
  extensionPreset: 'dremec-215x55',
};
const female = standoff.presets.find((preset) => preset.id === columnLayout.femalePreset)!;
const extension = standoff.presets.find((preset) => preset.id === columnLayout.extensionPreset)!;

/** Source bodies remain 50/55 mm; the 8 mm male stud crosses the 4 mm middle disc. */
export function columnPieces(): ConfiguredPiece[] {
  return columnLayout.lines.flatMap(([y, z], index) => {
    const number = index + 1;
    const front = configured(
      standoff,
      `column-front-${number}`,
      `Front column ${number} · DREMEC 115x50 · M3 female/female`,
      { ...female.parameters },
      [columnLayout.frontBody[0], y, z],
      [0, 90, 0],
      'default',
      0xb6bec6,
      female.id,
    );
    // End A is female at local Z=0. End B is the published 8 mm male projection.
    const rear = configured(
      standoff,
      `column-rear-${number}`,
      `Rear column ${number} · DREMEC 215x55 · M3 female/male`,
      { ...extension.parameters },
      [columnLayout.rearBody[1], y, z],
      [0, -90, 0],
      'default',
      0xb6bec6,
      extension.id,
    );
    front.preserveLibraryAppearance = true;
    rear.preserveLibraryAppearance = true;
    return [front, rear];
  });
}

/** Each M3×10 passes a 4 mm disc and engages 6 mm of a published 10 mm female end. */
export function columnFasteners(): Fastener[] {
  return columnLayout.lines.flatMap(([y, z], index) => [
    {
      id: `column-motor-bolt-${index + 1}`,
      diameter: 3,
      length: 10,
      underHead: [-72.1, y, z] as Vec,
      direction: [1, 0, 0] as Vec,
    },
    {
      id: `column-end-bolt-${index + 1}`,
      diameter: 3,
      length: 10,
      underHead: [44.9, y, z] as Vec,
      direction: [-1, 0, 0] as Vec,
    },
  ]);
}
