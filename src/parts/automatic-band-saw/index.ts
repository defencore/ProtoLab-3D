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
    'manufactured-detail',
    'purchased-component',
  ],
  order: 1319.5,
  part,
} satisfies PartModule;
