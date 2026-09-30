import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'automatic-tube-saw' };
export default {
  apiVersion: 1,
  dependencies: [
    'linear-guide',
    'circular-saw-blade',
    'conveyor-roller',
    'compact-pneumatic-cylinder',
    'machine-drive-motor',
    'machine-control',
    'machine-measurement',
  ],
  order: 1319,
  part,
} satisfies PartModule;
