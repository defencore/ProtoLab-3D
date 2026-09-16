import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'vacuum-cup' };
export default { apiVersion: 1, order: 1234, part } satisfies PartModule;
