import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'rov-project' };
export default {
  apiVersion: 2,
  dependencies: [
    'rov-component',
    'qfs2025-servo',
    'underwater-thruster',
    'ms5837-depth-sensor',
    'metal-servo-bracket',
    'metal-servo-horn',
    'underwater-pressure-enclosure',
  ],
  order: 126,
  part,
} satisfies PartModule;
