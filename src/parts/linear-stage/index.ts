import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'linear-stage' };
export default { apiVersion: 1, order: 1223, part } satisfies PartModule;
