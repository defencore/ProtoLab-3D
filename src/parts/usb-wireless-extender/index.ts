import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'usb-wireless-extender' };
export default { apiVersion: 2, order: 97.1, part } satisfies PartModule;
