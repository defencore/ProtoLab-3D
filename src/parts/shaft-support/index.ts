import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'shaft-support' };
export default { apiVersion: 1, order: 1221, part } satisfies PartModule;
