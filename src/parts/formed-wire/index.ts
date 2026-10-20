import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'formed-wire' };
export default { apiVersion: 2, order: 19.6, part } satisfies PartModule;
