import type { PartDefinition, Parameters } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import detail from '../manufactured-detail/part';
import { cylinder, subtract, type Shape } from '../../core/assembly/boundary/shapes';
import profile from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
export function toolsetterShape(p: Parameters): Shape {
  const contact = p.component === 'contact';
  const cuts: Shape[] = [];
  for (const x of [-15, 15]) {
    if (contact) {
      cuts.push(cylinder(1.7, 12, [x, 0, -1]));
      cuts.push(cylinder(3, 3.1, [x, 0, 7]));
    } else
      cuts.push({
        kind: 'cylinder',
        radius: 1.5,
        height: 6,
        origin: [x, 0, 2],
        axis: 'z',
        thread: { pitch: 0.5, internal: true, designation: 'M3' },
      });
  }
  if (contact)
    cuts.push({
      kind: 'cylinder',
      radius: 1.5,
      height: 6,
      origin: [0, -20, 5],
      axis: 'y',
      thread: { pitch: 0.5, internal: true, designation: 'M3' },
    });
  else cuts.push(cylinder(20.1, 2.1, [0, 0, 6]));
  return subtract(cylinder(contact ? 20 : 25, contact ? 10 : 8, [0, 0, 0]), ...cuts);
}
const recipe = (p: Parameters) => ({
  ...detail.defaults,
  recipe: JSON.stringify(toolsetterShape(p)),
});
const part: PartDefinition = {
  id: 'cnc-toolsetter-part',
  name: 'Flat toolsetter fabrication details',
  product: profile as ProductProfile,
  category: 'WORKSHOP TOOLS',
  subgroup: 'TOOL SETTING & PROBES',
  icon: 'circuit',
  complexity: 'Two machined details',
  description:
    'Conductive touch plate with insulating locating base. The reusable details make a removable flat Z probe.',
  keywords: ['CNC', 'toolsetter', 'probe', 'touch plate', 'POM'],
  defaults,
  parameters,
  presets,
  presetMatchKeys: ['component'],
  catalogSelection: [{ key: 'component' }],
  validate: (p) =>
    ['contact', 'insulator'].includes(String(p.component))
      ? []
      : ['Select a toolsetter fabrication detail.'],
  buildGeometry: (p, s) => detail.buildGeometry(recipe(p), s),
  buildExportGeometry: (p, s) => detail.buildExportGeometry!(recipe(p), s),
  dimensions: (p, s) => detail.dimensions(recipe(p), s),
  python: (p, s) => detail.python(recipe(p), s),
  assessment: (p) => [
    p.component === 'contact'
      ? 'Turn an aluminium 6061 disc D40 x10; two D3.4 mounting bores with D6 x3 socket-head counterbores and one blind radial M3 terminal thread.'
      : 'Turn a POM disc D50 x8; D40.2 x2 locating recess and two M3 blind holes at X +/-15 mm.',
    'Assemble contact at base Z6 with two M3 x10 socket screws. Calibrate the actual top-to-base height (nominal16 mm); keep the plate insulated from the metal table and connect through a current-limited probe input.',
    'Flat contact operation only. No spring overtravel or claimed probe repeatability. Remove from the cutting path after setting.',
  ],
  notes:
    'Own fabrication design corresponding to the supplier flat toolsetting option. Threaded POM fastening needs verified torque and retention. Wiring, strain relief and probing cycle require design release.',
  sources: [
    {
      label: 'Reference supplier flat and spring toolsetting options',
      url: 'https://cncmachines.com.ua/product/yastreb-8015-200/',
    },
  ],
};
export default part;
