import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 124.1,
  part: {
    ...part,
    id: 'waveshare-ups-3s',
    // Battery support from the manufacturer specification; output voltages remain separate.
    discovery: [
      { kind: 'power', key: 'batteryConfiguration', label: 'Battery support', value: '3S' },
      { kind: 'power', key: 'batteryFormat', label: 'Cell format', value: '18650' },
    ],
  },
} satisfies PartModule;
