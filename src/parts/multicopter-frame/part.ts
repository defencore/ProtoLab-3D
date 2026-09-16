import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters, catalogSelection } from './configurator';
import presets from './presets.json';
import { layouts, armSites, coaxial } from './lib/layout';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'multicopter-frame',
  name: 'Multicopter frame',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MULTICOPTERS',
  icon: 'bracket',
  description:
    'Lightweight multicopter frame with editable dimensions and named components. Popular model references are approximate and identify their source dimensions.',
  complexity: 'Popular references · custom dimensions',
  keywords: [
    'multicopter',
    'quad',
    'Y4',
    'Y6',
    'LY',
    'X8',
    'coaxial',
    'H frame',
    'quadcopter',
    'hexacopter',
    'octocopter',
    'FPV',
    'MARK5',
    'X500',
    'X650',
    '\u0440\u0430\u043c\u0430',
    '\u043c\u0443\u043b\u044c\u0442\u0438\u043a\u043e\u043f\u0442\u0435\u0440',
    '\u043a\u0432\u0430\u0434\u0440\u043e\u043a\u043e\u043f\u0442\u0435\u0440',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection,
  updateParameters(p, changedKey) {
    if (changedKey === 'layout' && p.layout === 'quad-v' && p.armAngle === p.rearAngle)
      return { ...p, armAngle: 55, rearAngle: 35 };
    return p;
  },
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Separate major components for layout work.',
    },
    {
      id: 'body',
      label: 'Bottom plate',
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
    if (!layouts.some((l) => l.value === p.layout)) return ['Choose a valid frame configuration.'];
    if (n(p, 'stackPitch') + n(p, 'hole') * 2 >= Math.min(n(p, 'bodyLength'), n(p, 'bodyWidth')))
      errors.push('Controller holes must fit inside the centre plate.');
    if (n(p, 'wheelbase') < Math.max(n(p, 'bodyLength'), n(p, 'bodyWidth')) * 2)
      errors.push('Motor spacing must exceed twice the centre plate size.');
    if (p.armStyle === 'tube' && n(p, 'tubeWall') * 2 >= n(p, 'armWidth'))
      errors.push('Tube wall is too thick.');
    if (n(p, 'spacerDiameter') * 4 >= Math.min(n(p, 'bodyLength'), n(p, 'bodyWidth')))
      errors.push('Spacers are too large for the centre plate.');
    if (n(p, 'shaftClearance') + n(p, 'hole') >= n(p, 'motorPitch') * 1.4)
      errors.push('Shaft clearance must not intersect motor screw holes.');
    const w = n(p, 'armWidth'),
      pad = Math.max(w, n(p, 'motorPitch') + 3 * n(p, 'hole'));
    const sites = armSites(p),
      R = n(p, 'wheelbase') / 2;
    for (const site of sites) {
      const separation = Math.min(
        ...sites
          .filter((s) => s !== site)
          .map((s) => Math.abs(((s.angle - site.angle + 540) % 360) - 180)),
      );
      const root = Math.max(
        n(p, 'bodyLength') * 0.16,
        w / (2 * Math.tan((separation * Math.PI) / 360)) + 0.5,
      );
      if (root >= R - pad / 2) {
        errors.push('Arms are too wide for the selected motor circle.');
        break;
      }
      const angle = (site.angle * Math.PI) / 180;
      if (
        p.layout !== 'quad-h' &&
        (Math.abs(root * Math.cos(angle)) > n(p, 'bodyLength') / 2 ||
          Math.abs(root * Math.sin(angle)) > n(p, 'bodyWidth') / 2)
      ) {
        errors.push(
          'Increase the centre plate size or reduce arm width so arm roots meet the plate.',
        );
        break;
      }
    }
    if (
      p.layout === 'quad-h' &&
      R * Math.sin((n(p, 'armAngle') * Math.PI) / 180) <= (n(p, 'bodyWidth') + w) / 2
    )
      errors.push('H side beams must lie outside the centre plate.');
    if (coaxial(p) && n(p, 'spacerDiameter') + n(p, 'hole') >= n(p, 'motorPitch'))
      errors.push('Coaxial spacers must clear the motor screw holes.');
    return errors;
  },
  buildGeometry: (p, state) => assembly.geometry(pieces(p, state)),
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  notes:
    'Frame configurations follow Figure 4 in Takva & İlerisoy (2023), DOI 10.2478/acee-2023-0004. +X is the nose, +Y is left, +Z is up. Motor circle diameter is twice the distance from the origin to a motor axis, including Y layouts without opposite motors. Quad V has separate front/rear angles. Quad Y has a rear coaxial pair; Y6 and inverted-Y LY have three pairs; X8 has four pairs. Coaxial gap is the clear distance between mounting plates, not rotor spacing. H beams form one structural component. Arm numbers are geometry labels, not flight-controller motor numbers. Dimensions and joints are editable design examples; the source diagram provides topology only. Product presets verify only their listed dimensions. No motors, propellers, tilt mechanisms, hardware or electronics are included. These are layout references, not interchangeable replacement frame parts.',
};
export default part;
