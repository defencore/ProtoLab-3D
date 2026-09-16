import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'disc-wave-spring' };
export default { apiVersion: 1, order: 1214, part } satisfies PartModule;
