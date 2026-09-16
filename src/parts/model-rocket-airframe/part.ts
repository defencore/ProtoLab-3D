import { withParameterStates } from '../../core/parameter-states';
import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters, catalogSelection } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'model-rocket-airframe',
  name: 'Model rocket airframe',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'box',
  description:
    'Lightweight model rocket airframe with editable dimensions and named components. Popular model references are approximate and identify their source dimensions.',
  complexity: 'Popular references · custom dimensions',
  keywords: [
    'model rocket',
    'Estes',
    'Alpha III',
    'Big Bertha',
    'airframe',
    'body tube',
    '\u0440\u0430\u043a\u0435\u0442\u0430',
    '\u043a\u043e\u0440\u043f\u0443\u0441',
    '\u0442\u0440\u0443\u0431\u0430',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection,
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Separate major components for layout work.',
    },
    {
      id: 'body',
      label: 'Body only',
      description: 'Primary shell or plate without the remaining assembly.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separate the major components for inspection.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'body', 'exploded'].includes(state))
      errors.push('Choose a valid model state.');
    if (n(p, 'wall') * 2 >= n(p, 'diameter') * 0.5)
      errors.push('The wall is too thick for the body.');
    if (n(p, 'noseLength') >= n(p, 'length') * 0.6)
      errors.push('The nose must be shorter than 60% of overall length.');
    if (
      Math.max(n(p, 'finRoot'), n(p, 'finSweep') + n(p, 'finTip')) >=
      n(p, 'length') - n(p, 'noseLength')
    )
      errors.push('Fins must stay below the nose.');
    if (!Number.isInteger(n(p, 'finCount'))) errors.push('Fin count must be a whole number.');
    return errors;
  },
  buildGeometry: (p, state) => assembly.geometry(pieces(p, state)),
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  notes:
    'External airframe reference for educational model rockets: open tube, hollow nose and separate fins. Z is the longitudinal axis. No motor mount, motor, igniter, propellant or deployment mechanism. Published product dimensions are rounded; tube wall, nose profile/length and fin shapes are editable assumptions, not traced factory parts. The nose sits at the tube end without a modeled retention joint. These are layout solids, not flight-ready kits.',
};
export default withParameterStates(part, {
  body: ['nose', 'finCount', 'finRoot', 'finTip', 'finSpan', 'finSweep', 'finThickness'],
});
