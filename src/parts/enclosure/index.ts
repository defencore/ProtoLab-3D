import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'enclosure', catalogSelection };
export default { apiVersion: 1, order: 70, part } satisfies PartModule;
