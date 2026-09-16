import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'o-ring' };
export default { apiVersion: 1, order: 1208, part } satisfies PartModule;
