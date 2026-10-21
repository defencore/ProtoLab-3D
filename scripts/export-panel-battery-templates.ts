import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defaults } from '../src/parts/panel-battery-module/configurator';
import { layout } from '../src/parts/panel-battery-module/lib/layout';

type Point = [number, number];
interface Hole {
  id: string;
  at: Point;
  diameter: number;
  purpose: string;
  node?: string;
  edgeRelief?: boolean;
  entryEdgeX?: number;
}
interface Drawing {
  id: string;
  title: string;
  size: Point;
  radius: number;
  origin: Point;
  cut: boolean;
  holes: Hole[];
  notes: string[];
}

const output = resolve(process.argv[2] ?? 'test-results/panel-battery-module');
const fixed = (value: number) => Number(value.toFixed(6)).toString();
const xml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const color = (hole: Hole) =>
  hole.edgeRelief
    ? '#ba2020'
    : hole.diameter === 1.8 || hole.diameter === 1.1
      ? '#1565a8'
      : '#111111';
const row = (points: Point[], diameter: number, prefix: string, purpose: string): Hole[] =>
  points.map((at, index) => ({ id: `${prefix}${index + 1}`, at, diameter, purpose }));
const local = (point: Point, origin: Point): Point => [point[0] - origin[0], point[1] - origin[1]];

function svg(drawing: Drawing, pack: string): string {
  const panel = drawing.id === 'panel',
    page: Point = [210, 210],
    centre: Point = [105, 96],
    point = ([x, y]: Point): Point => [centre[0] + x, centre[1] - y],
    [width, height] = drawing.size,
    text = (x: number, y: number, value: string, size = 3, extra = '') =>
      `<text x="${fixed(x)}" y="${fixed(y)}" font-size="${fixed(size)}" ${extra}>${xml(value)}</text>`,
    out = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${page[0]}mm" height="${page[1]}mm" viewBox="0 0 ${page[0]} ${page[1]}">`,
      '<style>text{font-family:Arial,sans-serif;fill:#111}line,circle,rect,path{fill:none;stroke-linecap:round}</style>',
      `<rect x="0" y="0" width="${page[0]}" height="${page[1]}" fill="white" stroke="none" style="fill:white"/>`,
      text(12, 12, `${pack} battery module / ${drawing.title}`, 4.1),
      text(12, 19, '1:1 / millimetres / top view / +Y up / PRINT 100% - DO NOT FIT', 3),
      text(
        12,
        25,
        `Drawing datum: ${panel ? 'panel cutout centre' : 'main PCB centre'}. Assembly origin offset X${fixed(drawing.origin[0])}, Y${fixed(drawing.origin[1])}.`,
        2.7,
      ),
      `<g transform="translate(${centre.join(' ')}) scale(1 -1)">`,
      `<rect x="${fixed(-width / 2)}" y="${fixed(-height / 2)}" width="${fixed(width)}" height="${fixed(height)}" rx="${fixed(drawing.radius)}" stroke="${drawing.cut ? '#ba2020' : '#6a6a6a'}" stroke-width="0.25" ${drawing.cut ? '' : 'stroke-dasharray="2 1"'}/>`,
      '<path d="M -4 0 H 4 M 0 -4 V 4" stroke="#888" stroke-width="0.12"/>',
    ];
  for (const hole of drawing.holes) {
    const [x, y] = hole.at;
    out.push(
      hole.entryEdgeX === undefined
        ? `<circle cx="${fixed(x)}" cy="${fixed(y)}" r="${fixed(hole.diameter / 2)}" stroke="${color(hole)}" stroke-width="0.2"/>`
        : `<path d="M ${fixed(hole.entryEdgeX)} ${fixed(y + hole.diameter / 2)} H ${fixed(x)} A ${fixed(hole.diameter / 2)} ${fixed(hole.diameter / 2)} 0 0 0 ${fixed(x)} ${fixed(y - hole.diameter / 2)} H ${fixed(hole.entryEdgeX)}" stroke="${color(hole)}" stroke-width="0.2"/>`,
      `<path d="M ${fixed(x - 1.4)} ${fixed(y)} H ${fixed(x + 1.4)} M ${fixed(x)} ${fixed(y - 1.4)} V ${fixed(y + 1.4)}" stroke="${color(hole)}" stroke-width="0.1"/>`,
    );
  }
  out.push('</g>');
  const [originX, originY] = point([0, 0]),
    axisX = originX + width / 2 + 4;
  out.push(
    `<path d="M ${axisX} ${originY + height / 2} v -10 l -1 2 m 1 -2 l 1 2" stroke="#555" stroke-width="0.2"/>`,
    text(axisX - 2, originY + height / 2 - 12, '+Y', 2.6),
    text(
      originX - width / 2,
      originY - height / 2 - 4,
      `${fixed(width)} x ${fixed(height)} mm${drawing.radius ? ` / R${fixed(drawing.radius)}` : ''}`,
      3,
    ),
  );
  for (const hole of drawing.holes) {
    const [x, y] = point(hole.at);
    if (hole.node) {
      out.push(
        `<line x1="${fixed(x - hole.diameter / 2 - 0.3)}" y1="${fixed(y)}" x2="47" y2="${fixed(y)}" stroke="#666" stroke-width="0.12"/>`,
        text(12, y + 0.8, `${hole.id}: ${hole.node}`, 2.1),
      );
    } else out.push(text(x + 2, y - 1.5, hole.id, 1.9));
  }
  const legendY = panel ? 171 : 158;
  const groups = [...new Set(drawing.holes.map((hole) => `${hole.diameter}|${hole.purpose}`))];
  for (const [index, group] of groups.entries()) {
    const [diameter, purpose] = group.split('|'),
      count = drawing.holes.filter(
        (hole) => hole.diameter === Number(diameter) && hole.purpose === purpose,
      ).length;
    const feature = drawing.holes.find((hole) => hole.purpose === purpose)?.edgeRelief
      ? 'edge relief'
      : 'drill';
    out.push(
      text(12, legendY + index * 5, `${count} x ${feature} diameter ${diameter} mm: ${purpose}`, 3),
    );
  }
  out.push(
    text(
      12,
      legendY + groups.length * 5,
      drawing.cut
        ? 'RED outline: cut. Circles/crosshairs: drill centres.'
        : drawing.holes.some((hole) => hole.edgeRelief)
          ? 'DASHED: board stock. RED: open U reliefs. Other circles: drill.'
          : 'DASHED outline: supplied board stock. Circles/crosshairs: drill centres.',
      2.7,
    ),
  );
  const calibrationY = panel ? 202 : 197;
  drawing.notes.forEach((note, index) =>
    out.push(text(12, legendY + (groups.length + 1) * 5 + index * 4.2, note, 2.55)),
  );
  out.push(
    `<path d="M 12 ${calibrationY - 2} v 4 M 12 ${calibrationY} H 62 M 62 ${calibrationY - 2} v 4" stroke="#111" stroke-width="0.3"/>`,
    text(67, calibrationY + 1, '50 mm calibration - measure before drilling', 3),
    '</svg>',
  );
  return out.join('\n') + '\n';
}

