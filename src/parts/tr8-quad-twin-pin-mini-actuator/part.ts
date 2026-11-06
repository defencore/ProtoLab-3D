import {bearingKit} from '../tr8-quad-twin-pin-actuator/part';
import {Box3,Vector3} from 'three';
import type {Parameters,PartDefinition,Preset} from '../../core/types';
import type {ProductProfile} from '../../core/product-types';
import {componentGeometry} from '../../core/assembly/detail-instances';
import {disposeModel} from '../../core/mechanical';
import {validateParameters} from '../../core/validation';
import original from '../tr8-quad-twin-pin-actuator/part';
import {cncChannels,placeCncPiece,libraries} from '../tr8-quad-cnc-actuator/part';
import {channelPieces} from './lib/channel';
import {framePieces} from './lib/frame';
import type {DiscPattern} from './lib/frame';
import {layout,diameterLimit} from './lib/layout';
import {nativeSource} from './lib/native';
import {fabricationFiles} from './lib/fabrication';
import {defaults,parameters} from './configurator';
import presets from './presets.json';
import product from './product.json';
export {layout,compact,diameterLimit} from './lib/layout';
export {framePieces,frameProfiles,discProfile,columnLines,cheekSocketPoints,lighteningCircles,guideProfile,guideShape,centralBore,guideTabCentre} from './lib/frame';
export {channelPieces,shaftShape,shaftPiece,sleevePiece} from './lib/channel';
export {cuttingProfiles,machiningSchedule} from './lib/fabrication';
export {nutShape,nutPiece,nutBore,twinPin,threadLayout} from '../tr8-quad-twin-pin-actuator/part';
export {libraries} from '../tr8-quad-cnc-actuator/part';
export {defaults,parameters} from './configurator';

export function pieces(p:Parameters,state='assembled') {
  return [...cncChannels(p,state,layout).flatMap(channel=>channelPieces(p,channel.angle).map(piece=>placeCncPiece(piece,channel))),...framePieces(p.discPattern as DiscPattern,bearingKit(p))];
}
const build=(p:Parameters,state:string)=>componentGeometry(libraries,pieces(p,state));
const part:PartDefinition={...original,
  states: original.states?.map((state) => ({ ...state })),
  id:'tr8-quad-twin-pin-mini-actuator',name: 'TR8×8(P2) rotary actuator · GMP16T-TEC1636 · 4 outputs · Ø54 laser steel twin-pin · ±20°',
  product:product as ProductProfile,complexity:'Ø54 discs · shortened output shafts · twin-pin nuts',
  description:'Smaller version of the approved twin-pin mechanism. Four output shafts and outer bearing stacks shorten by 5 mm for three Ø54 laser discs. Choose lightened discs with protected bearing/mounting zones or the original solid discs. Nuts, cranks and motor/screw datums keep the approved geometry; guide end keys clear a central Ø5 passage.',
  keywords:['TR8','TR8x8','twin pin mini','54 mm','short shaft','compact','laser','four drives','two sided nut','one piece crank'],
  defaults,parameters,presets:presets as Preset[],presetMatchKeys:['motorModel','discPattern','bearingKit'],
  validate(p,state) {
    if(p.bearingKit!==undefined&&!['prom-smb','reference'].includes(String(p.bearingKit)))return['Choose a supported bearing set.'];
    if(!['lightened','solid'].includes(String(p.discPattern)))return['Choose a supported disc construction.'];
    if(!['361-12','107-12','361-24','107-24'].includes(String(p.motorModel)))return['Choose a supported gearmotor.'];
    if(['A','B','C','D'].some(id=>!Number.isFinite(Number(p['angle'+id]))||Math.abs(Number(p['angle'+id]))>20))return['Keep outputs within ±20°.'];
    return pieces(p,state).flatMap(piece=>validateParameters(libraries.find(definition=>definition.id===piece.component.libraryId)!,piece.component.parameters,piece.component.state));
  },
  composition:p=>({components:pieces({...p,angleA:0,angleB:0,angleC:0,angleD:0}).map(piece=>piece.component),
    issues:['Assign compact frame edge ligaments, shaft attachment access, bearing fits and loads; bearing span is17.7 mm.']}),
  buildGeometry:build,
  dimensions(p,state){const model=build(p,state);try{return new Box3().setFromObject(model,true).getSize(new Vector3()).toArray() as [number,number,number];}finally{disposeModel(model);}},
  python:nativeSource,
  notes:`Default Prom.ua bearing set:8 SMB MF105,4 MF106 and4 MF63. Screw seats finish at10.02 mm; centres are -16.8/+16.8 mm and the existing sleeves are resized. The inner sleeves extend to the thread-root shoulders, so only two external screw rings and grooves remain per screw. Eight rings and eight grooves are removed per block. No adapters or extra parts. Select reference bearings for the previous13.02 mm screw seats and sleeves. Reference construction: Separate Ø54 version; the approved Ø64 and all earlier variants remain. The four outward bearing centres move from Y=17 to12 mm, outer cheeks from Y=14.9..17.9 to9.9..12.9 mm, and shaft ends from Y=27.5 to22.5 mm. Finished shaft length is29.95 mm; keep the accepted Ø3 inner journals and Ø6 main bodies. Inner-race sleeves shorten from5.95 to0.95 mm; outer clip centres move to14.4 mm and output flats begin at16.3 mm. The inner bearings remain at Y=-5.7 mm, yielding17.7 mm support spans. One-piece twin-trunnion nuts, monolithic3 mm cranks, central guide pin paths, ±20 degree travel, all motor/screw axes,50 mm screws and30 mm purchased columns stay as in Ø64. Three main discs are54x3 mm; four column lines move to radius23.5 mm at18+90n degrees. Eleven laser blanks use3 mm stock; four guide walls use2 mm stock. Every disc has a coaxial5 mm centre bore; narrower keys at Z=-2.75 mm in taller2 mm guide walls clear it while retaining the inner bearing and follower-slot datums. With the unchanged crank, the neutral outer top edge needs a diameter of${diameterLimit().minimumDiameter.toFixed(4)} mm;54 mm is the smallest whole-millimetre containing disc and leaves${diameterLimit().nominalRadialMargin.toFixed(4)} mm nominal radial margin there. Shaft tails intentionally extend beyond the circular rim along the four X-arranged outputs. The screw-axis radius stays16 mm in this shortening-only variant, rather than following a new D/4 rule. Qualify compact edge ligaments, fits, sleeve length, journal fatigue, output attachment and actual loads.`,
  fabricationFiles:p=>fabricationFiles(p,pieces({...p,angleA:0,angleB:0,angleC:0,angleD:0})),
};
export default part;
