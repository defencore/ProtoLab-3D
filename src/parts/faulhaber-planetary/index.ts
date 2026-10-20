import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'faulhaber-planetary' };
export default { apiVersion: 2, order: 1267, part } satisfies PartModule;
