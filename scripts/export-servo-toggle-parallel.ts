/** Prepare the current print/CAD input and a 1:1 host-panel cutting template. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import part from '../src/parts/servo-toggle-actuator/part';
import { configured } from '../src/parts/servo-toggle-actuator/lib/model';
import {
  installedPanelInterface,
  parallelPanelInterface,
} from '../src/parts/servo-toggle-actuator/lib/parallel-installation';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';

const arguments_ = process.argv.slice(2),
  dual = arguments_.includes('--dual'),
  positional = arguments_.filter((value) => value !== '--dual'),
  stem = dual ? 'servo-toggle-dual' : 'servo-toggle-parallel';
const parameters = {
  ...part.defaults,
  mechanism: dual ? 'parallel-dual' : 'parallel',
  ...(dual ? { manualState: 'guarded-off' } : {}),
  phase: 'off',
  baseLength: dual ? 100 : 80,
  baseWidth: dual ? 150 : 110,
  deckHeight: 42,
};
const errors = validateParameters(part, parameters, 'assembled');
if (errors.length) throw new Error(errors.join('; '));
const output = resolve(positional[0] ?? `test-results/${stem}`);
const input = resolve(
  positional[1] ?? `/tmp/protolab-${dual ? 'dual' : 'parallel'}-print-case.json`,
);
mkdirSync(output, { recursive: true });
const canonicalInstallation = parallelPanelInterface(parameters),
  installation = installedPanelInterface(parameters),
  script = generateScript(part, parameters, 'assembled'),
  codeSha256 = createHash('sha256').update(script).digest('hex');
writeFileSync(
  input,
  JSON.stringify({
    parameters,
    assemblyFileStem: stem,
    installationFileStem: dual
      ? 'servo-toggle-dual-installation'
      : 'servo-toggle-panel-installation',
    state: 'assembled',
    components: configured(parameters, 'assembled').map((piece) => piece.component),
    script,
    codeSha256,
    installation,
    output,
  }),
);

const { width, height, radius, centre, terminalNotch, additionalTerminalNotches } =
    canonicalInstallation.cutout,
  notches = [terminalNotch, ...additionalTerminalNotches].sort((a, b) => b.centre[1] - a.centre[1]),
  x0 = centre[0] - width / 2,
  x1 = centre[0] + width / 2,
  y0 = centre[1] - height / 2,
  y1 = centre[1] + height / 2,
  flangeLength = parameters.baseLength,
  flangeWidth = parameters.baseWidth,
  fx0 = -flangeLength / 2,
  fx1 = flangeLength / 2,
  fy0 = canonicalInstallation.flangeCentre[1] - flangeWidth / 2,
  fy1 = canonicalInstallation.flangeCentre[1] + flangeWidth / 2,
  [installedWidth, installedHeight] = installation.flangeSize,
  paperWidth = installedWidth + 60,
  paperHeight = installedHeight + 50,
  paperX = 30 - installation.flangeCentre[0] + installedWidth / 2,
  paperY = installation.flangeCentre[1] + installedHeight / 2 + 32,
  legends = 'legends' in installation ? installation.legends : [],
  axes = [[0, 0], [0, -28], ...(dual ? [[0, -90]] : [])];
const dxf: (string | number)[] = [
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
  'ENTITIES',
];
const panelPoint = ([x, y]: readonly number[]) => (dual ? [y, -x] : [x, y]);
const line = (layer: string, colour: number, from: number[], to: number[]) => {
  const a = panelPoint(from),
    b = panelPoint(to);
  dxf.push(0, 'LINE', 8, layer, 62, colour, 10, a[0], 20, a[1], 30, 0, 11, b[0], 21, b[1], 31, 0);
};
const arc = (
  x: number,
  y: number,
  start: number,
  end: number,
  r = radius,
  layer = 'CUTOUT',
  colour = 1,
) => {
  const [px, py] = panelPoint([x, y]);
  dxf.push(
    0,
    'ARC',
    8,
    layer,
    62,
    colour,
    10,
    px,
    20,
    py,
    30,
    0,
    40,
    r,
    50,
    dual ? (start + 270) % 360 : start,
    51,
    dual ? (end + 270) % 360 : end,
  );
};
line('CUTOUT', 1, [x0 + radius, y0], [x1 - radius, y0]);
arc(x1 - radius, y0 + radius, 270, 360);
line('CUTOUT', 1, [x1, y0 + radius], [x1, y1 - radius]);
arc(x1 - radius, y1 - radius, 0, 90);
line('CUTOUT', 1, [x1 - radius, y1], [x0 + radius, y1]);
arc(x0 + radius, y1 - radius, 90, 180);
let lastY = y1 - radius;
let notchPath = '';
for (const notch of notches) {
  const nx0 = notch.centre[0] - notch.width / 2,
    ny0 = notch.centre[1] - notch.height / 2,
    ny1 = notch.centre[1] + notch.height / 2,
    nr = notch.radius;
  line('CUTOUT', 1, [x0, lastY], [x0, ny1]);
  line('CUTOUT', 1, [x0, ny1], [nx0 + nr, ny1]);
  arc(nx0 + nr, ny1 - nr, 90, 180, nr);
  line('CUTOUT', 1, [nx0, ny1 - nr], [nx0, ny0 + nr]);
  arc(nx0 + nr, ny0 + nr, 180, 270, nr);
  line('CUTOUT', 1, [nx0 + nr, ny0], [x0, ny0]);
  lastY = ny0;
  notchPath += `V${ny1}H${nx0 + nr}A${nr} ${nr} 0 0 1 ${nx0} ${ny1 - nr}V${ny0 + nr}A${nr} ${nr} 0 0 1 ${nx0 + nr} ${ny0}H${x0}`;
}
line('CUTOUT', 1, [x0, lastY], [x0, y0 + radius]);
arc(x0 + radius, y0 + radius, 180, 270);
for (const [x, y] of installation.mountingHoles)
  dxf.push(
    0,
    'CIRCLE',
    8,
    'M4_HOLES',
    62,
    5,
    10,
    x,
    20,
    y,
    30,
    0,
    40,
    installation.holeDiameter / 2,
  );
const outlineLayer = 'CARRIER_OUTLINE_REFERENCE';
line(outlineLayer, 8, [fx0 + 4, fy0], [fx1 - 4, fy0]);
arc(fx1 - 4, fy0 + 4, 270, 360, 4, outlineLayer, 8);
line(outlineLayer, 8, [fx1, fy0 + 4], [fx1, fy1 - 4]);
arc(fx1 - 4, fy1 - 4, 0, 90, 4, outlineLayer, 8);
line(outlineLayer, 8, [fx1 - 4, fy1], [fx0 + 4, fy1]);
arc(fx0 + 4, fy1 - 4, 90, 180, 4, outlineLayer, 8);
line(outlineLayer, 8, [fx0, fy1 - 4], [fx0, fy0 + 4]);
arc(fx0 + 4, fy0 + 4, 180, 270, 4, outlineLayer, 8);
for (const [x, y] of axes) {
  line('AXES_REFERENCE', 8, [x - 2, y], [x + 2, y]);
  line('AXES_REFERENCE', 8, [x, y - 2], [x, y + 2]);
}
for (const legend of legends)
  dxf.push(
    0,
    'TEXT',
    8,
    'LEGENDS_REFERENCE',
    62,
    8,
    10,
    legend.centre[0],
    20,
    legend.centre[1],
    30,
    0,
    40,
    3.5,
    1,
    legend.text,
    50,
    0,
    72,
    1,
    11,
    legend.centre[0],
    21,
    legend.centre[1],
    31,
    0,
  );
dxf.push(0, 'ENDSEC', 0, 'EOF');
writeFileSync(resolve(output, 'panel-cutout-template.dxf'), dxf.join('\n') + '\n');

const cutoutPath = `M${x0 + radius} ${y0}H${x1 - radius}A${radius} ${radius} 0 0 1 ${x1} ${y0 + radius}V${y1 - radius}A${radius} ${radius} 0 0 1 ${x1 - radius} ${y1}H${x0 + radius}A${radius} ${radius} 0 0 1 ${x0} ${y1 - radius}${notchPath}V${y0 + radius}A${radius} ${radius} 0 0 1 ${x0 + radius} ${y0}Z`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${paperWidth}mm" height="${paperHeight}mm" viewBox="0 0 ${paperWidth} ${paperHeight}">
<rect width="${paperWidth}" height="${paperHeight}" fill="white"/>
<g font-family="sans-serif" fill="#111" text-anchor="middle">
<text x="${paperWidth / 2}" y="8" font-size="4">ST3215 / ASW-07D ${dual ? 'dual-switch ' : ''}panel template</text>
<text x="${paperWidth / 2}" y="14" font-size="2.6">${installedWidth} x ${installedHeight} mm PETG carrier - millimetres - print at 100%</text>
</g>
<g transform="translate(${paperX} ${paperY}) scale(1 -1)${dual ? ' rotate(-90)' : ''}" fill="none" stroke-width="0.3">
<rect x="${fx0}" y="${fy0}" width="${flangeLength}" height="${flangeWidth}" rx="4" stroke="#999" stroke-dasharray="2 1"/>
<path d="${cutoutPath}" stroke="#c11"/>
${canonicalInstallation.mountingHoles.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${installation.holeDiameter / 2}" stroke="#1457ac"/>`).join('\n')}
<path d="${axes.map(([x, y]) => `M${x - 2} ${y}H${x + 2}M${x} ${y - 2}V${y + 2}`).join('')}" stroke="#aaa" stroke-width="0.2"/>
</g>
${legends.map((legend) => `<text x="${legend.centre[0] + paperX}" y="${paperY - legend.centre[1] + 1.2}" text-anchor="middle" font-family="sans-serif" font-size="3.5" fill="#777">${legend.text}</text>`).join('\n')}
<g font-family="sans-serif" font-size="2.5" fill="#111">
<text x="8" y="20" fill="#c11">Red: ${installation.cutout.width} x ${installation.cutout.height} R${radius} THROUGH cutout + ${dual ? 'two upper terminal notches' : 'left terminal notch'}</text>
<text x="8" y="25" fill="#1457ac">Blue: four diameter 4.5 mm mounting holes</text>
<text x="8" y="30" fill="#777">Grey: carrier outline${dual ? ', legends' : ''} and axes, reference only</text>
<path d="M${paperWidth - 60} ${paperHeight - 11}H${paperWidth - 10}M${paperWidth - 60} ${paperHeight - 13}V${paperHeight - 9}M${paperWidth - 10} ${paperHeight - 13}V${paperHeight - 9}" fill="none" stroke="#111" stroke-width="0.3"/>
<text x="${paperWidth - 35}" y="${paperHeight - 14}" text-anchor="middle">Check this line measures 50 mm</text>
<text x="8" y="${paperHeight - 3}">Host plate top Z=0; reserve access below the servo. Fit to the actual print.</text>
</g>
</svg>`;
writeFileSync(resolve(output, 'panel-cutout-template.svg'), svg);
writeFileSync(
  resolve(output, 'panel-installation.json'),
  JSON.stringify(
    {
      codeSha256,
      unit: 'mm',
      ...installation,
      hostPlateExampleThickness: 3,
      plugPositionVerified: false,
      note: 'Cable approach is an authored clearance study. Source CAD omits the ports and mating plugs.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    input,
    output,
    codeSha256,
    templateScale: '1:1',
    components: configured(parameters, 'assembled').length,
  }),
);
