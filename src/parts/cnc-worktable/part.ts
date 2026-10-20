import type { PartDefinition, Preset, Parameters } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import manufactured from '../manufactured-detail/part';
import product from './product.json';
import { parameters, defaults, catalogSelection } from './configurator';
import presets from './presets.json';
import {
  worktableLayout,
  worktableShape,
  worktableParameters,
  worktableRibPassages,
} from './lib/layout';
export { worktableLayout, worktableParameters, worktableRibPassages };
const recipe = (p: Parameters) => ({
  ...manufactured.defaults,
  recipe: JSON.stringify(worktableShape(p)),
});
const part: PartDefinition = {
  id: 'cnc-worktable',
  product: product as ProductProfile,
  name: 'Worktable and coolant tray details',
  category: 'STRUCTURAL PARTS',
  subgroup: 'WORK SURFACES & TRAYS',
  icon: 'bracket',
  preview: 'worker',
  description:
    'Manufacturable T-slot slats, chipboard and vacuum surfaces, and individual tray/tank details. Geometry is an explicit DIY design; vendor surface options are reference classes.',
  complexity: 'Machined and bent details',
  keywords: ['CNC', 'milling', 'metal', 'T-slot', 'worktable', 'coolant', 'vacuum'],
  parameters,
  defaults,
  catalogSelection,
  presets: presets as Preset[],
  presetMatchKeys: ['component', 'length', 'width', 'thickness'],
  updateParameters: (p, key) =>
    key === 'component' ? worktableParameters(String(p.component)) : p,
  validate(p) {
    const numeric = parameters.filter((d) => d.type === 'number');
    if (
      numeric.some(
        (d) =>
          !Number.isFinite(Number(p[d.key])) ||
          Number(p[d.key]) < Number(d.min) ||
          Number(p[d.key]) > Number(d.max),
      )
    )
      return ['Keep all dimensions within the finite fabrication limits.'];
    const v = worktableLayout(p),
      errors: string[] = [];
    try {
      worktableRibPassages(p);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Invalid fixed-rib passages.');
    }
    if (!parameters[0].options!.some((o) => o.value === v.role))
      errors.push('Select an implemented worktable detail.');
    if (
      !['pan-side', 'pan-end'].includes(v.role) &&
      v.width <= 2 * Number(p.edgeMount) + Number(p.mountBoltDiameter) + 2
    )
      errors.push('Mounting rows need adequate edge clearance.');
    if (['slat', 't-track'].includes(v.role)) {
      if (Number(p.slotWidth) <= Number(p.slotOpening))
        errors.push('T-slot cavity must be wider than its opening.');
      if (Number(p.slotDepth) <= Number(p.slotHeight) || Number(p.slotDepth) >= v.thickness - 3)
        errors.push('Slots need a positive neck and at least 3 mm of floor.');
      if (
        v.role === 'slat' &&
        (Number(p.slotSpacing) <= Number(p.slotWidth) + 4 ||
          Number(p.slotSpacing) + Number(p.slotWidth) >= v.width - 6)
      )
        errors.push('Two slots must fit with continuous side and middle webs.');
      if (
        v.holes.some(
          (h) =>
            h.depth > v.thickness - Number(p.slotDepth) - 2 &&
            v.slots.some(
              (x) => Math.abs(h.center[0] - x) < Number(p.slotWidth) / 2 + h.diameter / 2 + 2,
            ),
        )
      )
        errors.push('Mounting holes must leave a continuous web beneath the T-slot cavities.');
    }
    if (v.role === 'hybrid-board' && (v.thickness < 18 || Number(p.slotSpacing) < 40))
      errors.push('The chipboard recesses require at least 18 mm stock and 40 mm track pitch.');
    if (v.role === 'vacuum-plate' && (v.width < 100 || v.length < 100))
      errors.push('The vacuum distribution and closed seal need a surface at least 100 by 100 mm.');
    if (v.role === 'filter-basket' && v.width * v.length > 100000)
      errors.push(
        'Select a chip filter plate no larger than 100000 square mm; use several plates for larger areas.',
      );
    if (['slat', 'vacuum-plate'].includes(v.role) && v.thickness < 15)
      errors.push('Metal threaded surfaces require at least 15 mm stock.');
    if (![4, 5, 6, 8, 10, 12].includes(Number(p.mountBoltDiameter)))
      errors.push('Select an implemented metric mounting thread diameter.');
    if (
      v.role === 'tank-body' &&
      (v.width < 2 * v.thickness + 20 || v.length < 2 * v.thickness + 20)
    )
      errors.push('Tank walls must leave an open internal volume.');
    if (
      ['pan-side', 'pan-end'].includes(v.role) &&
      (Number(p.bendRadius) + v.thickness >= 18 ||
        Number(p.bendRadius) + v.thickness >= v.width - 4)
    )
      errors.push('The bend needs straight flange and wall material beyond its outer radius.');
    if (v.role === 'pan-floor' && Number(p.supportSpacing) >= v.width - 80)
      errors.push('Floor hangers need adequate side-wall clearance.');
    return errors;
  },
  buildGeometry: (p, s) => manufactured.buildGeometry(recipe(p), s),
  buildExportGeometry: (p, s) => manufactured.buildExportGeometry!(recipe(p), s),
  dimensions: (p, s) => manufactured.dimensions(recipe(p), s),
  python: (p, s) =>
    manufactured.python(recipe(p), s) +
    (Number(p.threadFitAllowance) > 0
      ? '\nfor record in component_metadata:\n    record.update(' +
        JSON.stringify({
          ThreadInspectionRadialAllowanceMM: String(p.threadFitAllowance),
          ThreadInspectionFitBasis:
            'Authored CAD mating allowance; nominal thread designation is unchanged. This is not a released ISO tolerance class or a tap-drill diameter.',
        }) +
        ')\n'
      : ''),
  assessment: (p) => [
    String(p.component) === 'slat'
      ? 'Mill the aluminium slat from solid stock; T-slots stay open at both ends for inserting matched nuts. Blind underside mounting threads are independent of the slots.'
      : 'Use the material and manufacturing route specified for this selected detail.',
    'This is a dimensioned DIY component, not an undisclosed factory drawing. The source offers chipboard, T-track, aluminium, coolant and vacuum surface classes.',
    'Chipboard and vacuum workholding do not establish suitability for wet metal cutting. Metal milling uses mechanical clamps and the aluminium table with a sealed drained tray.',
    ...(worktableRibPassages(p).length
      ? [
          'Cut the explicit rounded passages around stationary RHS ribs. Apply a continuous coolant-compatible sealant bead after fixed-rib alignment, inspect all penetrations and leak-test the installed tray. The modeled clearance is not a sealed-containment proof.',
        ]
      : []),
  ],
  sources: [
    {
      label: 'Reference supplier work surface options',
      url: 'https://cncmachines.com.ua/product/yastreb-8015-200/',
    },
  ],
  notes:
    'Own fabrication geometry. Assign flatness, mounting datum and actual T-nut dimensions. Bent tray corners, seals and tank joints require their production details; this does not assert a factory replica.',
};
export default part;
