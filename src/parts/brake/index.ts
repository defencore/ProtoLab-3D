import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'brake' };
export default { apiVersion: 1, order: 1250, part } satisfies PartModule;
