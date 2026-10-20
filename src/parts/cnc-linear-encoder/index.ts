import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'cnc-linear-encoder' };
export default { apiVersion: 2, order: 1317.6, dependencies: [], part } satisfies PartModule;
