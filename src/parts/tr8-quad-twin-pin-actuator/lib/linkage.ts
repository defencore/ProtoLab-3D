import { detailComponent } from '../../../core/component-recipes';
import { box,cylinder,subtract,union,type Shape } from '../../../core/assembly/boundary/shapes';
import type {ConfiguredPiece} from '../../../core/assembly/detail-instances';
import {tr8NutShape,type Tr8Lead} from '../../tr8-compact-actuator/part';
import {forkShape,linkage} from '../../tr8-quad-cnc-actuator/part';
import {layout,twinPin as d} from './layout';

const axial=(r:number,from:number,to:number,z=layout.lever)=>cylinder(r,to-from,[from,0,z],'x');
const output=(r:number,from:number,to:number)=>cylinder(r,to-from,[0,from,0],'y');
const rotate=(shape:Shape,angle:number):Shape=>({kind:'transform',translation:[0,0,0],rotation:[0,angle,0],child:shape});

export function manufactured(id:string,label:string,shape:Shape,color:number,manufacturing:NonNullable<ConfiguredPiece['component']['manufacturing']>):ConfiguredPiece {
  const component=detailComponent(id,label,shape);component.manufacturing=manufacturing;
  return {component,label,color,requireSingleSolid:true};
}

/** Reuse the matching female tool, including its neutral helix phase. */
export function nutBore(center:number,threadLead:Tr8Lead=8):Shape {
  const original=tr8NutShape({flangeFaceX:center-6,neutralFlangeFaceX:-6,screwAxisZ:layout.lever,longAxis:'z',threadLead});
  if(original.kind!=='subtract'||original.children.length!==4)throw new Error('TR8 female tool contract changed.');
  return original.children[1];
}
export function nutShape(center:number,threadLead:Tr8Lead=8):Shape {
  const body:Shape={kind:'intersect',children:[axial(d.nutRadius,center-d.nutLength/2,center+d.nutLength/2),
    box([d.nutLength,2*d.nutFlatHalfWidth,2*d.nutRadius],[center-d.nutLength/2,-d.nutFlatHalfWidth,layout.lever-d.nutRadius])]};
  return subtract(union(body,
    cylinder(d.pinDiameter/2,d.outerPinEnd-4.6,[center,4.6,layout.lever],'y'),
    cylinder(d.pinDiameter/2,-4.6-d.innerPinEnd,[center,d.innerPinEnd,layout.lever],'y')),
    nutBore(center,threadLead));
}
export function nutPiece(center:number,threadLead:Tr8Lead=8):ConfiguredPiece {
  return manufactured('lead-nut',`Two-sided TR8×${threadLead}(P2) nut · one brass washer with two integral Ø4 trunnions`,nutShape(center,threadLead),0xc7a448,{
    material:'Bearing brass; grade and thread fit per production drawing',blank:'Brass block 8 x 20 x 13 mm minimum plus allowance',
    processes:['milling','turning','drilling'],requirements:[
      'Machine the 8 mm axial nut, 13 mm round envelope, 10 mm opposed flats and BOTH integral 4 mm trunnions from one blank. No separate H nut, carrier or flange bolts.',
      threadLead===8?'Cut the actual four-start Tr8x8(P2) RH internal thread: pitch 2 mm, lead 8 mm, 30 degree included angle. A conventional single-start metric tap is unsuitable.':
        'Cut a single-start Tr8x2(P2) RH internal thread: pitch 2 mm, lead 2 mm, 30 degree included angle. Match the Tr8x2 screw; neither a Tr8x8 nut nor an M8 metric tap is suitable.',
      'Qualify the shorter 8 mm engagement, brass thread wear, pin bending, root radii and lubrication for the intended load.',
    ],
  });
}
export function shaftShape(angle:number):Shape {
  const groove=subtract(output(3.1,layout.outputClip-.4,layout.outputClip+.4),output(2.85,layout.outputClip-.5,layout.outputClip+.5));
  return rotate(subtract(union(output(3,d.mainShaftStart,layout.outputTail),
    output(1.8,d.journalShoulder,d.mainShaftStart+.05),output(1.5,d.shaftEnd,d.journalShoulder+.05)),groove,
    cylinder(1,6.2,[-3.1,linkage.pinCentreY,0],'x'),
    box([8,6.4,4],[-4,layout.outputTail-6.2,2.5])),angle);
}
export function shaftPiece(angle:number):ConfiguredPiece {
  return manufactured('output-shaft','Extended output shaft · Ø6 body · Ø3 inner journal in laser guide',shaftShape(angle),0xaeb8c0,{
    material:'Steel; grade, shoulder radii and fits per production drawing',blank:'Diameter 6 mm round bar, 35 mm minimum plus allowance',
    processes:['turning','drilling','milling'],requirements:[
      'Turn the 3 mm inner journal from Y=-7.45 to -4.45; use a 3.6 mm diameter inner-ring shoulder to Y=-4.05, then the 6 mm body.',
      'Keep the original outer DIN471 groove, output flat and matched 2 mm crank cross-hole. Qualify journal fatigue and concentricity.',
      'The nut underside clears the rotating 6 mm shaft by 0.5 mm nominally over the complete travel.',
    ],
  });
}
export function crankPiece(angle:number):ConfiguredPiece {
  return manufactured('output-crank','One-piece closed-slot crank · 3 mm laser steel · Ø2 matched cross-pin',forkShape(layout,0,angle),0x759bb3,{
    material:'Steel; grade and pin fit per drawing',blank:'One 3 mm steel laser blank',processes:['cutting','drilling'],requirements:[
      'Cut one closed-slot crank per output. Finish its 5.8 mm shaft pilot to 6.05 mm; match-drill/ream the 2 mm transverse pin bore with the shaft.',
      'One monolithic crank, without laminated covers, bridges, welds or clamp bosses.',
    ],
  });
}
export function sleevePiece():ConfiguredPiece {
  return manufactured('output-long-spacer','Outer inner-race sleeve · 6.05×6.85×5.95',subtract(output(3.425,d.sleeveFrom,d.sleeveTo),output(3.025,d.sleeveFrom-.1,d.sleeveTo+.1)),0xaeb8c0,{
    material:'Steel; fit per drawing',blank:'Small precision tube or turned round stock',processes:['turning'],
    requirements:['Contact only the SMF106ZZ inner race. Finish length with the bearing, crank and retaining-ring stack.'],
  });
}
