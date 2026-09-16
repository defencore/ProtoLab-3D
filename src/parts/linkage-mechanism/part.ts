import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'linkage-mechanism',
  name: 'Linkage and indexing mechanism',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'MOTION MECHANISMS',
  icon: 'gear',
  description:
    'Four-bar, slider-crank, Scotch yoke, scissor, pantograph, cam and indexing mechanism geometry.',
  complexity: 'Parametric prototype',
  keywords: [
    'linkage and indexing mechanism',
    'linkage mechanism',
    'Four-bar linkage',
    'Slider-crank mechanism',
    'Scotch yoke',
    'Scissor lift',
    'Pantograph linkage',
    'Eccentric clamp',
    'Eccentric cam with roller follower',
    'Ratchet and pawl',
    'Geneva indexer',
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
    if (n(p, 'pin') >= n(p, 'width') * 0.6) errors.push('Pivot bore must leave link material.');
    if (['fourbar', 'toggle'].includes(String(p.form))) {
      const a = (n(p, 'phase') * Math.PI) / 180,
        dist = Math.hypot(
          n(p, 'ground') - n(p, 'crank') * Math.cos(a),
          n(p, 'crank') * Math.sin(a),
        );
      if (
        dist >= n(p, 'rod') + n(p, 'output') - 0.1 ||
        dist <= Math.abs(n(p, 'rod') - n(p, 'output')) + 0.1
      )
        errors.push('This four-bar pose cannot close; adjust lengths or input phase.');
    }
    if (
      ['slider', 'cam', 'eccentric'].includes(String(p.form)) &&
      n(p, 'rod') * 0.35 <= n(p, 'crank')
    )
      errors.push('Coupler/cam radius must exceed the crank eccentricity.');
    if (
      p.form === 'pantograph' &&
      Math.abs(Math.sin((n(p, 'phase') * Math.PI) / 180)) * Math.min(n(p, 'rod'), n(p, 'output')) <=
        n(p, 'width') + 0.2
    )
      errors.push('Pantograph links collide near the collapsed pose.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Four-bar and slider-crank poses are solved from link lengths; scissor height and pantograph pose are parameterized. Parts occupy separate axial layers with pivot bores; bearings and joining pins are omitted. Cam is circular eccentric, not a programmed lift law. Ratchet/Geneva are neutral construction references, not contact or full indexing simulations. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
