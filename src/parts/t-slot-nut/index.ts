import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 't-slot-nut' };
export default { apiVersion: 2, order: 1201, part } satisfies PartModule;
