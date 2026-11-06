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
  id: 'tr8-quad-mini-actuator',
  name: 'TR8×8(P2) rotary actuator · GMP16T-TEC1636 · 4 outputs · Ø72 laser steel · ±20°',
  product: product as ProductProfile,
  category: 'MOTORS & ACTUATORS',
  subgroup: 'MOTOR ASSEMBLIES',
  icon: 'gear',
  complexity: 'Four radial drives on three Ø72 discs',
  description:
    'Smaller four-drive version on three Ø72 steel discs. EZO SMF106ZZ output bearings keep Ø6 shafts while narrowing the pinned linkage and bearing supports. All laser parts use 3 mm steel; four independent outward axes form an X.',
  keywords: ['TR8', 'TR8x8', 'T8x8', '2P', 'quad', 'four drives', 'mini', 'compact', '72 mm', 'SMF106ZZ', 'GMP16T', 'laser cut', 'H flange', 'rotated nut'],
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
    `Separate mini version; the Ø82 four-drive, single-drive and SFK versions remain available. Three round Ø${packing.discDiameter}×3 mm discs use standard 30 mm M3 columns and one 2 mm precision spacer per stack. Four radial module frames at 45°, 135°, 225° and 315° sit ${packing.radius} mm from the centre. Output axes form an X at X=${mechanismLayout.outputX} mm. EZO SMF106ZZ 6×10×3 mm shielded bearings have Ø11.2×0.6 mm flanges. Their inner-race thrust sleeves use Ø6.85 mm abutments. Three-millimetre steel forks use two Ø2×10 pins per shaft. The 13 mm nut carrier retains 1.4 mm nominal pin-root wall. Inner sleeves are 0.95 mm, outer sleeves 0.5 mm; rings lie at ±14.4 mm and the integral Ø7.5×1 mm head ends at −16 mm. All laser parts use 3 mm steel, including the clockwise interleaved inner bearing bars. Those bars retain 0.2 mm seams; the fork/cheek gap is 0.35 mm. The frame columns move to radius 28 mm at 25°+90°i. Each 52 mm screw retains 28 mm of thread. The ${mechanismLayout.radius} mm lever gives 10.5551 mm stroke and 1.2224 mm nominal full-thread margin at ±20°. Assign production fits and verify loads for the smaller output bearings; their supplier ratings do not rate the complete actuator. Match-drill and ream the pin joints after setting axial and sliding clearances.`,
  sources: [
    { label: 'Supplied H-flange nut drawing', url: 'references/tr8-h-nut/h-nut-drawing.png' },
    { label: 'Supplied 250 mm TR8 stock', url: 'references/tr8-h-nut/tr8-stock.png' },
    { label: 'EZO SMF106ZZ dimensions and abutments', url: 'https://www.ezo-brg.co.jp/english/product/spec.php?eid=00582' },
    { label: 'Multi-start thread lead and pitch', url: 'https://blog.igus.eu/multi-start-thread/' },
    { label: 'ISO 8734 Ø2×10 hardened dowel catalogue', url: 'https://static.shop.fibro.com/assets/EN/document/doc_2351_1_english.pdf' },
  ],
  fabricationFiles: (p) => fabricationFiles(p, quadPieces({ ...p, angleA: 0, angleB: 0, angleC: 0, angleD: 0 })),
};
export default part;
