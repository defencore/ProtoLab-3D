import {Euler,Matrix4} from 'three';
import type {Parameters} from '../../../core/types';
import type {ConfiguredPiece} from '../../../core/assembly/detail-instances';
import previous,{channelPieces as previousChannel,libraries as previousLibraries} from '../../tr8-quad-twin-pin-mini-actuator/part';
import motor from '../../surpass-2845/part';
import {nutPiece,shoulderScrewPiece} from '../../tr8-quad-twin-pin-actuator/part';
import {driveMotion,selectedDrive} from './drive';
import {configureActuatorPiece,actuatorFastenerPiece} from '../../tr8-compact-actuator/part';
import {layout,motorModel,motorRoll,motorFit,inheritedParameters} from './layout';
export const libraries=[...previousLibraries,motor];
export function mountingPoints():[number,number][] {
  const a=motorRoll*Math.PI/180;
  return [-1,1].map(s=>[s*8*Math.sin(a),layout.lever-s*8*Math.cos(a)]);
}
export function channelPieces(p:Parameters,angle:number):ConfiguredPiece[] {
  const drive=selectedDrive(p);
  const pieces=previousChannel({...previous.defaults,...p,...inheritedParameters},angle)
    .filter(piece=>piece.component.id!=='gearmotor'&&!piece.component.id.startsWith('motor-front-M2-'))
    .map(piece=>{
      if(drive.lead===2&&piece.component.id==='lead-screw')return shoulderScrewPiece(angle,drive.lead);
      if(drive.lead===2&&piece.component.id==='lead-nut')return nutPiece(driveMotion(p,angle).nutTravel,drive.lead);
      if(piece.component.id!=='coupling')return piece;
      const label='LF D14 L22 clamp coupling · custom Ø3.175×4 mm bores';
      return {...piece,label,component:{...piece.component,name:label,presetId:undefined,
        parameters:{...piece.component.parameters,boreOption:'other',boreA:3.175,boreB:4},
        procurement:{...piece.component.procurement!,designation:'LF D14L22 Clamp · Other hole Ø3.175×4; specify motor bore fit'},
        placement:{...piece.component.placement,translation:[layout.couplingCentre,0,layout.lever] as [number,number,number]}}};
    });
  const e=new Euler().setFromRotationMatrix(new Matrix4().makeRotationY(Math.PI/2)
    .multiply(new Matrix4().makeRotationZ(motorRoll*Math.PI/180)),'ZYX');
  const motorPiece=configureActuatorPiece(motor,'motor','Surpass Hobby KK2845 3100KV · Ø28×47 mm · shaft Ø3.175',
    {model:motorModel},[layout.motorFront,0,layout.lever],[e.x,e.y,e.z].map(a=>a*180/Math.PI) as [number,number,number],
    'assembled',0xb83b46,motorModel);
  motorPiece.preserveLibraryAppearance=true;
  pieces.push(motorPiece,...mountingPoints().map(([y,z],i)=>actuatorFastenerPiece({
    id:'motor-mount-M3-'+(i+1),diameter:3,length:motorFit.boltLength,
    underHead:[layout.motorFront+motorFit.plateThickness,y,z],direction:[-1,0,0],
  })));
  return pieces;
}
