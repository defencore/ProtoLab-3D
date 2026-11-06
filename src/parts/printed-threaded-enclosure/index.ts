import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'printed-threaded-enclosure' };
export default {
  apiVersion: 2,
  order: 822,
  dependencies: ['printed-threaded-shell'],
  part,
} satisfies PartModule;
