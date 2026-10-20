import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'bearing-locknut' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1213, part } satisfies PartModule;
