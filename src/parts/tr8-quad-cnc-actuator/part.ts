import { Box3, Vector3 } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { componentGeometry, type ConfiguredPiece } from '../../core/assembly/detail-instances';
import { disposeModel } from '../../core/mechanical';
import { validateParameters } from '../../core/validation';
import { libraries, channelPieces } from './lib/channel';
import { cncLayout, nutTravel, type CncVariant, type Vec } from './lib/layout';
import { cncChannels, placeCncPiece } from './lib/placement';
import { cncFramePieces } from './lib/frame';
import { cncPython } from './lib/native';
import { cncFabricationFiles } from './lib/fabrication';
import { defaults, parameters } from './configurator';
import product from './product.json';
import coplanarPresets from './presets.json';

export { cncLayout, nutTravel, nativeThreadLayout, linkage, outputBearing } from './lib/layout';
export type { CncVariant, CncLayout } from './lib/layout';
export { cncChannels, placeCncPiece } from './lib/placement';
export { cncFramePieces, cncMiddleShape } from './lib/frame';
export { channelPieces, libraries } from './lib/channel';
export { cncFabricationFiles, cncMachiningSchedule, outerPlateBlankShape, outerPlateCircles, forkContours } from './lib/fabrication';
export { forkBlankShape, carrierBodyShape, carrierShape, forkShape, outputShaftShape, crossPinDatum } from './lib/linkage';
export { defaults, parameters } from './configurator';
export { cncPython } from './lib/native';
export { guideShape, centralGuideLayout, centralGuideFaces, centralGuide } from './lib/central-guide';

export function cncPieces(p: Parameters, state = 'assembled', variant: CncVariant = 'coplanar-64'): ConfiguredPiece[] {
  const layout = cncLayout(variant);
  return [...cncChannels(p, state, layout).flatMap(channel =>
    channelPieces(p, channel.angle, layout, channel.unit).map(piece => placeCncPiece(piece, channel))),
  ...cncFramePieces(layout)];
}

