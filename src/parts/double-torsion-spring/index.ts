import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'double-torsion-spring', catalogSelection };
export default { apiVersion: 2, order: 56, part } satisfies PartModule;
