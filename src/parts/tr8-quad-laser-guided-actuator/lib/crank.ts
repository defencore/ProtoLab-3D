import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { box, cylinder, subtract, union, type Shape } from '../../../core/assembly/boundary/shapes';
import { forkContours, linkage, type CncLayout } from '../../tr8-quad-cnc-actuator/part';
import type { LaserEdge, LaserProfile } from './profiles';

type Point = [number, number];
type Lamination = 'inner-cover' | 'upper-web' | 'lower-web' | 'outer-cover';

/** All dimensions are nominal CAD values; the welded assembly needs a qualified drawing. */
export const laminatedCrank = {
  coverThickness: .5,
  webThickness: 2,
  overallThickness: 3,
  shaftBore: 6.05,
  hubDiameter: 10,
  crossPinDiameter: 2,
  crossPinLength: 10,
  pinWindowHeight: 2.02,
  pinWindowHalfHeight: 1.01,
  slotWidth: 4.1,
  weldWitnessDiameter: 1,
  weldWitnessCentres: [[-3, 5.5], [3, 5.5], [-2, -3.5], [2, -3.5]] as Point[],
} as const;

function checkLayout(layout: CncLayout): void {
  if (layout.variant !== 'coplanar-64' || layout.outputStations.some(x => x !== 0) ||
      linkage.forkThickness !== laminatedCrank.overallThickness ||
      linkage.pinCentreY !== linkage.forkInnerFace + laminatedCrank.overallThickness / 2)
    throw new Error('The laminated crank requires the authored coplanar Ø64 output stack.');
}

