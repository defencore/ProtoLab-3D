import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 't-slot-nut',
  name: 'T-slot nut',
  category: 'FASTENERS & THREADS',
  subgroup: 'NUTS',
  icon: 'bolt',
  description:
    'Sliding and hammer-head nuts with an actual through bore and configurable slot shoulder.',
  complexity: 'Parametric prototype',
  keywords: [
    't-slot nut',
    't slot nut',
    'Slot 6 sliding nut \u00b7 M5',
    'Slot 8 sliding nut \u00b7 M6',
    'Hammer-head nut \u00b7 M5',
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
    if (n(p, 'bore') >= n(p, 'neck') || n(p, 'neck') >= n(p, 'width'))
      errors.push('Bore < slot neck < base width is required.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Slot dimensions are independent; verify against the selected extrusion. The through bore represents the nominal thread envelope. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
