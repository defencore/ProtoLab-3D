import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'fuselage-bulkhead' };
export default { apiVersion: 2, order: 126.1, part } satisfies PartModule;
