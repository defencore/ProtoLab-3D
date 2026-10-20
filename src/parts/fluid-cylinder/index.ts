import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'fluid-cylinder' };
export default { apiVersion: 2, order: 1229, part } satisfies PartModule;
