import {laserProfiles} from '../../tr8-quad-laser-guided-actuator/part';
export {profileDxf,profileSvg} from '../../tr8-quad-laser-guided-actuator/part';
export type LaserProfile=ReturnType<typeof laserProfiles>[number];
export type LaserEdge=LaserProfile['loops'][number][number];
export type LaserPoint=[number,number];
export const polygonLoop=(points:LaserPoint[]):LaserEdge[]=>points.map((from,i)=>({kind:'line',from,to:points[(i+1)%points.length]}));
