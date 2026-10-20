import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'faulhaber-linear-motor' };
export default { apiVersion: 2, order: 1269, part } satisfies PartModule;
