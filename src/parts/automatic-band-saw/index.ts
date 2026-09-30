import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'automatic-band-saw' };
export default {
  apiVersion: 1,
  dependencies: ['ball-screw', 'linear-guide', 'stepper-motor', 'machine-drive-motor'],
  order: 1319.5,
  part,
} satisfies PartModule;
