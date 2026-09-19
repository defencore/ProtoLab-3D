import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, updateParameters, catalogSelection } from './configurator';
import presets from './presets.json';
import { geometry, python, values, errors } from './lib/thread';
const part: PartDefinition = {
  id: 'thread-tool',
  name: 'Thread tool for cut or union',
  category: 'FASTENERS & THREADS',
  subgroup: 'THREAD GEOMETRY',
  icon: 'bolt',
  complexity: 'Boolean Cut / Union',
  description:
    'Closed helical solids for FreeCAD: fuse an external thread onto a part or subtract an internal-thread cutter. Choose a catalog size or enter custom dimensions.',
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
      label: 'External · Union',
      description:
        'Fuse this threaded solid into your part with a positive volume overlap. It does not cut an existing oversized shaft.',
    },
    {
      id: 'internal',
      label: 'Internal · Cut',
      description:
        'Subtract this positive cutter from your part to make a threaded hole. Both the core bore and helical groove are removed.',
    },
  ],
  validate: errors,
  buildGeometry: geometry,
  python,
  dimensions(p, state) {
    const v = values(p, state);
    return [v.major * 2, v.major * 2, v.length];
  },
  notes:
    'Export is one solid tool, not a screw assembly or a finished nut. Axis +Z, lower end Z=0. In FreeCAD place it with Placement; for a hole select the target first, tool second, then Part → Boolean → Cut. For an external thread use Part → Boolean → Union with a positive overlap at the base; a full-size shaft through the thread would fill its grooves. Extend a through-hole cutter beyond both target faces. Metric/UN profiles have flat root truncations; Tr/ACME use basic profiles without standard root clearance. No ISO 6g/6H or ASME 2A/2B fit class, rounded roots, runout or tapered pipe threads are implied. Radial fit adjustment is a per-tool design allowance. Use Python/FCMacro or STEP for CAD Booleans; STL is a tessellated mesh.',
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
