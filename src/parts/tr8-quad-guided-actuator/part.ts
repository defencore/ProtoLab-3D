import { Box3, Vector3 } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { componentGeometry } from '../../core/assembly/detail-instances';
import { disposeModel } from '../../core/mechanical';
import { validateParameters } from '../../core/validation';
import { createCncQuadDefinition, cncPieces, cncLayout, cncPython, libraries, centralGuideLayout,
  type CncVariant } from '../tr8-quad-cnc-actuator/part';
import { guidedFramePieces } from './lib/frame';
import { guidedFabricationFiles } from './lib/fabrication';
import presets from './presets.json';
import product from './product.json';

export { guidedFramePieces } from './lib/frame';
export { guidedFabricationFiles, guidedMachiningSchedule } from './lib/fabrication';
export { defaults, parameters, cncLayout, centralGuideLayout, centralGuideFaces, guideShape, libraries,
  type CncLayout, type CncVariant } from '../tr8-quad-cnc-actuator/part';

export function guidedPieces(p: Parameters, state = 'assembled', variant: CncVariant = 'coplanar-64') {
  const frame = new Map(guidedFramePieces(cncLayout(variant)).map(piece => [piece.component.id, piece]));
  return cncPieces(p, state, variant).map(piece => frame.get(piece.component.id) ?? piece);
}

export function createGuidedCncQuadDefinition(variant: CncVariant, catalog: Preset[], profile: ProductProfile): PartDefinition {
  const base = createCncQuadDefinition(variant), layout = cncLayout(variant), guide = centralGuideLayout(layout);
  const staggered = variant === 'staggered-56';
  const id = staggered ? 'tr8-quad-guided-staggered-actuator' : 'tr8-quad-guided-actuator';
  const build = (p: Parameters, state: string) => componentGeometry(libraries, guidedPieces(p, state, variant));
  return { ...base, id, product:profile, presets:catalog,
    name:`TR8×8(P2) rotary actuator · GMP16T-TEC1636 · 4 outputs · Ø${layout.diameter} CNC ${staggered?'staggered ':''}central guide · ±20°`,
    complexity:`Four drives · integral central nut guide · Ø${layout.diameter}`,
    description:`Four independent TR8 drives with a fixed central square spine and four integral sliding guide faces. All four nut carriers bear against the guide to resist screw reaction torque while travelling axially. Disc diameter ${layout.diameter} mm; the original motor, screw, output axes and three main discs are preserved.`,
    keywords:[...base.keywords, 'central guide', 'nut guide', 'anti rotation', 'antiroll', 'guided', 'four sliding faces'],
    validate(p,state) {
      const original = base.validate(p,state);
      if (original.length) return original;
      const body = guidedFramePieces(layout)[0];
      return validateParameters(libraries.find(l=>l.id===body.component.libraryId)!,body.component.parameters,body.component.state).map(error=>body.label+': '+error);
    },
    composition(p) { return { components:guidedPieces({...p,angleA:0,angleB:0,angleC:0,angleD:0},'assembled',variant).map(piece=>piece.component),
      issues:['Assign application loads, guide-face running fits, lubrication and production tolerances; verify guide-fin stiffness and wear.'] }; },
    buildGeometry:build,
    dimensions(p,state) {
      const model=build(p,state);
      try {return new Box3().setFromObject(model,true).getSize(new Vector3()).toArray() as [number,number,number];}
      finally {disposeModel(model);}
    },
    python:(p,state)=>cncPython(p,state,layout,guidedFramePieces(layout)),
    notes:`Separate centrally guided version; all earlier Ø64, Ø56, Ø72 and Ø82 arrangements remain available. The CNC middle body adds a square axial spine and four 1.5 mm pinwheel guide fins. Their fixed faces lie ${-guide.localFaceY} mm inward from the local screw/output plane and cover the full 10×8 mm carrier pads throughout ±20° travel. Nominal sliding clearance is ${guide.runningGap} mm; finish and lubricate the guide/carrier flats. The guide restrains both nut-roll directions independently of the outward forks and follower pins. Running clearance permits finite angular play before contact; this is not a preloaded joint. The guide is fused to the existing middle base and adds no bolts, extra main discs or diameter. Its axial span is ${guide.xSpan[0].toFixed(4)} to ${guide.xSpan[1].toFixed(4)} mm, ending before the end bearing disc. Screws, purchased nuts, motor options, coupling, outward X-arranged shafts, stroke law and original bearing interfaces remain unchanged. ${staggered?'Adjacent nuts and outputs remain staggered at X=−8.5/+8.5 mm.':'All output shafts remain at X=0.'} Review CNC cutter access, root reliefs, actual sliding fits, surface finish, lubrication, fin stiffness and wear under the intended load.`,
    fabricationFiles:p=>guidedFabricationFiles(layout,p,guidedPieces({...p,angleA:0,angleB:0,angleC:0,angleD:0},'assembled',variant)),
  };
}
export default createGuidedCncQuadDefinition('coplanar-64',presets as Preset[],product as ProductProfile);
