import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'faulhaber-linear-actuator' };
export default { apiVersion: 1, order: 1268, part } satisfies PartModule;
