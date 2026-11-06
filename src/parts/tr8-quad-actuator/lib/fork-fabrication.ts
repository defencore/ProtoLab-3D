import type { FabricationFile } from '../../../core/types';
import { forkLaserContours } from './nut-linkage';

export function forkDxf(): string {
  const pairs: (number | string)[] = [0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES'];
  for (const [index, loop] of forkLaserContours().entries()) for (const edge of loop) {
    const layer = index === 0 ? 'OUTER' : index === 1 ? 'SHAFT_PILOT' : 'CLOSED_SLOT';
    if (edge.kind === 'line') pairs.push(0, 'LINE', 8, layer, 10, edge.from[0], 20, edge.from[1], 11, edge.to[0], 21, edge.to[1]);
    else if (edge.kind === 'circle') pairs.push(0, 'CIRCLE', 8, layer, 10, edge.center[0], 20, edge.center[1], 40, edge.radius);
    else pairs.push(0, 'ARC', 8, layer, 10, edge.center[0], 20, edge.center[1], 40, edge.radius, 50, edge.start * 180 / Math.PI % 360, 51, edge.end * 180 / Math.PI % 360);
  }
  return [...pairs, 0, 'ENDSEC', 0, 'EOF'].join('\n') + '\n';
}
export function forkSvg(): string {
  const contours = forkLaserContours();
  const top = Math.max(...contours.flat().map((e) => e.kind === 'line' ? Math.max(e.from[1], e.to[1]) : e.center[1] + e.radius)) + 1;
  const height = top + 6;
  const paths = contours.map((loop) => {
    const first = loop[0];
    if (first.kind === 'circle') return `<circle cx="${first.center[0]}" cy="${first.center[1]}" r="${first.radius}"/>`;
    return `<path d="M${first.from.join(',')} ${loop.map((edge) => {
      if (edge.kind === 'circle') throw new Error('A fork circle must be a separate loop.');
      return edge.kind === 'line' ? `L${edge.to.join(',')}` : `A${edge.radius},${edge.radius} 0 ${edge.end - edge.start > Math.PI ? 1 : 0},1 ${edge.to.join(',')}`;
    }).join(' ')} Z"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12mm" height="${height}mm" viewBox="-6 ${-top} 12 ${height}"><title>Steel pinned fork · 3 mm sheet · quantity 8 · scale 1:1 mm</title><g transform="scale(1,-1)" fill="none" stroke="#111" stroke-width="0.08">${paths.join('')}</g></svg>\n`;
}
export function forkFabricationFiles(): FabricationFile[] {
  return (['dxf', 'svg'] as const).map((extension) => ({
    id: 'pinned-fork-' + extension, label: 'Pinned steel fork · 3 mm · quantity 8',
    description: 'One common flat profile for eight forks; finish Ø5.8 pilot to Ø6.05 and match-drill the transverse Ø2 hole after assembly.',
    name: 'TR8-quad-pinned-fork-3mm.' + extension,
    type: extension === 'dxf' ? 'application/dxf' : 'image/svg+xml', content: extension === 'dxf' ? forkDxf() : forkSvg(),
  }));
}
