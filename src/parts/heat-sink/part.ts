import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'heat-sink',
  name: 'Finned heat sink',
  category: 'ELECTRONICS & VISION',
  subgroup: 'COOLING & MOUNTING',
  icon: 'circuit',
  description: 'Extruded heat sink with editable base, fin pitch and clearance mounting holes.',
  complexity: 'Parametric prototype',
  keywords: [
    'finned heat sink',
    'heat sink',
    'Heat sink \u00b7 40 \u00d7 50 \u00d7 20 mm',
    'Heat sink \u00b7 80 \u00d7 100 \u00d7 30 mm',
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
    if (n(p, 'base') >= n(p, 'height') || n(p, 'fins') * n(p, 'fin') >= n(p, 'width'))
      errors.push('Fins need positive height and airflow gaps.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'No heat-transfer or thermal-resistance calculation. Envelope mode intentionally fills the fin region. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
