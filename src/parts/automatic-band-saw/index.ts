import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'automatic-band-saw' };
export default {
  apiVersion: 2,
  dependencies: [
    'ball-screw',
    'linear-guide',
    'stepper-motor',
    'machine-drive-motor',
    'machine-measurement',
    'manufactured-detail',
    'purchased-component',
    'round-pneumatic-cylinder',
    'profile-pneumatic-cylinder',
    'pneumatic-valve',
    'air-preparation-unit',
  ],
  order: 1319.5,
  part,
} satisfies PartModule;
