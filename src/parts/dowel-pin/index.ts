import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'dowel-pin' };
export default { apiVersion: 1, order: 1200, part } satisfies PartModule;
