import {cylinder,prism,subtract,union,type Shape} from '../../../core/assembly/boundary/shapes';
import type {ConfiguredPiece} from '../../../core/assembly/detail-instances';
import {framePieces as previousFrame,laserProfiles,receiverSlots} from '../../tr8-quad-laser-guided-actuator/part';
import {layout,twinPin as d} from './layout';
import type {BearingKit} from './bearings';
import {manufactured} from './linkage';
import {polygonLoop,type LaserProfile,type LaserPoint,type LaserEdge} from './profiles';

const t=3,tabDepth=2.7;
const flatPoly=(points:LaserPoint[],height=t,z=0):Shape=>prism(points,height,z,'z');
export const guideSlot={half:d.guideSlotHalfTravel,radius:d.guideSlotWidth/2,z:layout.lever};
export function guideProfile(pilot=true):LaserProfile {
  const points:LaserPoint[]=[[-15,-4.15],[15,-4.15],[15,-1.5],[17.7,-1.5],[17.7,1.5],[15,1.5],[15,d.guideTop],[-15,d.guideTop],[-15,1.5],[-17.7,1.5],[-17.7,-1.5],[-15,-1.5]];
  const {half:h,radius:r,z}=guideSlot;
  const arc=(center:LaserPoint,start:number,end:number):LaserEdge=>({kind:'arc',center,radius:r,start,end,
    from:[center[0]+r*Math.cos(start),center[1]+r*Math.sin(start)],to:[center[0]+r*Math.cos(end),center[1]+r*Math.sin(end)]});
  const slot:LaserEdge[]=[{kind:'line',from:[-h,z-r],to:[h,z-r]},arc([h,z],-Math.PI/2,Math.PI/2),
    {kind:'line',from:[h,z+r],to:[-h,z+r]},arc([-h,z],Math.PI/2,3*Math.PI/2)];
  const bore=(pilot?5.8:6.02)/2;
  const shape=subtract(flatPoly(points),cylinder(bore,3.2,[0,0,-.1]),
    union(cylinder(r,3.2,[-h,z,-.1]),cylinder(r,3.2,[h,z,-.1]),
      {kind:'box',size:[2*h,2*r,3.2],origin:[-h,z-r,-.1]}));
  return {id:'central-slot-guide',label:'Laser central guide · straight Ø4 follower slot and SMF63ZZ seat · quantity 4',thickness:3,quantity:4,
    shape,circles:[{center:[0,0],radius:bore}],loops:[polygonLoop(points),slot]};
}
export function guideSocketPoints(unit:number):LaserPoint[] {
  const a=(layout.clock+unit*90)*Math.PI/180,y=(d.guideLowY+d.guideHighY)/2;
  return [[y-1.55,-1.55],[y+1.55,-1.55],[y+1.55,1.55],[y-1.55,1.55]].map(([u,v])=>[(layout.outputRadial+u)*Math.cos(a)-v*Math.sin(a),(layout.outputRadial+u)*Math.sin(a)+v*Math.cos(a)]);
}
export function discProfile(role:'motor'|'fixed'|'end',pilot=true,kit:BearingKit='prom-smb'):LaserProfile {
  const old=laserProfiles(pilot).find(profile=>profile.id===role+'-disc')!;
  if(role==='motor')return old;
  const circles=old.circles.map(c=>kit==='prom-smb'&&c.radius>6&&c.radius<7?{...c,radius:pilot?4.9:5.01}:c);
  const polygons=[...receiverSlots().filter(slot=>slot.outer&&slot.discId===role+'-disc').map(slot=>slot.points),
    ...[0,1,2,3].map(guideSocketPoints)];
  const shape=subtract(cylinder(32,3,[0,0,0]),
    ...circles.slice(1).map(c=>cylinder(c.radius,3.2,[...c.center,-.1])),...polygons.map(points=>flatPoly(points,3.2,-.1)));
  return {...old,circles,shape,loops:polygons.map(polygonLoop)};
}
export function guideShape(unit:number):Shape {
  const clock=layout.clock+90*unit,a=clock*Math.PI/180;
  return {kind:'transform',translation:[0,layout.outputRadial*Math.cos(a),layout.outputRadial*Math.sin(a)],rotation:[clock,0,0],
    child:{kind:'transform',translation:[0,d.guideHighY,0],rotation:[90,0,0],child:guideProfile(false).shape}};
}
export function framePieces(kit:BearingKit='prom-smb'):ConfiguredPiece[] {
  const pieces=previousFrame().filter(piece=>!piece.component.id.endsWith('-inner-cheek')&&
    !['laser-fixed-disc','laser-end-disc'].includes(piece.component.id));
  for(const role of ['fixed','end'] as const) {
    const station=role==='fixed'?layout.middleBase[0]:layout.endPlateX;
    pieces.push(sheet('laser-'+role+'-disc',discProfile(role,false,kit).label,
      {kind:'transform',translation:[station,0,0],rotation:[90,0,90],child:discProfile(role,false,kit).shape}));
  }
  for(let unit=0;unit<4;unit++)pieces.push(sheet('channel-'+(unit+1)+'-central-slot-guide',
    'Channel '+(unit+1)+' · laser central slot guide · inner shaft-bearing seat',guideShape(unit)));
  return pieces;
}
function sheet(id:string,label:string,shape:Shape):ConfiguredPiece {
  return manufactured(id,label,shape,0x79909f,{material:'Steel; grade, tab fits and bearing-seat fits per production drawing',
    blank:'One 3 mm steel laser blank',processes:['cutting','drilling'],requirements:[
      'Laser cut, deburr, finish bearing pilots and fit the 2.7 mm tabs in 3.1 mm slots. The bolted disc stack captures the tabs.',
      'Each guide is one flat laser part with a closed straight pin slot and an inner output-bearing seat. No central milled spine or square key remains.',
      'Four identical guide walls are offset into a non-intersecting pinwheel; assign coaxiality, slot wear and frame stiffness for the application.',
    ]});
}
export function frameProfiles(pilot=true,kit:BearingKit='prom-smb'):LaserProfile[] {
  const outer=laserProfiles(pilot).find(p=>p.id==='output-bearing-cheek')!;
  return [discProfile('motor',pilot,kit),discProfile('fixed',pilot,kit),discProfile('end',pilot,kit),
    {...outer,quantity:4,label:'Outer output-bearing cheek · 3 mm steel · quantity 4'},guideProfile(pilot)];
}
export const tabSpans=[[-15-tabDepth,-15],[15,15+tabDepth]];
