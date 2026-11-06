import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'adc-module' };
export default { apiVersion: 2, order: 116.1, part } satisfies PartModule;
