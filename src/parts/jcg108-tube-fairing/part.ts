import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters, catalogSelection } from './configurator';
import { configuredPieces, libraries } from './lib/model';
import { fairingSpec } from './lib/fairing';
import profile from './product.json';
import presets from './presets.json';

const states = [
  {
    id: 'assembled',
    label: 'On pipe',
    description:
      'Fairing, unchanged source antenna and nominal anchor interfaces on an extended Ø90/86 pipe.',
  },
  {
    id: 'fairing-only',
    label: 'Fairing only',
    description: 'The standalone freeform shell in its installed coordinate system.',
  },
  {
    id: 'print-only',
    label: 'Supported printing pose',
    description:
      'The reference fairing alone, exterior upward and yawed 45°; underside supports and qualification remain necessary.',
  },
];

export function validate(p: Parameters, state: string): string[] {
  const errors: string[] = [];
  if (!states.some((s) => s.id === state)) errors.push('Select an implemented reference view.');
  for (const field of parameters) {
    const value = p[field.key];
    if (
      field.type === 'number' &&
      (typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < field.min! ||
        value > field.max!)
    )
      errors.push(`${field.label} must be within its stated range.`);
    if (field.type === 'boolean' && typeof value !== 'boolean')
      errors.push(`Choose ${field.label.toLowerCase()}.`);
    if (field.type === 'select' && !field.options?.some((v) => v.value === value))
      errors.push(`Choose ${field.label.toLowerCase()}.`);
  }
  if (Object.keys(p).some((key) => !(key in defaults)))
    errors.push('Remove unsupported fairing parameters.');
  if (!errors.length && Number(p.antennaY) + Number(p.antennaHole) / 2 > -8.9)
    errors.push(
      'Keep the complete cable opening at least 0.3 mm beside the maximum source housing footprint.',
    );
  return errors;
}

const part: PartDefinition = {
  id: 'jcg108-tube-fairing',
  name: 'Tube antenna fairing',
  category: 'ENCLOSURES & DEVICES',
  subgroup: 'GENERAL-PURPOSE ENCLOSURES',
  icon: 'box',
  description:
    'Preserved 314.8 mm conformal fairing concept for a directly adhered Jinchang JCG108 antenna on a Ø90 tube. Independent engineering reference for future development.',
  complexity: 'JCG108 · Ø90 · design study',
  preview: 'worker',
  product: profile as ProductProfile,
  validationNotice:
    'Engineering reference: native geometry validity does not establish aerodynamic, thermal, structural or production readiness at 300 m/s.',
  keywords: [
    'antenna',
    'fairing',
    'shroud',
    'Jinchang',
    'JCG108',
    'tube',
    'pipe',
    'aerodynamic',
    'conformal',
    '300 m/s',
    'future concept',
  ],
  defaults,
  parameters,
  catalogSelection,
  presets: presets as Preset[],
  states,
  presetMatchKeys: ['antennaModel', 'airflowDirection'],
  identityParameters(p) {
    const { showTube: _tube, showAntenna: _antenna, ...physical } = p;
    return physical;
  },
  validate,
  buildGeometry: (p, state) => componentGeometry(libraries, configuredPieces(p, state)),
  buildExportGeometry: (p, state) => componentGeometry(libraries, configuredPieces(p, state), true),
  python: (p, state) => componentPython(libraries, configuredPieces(p, state)),
  dimensions: (p, state) => componentDimensions(libraries, configuredPieces(p, state)),
  exportDimensions: (p, state) => componentDimensions(libraries, configuredPieces(p, state)),
  assessment(p) {
    const s = fairingSpec(p);
    return [
      `Retained concept: ${s.totalLength} mm long, ${s.noseLength} mm nose and ${s.tailLength} mm tail, ${s.apexAbovePipe.toFixed(2)} mm nominal centre projection. Flow: ${s.flowDirection}.`,
      `The unchanged adhesive-antenna:${String(p.antennaModel)} source reference is placed at back-plane radius ${s.backPlaneRadius.toFixed(2)} mm. Mounting contact depth ${s.measuredDepth.toFixed(2)} mm is a delivered-part measurement, not a source-model resize.`,
      'The principal shape is a genuine B-spline loft cut by native cylinders. The nominal 1 mm authored termination is fully tube-supported and needs native interpolation checks and edge bonding/finishing. It is not tangent to the bare tube at its final seam.',
      'The 4.2 mm cable corridor is an assumed service void, not a sourced boot or cable bend model. Prethread the actual connector before cap installation.',
      'No CFD, wind-tunnel, thermal, material or structural qualification is claimed. The two nominal flush anchor interfaces do not include their host captive-nut support.',
      'This standalone reference is excluded from procurement and is not included in the Grandado mounting kit.',
    ];
  },
  notes:
    'Preserved future design reference, not a manufacturing release or speed rating. The JCG108 source housing, lead execution and identity are reused without resizing. See GUIDE.md for the retained design, native geometry repair, assumptions and remaining verification.',
  sources: [
    {
      label: 'Jinchang JCG108 manufacturer datasheet',
      url: 'https://rnrorwxhqioplk5p.ldycdn.com/JCG108-aidqkBpmKjiRliSkjorpnllj.pdf',
    },
    { label: 'Retained JCG108 dimension drawing', url: 'references/antennas/jinchang-jcg108.png' },
  ],
};
export default part;