function dxf(drawing: Drawing, pack: string): string {
  const lines: string[] = [],
    pair = (code: number, value: string | number) =>
      lines.push(String(code), typeof value === 'number' ? fixed(value) : value),
    entity = (kind: string, layer: string) => {
      pair(0, kind);
      pair(8, layer);
    },
    line = (a: Point, b: Point, layer: string) => {
      entity('LINE', layer);
      pair(10, a[0]);
      pair(20, a[1]);
      pair(30, 0);
      pair(11, b[0]);
      pair(21, b[1]);
      pair(31, 0);
    },
    arc = (at: Point, radius: number, start: number, end: number, layer: string) => {
      entity('ARC', layer);
      pair(10, at[0]);
      pair(20, at[1]);
      pair(30, 0);
      pair(40, radius);
      pair(50, start);
      pair(51, end);
    },
    text = (at: Point, value: string, height = 2.5) => {
      entity('TEXT', 'REFERENCE_NO_CUT');
      pair(10, at[0]);
      pair(20, at[1]);
      pair(30, 0);
      pair(40, height);
      pair(1, value);
    };
  pair(0, 'SECTION');
  pair(2, 'HEADER');
  pair(9, '$ACADVER');
  pair(1, 'AC1015');
  pair(9, '$INSUNITS');
  pair(70, 4);
  pair(9, '$MEASUREMENT');
  pair(70, 1);
  pair(0, 'ENDSEC');
  pair(0, 'SECTION');
  pair(2, 'TABLES');
  pair(0, 'TABLE');
  pair(2, 'LAYER');
  pair(70, 8);
  for (const [layer, colorNumber] of [
    ['CUT_OUTLINE', 1],
    ['STOCK_OUTLINE', 8],
    ['REFERENCE_NO_CUT', 8],
    ['DRILL_1_1', 5],
    ['DRILL_1_8', 5],
    ['DRILL_3_4', 7],
    ['DRILL_4_5', 7],
    ['EDGE_RELIEF_10', 1],
  ] as const) {
    pair(0, 'LAYER');
    pair(2, layer);
    pair(70, 0);
    pair(62, colorNumber);
    pair(6, 'CONTINUOUS');
  }
  pair(0, 'ENDTAB');
  pair(0, 'ENDSEC');
  pair(0, 'SECTION');
  pair(2, 'ENTITIES');
  const [width, height] = drawing.size,
    x = width / 2,
    y = height / 2,
    r = drawing.radius,
    layer = drawing.cut ? 'CUT_OUTLINE' : 'STOCK_OUTLINE';
  line([-x + r, -y], [x - r, -y], layer);
  line([x, -y + r], [x, y - r], layer);
  line([x - r, y], [-x + r, y], layer);
  line([-x, y - r], [-x, -y + r], layer);
  if (r) {
    arc([x - r, -y + r], r, 270, 360, layer);
    arc([x - r, y - r], r, 0, 90, layer);
    arc([-x + r, y - r], r, 90, 180, layer);
    arc([-x + r, -y + r], r, 180, 270, layer);
  }
  for (const hole of drawing.holes) {
    if (hole.entryEdgeX !== undefined) {
      const r = hole.diameter / 2;
      line([hole.entryEdgeX, hole.at[1] - r], [hole.at[0], hole.at[1] - r], 'EDGE_RELIEF_10');
      arc(hole.at, r, 270, 90, 'EDGE_RELIEF_10');
      line([hole.at[0], hole.at[1] + r], [hole.entryEdgeX, hole.at[1] + r], 'EDGE_RELIEF_10');
    } else {
      entity('CIRCLE', `DRILL_${String(hole.diameter).replace('.', '_')}`);
      pair(10, hole.at[0]);
      pair(20, hole.at[1]);
      pair(30, 0);
      pair(40, hole.diameter / 2);
    }
    if (hole.node) text([hole.at[0] - 30, hole.at[1] - 0.7], `${hole.id}: ${hole.node}`, 1.7);
  }
  text([-width / 2, height / 2 + 10], `${pack} battery module / ${drawing.title}`, 3);
  text([-width / 2, height / 2 + 5], 'Units mm; top view; +Y up; 100% print; no fit.');
  const base = -Math.max(height / 2 + 12, 30);
  line([-25, base], [25, base], 'REFERENCE_NO_CUT');
  line([-25, base - 2], [-25, base + 2], 'REFERENCE_NO_CUT');
  line([25, base - 2], [25, base + 2], 'REFERENCE_NO_CUT');
  text([-25, base - 6], '50 mm calibration / REFERENCE ONLY');
  let noteY = base - 12;
  for (const note of drawing.notes) {
    text([-width / 2, noteY], note);
    noteY -= 4;
  }
  for (const purpose of [...new Set(drawing.holes.map((hole) => hole.purpose))]) {
    const matching = drawing.holes.filter((hole) => hole.purpose === purpose);
    text([-width / 2, noteY], `${matching.length} x diameter ${matching[0].diameter}: ${purpose}`);
    noteY -= 4;
  }
  pair(0, 'ENDSEC');
  pair(0, 'EOF');
  return lines.join('\n') + '\n';
}

