import {Box3,Vector3} from 'three';
import type {Parameters,PartDefinition,Preset} from '../../core/types';
import type {ProductProfile} from '../../core/product-types';
import {componentGeometry} from '../../core/assembly/detail-instances';
import {disposeModel} from '../../core/mechanical';
import {validateParameters} from '../../core/validation';
import {withGeometryMode} from '../../core/geometry-mode';
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
export {framePieces,frameProfiles,discProfile,motorMountCircles,lighteningCircles,columnLines,guideSocketPoints} from './lib/frame';
export {cuttingProfiles,machiningSchedule} from './lib/fabrication';
export {threadLayout,selectedDrive,driveMotion} from './lib/drive';
export function pieces(p:Parameters,state='assembled') {
  return [...cncChannels(p,state,layout).flatMap(c=>channelPieces(p,c.angle).map(piece=>placeCncPiece(piece,c))),
    ...framePieces(p.discPattern as DiscPattern)];
}
const neutral=(p:Parameters)=>({...p,angleA:0,angleB:0,angleC:0,angleD:0});
const build=(p:Parameters,state:string)=>componentGeometry(libraries,pieces(p,state));
const part:PartDefinition={...previous,id:'tr8-quad-surpass-actuator',name: 'TR8×2/8(P2) rotary actuator · Surpass Hobby KK2845 3100KV · 4 outputs · Ø70 laser steel · ±20°',
  product:product as ProductProfile,complexity:'4×Surpass2845 3100KV · direct drive · three laser discs',
  identityParameters:neutral,
  description:'Four Surpass Hobby KK2845 3100KV inrunners on a radius20.5 mm pitch circle, with three Ø70 laser discs, custom Ø3.175×4 couplings and the retained twin-pin TR8 linkage. Reconstructed analytic installation motors; Prom SMB bearings and standard30 mm columns.',
  keywords:['Surpass','Hobby','KK','KingKong','2845','3100KV','TR8','TR8x8','TR8x2','single start','2 mm lead','four motors','direct drive','twin pin','70 mm','laser'],
  defaults,parameters,presets:presets as Preset[],presetMatchKeys:['screwModel','discPattern'],
  states:previous.states?.map(s=>({...s})),
  validate(p,state) {
    if(!['assembled','negative-limit','positive-limit'].includes(state))return['Choose a supported inspection state.'];
    if(!['lightened','solid'].includes(String(p.discPattern)))return['Choose a supported disc construction.'];
    if(p.screwModel!==undefined&&!['tr8x8-p2','tr8x2-p2'].includes(String(p.screwModel)))return['Choose TR8×8(P2) or TR8×2(P2).'];
    if(Object.keys(p).some(k=>!Object.hasOwn(defaults,k)))return['Motor model and bearing set are fixed for this execution.'];
    if(['A','B','C','D'].some(id=>!Number.isFinite(Number(p['angle'+id]))||Math.abs(Number(p['angle'+id]))>20))return['Keep each output within ±20°.'];
    return pieces(p,state).flatMap(piece=>validateParameters(libraries.find(d=>d.id===piece.component.libraryId)!,piece.component.parameters,piece.component.state));
  },
  composition:p=>({components:pieces(neutral(p)).map(piece=>piece.component),issues:[
    'Direct BLDC drive requires four reversible sensorless controllers and travel limits. No output load/speed rating is assigned.',
    'Motor external geometry is reconstructed from a drawing. Confirm blind-hole insertion depth and route free cables separately.',
  ]}),
  buildGeometry:build,
  dimensions(p,state){const model=build(p,state);try{return new Box3().setFromObject(model,true).getSize(new Vector3()).toArray() as [number,number,number];}finally{disposeModel(model);}},
  // Working helices do not change this assembly's external installation envelope.
  exportDimensions(p,state){return withGeometryMode('simple',()=>part.dimensions(p,state));},
  python:nativeSource,
  sources:[{label:'Surpass Hobby2845 3100KV branded dimensional drawing',url:motorSource},
    {label:'Surpass Hobby manufacturer catalog',url:'https://www.ytk-group.co.jp/products/wp-content/uploads/2021/02/Catalog-from-Suprass-Hobby_compressed-1-1.pdf'}],
  notes:'Four Surpass Hobby KK2845 3100KV sensorless inrunners replace the geared motors in a separate Ø70 execution. Body28×47 mm, shaft3.175×15 mm, mounting cross16/19 mm with M3 threads. External motor geometry is an analytic drawing-based reconstruction, not manufacturer CAD. Cap seams and nominal hole depth are illustrative; confirm permitted screw insertion on actual motors. Motor/screw axes move to radius20.5 mm and output axes remain in the four45+90n degree directions. Four motors have approximately0.99 mm nominal adjacent body clearance. The motor plate uses Ø8.2 clearance holes and two M3×5 screws per motor on the16 mm cross. Use LF D14L22 Clamp Other-hole couplings specified at Ø3.175×4 mm; do not force the motor shaft into a3 mm hub. Couplings move+1.8 mm to X=-32.4, giving7 mm shaft engagement at each side and0.4 mm clearance to the screw shoulder and retaining the50 mm screws. Existing columns stay30 mm long; all three main discs stay3 mm thick and retain the central Ø5 passage. Shift guide/cheek tabs and screw bearing holes with their channel datums. Nut/crank/shaft geometry and±20 degree travel are retained. Only two external screw retaining rings remain per drive. Free phase cables, rear boots, connectors and electronics are outside the installation envelope. Use a reversible sensorless BLDC controller and qualify its low-speed and reversal behaviour for the short TR8 stroke; KV is not an output torque rating. Earlier FAULHABER and GMP variants remain separate.',
  fabricationFiles:p=>fabricationFiles(p,pieces(neutral(p))),
};
export default part;
