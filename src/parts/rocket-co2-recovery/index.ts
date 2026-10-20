import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 2,
  order: 121.45,
  dependencies: [
    'rocket-release',
    'recovery-detail',
    'purchased-recovery-component',
    'co2-cartridge',
    'li-ion-cell',
    'lch7-controller',
    'gps-tracker',
    'recovery-buzzer',
    'pwm-switch',
  ],
  part: { ...part, id: 'rocket-co2-recovery' },
} satisfies PartModule;
