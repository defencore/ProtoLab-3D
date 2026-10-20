import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'shaft' };
export default { apiVersion: 2, order: 1205, part } satisfies PartModule;
