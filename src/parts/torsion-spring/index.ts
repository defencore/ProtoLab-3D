import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'torsion-spring', catalogSelection };
export default { apiVersion: 1, order: 55, part } satisfies PartModule;
