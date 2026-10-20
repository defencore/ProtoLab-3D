import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'laboratory-terminal' };
export default { apiVersion: 2, order: 1410, dependencies: [], part } satisfies PartModule;
