import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'eccentric-bearing',
  name: 'Eccentric ball bearing',
  description:
    'MOCHU 524806K / NA4206X3A keyed eccentric ball bearing with separate races, balls, cage and seals.',
  category: 'BEARINGS & SEALS',
  subgroup: 'ECCENTRICS & FOLLOWERS',
  icon: 'bearing',
  complexity: 'Catalogue dimensions \u00b7 editable geometry',
  keywords: [
    'Eccentric ball bearing',
    'eccentric',
    '\u0435\u043a\u0441\u0446\u0435\u043d\u0442\u0440\u0438\u043a',
    '\u0435\u043a\u0441\u0446\u0435\u043d\u0442\u0440\u0438\u043a\u043e\u0432\u0438\u0439',
    'miniature',
    'MOCHU 524806K NA4206X3A',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Separate physical components.' },
    {
      id: 'open',
      label: 'Inspect rolling elements',
      description: 'Remove closures to inspect the bearing mechanism.',
    },
    {
      id: 'exploded',
      label: 'Exploded assembly',
      description: 'Separate rings and closures axially.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'open', 'exploded'].includes(state))
      errors.push('Select a valid model view.');
    const R = +p.outer / 2;
    if (+p.bore / 2 + +p.eccentricity + 0.5 >= 0.71 * R)
      errors.push('Eccentric bore must leave material beneath the inner raceway.');
    if (+p.keyWidth >= +p.bore || +p.keyWidth < 0.5)
      errors.push('Keyway must be narrower than the shaft bore.');
    if (Math.hypot(+p.bore / 2 + +p.keyDepth - +p.eccentricity, +p.keyWidth / 2) + 0.5 >= 0.71 * R)
      errors.push('Keyway must not break through the inner raceway.');
    if (+p.outerWidth / 2 <= 0.09 * R + 1.4)
      errors.push('Outer width must fit the balls, cage and seals.');
    if (+p.innerWidth < +p.outerWidth)
      errors.push('Inner ring must be at least as wide as the outer ring.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  notes:
    '524806K dimensions 30 \u00d7 70 \u00d7 16 / 18.5 mm follow the supplied listing. NA4206X3A is the seller\u2019s alternate designation, not a verified interchange standard. Eccentricity 4.5 mm, keyway 8 \u00d7 2 mm, raceways, ten balls and cage are reconstruction choices. Bore axis stays fixed while the bearing centre orbits by the eccentricity. The model describes packaging and mechanism layout, not a manufacturing drawing or a load-rated bearing.',
  sources: [
    {
      label: 'MOCHU \u00b7 requested 524806K listing',
      url: 'https://www.aliexpress.com/item/1005003592030441.html',
    },
    {
      label: 'WXING \u00b7 524806K \u00b7 30 \u00d7 70 \u00d7 18.5 mm',
      url: 'https://www.wxingbearing.com/524806k-deep-groove-eccentric-shaft-bearing-30-70-18-5mm-use-for-the-car',
    },
  ],
};
export default part;
