import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'landing-gear' };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 1247, part } satisfies PartModule;
