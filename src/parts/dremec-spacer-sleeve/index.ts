import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'dremec-spacer-sleeve' };
export default { apiVersion: 2, order: 72.3, part } satisfies PartModule;
