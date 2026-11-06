import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { geometry, python, motorDrawing, motorCatalog } from './lib/model';
import { defaults, parameters, catalogFilterFields } from './configurator';
import product from './product.json';
import presets from './presets.json';
export {
  motorDimensions,
  motorDrawing,
  motorCatalog,
  mountHoles,
  shaftMachining,
} from './lib/model';
const part: PartDefinition = {
  id: 'surpass-2845',
  name: 'Surpass Hobby KK 2845 3100KV',
  product: product as ProductProfile,
  category: 'MOTORS & ACTUATORS',
  subgroup: 'BRUSHLESS MOTORS',
  icon: 'gear',
  description:
    'Fixed Ø28×47 mm sensorless inrunner with Ø3.175 shaft and16/19 mm M3 mounting cross. Analytic external installation model reconstructed from the branded supplier drawing.',
  complexity: 'Dimensioned drawing · analytic installation envelope',
  keywords: [
    'Surpass',
    'Hobby',
    'KK',
    'KingKong',
    '2845',
    '3100KV',
    'brushless',
    'sensorless',
    'inrunner',
  ],
  defaults,
  parameters,
  catalogFilterFields,
  presets: presets as Preset[],
  presetMatchKeys: ['model'],
  catalogSelectionOnly: true,
  states: [
    {
      id: 'assembled',
      label: 'Installation model',
      description: 'Fixed external envelope; free leads and motor internals are omitted.',
    },
    {
      id: 'cross-drilled',
      label: 'Custom cross-drilled shaft',
      description:
        'Secondary machining: Ø1 transverse shaft hole, 13 mm from the front mounting face. This is not a supplier shaft execution.',
    },
  ],
  physicalStates: ['assembled', 'cross-drilled'],
  identityParameters: ({ shaftAngle: _shaftAngle, ...p }) => p,
  validate(p, state) {
    if (
      p.model !== defaults.model ||
      !['assembled', 'cross-drilled'].includes(state) ||
      Object.keys(p).some(
        (k) => k !== 'model' && !(state === 'cross-drilled' && k === 'shaftAngle'),
      ) ||
      (p.shaftAngle !== undefined &&
        (typeof p.shaftAngle !== 'number' ||
          !Number.isFinite(p.shaftAngle) ||
          Math.abs(p.shaftAngle) > 1000000))
    )
      return ['Choose the fixed2845 motor or its explicit custom cross-drilled shaft preparation.'];
    return [];
  },
  buildGeometry: geometry,
  dimensions: () => [28, 28, 62],
  python,
  notes:
    'Surpass Hobby KK2845 3100KV, Ø28×47 mm body, Ø3.175×15 mm output shaft, four M3 mounts in an opposed16/19 mm cross. Front mounting plane is Z=0 and shaft points along+Z. This is a drawing-based external installation envelope, not manufacturer CAD or a model of internal motor construction. Cap seams and2.5 mm nominal blind-hole clearance depth are illustrative. Verify allowable screw insertion depth on the purchased motor. Shaft flat depth is not dimensioned, so a conservative full round shaft envelope is retained. Free phase leads, rear cable boot and connectors require separate routing space. Sensorless motor; use an appropriate reversible BLDC drive and qualify low-speed operation for the actual application. The separate cross-drilled physical state adds a custom Ø1 hole through local X at Z=13; shaftAngle rotates only this shaft about local Z. Record this secondary drilling operation and the purchased motor blank on the modified assembly configuration. This hole is not present in the stock supplier model.',
  sources: [
    { label: 'Branded2845 3100KV installation drawing', url: motorDrawing },
    { label: 'Surpass Hobby manufacturer catalog', url: motorCatalog },
  ],
};
export default part;
