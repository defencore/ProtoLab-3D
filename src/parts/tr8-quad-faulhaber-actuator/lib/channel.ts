import {Euler,Matrix4} from 'three';
import type {Parameters} from '../../../core/types';
import type {ConfiguredPiece} from '../../../core/assembly/detail-instances';
import previous,{channelPieces as previousChannel,libraries as previousLibraries} from '../../tr8-quad-twin-pin-mini-actuator/part';
import motor from '../../faulhaber-bx4/part';
import {configureActuatorPiece,actuatorFastenerPiece} from '../../tr8-compact-actuator/part';
import {layout,motorModel,motorRoll,motorFit,inheritedParameters} from './layout';
export const libraries=[...previousLibraries,motor];
export function mountingPoints():[number,number][] {
  const a=motorRoll*Math.PI/180;
  return [-1,1].map(s=>[s*8.5*Math.cos(a),layout.lever+s*8.5*Math.sin(a)]);
}
export function channelPieces(p:Parameters,angle:number):ConfiguredPiece[] {
  const pieces=previousChannel({...previous.defaults,...p,...inheritedParameters},angle)
    .filter(piece=>piece.component.id!=='gearmotor'&&!piece.component.id.startsWith('motor-front-M2-'));
  const e=new Euler().setFromRotationMatrix(new Matrix4().makeRotationY(Math.PI/2)
    .multiply(new Matrix4().makeRotationZ(motorRoll*Math.PI/180)),'ZYX');
  const drive=configureActuatorPiece(motor,'motor','FAULHABER 2250S024BX4 6855 · 24 V · Ø22×51.8 mm',
    {model:motorModel},[layout.motorFront,0,layout.lever],[e.x,e.y,e.z].map(a=>a*180/Math.PI) as [number,number,number],
    'assembled',0xb7bec7,'2250s024bx4-6855');
  // The supplier installation solid includes a fixed housing and a circular shaft.
  // Rotate the screw/coupling with the drive phase; keep the motor housing stationary.
  drive.preserveLibraryAppearance=false;
  pieces.push(drive,...mountingPoints().map(([y,z],i)=>actuatorFastenerPiece({
    id:'motor-mount-M2-'+(i+1),diameter:2,length:motorFit.boltLength,
    underHead:[layout.motorFront+motorFit.plateThickness,y,z],direction:[-1,0,0],
  })));
  return pieces;
}
