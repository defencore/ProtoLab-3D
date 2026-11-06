import { Box3, Vector3 } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { componentGeometry } from '../../core/assembly/detail-instances';
import { disposeModel } from '../../core/mechanical';
import { validateParameters } from '../../core/validation';
import { libraries, cncChannels, placeCncPiece } from '../tr8-quad-cnc-actuator/part';
import { laserLayout } from './lib/layout';
import { framePieces } from './lib/frame';
import { centralGuidePiece } from './lib/guide';
import { laserChannelPieces } from './lib/channel';
import { laserPython } from './lib/native';
import { fabricationFiles } from './lib/fabrication';
import { defaults,parameters } from './configurator';
import presets from './presets.json';
import product from './product.json';

export {laserLayout as layout,frameLayout} from './lib/layout';
export {framePieces,laserProfiles,bearingCheeks,receiverSlots,columnLines,columnStages,cheekDimensions,discStations} from './lib/frame';
export {centralGuidePiece,centralGuideShape} from './lib/guide';
export {laserChannelPieces} from './lib/channel';
export {crankPieces,crankProfiles} from './lib/crank';
export {profileDxf,profileSvg} from './lib/profiles';
export {fabricationFiles,cuttingProfiles,machiningSchedule} from './lib/fabrication';
export {libraries} from '../tr8-quad-cnc-actuator/part';
export {defaults,parameters} from './configurator';

export const laserFramePieces=()=>[...framePieces(),centralGuidePiece()];
export function laserPieces(p:Parameters,state='assembled') {
  return [...cncChannels(p,state,laserLayout).flatMap(channel=>laserChannelPieces(p,channel.angle).map(piece=>placeCncPiece(piece,channel))),...laserFramePieces()];
}
const build=(p:Parameters,state:string)=>componentGeometry(libraries,laserPieces(p,state));
const part:PartDefinition={
  identityParameters: (p) => ({ ...p, angleA: 0, angleB: 0, angleC: 0, angleD: 0 }),
  id:'tr8-quad-laser-guided-actuator',name: 'TR8×8(P2) rotary actuator · GMP16T-TEC1636 · 4 outputs · Ø64 laser steel with nut guide · ±20°',
  product:product as ProductProfile,category:'MOTORS & ACTUATORS',subgroup:'MOTOR ASSEMBLIES',icon:'gear',
  complexity:'Three laser discs · standard standoffs · separate guide',
  description:'Demountable 64 mm frame with three 3 mm laser-cut discs, eight tabbed bearing cheeks and standard 30 mm female/female and male/female standoffs. A separate milled central guide keys into the bearing discs. Choose a welded four-lamination laser crank or a one-piece 3 mm laser crank.',
  keywords:['TR8','TR8x8','quad','four drives','laser','laser frame','sheet steel','laminated crank','central guide','sliding guide','standoff','64 mm','GMP16T','SMF106ZZ','tabbed','modular'],
  defaults,parameters,presets:presets as Preset[],presetMatchKeys:['motorModel','crankConstruction'],
  states:[
    {id:'assembled',label:'Independent outputs',description:'Set four independent output angles.'},
    {id:'negative-limit',label:'All −20°',description:'All four outputs at their negative limits.'},
    {id:'positive-limit',label:'All +20°',description:'All four outputs at their positive limits.'},
  ],
  validate(p,state) {
    if(!['laminated','solid'].includes(String(p.crankConstruction)))return['Choose a supported crank construction.'];
    if(!['361-12','107-12','361-24','107-24'].includes(String(p.motorModel)))return['Choose a supported gearmotor.'];
    if(['A','B','C','D'].some(k=>!Number.isFinite(Number(p['angle'+k]))||Math.abs(Number(p['angle'+k]))>20))return['Keep each output within ±20°.'];
    return laserPieces(p,state).flatMap(piece=>validateParameters(libraries.find(l=>l.id===piece.component.libraryId)!,piece.component.parameters,piece.component.state).map(error=>piece.label+': '+error));
  },
  composition(p) {return {components:laserPieces({...p,angleA:0,angleB:0,angleC:0,angleD:0}).map(piece=>piece.component),
    issues:['Finish bearing and tab fits; qualify the captured plate joints, crank welds, pin clearance and guide stiffness for the application.']};},
  buildGeometry:build,
  dimensions(p,state) {const model=build(p,state);try{return new Box3().setFromObject(model,true).getSize(new Vector3()).toArray() as [number,number,number];}finally{disposeModel(model);}},
  python:laserPython,
  notes:'New split-frame variant; all earlier models remain unchanged. Three Ø64×3 mm discs sit at X=−51, −18 and +15 mm, leaving two 30 mm clear spans. Four DREMEC 115x30 female/female and four 215x30 male/female standoffs capture the middle disc and use eight M3x8 end bolts; nominal engagements are 5 mm. Eight 3 mm laser cheeks support the unchanged SMF106ZZ bearing centres at local Y=12 and17 mm. Their tabs and disc sockets are centred on output-shaft height. A separate milled pinwheel nut guide fits two 8 mm square tenons into 8.1 mm laser sockets and is captured by the disc stack. All four carrier guide faces keep 0.05 mm nominal sliding clearance throughout ±20° travel. The structural frame requires milling only for this guide; bearing pilots, edges and tab fits still need finishing. Existing turned screws, output shafts, sleeves and machined nut carriers remain. The default crank is four laser laminations, .5/2/.5 mm overall, joined by flush spot or laser welds; two middle webs form the transverse pin access window. The original Ø2×10 pin presses through the existing shaft hole. This removes crank cross-drilling but requires weld and distortion qualification. The one-piece 3 mm alternative uses the original matched pin drill. Both keep three main discs, the original motors, 50 mm TR8×8(P2) screws, outward X-arranged shafts, screw axes at D/4 and independent ±20° motion. Set actual material grades, running fits, joint strength, lubrication and production tolerances.',
  sources:[
    {label:'Supplied H-flange nut drawing',url:''},
    {label:'DREMEC female/female standoff family',url:'https://dremec.ua/product/mama-mama-latyn/'},
    {label:'DREMEC male/female standoff family',url:'https://dremec.ua/product/papa-mama-latyn/'},
    {label:'EZO SMF106ZZ bearing dimensions',url:'https://www.ezo-brg.co.jp/english/product/spec.php?eid=00582'},
  ],
  fabricationFiles:p=>fabricationFiles(p,laserPieces({...p,angleA:0,angleB:0,angleC:0,angleD:0})),
};
export default part;
