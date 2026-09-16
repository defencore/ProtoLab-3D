import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'landing-gear',
  name: 'Landing gear strut',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'DUCTS & LANDING GEAR',
  icon: 'wing',
  description:
    'Single or twin-wheel fork, axle, telescopic strut and pivot mounts, with optional one- or two-link drag brace.',
  complexity: 'Parametric prototype',
  keywords: [
    'landing gear strut',
    'landing gear',
    'Landing gear \u00b7 \u00d860 wheel',
    'Landing gear \u00b7 \u00d8100 wheel',
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
    if (!['assembled', 'exploded'].includes(state)) errors.push('Choose a valid model state.');
    if (!['fork', 'braced', 'folding'].includes(String(p.form)))
      errors.push('Choose a valid construction.');
    if (!['single', 'twin'].includes(String(p.wheels)))
      errors.push('Choose a valid wheel arrangement.');
    const d = n(p, 'wheel'),
      w = n(p, 'width'),
      r = n(p, 'rod'),
      a = n(p, 'axle');
    const t = n(p, 'forkWall'),
      c = n(p, 'clearance'),
      L = n(p, 'strut');
    const crown = d / 2 + c;
    if (a >= d * 0.35) errors.push('Axle diameter must be below 35% of the wheel diameter.');
    const innerFork = (p.wheels === 'twin' ? 2 * w + c : w) + 2 * c;
    if (r * 0.65 + 1 > innerFork)
      errors.push(
        'Increase wheel width or fork clearance to fit the sliding strut between the fork cheeks.',
      );
    if (w >= d * 0.65) errors.push('Tyre width must be below 65% of its diameter.');
    if (r < a * 2 || r > d * 0.6)
      errors.push(
        'Strut diameter must be at least two axle diameters and at most 60% of the wheel diameter.',
      );
    if (L - crown - t < r * 3)
      errors.push(
        'Allow at least three strut diameters above the fork crown for the sleeve and upper pivot.',
      );
    if (n(p, 'plate') < Math.max(r * 0.6 + 2 * t + 1, a * 2.5))
      errors.push('Mount plate is too narrow for the pivot cheeks and mounting holes.');
    if (p.form !== 'fork' && n(p, 'braceSpan') < Math.max(n(p, 'plate') + a, r * 3))
      errors.push(
        'Separate the upper mounts by at least one plate width plus an axle diameter, and three strut diameters.',
      );
    if (p.form === 'folding' && n(p, 'kneeOffset') > (n(p, 'braceSpan') - r * 1.4) * 0.4)
      errors.push('Knee offset must stay below 40% of the horizontal brace span.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Mechanical layout with bored fork, axle, retainers, wheel hubs, sliding-strut envelope and clevis-mounted drag braces. Dimensions are editable prototype choices. Two-link brace is a fixed pose, without retraction actuation or an over-centre lock. No internal damper, bearings, fastener threads or load rating are modeled. Z is vertical; wheel and pivot axes are Y.',
  sources: [],
};
export default part;
