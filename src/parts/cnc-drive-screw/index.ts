import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'cnc-drive-screw' };
export default {
  apiVersion: 2,
  order: 64.4,
  dependencies: ['ball-screw'],
  part,
} satisfies PartModule;
