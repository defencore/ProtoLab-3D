import type {Parameters} from '../../../core/types';
import type {ConfiguredPiece} from '../../../core/assembly/detail-instances';
import {detailComponent} from '../../../core/component-recipes';
import {box,cylinder,subtract,union,type Shape} from '../../../core/assembly/boundary/shapes';
import {channelPieces as previousChannel} from '../../tr8-quad-twin-pin-actuator/part';
import {layout,compact as d} from './layout';

const axial=(radius:number,from:number,to:number)=>cylinder(radius,to-from,[0,from,0],'y');
export function shaftShape(angle:number):Shape {
  const groove=subtract(axial(3.1,layout.outputClip-.4,layout.outputClip+.4),axial(2.85,layout.outputClip-.5,layout.outputClip+.5));
  return {kind:'transform',translation:[0,0,0],rotation:[0,angle,0],child:subtract(
    union(axial(3,d.mainShaftStart,layout.outputTail),axial(1.8,d.journalShoulder,d.mainShaftStart+.05),axial(1.5,d.shaftEnd,d.journalShoulder+.05)),
    groove,cylinder(1,6.2,[-3.1,8.05,0],'x'),box([8,6.4,4],[-4,layout.outputTail-6.2,2.5]))};
}
export function shaftPiece(angle:number):ConfiguredPiece {
  const label='Short output shaft · 29.95 mm · Ø6 body and Ø3 inner journal';
  const component=detailComponent('output-shaft',label,shaftShape(angle));
  component.manufacturing={material:'Steel; grade, fits and shoulder radii per drawing',blank:'Diameter 6 mm bar, 30 mm minimum plus allowance',
    processes:['turning','drilling','milling'],requirements:[
      'Keep the accepted inner journal from Y=-7.45 to -4.45 and 3.6 mm shoulder to -4.05 mm. Face the outward end at Y=22.5 mm.',
      'Move the DIN471 groove centre to Y=14.4 mm; preserve its 0.8 mm width and 5.7 mm root diameter. Output flat begins at Y=16.3 mm.',
      'Keep the crank cross-hole centre at Y=8.05 mm. Qualify the unchanged Ø3 journal and pin fit for the intended load.',
    ]};
  return {component,label,color:0xaeb8c0,requireSingleSolid:true};
}
export function sleevePiece():ConfiguredPiece {
  const label='Short inner-race sleeve · 6.05×6.85×0.95 mm';
  const component=detailComponent('output-long-spacer',label,
    subtract(axial(3.425,d.sleeveFrom,d.sleeveTo),axial(3.025,d.sleeveFrom-.1,d.sleeveTo+.1)));
  component.manufacturing={material:'Steel; fit per drawing',blank:'Precision tube or turned round stock',processes:['turning'],
    requirements:['Finish the 0.95 mm sleeve to bear only on the SMF106ZZ inner ring. Set final axial float with the complete stack.']};
  return {component,label,color:0xaeb8c0,requireSingleSolid:true};
}
export function channelPieces(p:Parameters,angle:number):ConfiguredPiece[] {
  return previousChannel(p,angle).map(piece=>{
    const id=piece.component.id;
    if(id==='output-shaft')return shaftPiece(angle);
    if(id==='output-long-spacer')return sleevePiece();
    if(!['output-bearing-1','output-spacer','output-circlip-1'].includes(id))return piece;
    const translation=[...piece.component.placement.translation] as [number,number,number];translation[1]+=d.outerShift;
    return {...piece,component:{...piece.component,placement:{...piece.component.placement,translation}}};
  });
}
