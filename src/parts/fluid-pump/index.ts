import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'fluid-pump' };
export default { apiVersion: 1, order: 1232, part } satisfies PartModule;
