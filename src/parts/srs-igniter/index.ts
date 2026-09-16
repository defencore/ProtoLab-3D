import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'srs-igniter' };
export default { apiVersion: 1, order: 114, part } satisfies PartModule;
