import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'spacer', catalogSelection };
export default { apiVersion: 1, order: 72, part } satisfies PartModule;
