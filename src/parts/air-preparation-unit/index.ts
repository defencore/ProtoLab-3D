import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'air-preparation-unit' };
export default { apiVersion: 2, order: 119.2, part } satisfies PartModule;