/** Public family factory: each arrangement remains a separate library product. */
export function createCncQuadDefinition(variant: CncVariant): PartDefinition {
  const layout = cncLayout(variant), staggered = variant === 'staggered-56';
  const id = staggered ? 'tr8-quad-staggered-actuator' : 'tr8-quad-cnc-actuator';
  const name = staggered ? 'TR8×8(P2) rotary actuator · GMP16T-TEC1636 · 4 outputs · Ø56 CNC staggered · ±20°' : 'TR8×8(P2) rotary actuator · GMP16T-TEC1636 · 4 outputs · Ø64 CNC coplanar · ±20°';
  const build = (p: Parameters, state: string) => componentGeometry(libraries, cncPieces(p, state, variant));
  const presets: Preset[] = !staggered ? coplanarPresets as Preset[] : ['361-12', '107-12', '361-24', '107-24'].map(motorModel => ({
    id: id + '-' + motorModel,
    name: `TR8×8(P2) · GMP16T-TEC1636 ${motorModel.split('-')[0]}:1 / ${motorModel.split('-')[1]} V · 4 outputs · Ø${layout.diameter} CNC ${staggered ? 'staggered' : 'coplanar'} · ±20°`,
    description: staggered ? 'Two axial output planes reduce the disc diameter to 56 mm; longer 68 mm screws.' : 'Four coplanar outward outputs on a 64 mm frame with 50 mm screws.',
    parameters: { ...defaults, motorModel },
  }));
  return {
    id, name, product: product as ProductProfile,
    identityParameters: (p) => ({ ...p, angleA: 0, angleB: 0, angleC: 0, angleD: 0 }),
    category: 'MOTORS & ACTUATORS', subgroup: 'MOTOR ASSEMBLIES', icon: 'gear',
    complexity: `Four drives · Ø${layout.diameter} CNC middle body`,
    description: `Separate compact four-drive version with two 3 mm laser-cut outer discs and a one-piece CNC middle body with integral posts and bearing pods. Screw axes sit at radius ${layout.screwPitchRadius} mm, equally far from the centre and rim. ${staggered ? 'Adjacent nuts and output shafts occupy two axial planes, reducing diameter at the cost of overall length.' : 'All four outward output shafts occupy one axial plane.'}`,
    keywords: ['TR8', 'TR8x8', 'T8x8', '2P', 'quad', 'four drives', 'CNC', 'milled', 'compact', `${layout.diameter} mm`, 'SMF106ZZ', 'GMP16T', 'H flange', 'single fork', ...(staggered ? ['staggered', 'two planes'] : ['coplanar'])],
    defaults: { ...defaults },
    parameters: parameters.map((field) => ({ ...field, ...(field.options ? { options: field.options.map((option) => ({ ...option })) } : {}) })),
    presets, presetMatchKeys: ['motorModel'],
    states: [
      { id: 'assembled', label: 'Independent outputs', description: 'Set all four output angles independently.' },
      { id: 'negative-limit', label: 'All −20°', description: 'All four outputs at their negative travel limit.' },
      { id: 'positive-limit', label: 'All +20°', description: 'All four outputs at their positive travel limit.' },
    ],
    validate(p, state) {
      if (!['361-12', '107-12', '361-24', '107-24'].includes(String(p.motorModel))) return ['Choose a supported gearmotor.'];
      if (['A','B','C','D'].some(k => !Number.isFinite(Number(p['angle'+k])) || Math.abs(Number(p['angle'+k])) > 20)) return ['Each output must remain within ±20°.'];
      return cncPieces(p, state, variant).flatMap(piece => validateParameters(
        libraries.find(item => item.id === piece.component.libraryId)!, piece.component.parameters, piece.component.state,
      ).map(error => piece.label + ': ' + error));
    },
    composition(p) {
      return { components: cncPieces({ ...p, angleA:0, angleB:0, angleC:0, angleD:0 }, 'assembled', variant).map(piece => piece.component),
        issues: ['Production loads, material grades, fits, single-fork pin joints and short outboard bearing spans require qualification.'] };
    },
    buildGeometry: build,
    dimensions(p, state) {
      const model = build(p, state);
      try { return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec; }
      finally { disposeModel(model); }
    },
    python: (p, state) => cncPython(p, state, layout, cncFramePieces(layout)),
    notes: `The Ø82 and Ø72 versions remain separate. Exactly three main discs: two Ø${layout.diameter}×3 mm outer plates and one 5 mm middle base integrated with four longitudinal posts and four output bearing pods. Mill the middle frame from a Ø${layout.diameter}×${layout.endPlateX-layout.motorPlateX-3} mm billet using indexed setups; its transverse bearing bores and web/post junctions need a reviewed machining plan. Four screw axes lie exactly at radius D/4=${layout.screwPitchRadius} mm. ${staggered ? 'Adjacent nuts AND output shafts alternate between X=−8.5 and +8.5 mm; output axes form an X in the end view across two axial planes.' : 'All output shafts share X=0; their axes form an X in the end view.'} Each shaft uses one 3 mm steel closed-slot fork, one Ø2×10 cross pin and two outward SMF106ZZ bearings. The plain closed shaft end has no enlarged head. The single outward carrier flat is restrained by the fork face in both roll directions; the 0.05 mm running gap permits approximately 0.724° nominal roll play before contact. Lever ${layout.lever.toFixed(4)} mm gives ${(2*nutTravel(layout,20)).toFixed(4)} mm travel for ±20°. Four-start TR8×8(P2) screws are cut from 250 mm stock and turned to ${layout.screwEnds[1]-layout.screwEnds[0]} mm; retain ${layout.threadEnds[1]-layout.threadEnds[0]} mm of thread. Output tails and their accessible retaining hardware extend beyond the disc rim. Assign production fits, sleeve tolerances and application loads; supplier bearing ratings do not rate the complete actuator. Match-drill and ream the pin joints after setting running clearances.`,
    sources: [
      { label: 'Supplied H-flange nut drawing', url:'references/tr8-h-nut/h-nut-drawing.png' },
      { label: 'Supplied 250 mm TR8 stock', url:'references/tr8-h-nut/tr8-stock.png' },
      { label: 'EZO SMF106ZZ dimensions and abutments', url:'https://www.ezo-brg.co.jp/english/product/spec.php?eid=00582' },
      { label: 'ISO 8734 Ø2×10 dowel catalogue', url:'https://static.shop.fibro.com/assets/EN/document/doc_2351_1_english.pdf' },
    ],
    fabricationFiles: p => cncFabricationFiles(layout, p, cncPieces({...p,angleA:0,angleB:0,angleC:0,angleD:0},'assembled',variant)),
  };
}
export default createCncQuadDefinition('coplanar-64');
