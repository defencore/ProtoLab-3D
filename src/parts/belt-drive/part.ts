import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'belt-drive',
  name: 'Belt and pulley drive',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'BELTS CHAINS & CABLES',
  icon: 'gear',
  description: 'Equal-pulley drive with a separate closed belt, bores and flanges.',
  complexity: 'Parametric prototype',
  keywords: [
    'belt and pulley drive',
    'belt drive',
    'Timing drive \u00b7 2 mm pitch',
    'Timing drive \u00b7 3 mm pitch',
    'Timing drive \u00b7 5 mm pitch',
    'Timing drive \u00b7 8 mm pitch',
    'Trapezoidal timing drive \u00b7 5 mm pitch',
    'Trapezoidal timing drive \u00b7 10 mm pitch',
    'V-belt drive',
    'Poly-V drive',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  updateParameters(p, key) {
    if (key !== 'form') return p;
    const preset = presets.find((item) => item.parameters.form === p.form);
    return preset
      ? { ...p, ...preset.parameters, ...(p.detail === undefined ? {} : { detail: p.detail }) }
      : p;
  },
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
    const r = ['v', 'poly'].includes(String(p.form))
      ? n(p, 'pulleyDiameter') / 2
      : (n(p, 'pitch') * n(p, 'teeth')) / (2 * Math.PI);
    if (
      n(p, 'bore') >= 2 * r - 3 ||
      n(p, 'centres') < 2 * (r + n(p, 'thickness') + 2) ||
      n(p, 'thickness') <= 0.3
    )
      errors.push('Bore, belt thickness and pulley spacing must fit the selected pitch circle.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Both pulleys have equal tooth count. Belt path uses the entered centre distance; it is not snapped to a stock belt length. Detailed timing variants include tooth spaces and mating pulleys with clearances; rounded and trapezoidal profiles are approximations, not GT/HTD production tooling. V/poly-V variants have matching wedge/rib sections and sheave grooves. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [
    {
      label: 'SDP/SI belt and pulley families',
      url: 'https://shop.sdp-si.com/products/synchronous-drive-belts-pulleys-cables/synchronous-drive-belts-pulleys.html',
    },
  ],
};
export default part;
