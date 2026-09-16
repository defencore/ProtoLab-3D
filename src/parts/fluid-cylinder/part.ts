import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'fluid-cylinder',
  name: 'Pneumatic and hydraulic cylinder',
  category: 'PNEUMATICS & GAS',
  subgroup: 'CYLINDERS',
  icon: 'box',
  description: 'Round, tie-rod, compact, hydraulic and rodless actuator construction forms.',
  complexity: 'Parametric prototype',
  keywords: [
    'pneumatic and hydraulic cylinder',
    'fluid cylinder',
    'Round pneumatic cylinder \u00b7 \u00d825 \u00d7 100 mm',
    'Tie-rod cylinder \u00b7 \u00d832 \u00d7 100 mm',
    'Compact cylinder \u00b7 \u00d825 \u00d7 25 mm',
    'Hydraulic cylinder \u00b7 \u00d840 \u00d7 100 mm',
    'Rodless cylinder \u00b7 100 mm travel',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Separate physical components.' },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Axially separated components for inspection.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    for (const field of parameters) {
      if (
        field.type === 'number' &&
        field.step === 1 &&
        field.unit === '' &&
        !Number.isInteger(n(p, field.key))
      )
        errors.push(field.label + ' must be a whole number.');
    }
    if (!['assembled', 'exploded'].includes(state)) errors.push('Choose a valid model state.');
    if (
      n(p, 'extension') > n(p, 'stroke') ||
      n(p, 'rod') >= n(p, 'bore') - 2 ||
      n(p, 'port') >= n(p, 'bore') * 0.4
    )
      errors.push('Rod, port and stroke dimensions must fit the cylinder.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Cylinder styles are inspired by common ISO construction families, but mounting dimensions are custom and not certified to ISO 6432/15552/21287. No pressure calculation or sealing design. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [
    {
      label: 'Festo cylinder construction families',
      url: 'https://www.festo.com/gb/en/c/products/actuators/pneumatic-cylinders-id_pim135',
    },
  ],
};
export default part;
