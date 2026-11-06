import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'underwater-thruster', browseLabel: 'Underwater thruster' };
export default { apiVersion: 2, order: 83.2, dependencies: [], part } satisfies PartModule;
