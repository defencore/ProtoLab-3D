import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'cooling-fan' };
export default { apiVersion: 1, order: 1237, part } satisfies PartModule;
