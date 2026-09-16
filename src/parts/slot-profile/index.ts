import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'slot-profile' };
export default { apiVersion: 1, order: 1227, part } satisfies PartModule;
