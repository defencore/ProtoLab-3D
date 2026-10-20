import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'servo-toggle-actuator' };
export default {
  apiVersion: 2,
  order: 1401,
  dependencies: [
    'bus-servo',
    'panel-switch',
    'manufactured-detail',
    'bolt-screw',
    'hex-nut',
    'washer',
  ],
  part,
} satisfies PartModule;
