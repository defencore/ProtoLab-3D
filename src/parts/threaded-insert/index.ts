import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'threaded-insert' };
export default { apiVersion: 2, order: 1202, part } satisfies PartModule;
