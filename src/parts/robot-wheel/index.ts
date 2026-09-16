import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'robot-wheel' };
export default { apiVersion: 1, order: 1248, part } satisfies PartModule;
