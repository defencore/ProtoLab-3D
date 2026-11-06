import {bearingKit} from './lib/bearings';
import {Box3,Vector3} from 'three';
import type {Parameters,PartDefinition,Preset} from '../../core/types';
import type {ProductProfile} from '../../core/product-types';
import {componentGeometry} from '../../core/assembly/detail-instances';
import {disposeModel} from '../../core/mechanical';
import {validateParameters} from '../../core/validation';
import {cncChannels,placeCncPiece,libraries} from '../tr8-quad-cnc-actuator/part';
import {channelPieces} from './lib/channel';
import {framePieces} from './lib/frame';
import {layout} from './lib/layout';
import {nativeSource} from './lib/native';
import {fabricationFiles} from './lib/fabrication';
import {defaults,parameters} from './configurator';
import presets from './presets.json';
import product from './product.json';
export {layout,twinPin} from './lib/layout';
export {framePieces,frameProfiles,guideProfile,guideShape,guideSocketPoints,guideSlot} from './lib/frame';
export {channelPieces,innerBearingParameters} from './lib/channel';
export {nutShape,nutPiece,nutBore,shaftShape,shaftPiece,crankPiece,sleevePiece} from './lib/linkage';
export {threadLayout} from './lib/native';
export {cuttingProfiles} from './lib/fabrication';
export {libraries} from '../tr8-quad-cnc-actuator/part';
export {defaults,parameters} from './configurator';

export function pieces(p:Parameters,state='assembled') {
  return [...cncChannels(p,state,layout).flatMap(channel=>channelPieces(p,channel.angle).map(piece=>placeCncPiece(piece,channel))),...framePieces(bearingKit(p))];
}
const build=(p:Parameters,state:string)=>componentGeometry(libraries,pieces(p,state));
const part:PartDefinition={
  identityParameters: (p) => ({ ...p, angleA: 0, angleB: 0, angleC: 0, angleD: 0 }),
  id:'tr8-quad-twin-pin-actuator',name: 'TR8×8(P2) rotary actuator · GMP16T-TEC1636 · 4 outputs · Ø64 laser steel twin-pin · ±20°',
  product:product as ProductProfile,category:'MOTORS & ACTUATORS',subgroup:'MOTOR ASSEMBLIES',icon:'gear',
  complexity:'One-piece nuts and cranks · four laser slot guides',
  description:'Four compact one-piece brass TR8 nuts each have two integral trunnions: an outward one in one solid crank and an inward one in a straight laser-guide slot. Four offset laser guide plates also carry the inner shaft bearings. Three laser discs and purchased 30 mm columns retain the Ø64 frame.',
  keywords:['TR8','TR8x8','twin pin','two sided nut','washer nut','laser','slot guide','one piece crank','64 mm','four drives','SMF63ZZ','SMB','Prom.ua','MF105','MF106','MF63'],
  defaults,parameters,presets:presets as Preset[],presetMatchKeys:['motorModel','bearingKit'],
  states:[{id:'assembled',label:'Independent outputs',description:'Set four independent output angles.'},
    {id:'negative-limit',label:'All −20°',description:'All outputs at their negative limits.'},
    {id:'positive-limit',label:'All +20°',description:'All outputs at their positive limits.'}],
  validate(p,state) {
    if(p.bearingKit!==undefined&&!['prom-smb','reference'].includes(String(p.bearingKit)))return['Choose a supported bearing set.'];
    if(!['361-12','107-12','361-24','107-24'].includes(String(p.motorModel)))return['Choose a supported gearmotor.'];
    if(['A','B','C','D'].some(id=>!Number.isFinite(Number(p['angle'+id]))||Math.abs(Number(p['angle'+id]))>20))return['Keep outputs within ±20°.'];
    return pieces(p,state).flatMap(piece=>validateParameters(libraries.find(definition=>definition.id===piece.component.libraryId)!,piece.component.parameters,piece.component.state));
  },
  composition:p=>({components:pieces({...p,angleA:0,angleB:0,angleC:0,angleD:0}).map(piece=>piece.component),
    issues:['Assign fits and loads for the custom short TR8 nuts, trunnions, Ø3 journals and captured laser guide tabs.']}),
  buildGeometry:build,
  dimensions(p,state){const model=build(p,state);try{return new Box3().setFromObject(model,true).getSize(new Vector3()).toArray() as [number,number,number];}finally{disposeModel(model);}},
  python:nativeSource,
  notes:'Default bearing set: SMB MF105 2Z on all eight screw seats, MF106 2Z on four outer outputs, and MF63 2Z in four central guides; all are sourced from Prom.ua. MF105 bearing centres move inward0.2 mm and the existing four thrust sleeves per drive are resized. The inner sleeves extend to the thread-root shoulders, so only two external screw rings and grooves remain per screw. Eight rings and eight grooves are removed per block. No adapters or extra parts. The reference selection retains the previous bearings, sleeves and13.02 mm screw seats. Reference construction: New corrected twin-pin version; all earlier variants remain. Each nut is ONE manufactured brass component, not a purchased H nut inside a carrier. It has an 8 mm axial length, 13 mm round envelope, opposed 10 mm flats, and two integral 4 mm trunnions. The outward trunnion travels in one 3 mm monolithic closed-slot crank; its transverse shaft pin is match-drilled. The inward trunnion moves in a straight 4.1 mm laser slot, providing anti-roll guidance. Four identical 3 mm guide plates sit at local Y=-8.05..-5.05 in an offset pinwheel, with centred end tabs captured in the middle/end disc slots. Each also seats one EZO SMF63ZZ 3×6×2.5 inner bearing. The shaft is extended inward with a 3 mm journal and a 3.6 mm inner-race-only shoulder; its outer body/journal stays 6 mm and uses one original SMF106ZZ. This replaces the former pair of close outboard bearings with a wider bearing span. Three main discs, 30 mm purchased columns, motor/screw positions and 50 mm screws remain. Nominal nut-to-shaft clearance is 0.5 mm throughout ±20°. Finish bearing pilots and tabs; qualify short nut thread engagement, pin bending, slot wear, journal fatigue, fits and lubrication. There are no laminated cranks, separate nut carriers or milled central spines in this variant.',
  sources:[{label:'SMB bearings in stock on Prom.ua',url:'https://prom.ua/p969387376-podshipnik-smb-106.html'},{label:'EZO SMF63ZZ inner bearing dimensions',url:'https://www.ezo-brg.co.jp/english/product/spec.php?eid=00184&unit=mm'},
    {label:'EZO SMF106ZZ outer bearing dimensions',url:'https://www.ezo-brg.co.jp/english/product/spec.php?eid=00582'}],
  fabricationFiles:p=>fabricationFiles(p,pieces({...p,angleA:0,angleB:0,angleC:0,angleD:0})),
};
export default part;

export {bearingKit,stockBearingPieces,screwSleeves,shoulderScrewPiece,type BearingKit} from './lib/bearings';
