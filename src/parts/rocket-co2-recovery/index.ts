import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 1,
  order: 121.45,
  dependencies: [
    'rocket-release',
    'co2-cartridge',
    'li-ion-cell',
    'lch7-controller',
    'gps-tracker',
    'recovery-buzzer',
    'pwm-switch',
  ],
  part: { ...part, id: 'rocket-co2-recovery' },
} satisfies PartModule;
