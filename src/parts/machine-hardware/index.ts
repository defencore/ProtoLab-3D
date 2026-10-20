import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'machine-hardware' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1235, part } satisfies PartModule;
