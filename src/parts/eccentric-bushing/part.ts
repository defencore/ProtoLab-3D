import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'eccentric-bushing',
  name: 'Miniature eccentric bushing',
  description: 'MISUMI ECCB hex-head bushings for adjustable miniature bearing seats.',
  category: 'BEARINGS & SEALS',
  subgroup: 'ECCENTRICS & FOLLOWERS',
  icon: 'bearing',
  complexity: 'Catalogue dimensions \u00b7 editable geometry',
  keywords: [
    'Miniature eccentric bushing',
    'eccentric',
    '\u0435\u043a\u0441\u0446\u0435\u043d\u0442\u0440\u0438\u043a',
    '\u0435\u043a\u0441\u0446\u0435\u043d\u0442\u0440\u0438\u043a\u043e\u0432\u0438\u0439',
    'miniature',
    'MISUMI',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [{ id: 'assembled', label: 'Assembly', description: 'Separate physical components.' }],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled'].includes(state)) errors.push('Select a valid model view.');
    if (+p.bore / 2 + +p.eccentricity + 0.25 >= +p.seat / 2)
      errors.push('The eccentric bore must leave at least 0.25 mm of seat wall.');
    if (+p.acrossFlats < +p.seat + 0.5)
      errors.push('Hex head must extend beyond the bearing seat.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p)),
  python: (p, s) => assembly.python(pieces(p)),
  dimensions: (p, s) => assembly.dimensions(pieces(p)),
  notes:
    'Nominal MISUMI ECCB dimensions: D bearing seat, F seat length, V plain through bore, B hex flats, T head thickness and e eccentricity. Total length is F + T. Matching bearing designations are shown in the presets; bearings are not included. Edge breaks and tolerance bands are not modelled. Changing a dimension creates a custom bushing.',
  sources: [
    {
      label: 'MISUMI \u00b7 Eccentric Bushings ECCB \u00b7 p. 1155',
      url: 'https://es.misumi-ec.com/pdf/fa/2014/P1_1155-1156_F16_EN.pdf',
    },
  ],
};
export default part;
