import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'structural-section' };
export default { apiVersion: 1, order: 1226, part } satisfies PartModule;
