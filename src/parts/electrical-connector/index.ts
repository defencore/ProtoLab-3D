import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'electrical-connector' };
export default { apiVersion: 1, order: 1243, part } satisfies PartModule;
