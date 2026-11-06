import type {BearingKit} from '../../tr8-quad-twin-pin-actuator/part';
import type {ConfiguredPiece} from '../../../core/assembly/detail-instances';
import {detailComponent} from '../../../core/component-recipes';
import {cylinder,prism,subtract,type Shape} from '../../../core/assembly/boundary/shapes';
import {framePieces as previousFrame,frameProfiles as previousProfiles,guideSlot,cuttingProfiles as previousCutting} from '../../tr8-quad-twin-pin-actuator/part';
import {alignActuatorThreads} from '../../tr8-compact-actuator/part';
import {layout,compact} from './layout';

export type LaserProfile=ReturnType<typeof previousCutting>[number];
export type Point=[number,number];
const loop=(points:Point[]):LaserProfile['loops'][number]=>points.map((from,i)=>({kind:'line',from,to:points[(i+1)%points.length]}));
export type DiscPattern='lightened'|'solid';
export const centralBore=5;
export const guideTabCentre=-2.75;
export function guideSocketPoints(unit:number):Point[] {
  const a=(layout.clock+90*unit)*Math.PI/180,r=layout.outputRadial-6.05;
  return [[r-1.05,guideTabCentre-1.55],[r+1.05,guideTabCentre-1.55],[r+1.05,guideTabCentre+1.55],[r-1.05,guideTabCentre+1.55]]
    .map(([y,z])=>[y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)]);
}
/** Narrower end keys clear the centre bore; taller2 mm walls keep a substantial in-plane section. */
export function guideProfile(pilot=true):LaserProfile {
  const old=previousProfiles(pilot).find(p=>p.id==='central-slot-guide')!;
  const points:Point[]=[[-17.7,-4.25],[-15,-4.25],[-15,-5.25],[15,-5.25],[15,-4.25],[17.7,-4.25],
    [17.7,-1.25],[15,-1.25],[15,16.2],[-15,16.2],[-15,-1.25],[-17.7,-1.25]];
  const {half:h,radius:r,z}=guideSlot;
  const shape=subtract(prism(points,2,0,'z'),cylinder(old.circles[0].radius,2.2,[0,0,-.1]),
    cylinder(r,2.2,[-h,z,-.1]),cylinder(r,2.2,[h,z,-.1]),
    {kind:'box',size:[2*h,2*r,2.2],origin:[-h,z-r,-.1]});
  return {...old,label:'Central slot guide · 2 mm steel · raised section · Ø5 passage · quantity 4',thickness:2,shape,loops:[loop(points),old.loops[1]]};
}
export function guideShape(unit:number):Shape {
  const clock=layout.clock+90*unit,a=clock*Math.PI/180;
  return {kind:'transform',translation:[0,layout.outputRadial*Math.cos(a),layout.outputRadial*Math.sin(a)],rotation:[clock,0,0],
    child:{kind:'transform',translation:[0,-5.05,0],rotation:[90,0,0],child:guideProfile(false).shape}};
}
export function lighteningCircles(role:'motor'|'fixed'|'end') {
  const radius=role==='motor'?3.7:2.7,pitchRadius=role==='motor'?18.5:16;
  const phase=layout.clock+Math.atan2(layout.lever,layout.outputRadial)*180/Math.PI+45;
  return [0,1,2,3].map(i=>{const a=(phase+90*i)*Math.PI/180;return {center:[pitchRadius*Math.cos(a),pitchRadius*Math.sin(a)] as Point,radius};});
}
export function columnLines():Point[] {
  return [0,1,2,3].map(i=>{const a=(layout.postClock+90*i)*Math.PI/180;return[layout.postRadius*Math.cos(a),layout.postRadius*Math.sin(a)];});
}
export function cheekSocketPoints(unit:number):Point[] {
  const a=(layout.clock+unit*90)*Math.PI/180,y=layout.outputRadial+(compact.outerCheekLow+compact.outerCheekHigh)/2;
  return [[y-1.55,-1.55],[y+1.55,-1.55],[y+1.55,1.55],[y-1.55,1.55]].map(([r,z])=>[r*Math.cos(a)-z*Math.sin(a),r*Math.sin(a)+z*Math.cos(a)]);
}
export function discProfile(role:'motor'|'fixed'|'end',pilot=true,pattern:DiscPattern='lightened',kit:BearingKit='prom-smb'):LaserProfile {
  const old=previousProfiles(pilot,kit).find(profile=>profile.id===role+'-disc')!;
  const circles=[{center:[0,0] as Point,radius:layout.diameter/2},...columnLines().map(center=>({center,radius:1.7})),...old.circles.slice(5),
    {center:[0,0] as Point,radius:centralBore/2},...(pattern==='lightened'?lighteningCircles(role):[])];
  const polygons=role==='motor'?[]:[...[0,1,2,3].map(cheekSocketPoints),...[0,1,2,3].map(guideSocketPoints)];
  const shape=subtract(cylinder(layout.diameter/2,3,[0,0,0]),...circles.slice(1).map(c=>cylinder(c.radius,3.2,[...c.center,-.1])),
    ...polygons.map(points=>prism(points,3.2,-.1,'z')));
  return {...old,label:old.label.replace('Ø64','Ø54')+(pattern==='lightened'?' · lightened':''),circles,loops:polygons.map(loop),shape};
}
export function frameProfiles(pilot=true,pattern:DiscPattern='lightened',kit:BearingKit='prom-smb'):LaserProfile[] {
  return [...(['motor','fixed','end'] as const).map(role=>discProfile(role,pilot,pattern,kit)),
    previousProfiles(pilot).find(p=>p.id==='output-bearing-cheek')!,guideProfile(pilot)];
}
function sheet(id:string,label:string,shape:Shape):ConfiguredPiece {
  const component=detailComponent(id,label,shape);
  component.manufacturing={material:'Steel; grade, bearing pilots and tab fits per drawing',blank:'3 mm steel sheet',processes:['cutting','drilling'],
    requirements:['Laser cut the Ø54 disc and matching receiver slots; deburr and finish its bearing pilots.',
      'Column pitch radius is 23.5 mm at 18/108/198/288 degrees. Inspect the compact edge ligaments and frame stiffness for application loads.']};
  return {component,label,color:0x79909f,requireSingleSolid:true};
}
export function framePieces(pattern:DiscPattern='lightened',kit:BearingKit='prom-smb'):ConfiguredPiece[] {
  const columns=columnLines();
  const pieces=previousFrame(kit).map(piece=>{
    const id=piece.component.id;
    if(id.startsWith('laser-')&&id.endsWith('-disc')) {
      const role=id.slice(6,-5) as 'motor'|'fixed'|'end',profile=discProfile(role,false,pattern,kit);
      const station=role==='motor'?layout.motorPlateX:role==='fixed'?layout.middleBase[0]:layout.endPlateX;
      return sheet(id,profile.label,{kind:'transform',translation:[station,0,0],rotation:[90,0,90],child:profile.shape});
    }
    if(id.includes('central-slot-guide')) {
      const unit=Number(id.split('-')[1])-1;
      const component=detailComponent(id,'Laser central guide · 2 mm steel · Ø5 passage keys',guideShape(unit));
      component.manufacturing={material:'Steel; fits and loads per drawing',blank:'2 mm steel sheet',processes:['cutting','drilling'],
        requirements:['Laser cut 2 mm stock with end keys at Z=-2.75 and matching 2.1x3.1 mm disc slots. The body height is21.45 mm to retain the gross in-plane section moment of the former3 mm wall.',
          'Keep the original pin slot and finished bearing bore; qualify the revised end-key load path and sheet stiffness for the intended loads.']};
      return {component,label:component.name,color:0x79909f,requireSingleSolid:true};
    }
    const column=id.match(/^frame-column-(\d)-/),bolt=id.match(/^frame-(?:front|rear)-bolt-(\d)$/);
    const translation=[...piece.component.placement.translation] as [number,number,number];
    if(column||bolt) {const [y,z]=columns[Number((column??bolt)![1])-1];translation[1]=y;translation[2]=z;}
    else if(id.endsWith('-outer-cheek')) {
      const unit=Number(id.split('-')[1])-1,a=(layout.clock+90*unit)*Math.PI/180;
      translation[1]+=compact.outerShift*Math.cos(a);translation[2]+=compact.outerShift*Math.sin(a);
    } else return piece;
    return {...piece,component:{...piece.component,placement:{...piece.component.placement,translation}}};
  });
  return alignActuatorThreads(pieces);
}
