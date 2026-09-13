import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'l-bracket', catalogSelection };
export default { apiVersion: 1, order: 71, part } satisfies PartModule;
