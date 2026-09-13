import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'helical-gear', catalogSelection };
export default { apiVersion: 1, order: 60, part } satisfies PartModule;
