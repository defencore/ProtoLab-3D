import type {Parameters} from '../../../core/types';
import {tr8ThreadForLead,type Tr8Lead} from '../../tr8-compact-actuator/part';
import {threadLayout as originalThreadLayout} from '../../tr8-quad-twin-pin-actuator/part';
import {layout} from './layout';

export function selectedDrive(p:Parameters) {
  const model=p.screwModel??'tr8x8-p2';
  if(model!=='tr8x8-p2'&&model!=='tr8x2-p2')throw new Error('Choose TR8×8(P2) or TR8×2(P2).');
  const lead:Tr8Lead=model==='tr8x2-p2'?2:8;
  return {...tr8ThreadForLead(lead),model,designation:`TR8×${lead}(P2) RH`};
}
export function threadLayout(p:Parameters) {
  return {...originalThreadLayout,threadLead:selectedDrive(p).lead};
}
export function driveMotion(p:Parameters,angle:number) {
  const {lead}=selectedDrive(p),radians=angle*Math.PI/180;
  const nutTravel=layout.lever*Math.tan(radians);
  return {nutTravel,motorRotation:-360*nutTravel/lead,
    idealTorqueRatio:2*Math.PI*layout.lever/(lead*Math.cos(radians)**2)};
}
