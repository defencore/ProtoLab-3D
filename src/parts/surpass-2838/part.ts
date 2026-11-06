import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  geometry,
  python,
  motorDrawing,
  motorCatalog,
  motorBodySource,
  mountingReference,
} from './lib/model';
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
  id: 'surpass-2838',
  name: 'Surpass Hobby KK 2838 motors',
  product: product as ProductProfile,
  category: 'MOTORS & ACTUATORS',
  subgroup: 'BRUSHLESS MOTORS',
  icon: 'gear',
  description:
    'Seven fixed KK2838 windings with a nominal Ø28×40 mm body and Ø3.175×15 shaft. Analytic installation model from published dimensions, with a reconstructed 16/19 mm M3 mounting cross.',
  complexity: 'Dimensioned drawing · analytic installation envelope',
  keywords: [
    'Surpass',
    'Hobby',
    'KK',
    'KingKong',
    '2838',
    '3200–5700KV',
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
      !presets.some((preset) => preset.parameters.model === p.model) ||
      !['assembled', 'cross-drilled'].includes(state) ||
      Object.keys(p).some(
        (k) => k !== 'model' && !(state === 'cross-drilled' && k === 'shaftAngle'),
      ) ||
      (p.shaftAngle !== undefined &&
        (typeof p.shaftAngle !== 'number' ||
          !Number.isFinite(p.shaftAngle) ||
          Math.abs(p.shaftAngle) > 1000000))
    )
      return ['Choose the fixed2838 motor or its explicit custom cross-drilled shaft preparation.'];
    return [];
  },
  buildGeometry: geometry,
  dimensions: () => [28, 28, 55],
  python,
  notes:
    'Surpass Hobby KK2838 3200–5700KV, nominal Ø28×40 mm body and Ø3.175×15 mm output shaft. Front mounting plane is Z=0 and shaft points along+Z. The 16/19 mm M3 mounting cross is reconstructed from a supplier installation reference; confirm it on the delivered motor. This is an external installation reconstruction, not manufacturer CAD or a model of internal motor construction. Cap seams and2.5 mm nominal blind-hole clearance depth are illustrative. Verify allowable screw insertion depth on the purchased motor. Shaft flat depth is not dimensioned, so a conservative full round shaft envelope is retained. Free phase leads, rear cable boot and connectors require separate routing space. Sensorless motor; use an appropriate reversible BLDC drive and qualify low-speed operation for the actual application. The separate cross-drilled physical state adds a custom Ø1 hole through local X at Z=13; shaftAngle rotates only this shaft about local Z. Record this secondary drilling operation and the purchased motor blank on the modified assembly configuration. This hole is not present in the stock supplier model.',
  sources: [
    { label: 'Surpass Hobby manufacturer catalog', url: motorCatalog },
    { label: 'Authorized importer body and shaft dimensions', url: motorBodySource },
    { label: 'Supplier 16/19 M3 mounting reference', url: mountingReference },
  ],
};
export default part;
