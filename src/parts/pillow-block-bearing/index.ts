import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'pillow-block-bearing', catalogSelection };
export default { apiVersion: 1, order: 16, part } satisfies PartModule;
