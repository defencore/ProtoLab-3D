import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import * as assembly from '../../core/assembly/boundary/assembly';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { pieces, dimensions, selectedModel } from './lib/model';
import product from './product.json';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'adhesive-antenna',
  name: 'Adhesive antenna',
  category: 'ELECTRONICS & VISION',
  subgroup: 'RADIO MODULES',
  icon: 'circuit',
  preview: 'worker',
  complexity: 'JCG108 · dual band',
  product: product as ProductProfile,
  description:
    'Jinchang JCG108 adhesive I-bar antenna with 3 m or 5 m RG174 lead. Nominal source-dimensioned housing reference; undimensioned details and connector execution remain unresolved.',
  validationNotice:
    'Housing reference: nominal outside dimensions are sourced; contour details, cable and connector geometry remain unverified.',
  keywords: [
    'Jinchang',
    'JC Antenna',
    'JCG108',
    'GSM',
    '4G',
    'LTE',
    'antenna',
    'I-bar',
    '824',
    '960',
    '1710',
    '2170',
    '2.5dBi',
    'SMA',
    'RG174',
    'adhesive',
  ],
  defaults,
  parameters,
  catalogFilterFields,
  catalogSelectionOnly: true,
  presets: presets as Preset[],
  presetMatchKeys: ['model'],
  validate(p, state) {
    const errors: string[] = [];
    if (!presets.some((preset) => preset.parameters.model === p.model))
      errors.push('Select a supported Jinchang JCG108 reference execution.');
    for (const key of Object.keys(p))
      if (key !== 'model')
        errors.push(`Supplier dimensions are fixed; unsupported antenna setting: ${key}.`);
    if (state !== 'default') errors.push('This antenna reference only supports the default state.');
    return errors;
  },
  buildGeometry: (p) => assembly.geometry(pieces(p)),
  buildExportGeometry: (p) => assembly.geometry(pieces(p)),
  python: (p) => assembly.python(pieces(p)),
  dimensions,
  assessment(p) {
    const model = selectedModel(p);
    return [
      `JCG108: one complete supplier antenna; drawing lead length L=${model.catalog.attributes.leadLength / 1000} m, measured from the lower central housing datum to the connector tip. No cut-coax length tolerance or exact connector order execution is specified.`,
      'Nominal housing dimensions X126 × Y16.2 × Z8.6 mm; main housing span 15.5 mm. Drawing tolerances: length ±2 mm, the three cross-section dimensions ±1 mm. Geometry is nominal and does not include the tolerance envelope.',
      'Tapered shallow curved outline, corner radii, body depth away from the boss and boss diameter are drawing-traced approximations. Cable, strain relief, adhesive layer, connector and internal PCB are omitted.',
      'Published bands are 824–960 and 1710–2170 MHz, not continuous coverage between them. Manufacturer page markets 4G while the PDF says GSM. Do not infer additional LTE bands or equivalence to JCG108L or Data Alliance A2P3.',
      'Connector is published as SMA or others; gender, polarity and exact mating geometry are unknown. Resolve the ordered connector and mechanical interfaces before fitted installation or production release.',
    ];
  },
  notes:
    'Engineering reference, not original manufacturer CAD or a complete accurate antenna model. A valid native solid verifies only this nominal housing approximation. The four sourced housing extrema are retained; undimensioned outline/radii/boss and local depth are approximate. No mass, internal structure, cable route, adhesive stack or SMA/RP-SMA gender/polarity is inferred. The whole antenna, lead and fitted plug remain one supplier unit. See GUIDE.md for source hashes, drawing datums and unresolved evidence.',
  sources: [
    {
      label: 'Jinchang JCG108 manufacturer product page',
      url: 'https://www.jinchanggps.com/JCG108-4G-Antenna-pd46421675.html',
    },
    {
      label: 'Original JCG108 manufacturer datasheet',
      url: 'https://rnrorwxhqioplk5p.ldycdn.com/JCG108-aidqkBpmKjiRliSkjorpnllj.pdf',
    },
    {
      label: 'Original JCG108 dimension drawing',
      url: 'https://iororwxhqioplk5p.ldycdn.com/cloud/qmBpmKjiRliSkjormnlmj/JCG108.png',
    },
    {
      label: 'Retained manufacturer dimension drawing',
      url: 'references/antennas/jinchang-jcg108.png',
    },
  ],
};
export default part;
