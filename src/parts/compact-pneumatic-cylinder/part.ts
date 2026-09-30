import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults } from './configurator';
import presets from './presets.json';
import { cylinderSpec, cylinderPieces } from './lib/model';
import { geometry, python } from './lib/assembly';
const part: PartDefinition = {
  id: 'compact-pneumatic-cylinder',
  name: 'Compact pneumatic cylinder',
  category: 'PNEUMATICS & GAS',
  subgroup: 'CYLINDERS',
  description: 'AirTAC ACE32 / ACE50 double-acting compact cylinder with female-thread piston rod.',
  keywords: ['AirTAC', 'ACE32', 'ACE50', 'pneumatic', 'clamp'],
  icon: 'box',
  complexity: 'Source-based cylinder',
  parameters,
  defaults,
  presets: presets as Preset[],
  validate: (p) =>
    [32, 50].includes(Number(p.bore)) &&
    [25, 50, 100, 200].includes(Number(p.stroke)) &&
    Number(p.extension) >= 0 &&
    Number(p.extension) <= Number(p.stroke)
      ? []
      : ['Choose stroke 25, 50, 100 or 200 and extension within the selected stroke.'],
  buildGeometry: (p) => geometry(cylinderPieces(p)),
  dimensions: (p) => {
    const s = cylinderSpec(p);
    return [s.width, s.width, s.body + s.projection + s.extension];
  },
  python: (p) => {
    const pieces = cylinderPieces(p);
    return (
      python(pieces) +
      `
component_manufactured = [False]*${pieces.length}
component_groups = [["Pneumatic cylinder"]]*${pieces.length}`
    );
  },
  assessment: (p) => [
    `Theoretical extension force at 6 bar: ${((0.6 * Math.PI * Number(p.bore) ** 2) / 4).toFixed(1)} N; this is not a rated fixture holding force.`,
    'Guide the moving shoe externally. Do not transmit cutting side loads through the piston rod.',
  ],
  notes:
    'Purchased pressure component; barrel, separate end caps, guide gland, ports and threaded rod socket are shown; internal pressure seals and piston remain hidden. No fabricated pressure vessel is supplied.',
  sources: [
    {
      label: 'AirTAC ACE dimensions, page 110',
      url: 'https://as-en.airtac.com/upload/TACE-202003240444019596.PDF',
    },
  ],
};
export default part;
