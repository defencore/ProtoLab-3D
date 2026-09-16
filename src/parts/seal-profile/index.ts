import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'seal-profile' };
export default { apiVersion: 1, order: 1209, part } satisfies PartModule;
