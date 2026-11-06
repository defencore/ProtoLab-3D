import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';

const part = { ...definition, id: 'field-daq-enclosure', catalogSelection };
export default {
  apiVersion: 2,
  order: 610,
  dependencies: ['manufactured-detail', 'bolt-screw', 'hex-nut', 'washer', 'waterproof-connector'],
  part,
} satisfies PartModule;
