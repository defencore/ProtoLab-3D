export type FlatPoint = [number, number];
export type FlatEdge =
  | { kind: 'line'; from: FlatPoint; to: FlatPoint }
  | {
      kind: 'arc';
      from: FlatPoint;
      to: FlatPoint;
      center: FlatPoint;
      radius: number;
      start: number;
      end: number;
    };
export interface FlatPanelPattern {
  loops: FlatEdge[][];
  circles: { center: FlatPoint; radius: number }[];
  bends: {
    from: FlatPoint;
    to: FlatPoint;
    direction: 'up' | 'down';
    angle: number;
    innerRadius: number;
  }[];
}
const number = (value: number) => Number(value.toFixed(8)).toString();
const degrees = (angle: number) => ((angle * 180) / Math.PI + 360) % 360;
const xml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** One flat blank in millimetres. Only CUT entities belong to the cutting toolpath. */
export function sheetPanelDxf(pattern: FlatPanelPattern): string {
  const pairs: (number | string)[] = [
    0,
    'SECTION',
    2,
    'HEADER',
    9,
    '$ACADVER',
    1,
    'AC1015',
    9,
    '$INSUNITS',
    70,
    4,
    0,
    'ENDSEC',
    0,
    'SECTION',
    2,
    'TABLES',
    0,
    'TABLE',
    2,
    'LAYER',
    70,
    3,
  ];
  for (const [layer, color] of [
    ['CUT', 7],
    ['BEND_UP', 5],
    ['BEND_DOWN', 6],
  ] as const)
    pairs.push(0, 'LAYER', 2, layer, 70, 0, 62, color, 6, 'CONTINUOUS');
  pairs.push(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  const line = (from: FlatPoint, to: FlatPoint, layer: string) =>
    pairs.push(0, 'LINE', 8, layer, 10, from[0], 20, from[1], 30, 0, 11, to[0], 21, to[1], 31, 0);
  for (const circle of pattern.circles)
    pairs.push(
      0,
      'CIRCLE',
      8,
      'CUT',
      10,
      circle.center[0],
      20,
      circle.center[1],
      30,
      0,
      40,
      circle.radius,
    );
  for (const loop of pattern.loops)
    for (const edge of loop) {
      if (edge.kind === 'line') line(edge.from, edge.to, 'CUT');
      else {
        const [start, end] =
          edge.end < edge.start ? [edge.end, edge.start] : [edge.start, edge.end];
        pairs.push(
          0,
          'ARC',
          8,
          'CUT',
          10,
          edge.center[0],
          20,
          edge.center[1],
          30,
          0,
          40,
          edge.radius,
          50,
          degrees(start),
          51,
          degrees(end),
        );
      }
    }
  for (const bend of pattern.bends)
    line(bend.from, bend.to, bend.direction === 'up' ? 'BEND_UP' : 'BEND_DOWN');
  pairs.push(0, 'ENDSEC', 0, 'EOF');
  return (
    pairs.map((value) => (typeof value === 'number' ? number(value) : value)).join('\n') + '\n'
  );
}

function patternBounds(pattern: FlatPanelPattern) {
  const points: FlatPoint[] = pattern.circles.flatMap(
    ({ center: [x, y], radius: r }) =>
      [
        [x - r, y - r],
        [x + r, y + r],
      ] as FlatPoint[],
  );
  for (const edge of pattern.loops.flat()) {
    points.push(edge.from, edge.to);
    if (edge.kind !== 'arc') continue;
    const low = Math.min(edge.start, edge.end),
      high = Math.max(edge.start, edge.end);
    for (let k = Math.ceil(low / (Math.PI / 2)); k <= Math.floor(high / (Math.PI / 2)); k++) {
      const angle = (k * Math.PI) / 2;
      points.push([
        edge.center[0] + edge.radius * Math.cos(angle),
        edge.center[1] + edge.radius * Math.sin(angle),
      ]);
    }
  }
  for (const bend of pattern.bends) points.push(bend.from, bend.to);
  if (!points.length) throw new Error('A sheet blank requires at least one cutting contour.');
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}

/** Scale1:1; dashed colored bend marks are separate from the solid black CUT group. */
export function sheetPanelSvg(pattern: FlatPanelPattern, label: string): string {
  const [left, bottom, right, top] = patternBounds(pattern),
    margin = 2;
  const paths = pattern.loops
    .map((loop) => {
      if (!loop.length) throw new Error('An empty cutting wire cannot be exported.');
      const commands = loop.map((edge) =>
        edge.kind === 'line'
          ? `L${edge.to.join(',')}`
          : `A${edge.radius},${edge.radius} 0 ${Math.abs(edge.end - edge.start) > Math.PI ? 1 : 0},${edge.end > edge.start ? 1 : 0} ${edge.to.join(',')}`,
      );
      return `<path d="M${loop[0].from.join(',')} ${commands.join(' ')} Z"/>`;
    })
    .join('');
  const bends = (direction: 'up' | 'down') =>
    pattern.bends
      .filter((b) => b.direction === direction)
      .map(
        (b) =>
          `<line x1="${number(b.from[0])}" y1="${number(b.from[1])}" x2="${number(b.to[0])}" y2="${number(b.to[1])}"/>`,
      )
      .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${number(right - left + margin * 2)}mm" height="${number(top - bottom + margin * 2)}mm" viewBox="${number(left - margin)} ${number(-top - margin)} ${number(right - left + margin * 2)} ${number(top - bottom + margin * 2)}"><title>${xml(label)}</title><desc>Millimetres, scale1:1. Cut only the black CUT group. Blue BEND_UP and magenta BEND_DOWN dashed lines are forming marks viewed from the blank face.</desc><g transform="scale(1,-1)" fill="none" stroke-width="0.1"><g id="CUT" stroke="#111">${paths}${pattern.circles.map((c) => `<circle cx="${number(c.center[0])}" cy="${number(c.center[1])}" r="${number(c.radius)}"/>`).join('')}</g><g id="BEND_UP" stroke="#1565c0" stroke-dasharray="2 1">${bends('up')}</g><g id="BEND_DOWN" stroke="#ad1457" stroke-dasharray="2 1">${bends('down')}</g></g></svg>\n`;
}
