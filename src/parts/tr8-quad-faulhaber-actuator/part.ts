import {Box3,Vector3} from 'three';
import type {Parameters,PartDefinition,Preset} from '../../core/types';
import type {ProductProfile} from '../../core/product-types';
import {componentGeometry} from '../../core/assembly/detail-instances';
import {disposeModel} from '../../core/mechanical';
import {validateParameters} from '../../core/validation';
import previous from '../tr8-quad-twin-pin-mini-actuator/part';
import {cncChannels,placeCncPiece} from '../tr8-quad-cnc-actuator/part';
import {channelPieces,libraries} from './lib/channel';
import {framePieces,type DiscPattern} from './lib/frame';
import {layout,motorSource} from './lib/layout';
import {nativeSource} from './lib/native';
import {fabricationFiles} from './lib/fabrication';
import {defaults,parameters} from './configurator';
import presets from './presets.json';
import product from './product.json';
export {layout,motorFit,motorRoll,motorModel} from './lib/layout';
export {channelPieces,mountingPoints,libraries} from './lib/channel';
export {framePieces,frameProfiles,discProfile,motorMountCircles,lighteningCircles} from './lib/frame';
export {cuttingProfiles,machiningSchedule} from './lib/fabrication';
export {threadLayout} from '../tr8-quad-twin-pin-actuator/part';
export function pieces(p:Parameters,state='assembled') {
  return [...cncChannels(p,state,layout).flatMap(c=>channelPieces(p,c.angle).map(piece=>placeCncPiece(piece,c))),
    ...framePieces(p.discPattern as DiscPattern)];
}
const neutral=(p:Parameters)=>({...p,angleA:0,angleB:0,angleC:0,angleD:0});
const build=(p:Parameters,state:string)=>componentGeometry(libraries,pieces(p,state));
const part:PartDefinition={...previous,id:'tr8-quad-faulhaber-actuator',name: 'TR8×8(P2) rotary actuator · FAULHABER 2250S024BX4 6855 · 4 outputs · Ø56 laser steel · ±20°',
  product:product as ProductProfile,complexity:'4×2250S024BX4 6855 · direct drive · three laser discs',
  identityParameters:neutral,
  description:'Separate four-drive twin-pin version with original FAULHABER 2250S024BX4 6855 installation solids. Three Ø56 laser discs, tangential cable roots, revised Ø10 pilot/M2 motor mounts and the approved compact TR8 linkage with Prom SMB bearings.',
  keywords:['FAULHABER','2250S024BX4','6855','TR8','TR8x8','24 V','four motors','direct drive','twin pin','56 mm','laser'],
  defaults,parameters,presets:presets as Preset[],presetMatchKeys:['discPattern'],
  states:previous.states?.map(s=>({...s})),
  validate(p,state) {
    if(!['assembled','negative-limit','positive-limit'].includes(state))return['Choose a supported inspection state.'];
    if(!['lightened','solid'].includes(String(p.discPattern)))return['Choose a supported disc construction.'];
    if(Object.keys(p).some(k=>!Object.hasOwn(defaults,k)))return['Motor model and bearing set are fixed for this execution.'];
    if(['A','B','C','D'].some(id=>!Number.isFinite(Number(p['angle'+id]))||Math.abs(Number(p['angle'+id]))>20))return['Keep each output within ±20°.'];
    return pieces(p,state).flatMap(piece=>validateParameters(libraries.find(d=>d.id===piece.component.libraryId)!,piece.component.parameters,piece.component.state));
  },
  composition:p=>({components:pieces(neutral(p)).map(piece=>piece.component),issues:[
    'Direct BLDC drive requires four external Hall-compatible controllers and travel limits. No output load/speed rating is assigned.',
    'Manufacturer M2 bores are simplified tap-drill cylinders; the intended threaded engagements are not interference-fit joints.',
  ]}),
  buildGeometry:build,
  dimensions(p,state){const model=build(p,state);try{return new Box3().setFromObject(model,true).getSize(new Vector3()).toArray() as [number,number,number];}finally{disposeModel(model);}},
  python:nativeSource,
  sources:[{label:'FAULHABER 2250S024BX4 6855 · exact product',url:motorSource},
    {label:'Official drawing and motor data',url:'https://eshop.faulhaber.com/media/cd/65/80/1775629746/EN_2250_BX4_DFF.pdf'},
    {label:'Official 2250S_BX4 STEP archive',url:'https://eshop.faulhaber.com/media/e2/g0/85/1755618901/2250_BX4_3D-CAD.zip'}],
  notes:'Four bare 24 V FAULHABER 2250S024BX4 6855 motors, without gearboxes. Use the exact supplier installation solid; no synthetic motor mesh conversion. Motor fronts stay at X=-51 mm and screw axes stay at radius16 mm. Body diameter22±0.1 mm; motor roll clocks the cable roots tangentially. Motor housing remains fixed while the coupling and screw rotate. Each front pilot is Ø10×1 mm and each motor has six M2 blind holes,3 mm deep, on a Ø17 circle; this frame uses two opposed holes and M2×5 screws with2 mm nominal engagement. A3×4 LF coupling retains6.4 mm nominal engagement on the motor shaft. Three56×3 mm main discs retain the Ø5 centre passage, existing columns and bearing/guide tab datums. The approved50 mm screws, twin-pin nuts, monolithic cranks, SMB MF105/MF106/MF63 bearings and two external screw rings per drive remain. The motor plate lightening holes move inward to protect the new pilot/bolt pattern. Free175 mm cable runs, controllers and wiring are outside the installation envelope. Torque and speed differ from the GMP16 gearbox variants; do not reuse their output rating or control setup. Assign load, thermal duty, braking/back-drive behaviour and low-speed commutation requirements before manufacture. Previous versions remain separate.',
  fabricationFiles:p=>fabricationFiles(p,pieces(neutral(p))),
};
export default part;
