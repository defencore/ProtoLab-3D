import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, updateParameters, catalogSelection } from './configurator';
import presets from './presets.json';
import { geometry, python, dimensions, errors } from './lib/thread';
const part: PartDefinition = {
  id: 'thread-tool',
  name: 'Thread tool for cut or union',
  category: 'FASTENERS & THREADS',
  subgroup: 'THREAD GEOMETRY',
  icon: 'bolt',
  complexity: 'Boolean Cut / Union',
  description:
    'Helical Boolean tools and finished round or hexagonal threaded caps and plugs, with an optional central through hole. Choose a thread size or enter custom dimensions.',
  keywords: [
    'thread',
    'threading',
    'boolean',
    'cut',
    'union',
    'fusion',
    'threads',
    'internal',
    'external',
    'M1',
    'M2',
    'Mx',
    'metric',
    'UNC',
    'UNF',
    'UNEF',
    '3/8',
    '24',
    'Tr',
    'ACME',
    'multi-start',
    'left hand',
    'cap',
    'plug',
    'hollow',
    'bore',
    'hexagonal',
  ],
  parameters,
  defaults,
  presets: presets as Preset[],
  updateParameters,
  catalogSelection,
  presetMatchKeys: ['family', 'diameter', 'pitch', 'pitchUnit', 'tpi'],
  states: [
    {
      id: 'external',
      label: 'External thread · tool / plug',
      description:
        'Threaded body: a Union tool. Round/hex form: a finished externally threaded plug with a head.',
    },
    {
      id: 'internal',
      label: 'Internal thread · cutter / cap',
      description:
        'Threaded body: a positive Cut tool. Round/hex form: a finished female threaded cap with a closed or drilled end.',
    },
  ],
  validate: errors,
  buildGeometry: geometry,
  python,
  dimensions,
  notes:
    'Export is one solid. Threaded-body form produces a Boolean tool; round/hex forms produce a finished cap (internal) or headed plug (external). Axis +Z, lower end Z=0. Cap end thickness adds to threaded length. The optional hole is axial: in a hollow Cut tool it leaves a central post in the target. For a normal threaded bore, disable the tool hole. Cap size is round diameter or hex across flats. No standard cap dimensions, fit class, rounded thread roots, runout or pipe taper are implied. Use Python/FCMacro or STEP for CAD Booleans; STL is a tessellated mesh.',
  sources: [
    ...new Map(
      presets.map((p) => [
        p.catalog.sourceUrl,
        { label: p.catalog.sourceName, url: p.catalog.sourceUrl },
      ]),
    ).values(),
  ],
};
export default part;
