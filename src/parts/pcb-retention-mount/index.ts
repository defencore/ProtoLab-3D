import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'pcb-retention-mount' };
export default {
  apiVersion: 2,
  order: 614,
  dependencies: ['manufactured-detail'],
  part,
} satisfies PartModule;
