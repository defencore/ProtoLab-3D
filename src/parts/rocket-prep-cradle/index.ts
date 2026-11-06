import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'rocket-prep-cradle' };
export default { apiVersion: 2, order: 122.7, part } satisfies PartModule;
