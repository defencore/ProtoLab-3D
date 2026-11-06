import type { Shape } from '../../../core/assembly/boundary/shapes';

export type LaserPoint = [number, number];
export interface LaserCircle { center: LaserPoint; radius: number }
export type LaserEdge =
  | { kind: 'line'; from: LaserPoint; to: LaserPoint }
  | { kind: 'arc'; from: LaserPoint; to: LaserPoint; center: LaserPoint; radius: number; start: number; end: number };
export interface LaserProfile {
  id: string;
  label: string;
  thickness: number;
  quantity: number;
  /** Exact native flat blank, in XY with Z=0..thickness. */
  shape: Shape;
  circles: LaserCircle[];
  /** Closed directed wires. Arc spans may be clockwise (end < start). */
  loops: LaserEdge[][];
}

export function polygonLoop(points: LaserPoint[]): LaserEdge[] {
  return points.map((from, i) => ({ kind: 'line', from, to: points[(i + 1) % points.length] }));
}
const degrees = (angle: number) => ((angle * 180 / Math.PI) % 360 + 360) % 360;

/** Exact LINE, ARC and CIRCLE cutting paths; drawing units are millimetres. */
export function profileDxf(profile: LaserProfile): string {
  const pairs: (number | string)[] = [0,'SECTION',2,'HEADER',9,'$INSUNITS',70,4,0,'ENDSEC',0,'SECTION',2,'ENTITIES'];
  for (const circle of profile.circles)
    pairs.push(0,'CIRCLE',8,'CUT',10,circle.center[0],20,circle.center[1],40,circle.radius);
  for (const loop of profile.loops) for (const edge of loop) {
    if (edge.kind === 'line') pairs.push(0,'LINE',8,'CUT',10,edge.from[0],20,edge.from[1],11,edge.to[0],21,edge.to[1]);
    else {
      // DXF arcs are always counterclockwise; direction does not alter the cut.
      const [start,end] = edge.end < edge.start ? [edge.end,edge.start] : [edge.start,edge.end];
      pairs.push(0,'ARC',8,'CUT',10,edge.center[0],20,edge.center[1],40,edge.radius,50,degrees(start),51,degrees(end));
    }
  }
  return [...pairs,0,'ENDSEC',0,'EOF'].join('\n')+'\n';
}

export function profileBounds(profile: LaserProfile): [number,number,number,number] {
  const points: LaserPoint[] = profile.circles.flatMap(c => [[c.center[0]-c.radius,c.center[1]-c.radius],[c.center[0]+c.radius,c.center[1]+c.radius]] as LaserPoint[]);
  for (const edge of profile.loops.flat()) {
    points.push(edge.from,edge.to);
    if (edge.kind !== 'arc') continue;
    const lo = Math.min(edge.start,edge.end), hi = Math.max(edge.start,edge.end);
    for(let index=Math.ceil(lo/(Math.PI/2));index<=Math.floor(hi/(Math.PI/2));index++) {
      const angle=index*Math.PI/2;
      points.push([edge.center[0]+edge.radius*Math.cos(angle),edge.center[1]+edge.radius*Math.sin(angle)]);
    }
  }
  if (!points.length) throw new Error('A laser profile needs at least one closed contour.');
  return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
}
const xml = (text: string) => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

/** One SVG user unit equals one millimetre; no sheet-layout scaling is applied. */
export function profileSvg(profile: LaserProfile): string {
  const [left,bottom,right,top] = profileBounds(profile), margin=1;
  const paths=profile.loops.map(loop => {
    if (!loop.length) throw new Error('Empty laser wire.');
    return `<path d="M${loop[0].from.join(',')} ${loop.map(edge => edge.kind==='line'
      ? 'L'+edge.to.join(',')
      : `A${edge.radius},${edge.radius} 0 ${Math.abs(edge.end-edge.start)>Math.PI?1:0},${edge.end>edge.start?1:0} ${edge.to.join(',')}`).join(' ')} Z"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${right-left+2*margin}mm" height="${top-bottom+2*margin}mm" viewBox="${left-margin} ${-top-margin} ${right-left+2*margin} ${top-bottom+2*margin}"><title>${xml(profile.label)}</title><g transform="scale(1,-1)" fill="none" stroke="#111" stroke-width="0.08">${profile.circles.map(c=>`<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}"/>`).join('')}${paths}</g></svg>\n`;
}
