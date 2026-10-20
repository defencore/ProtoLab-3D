import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import profile from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
import { clampLayout, composition, dimensions, geometry, python } from './lib/model';
const part: PartDefinition = {
  id: 'tube-arm-clamp',
  product: profile as ProductProfile,
  name: 'Two-piece tube arm clamp',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'VEHICLE MOUNTS',
  icon: 'bracket',
  description:
    'Bored split blocks with four aligned through bolts, full bearing washers and separate nuts for round vehicle tubes.',
  complexity: 'Authored fabrication design',
  keywords: ['tube clamp', 'round arm', 'boom', 'carbon tube', 'payload', 'rover', 'split block'],
  defaults,
  parameters,
  presets: presets as Preset[],
  presetMatchKeys: ['tubeDiameter', 'length', 'bolt', 'boltPitchX', 'boltPitchY'],
  composition,
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Tube axis X; four concrete standard fastener stacks.',
    },
    { id: 'exploded', label: 'Exploded', description: 'Separated halves and clamping hardware.' },
    {
      id: 'halves',
      label: 'Clamp halves',
      description: 'Fabricated parts at their assembly coordinates.',
    },
    {
      id: 'print',
      label: 'Flat fabrication pose',
      description:
        'Both halves placed outer flat face down; choose and qualify the project process.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'exploded', 'halves', 'print'].includes(state))
      errors.push('Choose a valid clamp state.');
    if (!['3', '4'].includes(String(p.bolt))) return ['Choose M3 or M4 clamping hardware.'];
    if (
      parameters.some(
        (f) =>
          f.type === 'number' &&
          (!Number.isFinite(Number(p[f.key])) ||
            Number(p[f.key]) < f.min! ||
            Number(p[f.key]) > f.max!),
      )
    )
      return [...errors, 'Clamp dimensions are outside the supported finite ranges.'];
    const v = clampLayout(p),
      holeRadius = Number(p.boltClearance) / 2;
    if (Number(p.boltClearance) < v.bolt + 0.2)
      errors.push('Through holes must exceed the bolt diameter by at least 0.2 mm.');
    if ((Number(p.length) - Number(p.boltPitchX) - v.washerDiameter) / 2 < 2)
      errors.push('Leave at least 2 mm of full bearing face beyond each end washer.');
    if (Number(p.boltPitchX) < v.washerDiameter + 2)
      errors.push('Separate the two bolt rows by at least one washer diameter plus 2 mm.');
    if (Number(p.boltPitchY) / 2 - v.diameter / 2 - holeRadius < v.wall)
      errors.push(
        'Move the bolt columns outwards to retain the selected wall between each through hole and the tube bore.',
      );
    if (Number(p.splitGap) >= v.diameter * 0.2)
      errors.push('The open split gap must remain below 20% of the tube bore.');
    if (!v.screwPreset)
      errors.push(
        'No catalog screw covers the complete clamp and nut stack. Reduce the clamp height or select another construction.',
      );
    return errors;
  },
  updateParameters(p, changed) {
    return changed === 'bolt' ? { ...p, boltClearance: p.bolt === '4' ? 4.5 : 3.4 } : p;
  },
  buildGeometry: (p, s) => geometry(p, s),
  buildExportGeometry: (p, s) => geometry(p, s, true),
  python,
  dimensions,
  assessment(p) {
    const v = clampLayout(p);
    return [
      `Bore ${v.diameter.toFixed(2)} mm; unloaded split ${p.splitGap} mm; ${p.boltPitchX} x ${p.boltPitchY} mm four-hole pattern.`,
      `Clamp hardware: four ${v.screwPreset?.catalog?.designation ?? 'unavailable'} DIN 912 screws, eight DIN 125 washers and four DIN 934 nuts.`,
      'Verify a residual split gap and grip on the actual tube without crushing it. Material, print orientation, torque, locking and load qualification are project decisions.',
    ];
  },
  fabricationFiles(p) {
    return [
      {
        id: 'clamp-interface',
        label: 'Tube and fastener interface',
        description: 'Measured-fit inputs and complete library hardware identities · JSON',
        name: 'tube-arm-clamp-interface.json',
        type: 'application/json',
        content: JSON.stringify(
          {
            tubeOD: p.tubeDiameter,
            boreDiameter: Number(p.tubeDiameter) + Number(p.boreAllowance),
            openSplitGap: p.splitGap,
            boltPattern: [p.boltPitchX, p.boltPitchY],
            boltHole: p.boltClearance,
            assembly: composition(p),
          },
          null,
          2,
        ),
      },
    ];
  },
  validationNotice: 'Authored clamp design: qualify tube grip, material, torque and vehicle loads.',
  notes:
    'X is the tube axis; Z is the clamping screw axis. A positive unloaded split allows closure under preload; geometry does not simulate deformation. Standard hardware comes from existing library catalog records. Bore fit and wall choices are authored dimensions, without a supplier load rating. No tube, external mounting plate or vehicle load path is included.',
  sources: [],
};
export default part;
