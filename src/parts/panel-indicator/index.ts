import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';

const part = { ...definition, id: 'panel-indicator', catalogSelection };
export default { apiVersion: 2, order: 108.2, part } satisfies PartModule;
