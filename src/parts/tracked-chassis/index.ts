import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'tracked-chassis' };
export default { apiVersion: 1, order: 1260, part } satisfies PartModule;
