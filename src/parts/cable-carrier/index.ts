import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'cable-carrier' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1236, part } satisfies PartModule;
