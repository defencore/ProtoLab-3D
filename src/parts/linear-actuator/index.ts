import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'linear-actuator' };
export default { apiVersion: 1, order: 1225, part } satisfies PartModule;
