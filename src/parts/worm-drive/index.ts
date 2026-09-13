import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'worm-drive', catalogSelection };
export default { apiVersion: 1, order: 58, part } satisfies PartModule;
