import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'purchased-recovery-component' };
export default {
  apiVersion: 2,
  order: 19.8,
  dependencies: ['recovery-detail'],
  part,
} satisfies PartModule;
