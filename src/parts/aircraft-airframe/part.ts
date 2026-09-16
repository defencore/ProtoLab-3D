import { withParameterStates } from '../../core/parameter-states';
import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters, catalogSelection, updateParameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'aircraft-airframe',
  name: 'Aircraft airframe',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'AIRCRAFT',
  icon: 'wing',
  description:
    'Hobby airframes with selectable wing positions, body styles, tail layouts and separate control surfaces.',
  complexity: 'Popular references · custom dimensions',
  keywords: [
    'aircraft',
    'airplane',
    'fuselage',
    'RC',
    'trainer',
    'glider',
    '\u043b\u0456\u0442\u0430\u043a',
    '\u0444\u044e\u0437\u0435\u043b\u044f\u0436',
    '\u043a\u043e\u0440\u043f\u0443\u0441',
    'Dolphin',
    'Simple Cub',
    'ASW-17',
    'Versa',
    'Bronco',
    'Viggen',
    'flying wing',
    'delta',
    'canard',
    'twin boom',
    'tandem',
    'aileron',
    'elevon',
    'flap',
  ],
  defaults,
  parameters,
  updateParameters,
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
    const L = n(p, 'length'),
      W = n(p, 'bodyWidth'),
      H = n(p, 'bodyHeight');
    const root = n(p, 'rootChord'),
      chord = n(p, 'tailChord'),
      span = n(p, 'span');
    const wingOnly = p.layout === 'flying-wing';
    if (n(p, 'wall') * 2 >= Math.min(W, wingOnly ? (root * n(p, 'wingThickness')) / 100 : H) * 0.3)
      errors.push('Wall thickness is too large for the body or centre section.');
    if (span <= W * 2) errors.push('Wingspan must exceed twice the body width.');
    if (!wingOnly && (n(p, 'wingStation') / 100) * L + root > L)
      errors.push('Wing root trailing edge must fit within the fuselage length.');
    if (p.tail !== 'none') {
      if (n(p, 'tailSpan') <= W * 1.5)
        errors.push('Tail or foreplane span must exceed 1.5 times the body width.');
      if (chord > L * 0.3)
        errors.push('Tail or foreplane chord must not exceed 30% of fuselage length.');
      if (!wingOnly && p.layout !== 'canard' && (L * n(p, 'wingStation')) / 100 + root >= L - chord)
        errors.push('Leave longitudinal clearance between the main wing and the tail / aft wing.');
      if (p.layout === 'canard' && L * 0.11 + chord >= (L * n(p, 'wingStation')) / 100)
        errors.push('Leave longitudinal clearance between the canard and main wing.');
    }
    if (['flying-wing', 'delta'].includes(String(p.layout)) && p.tail !== 'none')
      errors.push('Flying-wing and delta configurations use a tailless wing.');
    if (['canard', 'twin-boom', 'tandem'].includes(String(p.layout)) && p.tail !== 'conventional')
      errors.push(
        'This configuration requires its conventional foreplane / tailplane arrangement.',
      );
    if (['flying-wing', 'delta'].includes(String(p.layout)) && p.wingControl !== 'elevons')
      errors.push('Choose elevons for pitch and roll on a tailless wing.');
    if (p.layout === 'twin-boom' && n(p, 'tailSpan') >= span * 0.8)
      errors.push('H-tail span must be less than 80% of main wingspan.');
    if (
      n(p, 'hingeGap') * 4 >=
      (Math.min(n(p, 'tipChord'), chord * 0.65) * n(p, 'controlChord')) / 100
    )
      errors.push('Hinge clearance is too large for the smallest control surface.');
    return errors;
  },
  buildGeometry: (p, state) => assembly.geometry(pieces(p, state)),
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  notes:
    'Lightweight geometry for layout studies. Nose is −X, span is Y, up is +Z. Orange surfaces identify controls in neutral position: ailerons (roll), elevators (pitch), rudder (yaw), elevons (pitch + roll), ruddervators (pitch + yaw), and flaps. These are separate solids, not simulated hinges or flight-control mixing. Manufacturer presets verify only the listed overall dimensions; contours, section profiles, mount stations, shell thickness and control geometry are editable approximations. Overall reference length is used for the body envelope; propellers, landing gear, linkages, spar joints and internal fittings are omitted. Use Wing and control surface for detailed profile design.',
};
export default withParameterStates(part, {
  body: [
    'layout',
    'wingMount',
    'wingStation',
    'wingThickness',
    'wingControl',
    'controlChord',
    'hingeGap',
    'span',
    'rootChord',
    'tipChord',
    'sweep',
    'dihedral',
    'tail',
    'tailSpan',
    'tailChord',
    'finHeight',
    'winglets',
    'foreplaneControl',
  ],
});
