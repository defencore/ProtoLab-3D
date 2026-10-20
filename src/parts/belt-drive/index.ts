import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'belt-drive' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1218, part } satisfies PartModule;
