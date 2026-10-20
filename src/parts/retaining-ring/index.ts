import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'retaining-ring', catalogSelection };
export default { apiVersion: 2, order: 48, part } satisfies PartModule;
