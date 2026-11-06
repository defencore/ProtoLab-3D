import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'power-filter' };
export default { apiVersion: 2, order: 116.2, part } satisfies PartModule;
