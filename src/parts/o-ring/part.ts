import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'o-ring',
  name: 'O-ring and groove tool',
  category: 'BEARINGS & SEALS',
  subgroup: 'STATIC SEALS',
  icon: 'bearing',
  description:
    'Round elastomer seal and separate face or radial groove cutter for CAD cut operations.',
  complexity: 'Parametric prototype',
  keywords: [
    'o-ring and groove tool',
    'o ring',
    'O-ring \u00b7 15 \u00d7 2 mm',
    'Face groove tool \u00b7 for 15 \u00d7 2 mm ring',
    'Radial groove tool \u00b7 for 15 \u00d7 2 mm ring',
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
    if (n(p, 'grooveWidth') >= n(p, 'inside') + n(p, 'section'))
      errors.push('Groove width exceeds the available diameter.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Groove depth and width are explicit user inputs; there is no automatic squeeze, stretch or pressure qualification. Face groove is centred at the free ring mean diameter. Radial cutter spans the entered inside diameter outward by groove depth. Place cutter relative to the actual shaft/bore before Cut. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [
    {
      label: 'Parker O-ring design handbook',
      url: 'https://www.parker.com/content/dam/Parker-com/Literature/O-Ring-Division-Literature/ORD-5700.pdf',
    },
  ],
};
export default part;
