import type { Parameters } from '../../../core/types';
import type { MountLayout } from './types';

export function layout(p: Parameters): MountLayout {
  const switchZ = Number(p.deckHeight);
  const contactZ = switchZ + 12.5 + Number(p.contactHeight);
  return {
    baseThickness: 6,
    switchX: 34,
    switchZ,
    servoX: -56,
    servoZ: contactZ - 8 - 33.7,
    contactZ,
    deckBottom: switchZ + 3,
    deckTop: switchZ + 6,
    guideY: 22,
    guideEnds: [-2, 70],
  };
}
