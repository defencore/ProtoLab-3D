import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentDimensions,
  componentGeometry,
  componentPython,
} from '../../core/assembly/detail-instances';
import { initializeManifoldGeometry } from '../../core/assembly/manifold-boundary';
import { defaults, parameters } from './configurator';
import { configured, libraries, validateJig } from './lib/model';
import { tubeReferenceDatums, accessWindowDatums } from '../modular-tube-avionics/lib/shared';
import { holeStations, tubeMounting } from '../modular-tube-avionics/lib/service';
import profile from './product.json';
import presets from './presets.json';
import {
  resolveTubeProfile,
  validateTubeProfile,
} from '../modular-tube-avionics/lib/tube-interface';

export const states = [
  {
    id: 'assembled',
    label: 'Working setup',
    description:
      'The front base stays fixed. Transfer the window stencil and two rails to its opposed registers for the second pass.',
  },
  {
    id: 'exploded',
    label: 'Separate components',
    description:
      'Inspect the fixed frame, pressure shoe, stencil, registered rails and hardware without changing the physical kit.',
  },
  {
    id: 'print',
    label: 'Printable tools · multiple beds',
    description:
      'Five PETG tools in their print poses on Z=0. Hardware and the reference workpiece are excluded.',
  },
];

const part: PartDefinition = {
  id: 'modular-tube-marking-kit',
  name: 'Modular tube marking kit',
  category: 'WORKSHOP TOOLS',
  subgroup: 'DRILLING JIGS',
  icon: 'bracket',
  description:
    'A fixed front-datum base and removable stencils for the two windows and all radial hole centers of the modular Ø90/86 avionics tube. Five reusable PETG tools share the existing project layout.',
  complexity: 'Five printed tools · project marking kit',
  preview: 'worker',
  keywords: [
    'tube',
    'stencil',
    'marking',
    'drilling',
    'window',
    'Grandado',
    '90/86',
    'avionics',
    'template',
    'P2S',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  product: profile as ProductProfile,
  states,
  catalogSelection: [],
  presetMatchKeys: ['tubeProfile', 'fitAllowance', 'jointAllowance', 'markDiameter'],
  identityParameters(p) {
    const { side: _side, showTube: _tube, ...physical } = p;
    return { ...physical, tubeProfile: resolveTubeProfile(p).id };
  },
  validate(p, state) {
    const errors: string[] = [];
    if (!states.some((candidate) => candidate.id === state))
      errors.push('Select a supported marking-kit view.');
    for (const key of Object.keys(p))
      if (!(key in defaults)) errors.push(`Unsupported marking-kit parameter: ${key}.`);
    for (const field of parameters) {
      const value = p[field.key];
      if (
        field.type === 'number' &&
        (typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < field.min! ||
          value > field.max!)
      )
        errors.push(`${field.label} is outside its finite range.`);
      if (field.type === 'boolean' && typeof value !== 'boolean')
        errors.push(`Choose ${field.label.toLowerCase()}.`);
      if (field.type === 'select' && !field.options?.some((option) => option.value === value))
        errors.push(`Choose ${field.label.toLowerCase()}.`);
    }
    return errors.length ? errors : [...validateTubeProfile(p), ...validateJig(p)];
  },
  initializeGeometry: async () => {
    await initializeManifoldGeometry();
  },
  composition(p) {
    const canonical = { ...p, side: 'first', showTube: false };
    return {
      components: configured(canonical, 'assembled', false).map((piece) => piece.component),
      issues: [
        'This is a separate manufacturing-tool kit. Its parts and hardware are not installed avionics components.',
        'The default passages transfer hole centers; final drilling, head-seat preparation and cutting follow the project layout after the tools are removed.',
      ],
    };
  },
  buildGeometry: (p, state) => componentGeometry(libraries, configured(p, state, true)),
  buildExportGeometry: (p, state) =>
    componentGeometry(libraries, configured(p, state, false), true),
  python: (p, state) => componentPython(libraries, configured(p, state, false)),
  dimensions: (p, state) => componentDimensions(libraries, configured(p, state, true)),
  exportDimensions: (p, state) => componentDimensions(libraries, configured(p, state, false)),
  assessment: (p) => {
    const tube = resolveTubeProfile(p);
    return [
      'Five PETG tools, one source M3×20 pressure screw, one M3×25 shoe-retainer screw and two M3 hex nuts. The same nine-piece kit marks both passes.',
      `Tube profile ${tube.id}: OD ${tube.outerDiameter} / ID ${tube.innerDiameter} mm, wall ${tube.wallThickness} mm. The associated avionics insert is Ø${tube.insertDiameter} mm; tool fitting allowance is separate. Project front X${tubeReferenceDatums.frontX} becomes jig X0.`,
      `Two opposed windows use the source ${accessWindowDatums.length}×${accessWindowDatums.width} mm projected outline and R${accessWindowDatums.cornerRadius} corners. The two side lines contain ${holeStations.length * 2} radial hole centers.`,
      `The ${p.markDiameter} mm transfer passages are separate from the fixed Ø${tubeMounting.pilotDiameter} mm finished tube holes. Keep the two shell head seats distinct from the fourteen countersunk anchor seats.`,
      'Seat the full front frame against the tube end. The diagonal pressure shoe pushes the nominal Ø90 tube against the fixed Y/Z tangent lands; verify contact and holding on the actual tube.',
      'Fit the rear rail first, then the front rail and window stencil. For the opposite pass, move only those three tools to the opposed registers; leave the base and its hardware fixed. No pilot pair is needed for indexing.',
      'Use narrow removable bands to seat the tool faces. Remove the complete marking kit before powered drilling, head-seat preparation or cutting; work through one tube wall at a time.',
      'Use the exported print poses and inspect each individual part in the slicer. The separated layout represents multiple beds, not one claimed build plate.',
    ];
  },
  notes:
    'Standalone process kit for modular-tube-avionics:d90-86-ov9281. Pattern dimensions derive from that package; fitting allowances do not resize its target cuts. Reference tube geometry is excluded from procurement and fabrication exports. See GUIDE.md for assembly, marking sequence and verification scope.',
};

export default part;
