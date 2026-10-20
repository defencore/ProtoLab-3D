import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'gearbox' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1216, part } satisfies PartModule;
