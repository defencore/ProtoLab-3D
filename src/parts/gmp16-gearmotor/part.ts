import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { models, sourceUrl, listingUrl } from './lib/catalog';
import { pieces, dimensions } from './lib/model';
import { geometry, python } from '../../core/assembly/mechanical/assembly';
import product from './product.json';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'gmp16-gearmotor',
  name: 'GMP16T-TEC1636 planetary gearmotor',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'MOTOR ASSEMBLIES',
  icon: 'gear',
  product: product as ProductProfile,
  description:
    'Ø16 brushless coreless motor with 1–5 planetary stages, 17 reduction ratios, 12/24 V windings and the 11.6D7 output shaft.',
  complexity: 'Source dimensions · selectable reduction and voltage',
  keywords: [
    'GMP16T',
    'GMP16',
    'TEC1636',
    'TBC1636',
    'planetary',
    'gearmotor',
    'gear motor',
    '361-11.6D7',
    '107-11.6D7',
    '12V',
    '24V',
    '1005011804448445',
    'brushless',
    'coreless',
    'motor reducer',
    '\u0434\u0432\u0438\u0433\u0443\u043d',
    '\u043f\u043b\u0430\u043d\u0435\u0442\u0430\u0440\u043d\u0438\u0439',
    '\u0440\u0435\u0434\u0443\u043a\u0442\u043e\u0440',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  catalogFilterFields,
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Nominal mounting envelope with source shaft and front interfaces.',
    },
    {
      id: 'exploded',
      label: 'Separated housings',
      description: 'Housing and cover inspection; internal gear teeth are not reconstructed.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((model) => model.id === p.model))
      errors.push('Select a supported motor execution.');
    if (
      typeof p.outputAngle !== 'number' ||
      !Number.isFinite(p.outputAngle) ||
      Math.abs(p.outputAngle) > 180
    )
      errors.push('Shaft position must be between −180° and 180°.');
    if (typeof p.showLeads !== 'boolean') errors.push('Choose cable visibility.');
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Choose a supported inspection state.');
    for (const key of Object.keys(p))
      if (!parameters.some((field) => field.key === key))
        errors.push(`Unsupported fixed motor parameter: ${key}.`);
    return errors;
  },
  buildGeometry: (p, state) => geometry(pieces(p, state)),
  python: (p, state) => python(pieces(p, state)),
  dimensions,
  notes:
    'Source-dimensioned installation model. Ratio changes gearbox length and stage count. The attachment provides 17 ratios and 12/24 V motor data; seller availability beyond the two requested 107/361 variants is unconfirmed. The torque table lists 5 kgf·cm for some ratios despite a 3 kgf·cm gearbox rated maximum and 5 kgf·cm momentary maximum. These conflicting figures are transcribed, not approved continuous ratings. Wall thicknesses, mounting thread depths, internal clearances and cables are illustrative. M2 holes are nominal pilots without helical threads. No internal gearing, controller, connector execution or manufacturing fits are certified.',
  sources: [
    { label: 'Supplied GMP16T-TEC1636 dimensions and ratings', url: sourceUrl },
    {
      label: 'Supplied planetary construction image',
      url: 'references/gmp16-gearmotor/planetary-construction.png',
    },
    { label: 'Supplier listing · availability unconfirmed', url: listingUrl },
  ],
};
export default part;
