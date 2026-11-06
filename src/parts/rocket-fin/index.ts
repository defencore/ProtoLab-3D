import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'rocket-fin' };
export default { apiVersion: 2, order: 123.3, part } satisfies PartModule;
