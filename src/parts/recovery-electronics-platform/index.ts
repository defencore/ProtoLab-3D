import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'recovery-electronics-platform' };
export default {
  apiVersion: 2,
  order: 96.9,
  dependencies: [
    'gps-tracker',
    'jhe42b-finder',
    'usb-wireless-extender',
    'recovery-electronics-mount',
  ],
  part,
} satisfies PartModule;
