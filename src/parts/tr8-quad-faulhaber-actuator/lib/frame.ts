import type {ConfiguredPiece} from '../../../core/assembly/detail-instances';
import {detailComponent} from '../../../core/component-recipes';
import {cylinder,prism,subtract,type Shape} from '../../../core/assembly/boundary/shapes';
import {framePieces as previousPieces,frameProfiles as previousProfiles,discProfile as previousDisc,
  lighteningCircles as previousLightening,columnLines} from '../../tr8-quad-twin-pin-mini-actuator/part';
import {cncChannels} from '../../tr8-quad-cnc-actuator/part';
import {configureActuatorPiece,alignActuatorThreads} from '../../tr8-compact-actuator/part';
import bolt from '../../bolt-screw/part';
import {layout,motorFit} from './layout';
import {mountingPoints} from './channel';
export type LaserProfile=ReturnType<typeof previousProfiles>[number];
export type DiscPattern='lightened'|'solid';
type Role='motor'|'fixed'|'end';
export function lighteningCircles(role:Role) {
  if(role!=='motor')return previousLightening(role);
  const phase=layout.clock+Math.atan2(layout.lever,layout.outputRadial)*180/Math.PI+45;
  return [0,1,2,3].map(i=>{const a=(phase+90*i)*Math.PI/180;
    return {center:[10*Math.cos(a),10*Math.sin(a)] as [number,number],radius:3.2};});
}
export function motorMountCircles(pilot=true) {
  return cncChannels({},'assembled',layout).flatMap(c=>{
    const a=c.clock*Math.PI/180;
    const point=(y:number,z:number):[number,number]=>[c.origin[1]+y*Math.cos(a)-z*Math.sin(a),c.origin[2]+y*Math.sin(a)+z*Math.cos(a)];
    return [{center:point(0,layout.lever),radius:(pilot?motorFit.pilotBlankDiameter:motorFit.pilotDiameter)/2},
      ...mountingPoints().map(([y,z])=>({center:point(y,z),radius:motorFit.boltClearance/2}))];
  });
}
/** Finish from the motor side after laser cutting; the DXF keeps through holes only. */
export function columnCountersinks():Shape[] {
  return columnLines().map(([y,z])=>({kind:'transform',translation:[y,z,0],rotation:[0,0,0],
    child:{kind:'revolve',profile:[[0,-.1],[3.1,-.1],[3.1,.25],[1.7,1.65],[0,1.65]]}}));
}
export function discProfile(role:Role,pilot=true,pattern:DiscPattern='lightened'):LaserProfile {
  const old=previousDisc(role,pilot,'solid','prom-smb');
  // The old motor clearance and bolt pattern are replaced together.
  const circles=role==='motor'?[{center:[0,0] as [number,number],radius:28},...old.circles.slice(1,5),
    ...motorMountCircles(pilot),{center:[0,0] as [number,number],radius:2.5}]:
    [{...old.circles[0],radius:28},...old.circles.slice(1)];
  if(pattern==='lightened')circles.push(...lighteningCircles(role));
  const polygons=old.loops.map(loop=>loop.map(edge=>edge.from));
  const shape=subtract(cylinder(28,3,[0,0,0]),...circles.slice(1).map(c=>cylinder(c.radius,3.2,[...c.center,-.1])),
    ...polygons.map(points=>prism(points,3.2,-.1,'z')),...(role==='motor'&&!pilot?columnCountersinks():[]));
  return {...old,label:`${role==='motor'?'FAULHABER motor':role==='fixed'?'Fixed screw bearing':'End screw bearing'} disc · Ø56×3 mm${pattern==='lightened'?' · lightened':''}`,
    circles,shape};
}
export function frameProfiles(pilot=true,pattern:DiscPattern='lightened'):LaserProfile[] {
  return [...(['motor','fixed','end'] as const).map(role=>discProfile(role,pilot,pattern)),
    ...previousProfiles(pilot,pattern,'prom-smb').filter(p=>!p.id.endsWith('-disc'))];
}
export function framePieces(pattern:DiscPattern='lightened'):ConfiguredPiece[] {
  return alignActuatorThreads(previousPieces(pattern,'prom-smb').map(piece=>{
    const id=piece.component.id;
    if(id.startsWith('frame-front-bolt-')) {
      const preset=bolt.presets.find(p=>p.id==='gvyntok-040-070-003')!;
      const [,y,z]=piece.component.placement.translation;
      return configureActuatorPiece(bolt,id,'Front frame screw · M3×8 DIN 7991 · flush countersunk',
        {...preset.parameters},[layout.motorPlateX+4,y,z],[0,-90,0],'default',0x333b45,preset.id);
    }
    if(!id.startsWith('laser-')||!id.endsWith('-disc'))return piece;
    const role=id.slice(6,-5) as Role,profile=discProfile(role,false,pattern);
    const station=role==='motor'?layout.motorPlateX:role==='fixed'?layout.middleBase[0]:layout.endPlateX;
    const component=detailComponent(id,profile.label,{kind:'transform',translation:[station,0,0],rotation:[90,0,90],child:profile.shape});
    component.manufacturing={material:'Steel; grade and fits per drawing',blank:'Ø56×3 mm steel sheet',processes:['cutting','drilling'],
      requirements:['Laser cut the supplied profile; deburr and finish all bearing/pilot bores. All three discs retain a coaxial Ø5 centre passage.',
        ...(role==='motor'?['Finish four motor pilots from Ø9.8 to Ø10.1 mm. Use two opposed M2×5 screws on each Ø17 bolt circle. Engagement is2 mm in3 mm blind holes.',
          'Countersink the four column holes on the motor side: Ø6.2 mouth,0.25 mm rim,90° included cone to Ø3.4 at1.65 mm depth. Fit M3×8 DIN7991 heads flush before installing motors.']:[]),
        'Column pitch radius remains23.5 mm at18+90n degrees. Match the guide and bearing-cheek tabs to the unchanged receiver slots.']};
    return {component,label:profile.label,color:0x79909f,requireSingleSolid:true};
  }));
}
