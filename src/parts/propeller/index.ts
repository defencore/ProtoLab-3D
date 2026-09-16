import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'propeller' };
export default { apiVersion: 1, order: 1245, part } satisfies PartModule;
