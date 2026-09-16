import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'structural-section',
  name: 'Structural section',
  category: 'STRUCTURAL PARTS',
  subgroup: 'STEEL & GENERAL SECTIONS',
  icon: 'bracket',
  description:
    'I-beam, channel, angle and rectangular hollow sections with editable wall thickness.',
  complexity: 'Parametric prototype',
  keywords: [
    'structural section',
    'structural section',
    'I-beam \u00b7 40 \u00d7 60 mm',
    'C channel \u00b7 40 \u00d7 60 mm',
    'Angle \u00b7 40 \u00d7 60 mm',
    'Rectangular tube \u00b7 40 \u00d7 60 mm',
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
    if (2 * n(p, 'wall') >= Math.min(n(p, 'width'), n(p, 'height')))
      errors.push('Wall thickness closes the section.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    ' Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
