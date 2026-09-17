import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'faulhaber-am' };
export default { apiVersion: 1, order: 1266, part } satisfies PartModule;
