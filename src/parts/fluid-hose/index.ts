import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'fluid-hose' };
export default { apiVersion: 2, order: 1233, part } satisfies PartModule;
