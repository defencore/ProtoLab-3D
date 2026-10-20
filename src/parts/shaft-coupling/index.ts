import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'shaft-coupling' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1211, part } satisfies PartModule;
