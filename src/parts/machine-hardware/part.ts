import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'machine-hardware',
  name: 'Machine frame hardware',
  category: 'STRUCTURAL PARTS',
  subgroup: 'HANDLES HINGES & FEET',
  icon: 'bracket',
  description:
    'Five-knuckle hinge, bridge pull handle, barrel bolt with strike, levelling foot and insertion end cap.',
  complexity: 'Parametric prototype',
  keywords: [
    'machine frame hardware',
    'machine hardware',
    'Leaf hinge \u00b7 40 \u00d7 60 mm',
    'Bridge handle \u00b7 60 mm centres',
    'Sliding latch',
    'Adjustable levelling foot',
    'Extrusion end cap \u00b7 40 mm',
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
    if (!['hinge', 'handle', 'latch', 'foot', 'cap'].includes(String(p.form)))
      errors.push('Choose a valid hardware family.');
    const bore = n(p, 'mountHole');
    if (p.form === 'hinge') {
      const r = n(p, 'pinDiameter') / 2 + n(p, 'leafThickness');
      if (n(p, 'hingeWidth') / 2 - r - 0.2 < bore + 2)
        errors.push('Hinge leaves need room around the mounting holes.');
      if (n(p, 'hingeLength') / 5 < n(p, 'leafThickness'))
        errors.push('Hinge knuckles are too short for the leaf thickness.');
    } else if (p.form === 'handle') {
      const t = n(p, 'handleThickness');
      if (t <= bore + 2 || n(p, 'handleWidth') * 0.7 <= bore + 2)
        errors.push('Handle legs must leave material around the mounting bores.');
      if (n(p, 'handleHeight') < 2.5 * t || n(p, 'handlePitch') < 3 * t)
        errors.push('Increase handle height or mounting pitch to leave finger clearance.');
      if (n(p, 'handleFootLength') < t || n(p, 'handleFootLength') >= n(p, 'handlePitch'))
        errors.push('Mounting feet must support the legs without overlapping.');
    } else if (p.form === 'latch') {
      const d = n(p, 'boltDiameter'),
        L = n(p, 'latchLength'),
        W = n(p, 'latchWidth');
      if (L < 8 * d || W < 3 * d || W * 0.36 <= d * 0.9 + bore / 2 + 0.2)
        errors.push('Increase the bolt plate size to fit guides and mounting holes.');
      if (bore >= L * 0.1 || bore >= W * 0.22)
        errors.push('Mounting holes are too large for the latch plates.');
      if (n(p, 'latchTravel') > L * 0.18 + 1e-9)
        errors.push('Bolt retraction must not exceed 18% of plate length.');
    } else if (p.form === 'foot') {
      if (n(p, 'stemDiameter') * 2.5 > n(p, 'footDiameter'))
        errors.push('Foot pad must be at least 2.5 stem diameters wide.');
      if (n(p, 'footHeight') < n(p, 'padThickness') + n(p, 'stemDiameter') * 1.4)
        errors.push('Stem height must accommodate the locknut above the pad.');
    } else if (p.form === 'cap') {
      if (4 * n(p, 'capWall') + 0.8 >= Math.min(n(p, 'capWidth'), n(p, 'capLength')))
        errors.push('Cap skirt walls are too thick for the profile opening.');
    }
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Editable mechanical prototypes with actual hinge knuckles, mounting bores, guided bolt and separate strike. Hinge angle and bolt retraction change the assembly pose. Foot threads and pin retainers use smooth nominal envelopes. Profile cap fit depends on the actual extrusion opening. No manufacturer fit or load rating is implied.',
  sources: [],
};
export default part;
