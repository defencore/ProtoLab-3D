import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import * as assembly from '../../core/assembly/boundary/assembly';
import { defaults, parameters, catalogFilterFields } from './configurator';
import profile from './product.json';
import presets from './presets.json';
import { encoderSpec, encoderDrawingSource, encoderExecutions } from './lib/specs';
import { encoderPieces } from './lib/model';
export {
  encoderSpec,
  encoderDrawingSource,
  encoderExecutions,
  encoderPieces,
  defaults as encoderDefaults,
};
export function encoderParameters(
  model: string,
  component = 'assembly',
  headPosition = 0,
): Parameters {
  return { ...defaults, model, component, headPosition };
}
const part: PartDefinition = {
  id: 'cnc-linear-encoder',
  product: profile as ProductProfile,
  name: 'HEIDENHAIN LS 477 linear encoder and MSL 41 spar',
  category: 'ELECTRONICS & VISION',
  subgroup: 'SENSORS & SWITCHES',
  icon: 'rail',
  complexity: 'Source-identified purchased linear measurement kit',
  description:
    'Authentic TTL differential linear scales with separately ordered mounting spars and independent physical readhead poses.',
  keywords: [
    'HEIDENHAIN',
    'LS477',
    'MSL41',
    'linear encoder',
    'TTL',
    'CNC',
    'feedback',
    'CN5',
    'scale',
  ],
  parameters,
  defaults,
  presets: presets as Preset[],
  catalogFilterFields,
  catalogSelectionOnly: true,
  catalogSelection: [{ key: 'model' }],
  presetMatchKeys: ['model'],
  validate: (p) => {
    let s;
    try {
      s = encoderSpec(p);
    } catch {
      return ['Select an identified HEIDENHAIN execution.'];
    }
    const errors: string[] = [];
    if (!['assembly', 'scale', 'readhead'].includes(String(p.component)))
      errors.push('Select a supported inspection component.');
    if (s.kind === 'spar' && p.component !== 'assembly')
      errors.push('A separately ordered MSL 41 uses the complete purchased unit inspection role.');
    const shift = Number(p.headPosition);
    if (!Number.isFinite(shift) || Math.abs(shift) > s.measuringLength / 2)
      errors.push(
        'The readhead inspection displacement must remain inside the selected measuring travel.',
      );
    return errors;
  },
  buildGeometry: (p) => assembly.geometry(encoderPieces(p)),
  buildExportGeometry: (p) => assembly.geometry(encoderPieces(p)),
  dimensions: (p) => assembly.dimensions(encoderPieces(p)),
  python: (p) => {
    const s = encoderSpec(p),
      pieces = encoderPieces(p);
    return (
      assembly.python(pieces) +
      '\ncomponent_manufactured = [False]*len(components)\ncomponent_metadata = ' +
      JSON.stringify(
        pieces.map((piece) => ({
          PurchasedUnit: s.designation,
          IncludedInspectionRole: String(p.component),
          SupplierSource: s.source,
          MountingDrawingSource: encoderDrawingSource,
          GeometryLimitations:
            'Source envelopes and mounting centers; spar clamp/profile, head flange and socket contours reconstructed. No supplier internal structure or unpublished threads are invented.',
          MeasurementInterface:
            s.kind === 'encoder' ? s.output : 'Separately ordered source mounting spar',
          FeedbackAcceptance:
            'Delivered execution/certificate, signal polarity/electronic gearing, homing, laser map and tool-position error must be qualified.',
          InspectionComponent: piece.label,
        })),
      )
    );
  },
  assessment: () => [
    'Factory accuracy +/-3 um and evaluated measuring step do not certify +/-0.025 mm finished-part tolerance.',
    'DDCS step/direction commands do not read these scales. An explicitly configured Delta A3-M full-closed-loop drive uses the TTL signals at CN5.',
    'Order the matching mounting spar separately and verify delivered instructions, readhead plane, cable route and source clamping hardware before releasing brackets.',
    'The source IP53 installation rating requires correct mounting; IP64 requires the specified compressed-air protection. Shield against chips/coolant and thermal gradients.',
  ],
  notes:
    'LS 477 supplies complementary TTL A,/A,B,/B,Z,/Z at 5 V, not a 1 Vpp LS 487 signal. Models identify exact factory IDs with +/-3 um grade and 5x/10x interpolation. Housing, head and separately ordered MSL 41 share measurement-axis X, housing-midpoint X0, housing rear Y0/bottom Z0. Readhead left datum at mid stroke is X-52.5; hole centers X-40.5/+15.5, Z-4 are not centered around X0. Simple and Full retain identical nominal supplier envelopes because no published thread profile or internal manufacturing recipe is available. Reconstructed local contours do not replace supplier CAD or mounting instructions. The selected factory accuracy must be confirmed by order and acceptance, and does not prove finished-part tolerance.',
  sources: [
    {
      label: 'HEIDENHAIN source dimensions and installation requirements, printed pages 38-39',
      url: encoderDrawingSource,
    },
    ...encoderExecutions.map((s) => ({ label: s.designation, url: s.source })),
  ],
};
export default part;
