import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'cable-carrier' };
export default { apiVersion: 1, order: 1236, part } satisfies PartModule;
