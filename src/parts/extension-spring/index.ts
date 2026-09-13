import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'extension-spring', catalogSelection };
export default { apiVersion: 1, order: 54, part } satisfies PartModule;
