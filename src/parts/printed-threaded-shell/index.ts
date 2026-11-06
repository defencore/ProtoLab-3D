import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'printed-threaded-shell' };
export default { apiVersion: 2, order: 823, part } satisfies PartModule;
