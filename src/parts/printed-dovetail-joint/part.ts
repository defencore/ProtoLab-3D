import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import profile from './product.json';
import presets from './presets.json';
import { defaults, parameters, catalogSelection } from './configurator';
import { layout, composition, geometry, python, dimensions } from './lib/model';

const part: PartDefinition = {
  id: 'printed-dovetail-joint',
  name: 'Printed dovetail joint',
  category: 'FASTENERS & THREADS',
  subgroup: 'PRINTED JOINTS',
  product: profile as ProductProfile,
  icon: 'bracket',
  complexity: 'Parametric print calibration pair',
  description:
    'Two printable coupons with a true trapezoidal sliding key, normal flank clearance and open-ended receiver.',
  keywords: ['3D printing', 'FDM', 'FFF', 'dovetail', 'sliding joint', 'clearance', 'fit coupon'],
  defaults,
  parameters,
  presets: presets as Preset[],
  presetMatchKeys: ['length', 'width', 'tongueWidth', 'tongueHeight', 'clearance'],
  catalogSelection,
  composition,
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description:
        'Mating coupons at the canonical installed placement; Y is the open insertion axis.',
    },
    {
      id: 'exploded',
      label: 'Separated along insertion axis',
      description:
        'Receiver slid clear along +Y for inspection; physical composition stays unchanged.',
    },
    {
      id: 'print',
      label: 'For 3D printing',
      description: 'Two separate coupons on Z=0 with flat outer bases down and an 8 mm bed gap.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'exploded', 'print'].includes(state))
      errors.push('Choose a supported joint state.');
    if (
      parameters.some(
        (field) =>
          typeof p[field.key] !== 'number' ||
          !Number.isFinite(p[field.key]) ||
          Number(p[field.key]) < field.min! ||
          Number(p[field.key]) > field.max!,
      )
    )
      return [...errors, 'Joint dimensions must be finite numbers inside their supported ranges.'];
    const d = layout(p);
    if (d.width / 2 - d.slotTop < d.base)
      errors.push(
        'Increase coupon width or reduce the tongue to retain at least one base thickness beside each groove flank.',
      );
    if (d.head <= d.neck) errors.push('Dovetail head width must exceed the tongue neck width.');
    if (d.height <= d.clearance || (d.head - d.neck) / 2 <= d.slope * d.clearance + d.flankOffset)
      errors.push(
        'Increase the dovetail undercut or reduce clearance to retain positive flank capture.',
      );
    return errors;
  },
  buildGeometry: (p, s) => geometry(p, s),
  buildExportGeometry: (p, s) => geometry(p, s, true),
  python,
  dimensions,
  assessment(p) {
    const d = layout(p);
    return [
      `Engagement length ${d.length} mm; mating clearance ${d.clearance} mm. Clearance is normal to each sloping flank and vertical at the base and groove roof.`,
      'Dovetail captures separation along Z; translation along Y remains free and requires an additional end stop when needed.',
      'Selected dimensions are calibration examples. Print both coupons, measure fit and qualify material, process orientation, temperature, wear and project loads.',
    ];
  },
  validationNotice: 'Calibration pair: qualify the printed fit and project loads before reuse.',
  notes:
    'The constant XZ section slides through either open Y end. Print the male outer base down and the receiver outer roof down using the print state. Sloping groove faces and sharp corners need slicer review and process qualification. No axial stop, preload or load rating is included.',
  sources: [
    {
      label: 'Formlabs: process and material considerations for printed mating joints',
      url: 'https://formlabs.com/blog/designing-3d-printed-snap-fit-enclosures/',
    },
  ],
};
export default part;
