import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'industrial-sensor' };
export default { apiVersion: 2, order: 1241, part } satisfies PartModule;
