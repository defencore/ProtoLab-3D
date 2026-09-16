import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'shaft-collar' };
export default { apiVersion: 1, order: 1206, part } satisfies PartModule;
