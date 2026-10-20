import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'tbi-ball-screw' };
export default {
  apiVersion: 2,
  order: 65.1,
  dependencies: ['ball-screw'],
  part,
} satisfies PartModule;
