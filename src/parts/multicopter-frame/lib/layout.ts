import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';

/** Figure 4, Takva & İlerisoy (2023). +X is the nose, +Y is left, +Z is up.
 * Angles describe geometry, not flight-controller motor numbering or mixing. */
export const layouts = [
  { value: 'quad-plus', label: 'Quad + · 4 arms / 4 motors' },
  { value: 'quad-x', label: 'Quad X · 4 arms / 4 motors' },
  { value: 'quad-h', label: 'Quad H · 2 side beams / 4 motors' },
  { value: 'quad-v', label: 'Quad V · 4 arms / 4 motors' },
  { value: 'quad-y', label: 'Quad Y · 3 arms / 4 motors' },
  { value: 'hexa-plus', label: 'Hexa + · 6 arms / 6 motors' },
  { value: 'hexa-x', label: 'Hexa X · 6 arms / 6 motors' },
  { value: 'hexa-y6', label: 'Hexa Y6 · 3 arms / 6 motors' },
  { value: 'hexa-ly', label: 'Hexa LY · inverted Y / 6 motors' },
  { value: 'octa-plus', label: 'Octa + · 8 arms / 8 motors' },
  { value: 'octa-x', label: 'Octa X · 8 arms / 8 motors' },
  { value: 'octa-x8', label: 'Octa X8 · 4 arms / 8 motors' },
];
export const coaxial = (p: Parameters) =>
  ['quad-y', 'hexa-y6', 'hexa-ly', 'octa-x8'].includes(String(p.layout));
export function armSites(p: Parameters): { angle: number; paired: boolean }[] {
  const a = n(p, 'armAngle');
  const radial = (count: number, offset: number) =>
    Array.from({ length: count }, (_, i) => offset + (i * 360) / count);
  let angles: number[];
  switch (p.layout) {
    case 'quad-plus':
      angles = radial(4, 0);
      break;
    case 'quad-x':
    case 'quad-h':
    case 'octa-x8':
      angles = [a, 180 - a, 180 + a, 360 - a];
      break;
    case 'quad-v':
      angles = [a, 180 - n(p, 'rearAngle'), 180 + n(p, 'rearAngle'), 360 - a];
      break;
    case 'quad-y':
    case 'hexa-y6':
      angles = [60, 180, 300];
      break;
    case 'hexa-ly':
      angles = [0, 120, 240];
      break;
    case 'hexa-plus':
      angles = radial(6, 0);
      break;
    case 'hexa-x':
      angles = radial(6, 30);
      break;
    case 'octa-plus':
      angles = radial(8, 0);
      break;
    case 'octa-x':
      angles = radial(8, 22.5);
      break;
    default:
      throw new Error('Choose a valid frame configuration.');
  }
  return angles.map((angle) => ({
    angle,
    paired: p.layout === 'quad-y' ? angle === 180 : coaxial(p),
  }));
}
