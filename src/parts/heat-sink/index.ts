import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'heat-sink' };
export default { apiVersion: 1, order: 1238, part } satisfies PartModule;
