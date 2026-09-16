import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'fluid-fitting' };
export default { apiVersion: 1, order: 1230, part } satisfies PartModule;
