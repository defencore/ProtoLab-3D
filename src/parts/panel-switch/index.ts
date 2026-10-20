import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'panel-switch' };
export default { apiVersion: 2, order: 1400, dependencies: [], part } satisfies PartModule;
