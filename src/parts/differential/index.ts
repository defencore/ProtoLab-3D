import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'differential' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1217, part } satisfies PartModule;
