import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'eccentric-cam-follower',
  name: 'Eccentric cam follower',
  description:
    'Compact IKO CFE eccentric-collar rollers with hex-socket studs, needle rollers and sealed or shielded closures.',
  category: 'BEARINGS & SEALS',
  subgroup: 'ECCENTRICS & FOLLOWERS',
  icon: 'bearing',
  complexity: 'Catalogue dimensions \u00b7 editable geometry',
  keywords: [
    'Eccentric cam follower',
    'eccentric',
    '\u0435\u043a\u0441\u0446\u0435\u043d\u0442\u0440\u0438\u043a',
    '\u0435\u043a\u0441\u0446\u0435\u043d\u0442\u0440\u0438\u043a\u043e\u0432\u0438\u0439',
    'miniature',
    'IKO CFE',
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
    const journal = Math.max(+p.stud, +p.outer * 0.48),
      gap = (+p.outer * 0.72 - journal) / 4;
    if (gap <= 0.2)
      errors.push('Roller diameter must leave room around the stud for needle rollers.');
    if (+p.collar / 2 <= +p.stud / 2 + +p.eccentricity + 0.22)
      errors.push('Eccentric collar must retain at least 0.2 mm of wall.');
    if (+p.collar / 2 + +p.eccentricity >= +p.outer * 0.355)
      errors.push('Collar must fit behind the stud shoulder.');
    if (+p.studLength <= +p.collarLength + 2)
      errors.push('Stud must project at least 2 mm beyond the collar.');
    if (+p.hex / Math.sqrt(3) + 0.2 >= journal / 2)
      errors.push('Hex socket must fit inside the stud head.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  notes:
    'IKO CFE external dimensions and 0.4 mm eccentricity follow catalogue 1569E pp. 51\u201352. The mounting collar remains centred while the stud and roller axes are offset. Needle count, internal race dimensions and socket depth are reconstructed. B has metal shields; BUU has rubber seals. Stud threads use a smooth nominal-diameter envelope; thread pitches are shown in each preset. Nuts and washers are not included. Edited dimensions describe a custom model.',
  sources: [
    {
      label: 'IKO \u00b7 Cam Followers catalogue \u00b7 CFE pp. 51\u201352',
      url: 'https://ikont.com/catalogs/other/1569E.pdf',
    },
  ],
};
export default part;
