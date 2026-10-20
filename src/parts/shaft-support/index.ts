import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'shaft-support' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1221, part } satisfies PartModule;
