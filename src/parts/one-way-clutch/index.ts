import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'one-way-clutch', catalogSelection };
export default { apiVersion: 1, order: 18, part } satisfies PartModule;
