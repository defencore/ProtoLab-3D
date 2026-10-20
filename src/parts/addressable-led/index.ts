import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'addressable-led' };
export default { apiVersion: 2, order: 1450, dependencies: [], part } satisfies PartModule;
