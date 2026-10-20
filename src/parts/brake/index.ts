import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'brake' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1250, part } satisfies PartModule;
