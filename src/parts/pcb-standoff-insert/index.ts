import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'pcb-standoff-insert' };
export default {
  apiVersion: 2,
  order: 72.2,
  dependencies: ['pcb-standoff'],
  part,
} satisfies PartModule;
