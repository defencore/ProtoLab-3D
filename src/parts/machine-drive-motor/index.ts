import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'machine-drive-motor' };
export default {
  apiVersion: 2,
  dependencies: ['stepper-motor'],
  order: 1329,
  part,
} satisfies PartModule;
