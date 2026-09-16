import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 't-slot-nut' };
export default { apiVersion: 1, order: 1201, part } satisfies PartModule;