const point = (center: Point, radius: number, angle: number): Point =>
  [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
const line = (from: Point, to: Point): LaserEdge => ({kind:'line',from,to});
const arc = (radius: number, start: number, end: number, center: Point = [0,0]): LaserEdge => ({
  kind:'arc',center,radius,start,end,from:point(center,radius,start),to:point(center,radius,end),
});
function baseLoops(layout: CncLayout) {
  const source = forkContours(layout);
  const convert = (edge: (typeof source.outer)[number]): LaserEdge => edge.kind === 'line'
    ? line(edge.from,edge.to) : arc(edge.radius,edge.start,edge.end,edge.center);
  return {outer:source.outer.map(convert),slot:source.slot.map(convert)};
}

/** Exact flat XY cutting stock at Z=0..thickness; no in-plane cross-drilled hole. */
export function crankBlankShape(layout: CncLayout, lamination: Lamination): Shape {
  checkLayout(layout);
  const cover = lamination === 'inner-cover' || lamination === 'outer-cover';
  const t = cover ? laminatedCrank.coverThickness : laminatedCrank.webThickness;
  const half = linkage.forkArmHalfWidth, sr = linkage.slotWidth/2;
  const root = layout.lever-.3, top = layout.lever/Math.cos(Math.PI/9)+.30822227524088;
  const flat = subtract(
    union(cylinder(5,t,[0,0,0]),box([2*half,top-3,t],[-half,3,0]),cylinder(half,t,[0,top,0])),
    cylinder(laminatedCrank.shaftBore/2,t+.2,[0,0,-.1]),
    union(cylinder(sr,t+.2,[0,root,-.1]),box([2*sr,top-root,t+.2],[-sr,root,-.1]),cylinder(sr,t+.2,[0,top,-.1])),
  );
  if (cover) return flat;
  const h = laminatedCrank.pinWindowHalfHeight;
  return {kind:'intersect',children:[flat,lamination === 'upper-web'
    ? box([20,top+10-h,t+.2],[-10,h,-.1])
    : box([20,20-h,t+.2],[-10,-20,-.1])]};
}

/** Three unique cutting profiles build four pieces per output (two covers are identical). */
export function crankProfiles(layout: CncLayout): LaserProfile[] {
  checkLayout(layout);
  const base = baseLoops(layout), h = laminatedCrank.pinWindowHalfHeight;
  const r = laminatedCrank.shaftBore/2, half = linkage.forkArmHalfWidth;
  const top = layout.lever/Math.cos(Math.PI/9)+.30822227524088;
  const outerAngle = Math.asin(h/5), innerAngle = Math.asin(h/r), shoulder = Math.atan2(3,4);
  const outerX = Math.sqrt(25-h*h), innerX = Math.sqrt(r*r-h*h);
  const upper: LaserEdge[] = [
    arc(5,outerAngle,shoulder),line([4,3],[half,3]),line([half,3],[half,top]),
    arc(half,0,Math.PI,[0,top]),line([-half,top],[-half,3]),line([-half,3],[-4,3]),
    arc(5,Math.PI-shoulder,Math.PI-outerAngle),line([-outerX,h],[-innerX,h]),
    arc(r,Math.PI-innerAngle,innerAngle),line([innerX,h],[outerX,h]),
  ];
  const lower: LaserEdge[] = [
    arc(5,Math.PI+outerAngle,2*Math.PI-outerAngle),line([outerX,-h],[innerX,-h]),
    arc(r,2*Math.PI-innerAngle,Math.PI+innerAngle),line([-innerX,-h],[-outerX,-h]),
  ];
  return [
    {id:'crank-cover',label:'Crank cover · 0.5 mm steel · quantity 8',thickness:.5,quantity:8,
      shape:crankBlankShape(layout,'inner-cover'),circles:[{center:[0,0],radius:r}],loops:[base.outer,base.slot]},
    {id:'crank-upper-web',label:'Crank upper web · 2 mm steel · quantity 4',thickness:2,quantity:4,
      shape:crankBlankShape(layout,'upper-web'),circles:[],loops:[upper,base.slot]},
    {id:'crank-lower-web',label:'Crank lower bridge · 2 mm steel · quantity 4',thickness:2,quantity:4,
      shape:crankBlankShape(layout,'lower-web'),circles:[],loops:[lower]},
  ];
}

export const crankAssemblyRequirements = [
  'Laser cut two 0.5 mm covers, one 2 mm upper web and one 2 mm lower bridge per output. The upper and lower webs are separate until joined to the covers.',
  'Fixture the Ø6.05 shaft bore and 4.1 mm follower slot with aligned profiles; hold the complete stack at 3 mm and keep the transverse pin window 2.02 mm high.',
  'Use a qualified spot or laser welding procedure to join BOTH covers to BOTH webs. Candidate 1 mm witness footprints lie at X/Z=(-3,5.5),(3,5.5),(-2,-3.5),(2,-3.5) mm; these are not laser holes or a weld-strength specification.',
  'Keep welds away from the shaft bore, follower slot and transverse pin passage. Dress every sliding face and the outer envelope flush; inspect warping, bore/slot sizes, layer separation and weld integrity.',
  'After joining, slide the crank onto the plain inner shaft end, align the open transverse window and press the unchanged ISO 8734 Ø2×10 dowel through the SHAFT cross bore from X. No transverse crank drilling is required.',
  'The cover plates retain the dowel axially along Y; upper/lower web edges transmit torque in both directions. The nominal 2.02 mm window permits finite pin take-up and is not a zero-backlash joint.',
  'Assign actual sheet, cut, pin-fit and weld tolerances and qualify torque, axial retention, fatigue and heat distortion before manufacture.',
] as const;

export function crankPieces(layout: CncLayout, angle: number): ConfiguredPiece[] {
  checkLayout(layout);
  const inner = linkage.forkInnerFace;
  const parts: {kind:Lamination;low:number;thickness:number;label:string}[] = [
    {kind:'inner-cover',low:inner,thickness:.5,label:'Inner crank cover · 0.5 mm laser steel'},
    {kind:'upper-web',low:inner+.5,thickness:2,label:'Upper crank web · 2 mm laser steel · open pin window'},
    {kind:'lower-web',low:inner+.5,thickness:2,label:'Lower crank bridge · 2 mm laser steel · open pin window'},
    {kind:'outer-cover',low:inner+2.5,thickness:.5,label:'Outer crank cover · 0.5 mm laser steel'},
  ];
  return parts.map(part => {
    // Flat-Z stock becomes an X/Z sheet at the requested Y plane, then follows
    // the same output-shaft rotation as the original one-piece crank.
    const shape: Shape = {kind:'transform',translation:[0,0,0],rotation:[0,angle,0],child:{
      kind:'transform',translation:[0,part.low+part.thickness,0],rotation:[90,0,0],child:crankBlankShape(layout,part.kind),
    }};
    const component = detailComponent('output-crank-'+part.kind,part.label,shape);
    component.manufacturing = {
      material:'Steel; grade, cut quality and weld procedure per production drawing',
      blank:`${part.thickness} mm steel sheet`,
      processes:['cutting','assembly'],
      requirements:[...crankAssemblyRequirements],
    };
    return {component,label:part.label,color:0x759bb3,requireSingleSolid:true};
  });
}

/** The laser-created rectangular access window contains the old circular cross cutter. */
export function crankPinWindowShape(): Shape {
  return box([10.2,laminatedCrank.webThickness,laminatedCrank.pinWindowHeight],[-5.1,linkage.forkInnerFace+.5,-laminatedCrank.pinWindowHalfHeight]);
}
