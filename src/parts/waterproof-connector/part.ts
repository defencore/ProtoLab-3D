import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { Mesh } from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import * as assembly from '../../core/assembly/boundary/assembly';
import { conformPrecisionMesh } from '../../core/assembly/precision-mesh';
import { defaults, parameters, catalogFilterFields } from './configurator';
import {
  drawingUrl,
  sp16DrawingUrl,
  sp16ContactsUrl,
  sp20ThreeDrawingUrl,
  sp20ThreeContactsUrl,
  findModel,
  models,
} from './lib/catalog';
import { pieces, housingProfile } from './lib/model';
import product from './product.json';
import presets from './presets.json';

const geometry: PartDefinition['buildGeometry'] = (parameters, state) => {
  const model = conformPrecisionMesh(assembly.geometry(pieces(parameters, state)));
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const original = child.geometry;
    child.geometry = toCreasedNormals(original, Math.PI / 6);
    original.dispose();
  });
  return model;
};

const part: PartDefinition = {
  id: 'waterproof-connector',
  name: 'SP waterproof connectors',
  category: 'CONNECTORS & INTERFACES',
  subgroup: 'POWER & INDUSTRIAL',
  icon: 'circuit',
  preview: 'worker',
  complexity: 'SP16 · 5 contacts / SP20 · 2 / 3 / 4 / 6 contacts',
  product: product as ProductProfile,
  description:
    'Source-dimension SP16 five-contact and SP20 two-, three-, four- and six-contact connectors. Each straight cable half or panel half includes its housing, coupling or retaining nut, seals and the selected contact pattern. Supplier links identify complete matching kits.',
  keywords: [
    'SP16',
    'SP16-5',
    'SP20',
    'SP20-3',
    'SP20-2',
    'SP20-4',
    'SP20-6',
    'waterproof',
    'sealed',
    'plug',
    'socket',
    'male',
    'female',
    'panel',
    'cable',
    'round',
    'aviation',
    'connector',
    'M20',
    'IP68',
    '2 pin',
    '3 pin',
    '5 pin',
    '4 pin',
    '6 pin',
  ],
  defaults,
  parameters,
  catalogFilterFields,
  catalogSelectionOnly: true,
  presets: presets as Preset[],
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Installed hardware',
      description:
        'Selected connector half; panel nut follows the host panel thickness. The supplied protective cap is omitted.',
    },
    {
      id: 'exploded',
      label: 'Hardware inspection',
      description:
        'Separate coupling / gland nuts or panel nut and seal without changing the selected physical product.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!findModel(p.model)) errors.push('Choose a supported SP16 or SP20 connector model.');
    if (
      typeof p.panelThickness !== 'number' ||
      !Number.isFinite(p.panelThickness) ||
      p.panelThickness < 0.8 ||
      p.panelThickness > 4
    )
      errors.push('Choose an installation panel thickness between 0.8 and 4 mm.');
    for (const key of Object.keys(p))
      if (!['model', 'panelThickness'].includes(key))
        errors.push(`Unsupported SP connector setting: ${key}.`);
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Choose a supported SP connector hardware view.');
    return errors;
  },
  buildGeometry: geometry,
  buildExportGeometry: geometry,
  python: (p, s) => assembly.python(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  assessment(p) {
    const model = findModel(p.model);
    if (!model) return [];
    const d = housingProfile(model);
    return [
      `${model.designation}. Source supplier kit ${model.kitCode} contains both matching halves; separate-half availability is unverified. Manufacturer is not identified.`,
      `The supplier family table gives ${model.contacts} contacts and nominal mating diameter ${model.contactDiameter} mm. Contact numbering, pitch, cup geometry and engagement depths are illustrative.`,
      model.housing === 'panel-socket'
        ? `Source housing drawing: 22 mm body, maximum collar diameter ${2 * d.collarRadius} mm, nominal Ø${2 * d.mountRadius} mounting barrel. Rear flange seat is Z=0 and +Z faces outside; the approximate body occupies Z=−8..+14 mm, with illustrative solder cups to −15 mm. Panel ${p.panelThickness} mm sets the retaining nut position only.`
        : `Source drawing: ${d.plugLength} mm plug length and ${model.series === 'SP16' ? 'Ø8 / PG9 entry' : '8–12 mm cable range / PG13.5 entry'}. The model occupies Z=−${d.plugLength}..0 mm; the protective shroud is at the front and the contact tips are recessed. Body diameters and axial subdivisions are approximate.`,
      `Source panel opening: Ø${d.panelOpening} mm with two opposing flats, ${d.panelFlats} mm across flats. The flats face ±Y. The mounting barrel is nominal Ø${2 * d.mountRadius}; threaded surfaces, nut profiles and barrel flat clearances are approximate. Helices are omitted.`,
      'No protective cap, tether, cable, host panel or soldered wires are represented. Measure these spaces separately. This model does not establish mating interchangeability with SP21 or any other supplier family.',
      'The supplier advertises IP68; no immersion depth, duration, electrical qualification or assembled enclosure protection is established by this geometry. Electrical ratings are intentionally absent from searchable attributes because suppliers conflict.',
    ];
  },
  notes:
    'Analytical source-dimension library models, not manufacturer CAD. SP16-5 uses its own supplier drawing: 60 mm plug, 22 mm socket body, Ø25 collar, nominal Ø16 barrel and Ø16.5 panel opening with 15.3 mm opposing flats. SP20 uses a 66 mm plug, 22 mm body, Ø29 collar and Ø20.5 opening with 19.5 mm opposing flats. Contact counts, topology and nominal mating diameters follow the selected supplier table: SP16-5 Ø1; SP20-2/3/4 Ø2.8; SP20-6 Ø1.8. Contact pitch, axial splits, keys, nuts, seal details, barrel-flat clearance and engagement are authored approximations. Socket solder cups extend beyond the 22 mm body. Protective caps, tethers, wires and cable are omitted. The manufacturer is unidentified. These are unbranded SP16/SP20 executions, not substitutions for WEIPU SP17/SP21. No thread fit, electrical qualification or completed-enclosure IP certification is established. Supplier listings sell kits; individual-half names are library configuration identities, not confirmed separate order codes.',
  sources: [
    ...models
      .filter((model) => model.housing === 'panel-socket')
      .map((model) => ({
        label: `Kladova Maistra ${model.series}-${model.contacts} kit ${model.kitCode}`,
        url: model.sourceUrl,
      })),
    { label: 'SP16 supplier housing drawing', url: sp16DrawingUrl },
    { label: 'SP16 contact topology and diameters', url: sp16ContactsUrl },
    {
      label: 'SP16 mating-face photograph / female panel and male cable contacts',
      url: 'https://klmaster.com/files/goods/182/big_germetichnyy_razem_sp16_5_pin_ip68_komplekt.jpg',
    },
    { label: 'SP20-3 supplier housing drawing', url: sp20ThreeDrawingUrl },
    { label: 'SP20-3 contact topology and diameters', url: sp20ThreeContactsUrl },
    {
      label: 'SP20 shared housing drawing embedded by the supplier in all three kit pages',
      url: drawingUrl,
    },
    {
      label: 'SP20 contact layouts and nominal diameters — supplier family table',
      url: 'https://klmaster.com/files/goods/707/gallery/germetichnyy_razem_sp20_6_pin_ip68_komplekt_1.jpg',
    },
  ],
};
export default part;
