import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'eccentric-cam-follower' };
export default { apiVersion: 1, order: 1263, part } satisfies PartModule;
