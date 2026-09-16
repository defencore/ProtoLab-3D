import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'shaft-key' };
export default { apiVersion: 1, order: 1204, part } satisfies PartModule;
