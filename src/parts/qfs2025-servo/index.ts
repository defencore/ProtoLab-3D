import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'qfs2025-servo',
  browseFamily: { id: 'servo-motors', label: 'Servo motors' } };
export default {
  apiVersion: 2,
  order: 83.1,
  dependencies: ['underwater-thruster'],
  part,
} satisfies PartModule;
