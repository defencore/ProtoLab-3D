import { Box3, Group, Vector3 } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { detailComponent } from '../../core/component-recipes';
import { componentGeometry, type ConfiguredPiece } from '../../core/assembly/detail-instances';
import { disposeModel } from '../../core/mechanical';
import { validateParameters } from '../../core/validation';
import { libraries, mechanismPieces } from './lib/mechanism';
import { channels, packing, placePiece, type Vec } from './lib/placement';
import { frameColumnPieces } from './lib/columns';
import { bearingCheeks } from './lib/bearing-cheeks';
import { sharedPlates } from './lib/shared-plates';
import { quadPython } from './lib/native';
import { fabricationFiles } from './lib/fabrication';
import { mechanismLayout } from './lib/layout';
import { defaults, parameters } from './configurator';
import product from './product.json';
import presets from './presets.json';

export function quadFramePieces(): ConfiguredPiece[] {
  return [
    ...frameColumnPieces(),
    ...[...sharedPlates(), ...bearingCheeks()].map((item) => {
      const component = detailComponent(item.id, item.label, item.shape);
      component.manufacturing = {
        material: 'Steel; grade and fits assigned in the production drawing',
        blank: `${item.thickness} mm flat sheet`,
        processes: ['cutting', 'drilling'],
        requirements: [
          'Laser cut the supplied contours; deburr; finish bearing pilots to the assigned fit.',
          'Locate the short cheek tabs in the matching receiver slots before securing the frame stack.',
        ],
      };
      return { component, label: item.label, color: item.color, requireSingleSolid: true };
    }),
  ];
}
export function quadPieces(p: Parameters, state = 'assembled'): ConfiguredPiece[] {
  return [
    ...channels(p, state).flatMap((channel) =>
      mechanismPieces(p, channel.angle).map((piece) => placePiece(piece, channel)),
    ),
    ...quadFramePieces(),
  ];
}
function build(p: Parameters, state: string): Group {
  return componentGeometry(libraries, quadPieces(p, state));
}
const part: PartDefinition = {
  identityParameters: (p) => ({ ...p, angleA: 0, angleB: 0, angleC: 0, angleD: 0 }),
  id: 'tr8-quad-actuator',
  name: 'TR8×8(P2) rotary actuator · GMP16T-TEC1636 · 4 outputs · Ø82 laser steel · ±20°',
  product: product as ProductProfile,
  category: 'MOTORS & ACTUATORS',
  subgroup: 'MOTOR ASSEMBLIES',
  icon: 'gear',
  complexity: 'Four radial drives on three round discs',
  description:
    'Four independent TR8×8(P2) mechanisms on three Ø82 steel discs. Outward Ø6 axes form an X. Flat steel forks use pressed cross pins, and the four inner bearing supports interleave clockwise around the centre. H-flange nuts are clocked 90°.',
  keywords: ['TR8', 'TR8x8', 'T8x8', '2P', 'quad', 'four drives', 'compact', 'GMP16T', 'laser cut', 'H flange', 'rotated nut'],
  defaults,
  parameters,
  presets: presets as Preset[],
  presetMatchKeys: ['motorModel'],
  states: [
    { id: 'assembled', label: 'Independent outputs', description: 'Set each of the four shaft angles independently.' },
    { id: 'negative-limit', label: 'All −20°', description: 'All four outputs at their negative travel limit.' },
    { id: 'positive-limit', label: 'All +20°', description: 'All four outputs at their positive travel limit.' },
  ],
  validate(p, state) {
    if (!['361-12', '107-12', '361-24', '107-24'].includes(String(p.motorModel)))
      return ['Choose a supported gearmotor.'];
    if (['A', 'B', 'C', 'D'].some((id) => !Number.isFinite(Number(p['angle' + id])) || Math.abs(Number(p['angle' + id])) > 20))
      return ['Each output angle must remain within ±20°.'];
    return quadPieces(p, state).flatMap((piece) => validateParameters(
      libraries.find((item) => item.id === piece.component.libraryId)!,
      piece.component.parameters, piece.component.state,
    ).map((error) => piece.label + ': ' + error));
  },
  composition(p) {
    return { components: quadPieces({ ...p, angleA: 0, angleB: 0, angleC: 0, angleD: 0 }).map((piece) => piece.component),
      issues: ['Assign application loads, production fits and tolerances; verify the M3 column joints and bearing-cheek tabs for the intended load.'] };
  },
  buildGeometry: build,
  dimensions(p, state) {
    const model = build(p, state);
    try { return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec; }
    finally { disposeModel(model); }
  },
  python: (p, state) => quadPython(p, state, quadFramePieces()),
  notes:
    `Independent four-drive version; single-drive and SFK variants remain available. Three round Ø${packing.discDiameter}×3 mm discs use standard 30 mm M3 columns and one 2 mm precision spacer per stack. Four radial module frames at 45°, 135°, 225° and 315° sit ${packing.radius} mm from the centre. Output axes form an X at X=${mechanismLayout.outputX} mm. Flat 3 mm steel forks are pinned to each Ø6 shaft with two Ø2×10 dowels, replacing split clamps, bolts and nuts. Pinned hubs and 0.45 mm sleeves locate the inner races; only two outer retaining rings remain. Four inner 4 mm bearing bars interleave clockwise with 0.2 mm seams, while outer supports remain circular. The integral Ø8×1 mm shaft head replaces a threaded cap. Nut H flanges are rotated 90°. Each 52 mm screw retains 28 mm of TR8×8(P2) thread. The ${mechanismLayout.radius} mm lever gives 10.5551 mm stroke and 1.2224 mm nominal full-thread margin at ±20°. Match-drill and ream the pin joints after setting axial and sliding clearances. Pin end chamfers are inspection geometry; source nominal dimensions are verified. The shimmed M3 joint has 3 mm stud engagement and requires load verification.`,
  sources: [
    { label: 'Supplied H-flange nut drawing', url: '' },
    { label: 'Supplied 250 mm TR8 stock', url: '' },
    { label: 'Multi-start thread lead and pitch', url: 'https://blog.igus.eu/multi-start-thread/' },
    { label: 'ISO 8734 Ø2×10 hardened dowel catalogue', url: 'https://static.shop.fibro.com/assets/EN/document/doc_2351_1_english.pdf' },
  ],
  fabricationFiles: (p) => fabricationFiles(p, quadPieces({ ...p, angleA: 0, angleB: 0, angleC: 0, angleD: 0 })),
};
export default part;
