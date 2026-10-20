import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'cnc-spindle' };
export default { apiVersion: 2, order: 1207.1, part } satisfies PartModule;
