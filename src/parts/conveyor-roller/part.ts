import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults } from './configurator';
import presets from './presets.json';
import { rollerPieces, rollerSpec } from './lib/model';
import { geometry, python } from './lib/assembly';
const part: PartDefinition = {
  id: 'conveyor-roller',
  name: 'Conveyor roller',
  category: 'MACHINE TOOLS',
  subgroup: 'MATERIAL HANDLING',
  description: 'Interroll 1700 passive rollers and EC5000 24 V powered belt rollers.',
  keywords: ['conveyor', 'roller', 'Interroll', '1700', 'EC5000'],
  icon: 'wheel',
  complexity: 'Purchased roller',
  parameters,
  defaults,
  presets: presets as Preset[],
  validate: (p) =>
    Number(p.installationLength) >= 200 && Number(p.installationLength) <= 600
      ? []
      : ['EL must be between 200 and 600 mm.'],
  buildGeometry: (p) => geometry(rollerPieces(p)),
  dimensions: (p) => [50, 50, Number(p.installationLength)],
  python: (p) => {
    const count = rollerPieces(p).length;
    return (
      python(rollerPieces(p)) +
      '\ncomponent_manufactured = [False]*' +
      count +
      '\ncomponent_groups = [["Purchased roller"]]*' +
      count
    );
  },
  assessment: (p) =>
    p.model === 'ec5000'
      ? [
          'EC5000 crowned roller: 24 V, 35 W selection; order AI control with DriveControl and compatible power supply.',
          'D50 sourced. Tube length and D12 shaft here reserve an installation envelope; confirm ordered length, crown and cable-side hex geometry before drilling.',
        ]
      : [
          `Order reference RL ${rollerSpec(p).referenceLength} mm; usable steel tube U ${rollerSpec(p).tubeLength} mm.`,
          'Visible pieces belong to one purchased roller. Supplier ratings do not establish machine capacity.',
        ],
  notes:
    'Confirm the D12 female-thread shaft option on the purchase order. Simplified bearing housings are for clearance planning, not manufacture.',
  sources: [
    {
      label: 'Interroll EC5000 crowned belt-conveyor roller',
      url: 'https://www.interroll.com/products/rollerdrive/ec5000-crowned-0c-to-40c',
    },
    {
      label: 'Interroll Series 1700, January 2026',
      url: 'https://www.interroll.com/fileadmin/products/product_data/Roller-series-1700/Series_1700_EN.pdf',
    },
    {
      label: 'Interroll shaft connection variants',
      url: 'https://www.interroll.com/fileadmin/user_upload/PDF/Interroll_ConveyorRollers_us_1.pdf',
    },
  ],
};
export default part;
