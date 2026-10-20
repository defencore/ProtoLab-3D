import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'manufactured-detail' };
export default { apiVersion: 2, order: 19.5, part } satisfies PartModule;
