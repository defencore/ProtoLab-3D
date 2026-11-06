import type {ConfiguredPiece} from '../../../core/assembly/detail-instances';
import {detailComponent} from '../../../core/component-recipes';
import {cylinder,prism,subtract,type Shape} from '../../../core/assembly/boundary/shapes';
import {framePieces as previousPieces,frameProfiles as previousProfiles,guideProfile,compact,guideTabCentre} from '../../tr8-quad-twin-pin-mini-actuator/part';
import {cncChannels} from '../../tr8-quad-cnc-actuator/part';
import {alignActuatorThreads} from '../../tr8-compact-actuator/part';
import {layout,motorFit,radialShift} from './layout';
import {mountingPoints} from './channel';
export type LaserProfile=ReturnType<typeof previousProfiles>[number];
export type DiscPattern='lightened'|'solid';
type Point=[number,number];
type Role='motor'|'fixed'|'end';
const rotate=(y:number,z:number,unit:number):Point=>{
  const a=(layout.clock+90*unit)*Math.PI/180;
  return [y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];
};
const loop=(points:Point[]):LaserProfile['loops'][number]=>points.map((from,i)=>({kind:'line',from,to:points[(i+1)%points.length]}));
export function columnLines():Point[] {
  return [0,1,2,3].map(i=>{const a=(layout.postClock+90*i)*Math.PI/180;return [layout.postRadius*Math.cos(a),layout.postRadius*Math.sin(a)];});
}
export function cheekSocketPoints(unit:number):Point[] {
  const y=layout.outputRadial+(compact.outerCheekLow+compact.outerCheekHigh)/2;
  return [[y-1.55,-1.55],[y+1.55,-1.55],[y+1.55,1.55],[y-1.55,1.55]].map(([y,z])=>rotate(y,z,unit));
}
export function guideSocketPoints(unit:number):Point[] {
  const y=layout.outputRadial-6.05;
  return [[y-1.05,guideTabCentre-1.55],[y+1.05,guideTabCentre-1.55],[y+1.05,guideTabCentre+1.55],[y-1.05,guideTabCentre+1.55]]
    .map(([y,z])=>rotate(y,z,unit));
}
export function guideShape(unit:number):Shape {
  const a=(layout.clock+90*unit)*Math.PI/180;
  return {kind:'transform',translation:[0,layout.outputRadial*Math.cos(a),layout.outputRadial*Math.sin(a)],rotation:[layout.clock+90*unit,0,0],
    child:{kind:'transform',translation:[0,-5.05,0],rotation:[90,0,0],child:guideProfile(false).shape}};
}
export function lighteningCircles(role:Role) {
  // Offset the bearing-disc windows slightly to balance the clearances to
  // column holes and guide keys. New window ligaments remain above3 mm.
  const phase=layout.clock+Math.atan2(layout.lever,layout.outputRadial)*180/Math.PI+45-(role==='motor'?0:.6);
  const pitch=role==='motor'?12.5:21.8,radius=role==='motor'?6.75:5;
  return [0,1,2,3].map(i=>{const a=(phase+90*i)*Math.PI/180;return {center:[pitch*Math.cos(a),pitch*Math.sin(a)] as Point,radius};});
}
export function motorMountCircles() {
  return cncChannels({},'assembled',layout).flatMap(c=>{
    const point=(y:number,z:number)=>{const p=rotate(y,z,c.unit);return [c.origin[1]+p[0],c.origin[2]+p[1]] as Point;};
    return [{center:point(0,layout.lever),radius:motorFit.shaftClearance/2},
      ...mountingPoints().map(([y,z])=>({center:point(y,z),radius:motorFit.boltClearance/2}))];
  });
}
export function discProfile(role:Role,pilot=true,pattern:DiscPattern='lightened'):LaserProfile {
  const original=previousProfiles(pilot,pattern,'prom-smb').find(p=>p.id===role+'-disc')!;
  const screwHoles=[0,1,2,3].map(i=>({center:rotate(layout.outputRadial,layout.lever,i),radius:pilot?4.9:5.01}));
  const circles=[{center:[0,0] as Point,radius:35},...columnLines().map(center=>({center,radius:1.7})),
    ...(role==='motor'?motorMountCircles():screwHoles),{center:[0,0] as Point,radius:2.5},...(pattern==='lightened'?lighteningCircles(role):[])];
  const polygons=role==='motor'?[]:[...[0,1,2,3].map(cheekSocketPoints),...[0,1,2,3].map(guideSocketPoints)];
  const shape=subtract(cylinder(35,3,[0,0,0]),...circles.slice(1).map(c=>cylinder(c.radius,3.2,[...c.center,-.1])),
    ...polygons.map(points=>prism(points,3.2,-.1,'z')));
  return {...original,label:`${role==='motor'?'Surpass2845 motor':role==='fixed'?'Fixed screw bearing':'End screw bearing'} disc · Ø70×3 mm${pattern==='lightened'?' · lightened':''}`,
    circles,loops:polygons.map(loop),shape};
}
export function frameProfiles(pilot=true,pattern:DiscPattern='lightened'):LaserProfile[] {
  return [...(['motor','fixed','end'] as const).map(role=>discProfile(role,pilot,pattern)),
    ...previousProfiles(pilot,pattern,'prom-smb').filter(p=>!p.id.endsWith('-disc'))];
}
export function framePieces(pattern:DiscPattern='lightened'):ConfiguredPiece[] {
  const columns=columnLines();
  return alignActuatorThreads(previousPieces(pattern,'prom-smb').map(piece=>{
    const id=piece.component.id;
    if(id.startsWith('laser-')&&id.endsWith('-disc')) {
      const role=id.slice(6,-5) as Role,profile=discProfile(role,false,pattern);
      const station=role==='motor'?layout.motorPlateX:role==='fixed'?layout.middleBase[0]:layout.endPlateX;
      const component=detailComponent(id,profile.label,{kind:'transform',translation:[station,0,0],rotation:[90,0,90],child:profile.shape});
      component.manufacturing={material:'Steel; grade and fits per drawing',blank:'Ø70×3 mm steel sheet',processes:['cutting','drilling'],requirements:[
        'Laser cut the supplied profile. All three discs have a central Ø5 passage. Finish the screw bearing pilots from Ø9.8 to Ø10.02 mm.',
        'Motor and screw axes are at radius20.5 mm. Columns are at radius30.5 mm, clock18+90n degrees.',
        ...(pattern==='lightened'?['The larger lightening windows retain at least3 mm nominal web to neighbouring holes/slots. Do not enlarge bearing seats or mounting holes.']:[]),
        ...(role==='motor'?['Use the Ø8.2 motor shaft/bearing clearance openings, not a precision pilot fit. Mount each motor with two opposed M3×5 screws on the16 mm cross.']:[]),
        'Use the unchanged guide/cheek tab profiles with the matching radially shifted receiver slots.']};
      return {component,label:profile.label,color:0x79909f,requireSingleSolid:true};
    }
    if(id.includes('central-slot-guide')) {
      const unit=Number(id.split('-')[1])-1;
      return {...piece,component:{...detailComponent(id,piece.label,guideShape(unit)),manufacturing:piece.component.manufacturing}};
    }
    const translation=[...piece.component.placement.translation] as [number,number,number];
    const column=id.match(/^frame-column-(\d)-/),bolt=id.match(/^frame-(?:front|rear)-bolt-(\d)$/);
    if(column||bolt) {
      const [y,z]=columns[Number((column??bolt)![1])-1];translation[1]=y;translation[2]=z;
    } else if(id.endsWith('-outer-cheek')) {
      const a=(layout.clock+90*(Number(id.split('-')[1])-1))*Math.PI/180;
      translation[1]+=radialShift*Math.cos(a);translation[2]+=radialShift*Math.sin(a);
    } else return piece;
    return {...piece,component:{...piece.component,placement:{...piece.component.placement,translation}}};
  }));
}
