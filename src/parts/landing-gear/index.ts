import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'landing-gear' };
export default { apiVersion: 1, order: 1247, part } satisfies PartModule;
