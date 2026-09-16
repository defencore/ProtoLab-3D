import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'fluid-cylinder' };
export default { apiVersion: 1, order: 1229, part } satisfies PartModule;
