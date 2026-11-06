import { Euler, Matrix4, Vector3 } from 'three';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import type { Parameters } from '../../../core/types';
import { frameLayout } from './layout';
export type Vec = [number,number,number];
export interface QuadChannel { id:'a'|'b'|'c'|'d'; clock:number; origin:Vec; angle:number; }
export const packing = frameLayout;
export function channels(p:Parameters,state='assembled'):QuadChannel[] {
  return (['a','b','c','d'] as const).map((id,index)=>{
    const clock=packing.clock+index*90, radians=clock*Math.PI/180;
    const angle=state==='negative-limit'?-20:state==='positive-limit'?20:Number(p['angle'+id.toUpperCase()]);
    return {id,clock,angle,origin:[0,packing.radius*Math.cos(radians),packing.radius*Math.sin(radians)]};
  });
}
export function placePiece(piece:ConfiguredPiece,channel:QuadChannel):ConfiguredPiece {
  if ((piece.position??[0,0,0]).some((value)=>Math.abs(value)>1e-10) || Math.abs(piece.z??0)>1e-10 || Math.abs(piece.angle??0)>1e-10)
    throw new Error('Quad channel pieces must express their complete local placement in the occurrence.');
  const c=piece.component;
  const outer=new Matrix4().makeRotationX(channel.clock*Math.PI/180).setPosition(...channel.origin);
  const frame=new Matrix4().makeRotationFromEuler(new Euler(...c.placement.rotation.map((value)=>value*Math.PI/180) as Vec,'ZYX')).setPosition(...c.placement.translation);
  const world=outer.multiply(frame), rotation=new Euler().setFromRotationMatrix(world,'ZYX');
  const label=channel.id.toUpperCase()+' · '+piece.label;
  return {...piece,label,component:{...c,id:channel.id+'-'+c.id,name:label,placement:{translation:new Vector3().setFromMatrixPosition(world).toArray() as Vec,rotation:[rotation.x,rotation.y,rotation.z].map((value)=>value*180/Math.PI) as Vec}}};
}
