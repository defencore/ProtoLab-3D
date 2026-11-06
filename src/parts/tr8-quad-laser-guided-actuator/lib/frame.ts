import { detailComponent } from '../../../core/component-recipes';
import { cylinder, prism, subtract, union, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import standoff from '../../pcb-standoff/part';
import { configureActuatorPiece, actuatorFastenerPiece, alignActuatorThreads } from '../../tr8-compact-actuator/part';
import { laserLayout as layout } from './layout';
import { polygonLoop, type LaserPoint, type LaserCircle, type LaserProfile } from './profiles';

export const sheetThickness = 3;
export const discStations = [layout.motorPlateX, layout.middleBase[0], layout.endPlateX] as const;
export const cheekDimensions = {
  thickness:3, bossSide:14.2, finishedBore:10.02, pilotBore:9.8,
  armHeight:3, shoulderHeight:5, shoulderLength:3, tabDepth:2.7,
  tabHeight:3, slotWidth:3.1, slotHeight:3.1,
} as const;
export const columnStages = [
  {preset:'dremec-115x30',origin:-48,rotation:90},
  {preset:'dremec-215x30',origin:15,rotation:-90},
] as const;

export function columnLines(): LaserPoint[] {
  return [0,1,2,3].map(index => {
    const angle=(layout.postClock+90*index)*Math.PI/180;
    return [layout.postRadius*Math.cos(angle),layout.postRadius*Math.sin(angle)];
  });
}
function channelPoint(y:number,z:number,unit:number):LaserPoint {
  const angle=(layout.clock+90*unit)*Math.PI/180;
  return [(layout.outputRadial+y)*Math.cos(angle)-z*Math.sin(angle),(layout.outputRadial+y)*Math.sin(angle)+z*Math.cos(angle)];
}
function square(center:LaserPoint,width:number,height=width,angle=0):LaserPoint[] {
  const c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180);
  return [[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]].map(([x,y])=>[center[0]+c*x-s*y,center[1]+s*x+c*y]);
}
const cheekLow = (outer:boolean) => outer ? layout.outputBearingCentres[1]+1.5-.6-3 : layout.outputBearingCentres[0]-1.5+.6;
const flatPolygon = (points:LaserPoint[],height:number,origin=0):Shape => prism(points,height,origin,'z');
function flatShape(circles:LaserCircle[],polygons:LaserPoint[][],outerCircle:boolean):Shape {
  const stock=outerCircle?cylinder(circles[0].radius,sheetThickness,[...circles[0].center,0]):flatPolygon(polygons[0],sheetThickness);
  const holes=[...circles.slice(outerCircle?1:0).map(c=>cylinder(c.radius,sheetThickness+.2,[...c.center,-.1])),
    ...polygons.slice(outerCircle?0:1).map(p=>flatPolygon(p,sheetThickness+.2,-.1))];
  return subtract(stock,union(...holes));
}

export interface ReceiverSlot {
  id:string; discId:'fixed-disc'|'end-disc'; unit:number; outer:boolean;
  points:LaserPoint[]; center:LaserPoint; receiverSpanX:[number,number]; tabSpanX:[number,number];
  shoulderFaceX:number; width:number; height:number;
}
export function receiverSlots(): ReceiverSlot[] {
  const slots:ReceiverSlot[]=[];
  for(let unit=0;unit<4;unit++)for(const outer of [false,true])for(const end of [0,1]) {
    const low=cheekLow(outer),half=(cheekDimensions.slotWidth)/2;
    const local=square([low+sheetThickness/2,0],cheekDimensions.slotWidth,cheekDimensions.slotHeight);
    const station=end?layout.endPlateX:layout.middleBase[0];
    slots.push({id:`channel-${unit+1}-${outer?'outer':'inner'}-cheek-${end?'end':'fixed'}-slot`,
      discId:end?'end-disc':'fixed-disc',unit,outer,points:local.map(([y,z])=>channelPoint(y,z,unit)),
      center:channelPoint(low+sheetThickness/2,0,unit),receiverSpanX:[station,station+sheetThickness],
      tabSpanX:end?[layout.endPlateX,layout.endPlateX+cheekDimensions.tabDepth]:[layout.middleBase[1]-cheekDimensions.tabDepth,layout.middleBase[1]],
      shoulderFaceX:end?layout.endPlateX:layout.middleBase[1],width:2*half,height:cheekDimensions.slotHeight});
  }
  return slots;
}

export function discProfile(role:'motor'|'fixed'|'end',pilot=true):LaserProfile {
  const circles:LaserCircle[]=[{center:[0,0],radius:layout.diameter/2},...columnLines().map(center=>({center,radius:1.7}))];
  for(let unit=0;unit<4;unit++) {
    if(role==='motor') {
      circles.push({center:channelPoint(0,layout.lever,unit),radius:3.1});
      for(const offset of [-5.25,5.25])circles.push({center:channelPoint(0,layout.lever+offset,unit),radius:1.1});
    } else circles.push({center:channelPoint(0,layout.lever,unit),radius:(pilot?12.8:13.02)/2});
  }
  const polygons:LaserPoint[][]=role==='motor'?[]:[square([0,0],8.1,8.1,layout.clock),...receiverSlots().filter(s=>s.discId===role+'-disc').map(s=>s.points)];
  return {id:role+'-disc',label:`${role==='motor'?'Motor':role==='fixed'?'Fixed screw bearing':'End screw bearing'} disc · Ø64 × 3 mm steel`,
    thickness:sheetThickness,quantity:1,shape:flatShape(circles,polygons,true),circles,loops:polygons.map(polygonLoop)};
}

