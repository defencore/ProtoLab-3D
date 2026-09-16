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
    'Four-bar, slider-crank, Scotch yoke, scissor, parallelogram, cam and indexing mechanism geometry.',
  complexity: 'Parametric prototype',
  keywords: [
    'linkage and indexing mechanism',
    'linkage mechanism',
    'Four-bar linkage',
    'Slider-crank mechanism',
    'Scotch yoke',
    'Scissor lift',
    'Parallelogram linkage',
    'Eccentric cam',
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
    if (
      p.form === 'geneva' &&
      n(p, 'ground') * (1 - Math.sin(Math.PI / n(p, 'slots'))) <= n(p, 'width') + n(p, 'pin')
    )
      errors.push('Indexer centres must leave space for the driver, axle and slot ends.');
    if (p.form === 'yoke' && n(p, 'rod') <= 2 * n(p, 'crank') + n(p, 'width'))
      errors.push('Yoke rod must remain inside its guide over the complete crank travel.');
    if (n(p, 'pin') >= n(p, 'width') * 0.6) errors.push('Pivot bore must leave link material.');
    if (['fourbar'].includes(String(p.form))) {
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
    if (['cam', 'eccentric'].includes(String(p.form)) && n(p, 'rod') * 0.35 <= n(p, 'crank'))
      errors.push('Coupler/cam radius must exceed the crank eccentricity.');
    if (p.form === 'slider' && n(p, 'rod') <= n(p, 'crank') + n(p, 'width'))
      errors.push('Connecting rod must clear the crank throughout its rotation.');
    if (
      p.form === 'pantograph' &&
      Math.abs(Math.sin((n(p, 'phase') * Math.PI) / 180)) * Math.min(n(p, 'rod'), n(p, 'output')) <=
        n(p, 'width') + 0.2
    )
      errors.push('Parallelogram links collide near the collapsed pose.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Four-bar and slider-crank poses are solved from link lengths; scissor height and parallelogram pose are parameterized. Links have separate joining pins and pedestals; slider and yoke variants include guides. Cam is circular eccentric, not a programmed lift law. Geneva wheel pose follows the driver during engagement and dwells outside it; a locking disc is not included. Ratchet pawl is positioned next to the outermost tooth. Contact loads, return springs and ratchet dynamics are not simulated. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
