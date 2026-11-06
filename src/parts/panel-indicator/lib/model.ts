import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/electronics/assembly';
import { box, cylinder, subtract, type Shape } from '../../../core/assembly/electronics/shapes';

export const indicatorColours = [
  { id: 'red', label: 'Red', color: 0xd62828 },
  { id: 'green', label: 'Green', color: 0x27a54b },
  { id: 'yellow', label: 'Yellow — illustrative', color: 0xf2c529 },
  { id: 'blue', label: 'Blue — illustrative', color: 0x2578dd },
  { id: 'white', label: 'White — illustrative', color: 0xeeeeed },
] as const;

/** Assumed millimetre envelope; no value in this record is a verified Lehao dimension. */
export const envelope = {
  headDiameter: 19,
  mountingDiameter: 16,
  shankDiameter: 15.6,
  overallLength: 45,
  frontProjection: 5,
} as const;

export function pieces(p: Parameters, state: string): Piece[] {
  if (p.model !== 'lehao-ad16-16c') throw new Error('Select the supported indicator model.');
  const colour = indicatorColours.find((colour) => colour.id === p.lensColour);
  if (!colour) throw new Error('Select a supported lens colour.');
  if (!['assembled', 'exploded'].includes(state)) throw new Error('Unsupported indicator state.');
  const exploded = state === 'exploded';

  const housing: Shape = {
    kind: 'revolve',
    profile: [
      [0, -35],
      [5.5, -35],
      [5.5, -33],
      [7, -33],
      [7, -24],
      [envelope.shankDiameter / 2, -24],
      [envelope.shankDiameter / 2, 0],
      [envelope.headDiameter / 2, 0],
      [envelope.headDiameter / 2, 4.3],
      [7.6, 4.3],
      [7.6, 1.22],
      [0, 1.22],
    ],
  };
  return [
    { shape: housing, label: 'Indicator housing — approximate', color: 0x292c30 },
    {
      shape: cylinder(7.6, 3.78, [0, 0, 1.22]),
      label: `Lens — ${colour.id}`,
      color: colour.color,
      z: exploded ? 12 : 0,
    },
    {
      shape: subtract(cylinder(9.4, 3, [0, 0, -5]), cylinder(8, 3.4, [0, 0, -5.2])),
      label: 'Retaining nut — approximate, thread omitted',
      color: 0x3c4147,
      z: exploded ? -40 : 0,
    },
    ...[-3.3, 3.3].map((x, index): Piece => ({
      shape: box([2.8, 0.5, 5], [x - 1.4, -0.25, -40]),
      label: `Terminal ${index + 1} — illustrative, no polarity assigned`,
      color: 0xbfa565,
      z: exploded ? -12 : 0,
    })),
  ];
}
