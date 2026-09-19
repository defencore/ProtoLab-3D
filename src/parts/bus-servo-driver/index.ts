import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'bus-servo-driver' };
export default { apiVersion: 1, order: 110, part } satisfies PartModule;
