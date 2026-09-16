import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'blind-rivet' };
export default { apiVersion: 1, order: 1203, part } satisfies PartModule;
