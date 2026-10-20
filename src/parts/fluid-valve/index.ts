import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'fluid-valve' };
export default { apiVersion: 2, order: 1231, part } satisfies PartModule;
