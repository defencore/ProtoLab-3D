import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'compute-module-carrier' };
export default { apiVersion: 2, order: 101.5, part } satisfies PartModule;
