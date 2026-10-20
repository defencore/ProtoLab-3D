import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'eccentric-bushing' };
export default { apiVersion: 2, order: 1262, part } satisfies PartModule;
