import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import profile from './product.json';
import data from './presets.json';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { validateStandoff, geometry, python, dimensions } from '../pcb-standoff/lib/model';
const presets = data as Preset[];
const part: PartDefinition = {
  id: 'pcb-standoff-insert',
  browseFamily: { id: 'spacers-standoffs', label: 'Spacers & standoffs' },
  product: profile as ProductProfile,
  name: 'PCB standoff with metal insert',
  category: 'FASTENERS & THREADS',
  subgroup: 'SPACERS & STANDOFFS',
  icon: 'bolt',
  description:
    'One complete supplier polymer standoff with metal insert, preserving source-qualified interfaces and installation geometry.',
  complexity: 'Fixed supplier assembly SKU',
  keywords: ['PCB', 'standoff', 'insert', 'nylon', 'polyamide', 'brass', 'DREMEC'],
  defaults,
  parameters,
  presets,
  catalogSelectionOnly: true,
  catalogFilterFields,
  presetMatchKeys: ['catalogItem'],
  validate: (p) => validateStandoff(p, presets, true),
  buildGeometry: (p) => geometry(p, true),
  python: (p) => python(p, true),
  dimensions,
  notes:
    'Procure the complete supplier unit. Internal insert solids are shown only where their outside dimensions and spans are explicitly defined; otherwise one honest installation envelope represents the complete assembly. Cylindrical insert seats do not establish a press fit, knurl or retention strength. Simple/Full applies only to authored thread pitch and real spans; unpublished blind-hole depths and self-tapping profiles remain nominal and clearly annotated. Appearance does not verify the material.',
};
export default part;
