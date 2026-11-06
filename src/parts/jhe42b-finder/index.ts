import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'jhe42b-finder' };

export default {
  apiVersion: 2,
  order: 99.21,
  part,
} satisfies PartModule;
