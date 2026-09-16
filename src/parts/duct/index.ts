import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'duct' };
export default { apiVersion: 1, order: 1246, part } satisfies PartModule;