/** One cutting profile makes all eight centred bearing support plates. */
export function cheekProfile(pilot=true):LaserProfile {
  const b=cheekDimensions.bossSide/2,left=layout.middleBase[1],right=layout.endPlateX;
  const t=cheekDimensions.tabDepth,a=cheekDimensions.armHeight/2,s=cheekDimensions.shoulderHeight/2,w=cheekDimensions.shoulderLength;
  const points:LaserPoint[]=[
    [left-t,-a],[left,-a],[left,-s],[left+w,-s],[left+w,-a],[-b,-a],[-b,-b],[b,-b],[b,-a],
    [right-w,-a],[right-w,-s],[right,-s],[right,-a],[right+t,-a],
    [right+t,a],[right,a],[right,s],[right-w,s],[right-w,a],[b,a],[b,b],[-b,b],[-b,a],
    [left+w,a],[left+w,s],[left,s],[left,a],[left-t,a],
  ];
  const circles=[{center:[0,0] as LaserPoint,radius:(pilot?cheekDimensions.pilotBore:cheekDimensions.finishedBore)/2}];
  return {id:'output-bearing-cheek',label:'Centred output bearing cheek · 3 mm steel · quantity 8',thickness:3,quantity:8,
    shape:flatShape(circles,[points],false),circles,loops:[polygonLoop(points)]};
}
export function laserProfiles(pilot=true):LaserProfile[] {return [discProfile('motor',pilot),discProfile('fixed',pilot),discProfile('end',pilot),cheekProfile(pilot)];}

function discShape(role:'motor'|'fixed'|'end'):Shape {
  const station=role==='motor'?layout.motorPlateX:role==='fixed'?layout.middleBase[0]:layout.endPlateX;
  return {kind:'transform',translation:[station,0,0],rotation:[90,0,90],child:discProfile(role,false).shape};
}
export interface BearingCheek {id:string;label:string;unit:number;outer:boolean;lowY:number;shape:Shape;tabSpansX:[[number,number],[number,number]];}
export function bearingCheeks():BearingCheek[] {
  const out:BearingCheek[]=[];
  for(let unit=0;unit<4;unit++)for(const outer of [false,true]) {
    const lowY=cheekLow(outer),angle=(layout.clock+unit*90)*Math.PI/180;
    out.push({id:`channel-${unit+1}-output-${outer?'outer':'inner'}-cheek`,label:`Channel ${unit+1} ${outer?'outer':'inner'} bearing cheek · centred tabbed 3 mm laser plate`,
      unit,outer,lowY,tabSpansX:[[layout.middleBase[1]-cheekDimensions.tabDepth,layout.middleBase[1]],[layout.endPlateX,layout.endPlateX+cheekDimensions.tabDepth]],
      shape:{kind:'transform',translation:[0,layout.outputRadial*Math.cos(angle),layout.outputRadial*Math.sin(angle)],rotation:[layout.clock+unit*90,0,0],
        child:{kind:'transform',translation:[0,lowY+sheetThickness,0],rotation:[90,0,0],child:cheekProfile(false).shape}}});
  }
  return out;
}
function sheetPiece(id:string,label:string,shape:Shape):ConfiguredPiece {
  const component=detailComponent(id,label,shape);
  component.manufacturing={material:'Steel; grade and final fits per production drawing',blank:'3 mm steel sheet',processes:['cutting','drilling'],requirements:[
    'Laser cut the supplied 1:1 profile, deburr and finish bearing pilots to their assigned fits.',
    'Fit the centred 2.7 mm tabs in the matching 3.1 mm receiver slots. Assign actual sheet thickness and tab fits before manufacture.',
    'The three bolted discs capture all tabbed parts axially; check frame loads, tab bearing stress and alignment for the application.',
  ]};
  return{component,label,color:0x79909f,requireSingleSolid:true};
}

/** Three laser discs, eight tabbed supports, eight catalog columns and eight bolts. */
export function framePieces():ConfiguredPiece[] {
  const pieces:ConfiguredPiece[]=[...(['motor','fixed','end'] as const).map(role=>sheetPiece('laser-'+role+'-disc',discProfile(role,false).label,discShape(role))),
    ...bearingCheeks().map(cheek=>sheetPiece(cheek.id,cheek.label,cheek.shape))];
  for(const [index,[y,z]] of columnLines().entries()) {
    for(const [stageIndex,stage] of columnStages.entries()) {
      const preset=standoff.presets.find(p=>p.id===stage.preset);
      if(!preset)throw new Error('Required standard standoff is missing: '+stage.preset);
      pieces.push(configureActuatorPiece(standoff,`frame-column-${index+1}-${stageIndex+1}`,`Frame column ${index+1}/${stageIndex+1} · DREMEC ${preset.name}`,
        {...standoff.defaults,...preset.parameters},[stage.origin,y,z],[0,stage.rotation,0],'default',0xb6bec6,preset.id));
    }
    pieces.push(actuatorFastenerPiece({id:`frame-front-bolt-${index+1}`,diameter:3,length:8,underHead:[layout.motorPlateX,y,z],direction:[1,0,0]}),
      actuatorFastenerPiece({id:`frame-rear-bolt-${index+1}`,diameter:3,length:8,underHead:[layout.endPlateX+3,y,z],direction:[-1,0,0]}));
  }
  return alignActuatorThreads(pieces);
}
