import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'cnc-toolsetter-part' };
export default {
  apiVersion: 2,
  order: 1317.5,
  dependencies: ['manufactured-detail'],
  part,
} satisfies PartModule;
