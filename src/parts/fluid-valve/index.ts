import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'fluid-valve' };
export default { apiVersion: 1, order: 1231, part } satisfies PartModule;
