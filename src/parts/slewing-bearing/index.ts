import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'slewing-bearing' };
export default { apiVersion: 2, order: 1252, part } satisfies PartModule;
