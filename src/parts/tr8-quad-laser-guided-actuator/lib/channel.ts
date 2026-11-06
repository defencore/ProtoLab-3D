import type { Parameters } from '../../../core/types';
import { channelPieces as originalChannelPieces } from '../../tr8-quad-cnc-actuator/part';
import { laserLayout } from './layout';
import { crankPieces } from './crank';

/** Only the output crank changes; the shaft, pressed pin and every drive remain. */
export function laserChannelPieces(p:Parameters,angle:number) {
  if(p.crankConstruction!=='laminated'&&p.crankConstruction!=='solid') throw new Error('Choose a supported crank construction.');
  const pieces=originalChannelPieces(p,angle,laserLayout);
  return pieces.flatMap(piece=>{
    if(piece.component.id!=='output-rear-crank')return[piece];
    if(p.crankConstruction==='laminated')return crankPieces(laserLayout,angle);
    const label='One-piece laser crank · 3 mm steel · matched transverse drill';
    return[{...piece,label,component:{...piece.component,name:label,manufacturing:{
      material:'Steel; grade and fits per drawing',blank:'3 mm steel sheet',processes:['cutting','drilling'] as ('cutting'|'drilling')[],
      requirements:['Laser cut the closed slot and shaft pilot, deburr and finish the bore. Match-drill/ream the transverse 2 mm pin hole with the output shaft.'],
    }}}];
  });
}
