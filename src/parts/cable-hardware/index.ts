import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'cable-hardware' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1220, part } satisfies PartModule;
