import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'aluminium-profile', catalogSelection };
export default { apiVersion: 1, order: 72.1, part } satisfies PartModule;