await mkdir(output, { recursive: true });
const sourcePaths = [
  'src/parts/panel-battery-module/lib/layout.ts',
  'src/parts/panel-battery-module/lib/model.ts',
  'src/parts/panel-battery-module/lib/closure.ts',
  'scripts/export-panel-battery-templates.ts',
];
const provenance = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (path) => [
      path,
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
    ]),
  ),
);
for (const pack of ['3S', '4S']) {
  const d = layout({ ...defaults, pack }),
    diagrams: Drawing[] = [
      {
        id: 'panel',
        title: 'host panel cutout and mounting',
        size: [d.cutoutLength, d.cutoutWidth],
        radius: d.cutoutRadius,
        origin: d.bodyCentre,
        cut: true,
        holes: row(
          d.panelHoles.map((point) => local(point, d.bodyCentre)),
          4.5,
          'M',
          'M4 panel mounting',
        ),
        notes: [
          'Cutout is for the complete module body; front flange remains outside the opening.',
          'Hole-coordinate CSV and DXF use this drawing datum; no automatic scaling.',
        ],
      },
      {
        id: 'main-pcb',
        title: 'main PCB critical drill pattern',
        size: [d.boardLength, d.boardWidth],
        radius: 0,
        origin: d.boardCentre,
        cut: false,
        holes: [
          ...row(
            d.holderPins.map((point) => local(point, d.boardCentre)),
            1.8,
            'P',
            'MPD contact tails',
          ),
          ...row(
            d.boardHoles.map((point) => local(point, d.boardCentre)),
            3.4,
            'M',
            'PCB mounting',
          ),
          ...row(
            d.boardReliefs.map((point) => local(point, d.boardCentre)),
            10,
            'R',
            'Left rail-post U relief',
          ).map((hole) => ({
            ...hole,
            edgeRelief: true,
            entryEdgeX: -d.boardLength / 2,
          })),
          ...row(
            d.balancePins.map((point) => local(point, d.boardCentre)),
            1.1,
            'PIN',
            'Right-angle balance header tails',
          ).map((hole, i) => ({
            ...hole,
            node: i === 0 ? 'B- / PIN 1' : i === d.cells ? 'B+' : `B${i}`,
          })),
        ],
        notes: [
          'Unused perfs/pads omitted. External M3 holder rails need no holder-fixing drills.',
          'Right-angle XH2.54 row: assembly X-50.5; PIN1 at +Y; opening faces -X.',
          ...(d.boardReliefs.length
            ? ['RED U reliefs: radius 5 mm, 10 mm opening; remove to LEFT stock edge.']
            : []),
        ],
      },
    ];
  const destination = resolve(output, pack);
  await mkdir(destination, { recursive: true });
  for (const extension of ['svg', 'dxf', 'holes.csv'])
    await rm(
      resolve(destination, `balance-pcb${extension === 'holes.csv' ? '-' : '.'}${extension}`),
      {
        force: true,
      },
    );
  const records = [];
  for (const drawing of diagrams) {
    const svgText = svg(drawing, pack),
      dxfText = dxf(drawing, pack);
    for (const hole of drawing.holes) {
      if (hole.edgeRelief) {
        if (
          hole.entryEdgeX !== -drawing.size[0] / 2 ||
          hole.at[0] < hole.entryEdgeX ||
          hole.at[0] + hole.diameter / 2 >= drawing.size[0] / 2 ||
          Math.abs(hole.at[1]) + hole.diameter / 2 >= drawing.size[1] / 2
        )
          throw new Error(`Invalid open U relief: ${pack}/${drawing.id}/${hole.id}`);
        continue;
      }
      if (Math.abs(hole.at[0]) + hole.diameter / 2 >= drawing.size[0] / 2 && drawing.id !== 'panel')
        throw new Error(`Hole outside stock: ${pack}/${drawing.id}/${hole.id}`);
      if (Math.abs(hole.at[1]) + hole.diameter / 2 >= drawing.size[1] / 2 && drawing.id !== 'panel')
        throw new Error(`Hole outside stock: ${pack}/${drawing.id}/${hole.id}`);
    }
    await writeFile(resolve(destination, `${drawing.id}.svg`), svgText);
    await writeFile(resolve(destination, `${drawing.id}.dxf`), dxfText);
    await writeFile(
      resolve(destination, `${drawing.id}-holes.csv`),
      [
        'id,purpose,diameter_mm,x_mm,y_mm,assembly_x_mm,assembly_y_mm,node',
        ...drawing.holes.map((hole) =>
          [
            hole.id,
            hole.purpose,
            hole.diameter,
            ...hole.at,
            hole.at[0] + drawing.origin[0],
            hole.at[1] + drawing.origin[1],
            hole.node ?? '',
          ].join(','),
        ),
      ].join('\n') + '\n',
    );
    records.push({
      id: drawing.id,
      widthMm: drawing.size[0],
      heightMm: drawing.size[1],
      radiusMm: drawing.radius,
      drawingOriginAssembly: drawing.origin,
      holes: drawing.holes,
      svgSha256: createHash('sha256').update(svgText).digest('hex'),
      dxfSha256: createHash('sha256').update(dxfText).digest('hex'),
    });
    console.log(
      `${pack}/${drawing.id}: ${drawing.size.join(' x ')} mm, ${drawing.holes.length} holes`,
    );
  }
  await writeFile(
    resolve(destination, 'templates.json'),
    JSON.stringify(
      { pack, units: 'mm', scale: 1, view: 'top, +Y up', provenance, drawings: records },
      null,
      2,
    ) + '\n',
  );
}
