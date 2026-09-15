import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';

const part = { ...definition, id: 'holding-electromagnet', catalogSelection };
export default { apiVersion: 1, order: 80, part } satisfies PartModule;
