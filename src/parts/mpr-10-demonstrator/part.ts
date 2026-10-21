import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { component } from '../../core/assembly/boundary/shapes';
import { defaults, parameters, catalogSelection } from './configurator';
import { libraries, configured, composition, kinematics, layout, fitSleeve } from './lib/model';
import { hardwareSources } from './lib/hardware';
import { fabricationFiles } from './lib/fabrication';
import presets from './presets.json';
import product from './product.json';

function validate(p: Parameters, state: string) {
  const errors: string[] = [];
  for (const key of Object.keys(p))
    if (!parameters.some((field) => field.key === key)) errors.push(`Unsupported setting: ${key}.`);
  for (const field of parameters) {
    const v = p[field.key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < field.min! || v > field.max!)
      errors.push(`${field.label} must be between ${field.min} and ${field.max} ${field.unit}.`);
  }
  if (!['assembled', 'tube', 'exploded', 'prints'].includes(state))
    errors.push('Choose a supported inspection view.');
  if (errors.length) return errors;
  for (let i = 0; i < 4; i++) {
    const k = kinematics(p, i);
    if (k.nutZ - 7.5 < layout.screwThreadStart + 2 || k.nutZ + 7.5 > layout.screwThreadEnd - 2)
      errors.push(`Channel ${i + 1} nut exceeds the supported threaded travel.`);
  }
  return errors;
}
const part: PartDefinition = {
  id: 'mpr-10-demonstrator',
  name: 'MPR.10 mechanism demonstrator',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'MOTION MECHANISMS',
  icon: 'gear',
  complexity: 'Four screw-driven rockers',
  preview: 'worker',
  description:
    'Three printed discs and peripheral M5 standoffs support four compact NEMA 8/SFK0601 drives. Each 52 mm screw centres its working thread on an 8.5 mm rocker. Captured rollers link the nut U-grooves to the rockers without a separate linear guide; two disc-mounted bearings support each output.',
  keywords: [
    'MPR.10',
    'demonstrator',
    '3D printed',
    'ball screw',
    'SFK0601',
    'NEMA 8',
    'U groove',
    'rocker',
    'captured roller',
    'guide free',
    'M5 standoff',
    'DIN 6799',
    'E clip',
    'tube',
    '90',
    '86',
  ],
  product: product as ProductProfile,
  defaults,
  parameters,
  catalogSelection,
  presets: presets as Preset[],
  presetMatchKeys: ['fitClearance', 'printClearance', 'bearingPressFit'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Complete mechanism with all purchased and fabricated components.',
    },
    {
      id: 'tube',
      label: 'Tube fit',
      description: 'Half-section Ø90/86 reference sleeve with end-open output-shaft slots.',
    },
    {
      id: 'exploded',
      label: 'Separate components',
      description: 'Move the four channels radially outward for inspection.',
    },
    {
      id: 'prints',
      label: 'Printed components',
      description:
        'Inspect the prints in their installed positions; export individual details for slicing.',
    },
  ],
  validate,
  composition,
  fabricationFiles,
  buildGeometry(p, state) {
    const model = componentGeometry(libraries, configured(p, state));
    if (state === 'tube') {
      const sleeve = component(fitSleeve(p), 'REFERENCE ONLY · tube Ø90/86', 0x9eabb8);
      sleeve.traverse((o) => {
        if ('material' in o) {
          const materials = Array.isArray(o.material) ? o.material : [o.material];
          for (const material of materials) {
            material.transparent = true;
            material.opacity = 0.25;
            material.depthWrite = false;
          }
        }
      });
      model.add(sleeve);
    }
    return model;
  },
  buildExportGeometry: (p, s) => componentGeometry(libraries, configured(p, s), true),
  python: (p, s) => componentPython(libraries, configured(p, s)),
  dimensions: (p, s) => componentDimensions(libraries, configured(p, s)),
  assessment(p) {
    return [
      `Tube Ø90/86 mm. Printed deck diameter ${(86 - 2 * Number(p.fitClearance)).toFixed(1)} mm; radial installation clearance ${Number(p.fitClearance).toFixed(2)} mm. Four 12 mm end-open shaft slots permit axial insertion from the slotted end; qualify actual passage and service access.`,
      'Three printed discs are joined by peripheral M5 × 20 mm and M5 × 30 mm female/female standoffs. Paired lugs directly on the upper disc house the output bearings.',
      `Four NEMA 8 8HS12-0506S motors drive ${layout.screwLength} mm custom-ended SFK0601 screws. The ${layout.screwThreadEnd - layout.screwThreadStart} mm working thread and neutral nut are centred on the output axis at Z=${layout.outputZ} mm.`,
      'Each output has two 688ZZ bearings 18 mm apart. Metal DIN 6799 size-6 E-clips and inner-ring washers locate the outer bearing axially; the inner bearing provides radial support.',
      `Fixed outer-race seats use ${Number(p.bearingPressFit).toFixed(2)} mm diametral interference, subject to print-fit qualification. The rear 684ZZ screw bearing slides in a Ø9.10 mm through bore. Shaft E-clips retain inner rings; housing retention depends on the qualified outer-race fit.`,
      "The captured rocker pin supplies the nut fork's antirotation constraint: the fork drives the roller along Z, retains the stepped steel sleeve flange along X and leaves transverse Y sliding free. Keep the capture faces clear of the bearing shields.",
      `Output bearing centre spacing 18 mm. Nominal joint travel is ±${(layout.arm * Math.sin((18 * Math.PI) / 180)).toFixed(3)} mm for prescribed ±18° poses with the ${layout.arm} mm rocker; one SFK0601 revolution corresponds to 1 mm nut travel.`,
      'The angle controls show nominal joint closure. Measure reversal take-up, friction and free motion on the assembled hardware; the preview does not simulate loaded contact.',
      `Rocker split-face closing relief is ${(Number(p.printClearance) + 0.1).toFixed(2)} mm per half. Finish the bore and shaft flats, then verify actual clamp grip and follower-pin retention on the assembled prints.`,
      ...[0, 1, 2, 3].map((i) => {
        const k = kinematics(p, i);
        return `CH${i + 1}: ${k.angle.toFixed(1)}°, carriage ${k.travel.toFixed(2)} mm from centre.`;
      }),
      'Custom screw journals, DIN 6799 shaft grooves and steel inner-ring spacers require metalworking and inspection. The guide documents fits, alignment, assembly access and print qualification.',
    ];
  },
  sources: hardwareSources,
  notes:
    'Benchtop mechanical demonstration adapted from the supplied MPR.10 STEP and subsequent reference images. Printed discs, peripheral standoffs, captured nut forks, custom journals and metal E-clip grooves are prototype design choices. Manufacturer references establish only the stated purchased-component interfaces. Qualify fixed bearing press fits, rear float, captured-pin antirotation, sliding contact and reversal take-up on the assembled hardware. The half sleeve is a fit reference excluded from the mechanism specification and CAD export. Its end-open shaft slots support axial insertion from the slotted end; qualify passage, slot closure and service access on the actual host tube. No load, speed or service-life rating is assigned.',
};
export default part;
