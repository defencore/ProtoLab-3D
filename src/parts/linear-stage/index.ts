import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'linear-stage' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1223, part } satisfies PartModule;
