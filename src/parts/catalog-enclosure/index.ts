import definition from './part';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'catalog-enclosure' };
export default { apiVersion: 2, order: 69.5, part } satisfies PartModule;
