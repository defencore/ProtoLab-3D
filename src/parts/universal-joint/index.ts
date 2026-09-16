import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'universal-joint' };
export default { apiVersion: 1, order: 1212, part } satisfies PartModule;
