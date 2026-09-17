import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'eccentric-bearing' };
export default { apiVersion: 1, order: 1261, part } satisfies PartModule;
