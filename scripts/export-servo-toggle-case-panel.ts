/** Prepare the current modular case-panel CAD and print export input. */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import part from '../src/parts/servo-toggle-actuator/part';
import { configured } from '../src/parts/servo-toggle-actuator/lib/model';
import {
  casePanelLayout,
  casePanelStructure,
} from '../src/parts/servo-toggle-actuator/lib/case-panel';
import { caseElectronicsLayout } from '../src/parts/servo-toggle-actuator/lib/case-electronics-layout';
import {
  caseElectronicsHoneycomb,
  caseElectronicsRetention,
} from '../src/parts/servo-toggle-actuator/lib/case-electronics';
import {
  caseElectronicsAccess,
  caseElectronicsEmi,
} from '../src/parts/servo-toggle-actuator/lib/case-electronics-components';
import { caseFitLayout } from '../src/parts/servo-toggle-actuator/lib/case-fit';
import { caseWallMountStructure } from '../src/parts/servo-toggle-actuator/lib/case-wall-mounts';
import { caseConnectorMounting } from '../src/parts/servo-toggle-actuator/lib/case-components';
import { caseWallMountDrawing } from './case-panel-wall-mount-drawing';
import { caseElectronicsGridDrawing } from './case-electronics-grid-drawing';
import { caseSeatRingDrawing } from './case-seat-ring-drawing';

const preset = part.presets.find((item) => item.parameters.mechanism === 'case-panel');
if (!preset) throw new Error('The modular case-panel preset is missing.');
const parameters = { ...part.defaults, ...preset.parameters, phase: 'off' },
  state = 'assembled',
  output = resolve(process.argv[2] ?? 'test-results/servo-toggle-case-panel'),
  input = resolve(process.argv[3] ?? '/tmp/protolab-case-panel-print-case.json'),
  errors = validateParameters(part, parameters, state);
if (errors.length) throw new Error(errors.join('; '));
mkdirSync(output, { recursive: true });
copyFileSync(
  new URL('../src/parts/servo-toggle-actuator/GUIDE.md', import.meta.url),
  resolve(output, 'GUIDE.md'),
);
// Refresh drawings and instructions from an already prepared immutable CAD input without rebuilding geometry.
const prepared = process.env.CASE_PANEL_REUSE_INPUT
  ? (JSON.parse(readFileSync(process.env.CASE_PANEL_REUSE_INPUT, 'utf8')) as {
      parameters: typeof parameters;
      script: string;
      components: ReturnType<typeof configured>[number]['component'][];
      layout: ReturnType<typeof casePanelLayout>;
      mechanicalStructure: ReturnType<typeof casePanelStructure>;
      electronics: ReturnType<typeof caseElectronicsLayout>;
      electronicsHoneycomb: ReturnType<typeof caseElectronicsHoneycomb>;
      electronicsRetention: ReturnType<typeof caseElectronicsRetention>;
      electronicsAccess: ReturnType<typeof caseElectronicsAccess>;
      modelEmi: ReturnType<typeof caseElectronicsEmi>;
      caseEnvelope: ReturnType<typeof caseFitLayout>;
      wallMounts: ReturnType<typeof caseWallMountStructure>;
      connectorMounting: ReturnType<typeof caseConnectorMounting>;
    })
  : undefined;
if (prepared && JSON.stringify(prepared.parameters) !== JSON.stringify(parameters))
  throw new Error('Prepared input parameters differ; prepare current CAD first.');
if (
  prepared &&
  (!prepared.mechanicalStructure || !prepared.electronicsRetention || !prepared.wallMounts)
)
  throw new Error('Prepare a fresh input with the current structural and retention contract.');
const script = prepared?.script ?? generateScript(part, parameters, state, preset.id),
  codeSha256 = createHash('sha256').update(script).digest('hex'),
  components =
    prepared?.components ?? configured(parameters, state).map((piece) => piece.component),
  layout = prepared?.layout ?? casePanelLayout(parameters),
  mechanicalStructure = prepared?.mechanicalStructure ?? casePanelStructure(parameters),
  electronics = prepared?.electronics ?? caseElectronicsLayout(parameters),
  electronicsHoneycomb = prepared?.electronicsHoneycomb ?? caseElectronicsHoneycomb(parameters),
  electronicsRetention = prepared?.electronicsRetention ?? caseElectronicsRetention(parameters),
  electronicsAccess = prepared?.electronicsAccess ?? caseElectronicsAccess(parameters),
  modelEmi = prepared?.modelEmi ?? caseElectronicsEmi(parameters),
  caseEnvelope = prepared?.caseEnvelope ?? caseFitLayout(parameters),
  wallMounts = prepared?.wallMounts ?? caseWallMountStructure(parameters),
  connectorMounting = prepared?.connectorMounting ?? caseConnectorMounting(parameters);
const record = {
  parameters,
  state,
  presetId: preset.id,
  assemblyFileStem: 'servo-toggle-case-panel',
  components,
  script,
  codeSha256,
  layout,
  mechanicalStructure,
  electronics,
  electronicsHoneycomb,
  electronicsRetention,
  electronicsAccess,
  modelEmi,
  caseEnvelope,
  wallMounts,
  connectorMounting,
  output,
};
writeFileSync(input, JSON.stringify(record));
writeFileSync(resolve(output, 'case-panel-source.FCMacro'), script);
writeFileSync(
  resolve(output, 'case-panel-components.json'),
  JSON.stringify(
    {
      unit: 'mm',
      codeSha256,
      parameters,
      layout,
      mechanicalStructure,
      electronics,
      electronicsHoneycomb,
      electronicsRetention,
      electronicsAccess,
      modelEmi,
      caseEnvelope,
      wallMounts,
      connectorMounting,
      components,
    },
    null,
    2,
  ) + '\n',
);
writeFileSync(
  resolve(output, 'case-panel-manufacturing.json'),
  JSON.stringify(
    {
      unit: 'mm',
      codeSha256,
      parameters,
      layout,
      mechanicalStructure,
      electronics,
      electronicsHoneycomb,
      electronicsRetention,
      electronicsAccess,
      modelEmi,
      caseEnvelope,
      wallMounts,
      connectorMounting,
      components: components.map(
        ({ id, name, libraryId, supply, manufacturing, procurement, notes, placement }) => ({
          id,
          name,
          libraryId,
          supply,
          manufacturing,
          procurement,
          notes,
          placement,
        }),
      ),
    },
    null,
    2,
  ) + '\n',
);

const paperWidth = layout.width + 40,
  paperHeight = layout.height + 52,
  left = 20 - layout.min[0],
  top = 30 + layout.max[1],
  point = ([x, y]: readonly number[]) => [left + x, top - y],
  xml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
  text = (at: readonly number[], value: string, size = 3, colour = '#202c39') => {
    const [x, y] = point(at);
    return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="${colour}">${xml(value)}</text>`;
  },
  circle = (at: readonly number[], radius: number, colour: string, fill = 'none') => {
    const [x, y] = point(at);
    return `<circle cx="${x}" cy="${y}" r="${radius}" stroke="${colour}" fill="${fill}"/>`;
  },
  rect = (
    at: readonly number[],
    width: number,
    height: number,
    colour: string,
    fill = 'none',
    radius = 1,
  ) => {
    const [x, y] = point(at);
    return `<rect x="${x - width / 2}" y="${y - height / 2}" width="${width}" height="${height}" rx="${radius}" stroke="${colour}" fill="${fill}"/>`;
  },
  line = (a: readonly number[], b: readonly number[], colour = '#66727e', dash = '') => {
    const [x1, y1] = point(a),
      [x2, y2] = point(b);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colour}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  },
  svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${paperWidth}mm" height="${paperHeight}mm" viewBox="0 0 ${paperWidth} ${paperHeight}">`,
    '<style>text{font-family:Arial,sans-serif}circle,rect,line{stroke-width:.3}</style>',
    `<rect width="${paperWidth}" height="${paperHeight}" fill="white"/>`,
    `<text x="${paperWidth / 2}" y="9" text-anchor="middle" font-family="Arial,sans-serif" font-size="4">Modular case panel / operator top view</text>`,
    `<text x="${paperWidth / 2}" y="15" text-anchor="middle" font-family="Arial,sans-serif" font-size="2.7">${layout.width} x ${layout.height} x ${layout.panelThickness} mm / dimensions in mm / scale 1:1 / print at 100%</text>`,
    rect(
      layout.centre,
      layout.width,
      layout.height,
      '#334452',
      '#f4f7f8',
      layout.panelCornerRadius,
    ),
    ...layout.mountingHoles.map((at) => circle(at, 2.25, '#2451a5', 'white')),
    rect(
      [
        (layout.cassetteFrontFlange.min[0] + layout.cassetteFrontFlange.max[0]) / 2,
        (layout.cassetteFrontFlange.min[1] + layout.cassetteFrontFlange.max[1]) / 2,
      ],
      layout.cassetteFrontFlange.max[0] - layout.cassetteFrontFlange.min[0],
      layout.cassetteFrontFlange.max[1] - layout.cassetteFrontFlange.min[1],
      '#3d5e74',
      '#e3ebf0',
      4,
    ),
  ];
svg.push(
  '<g stroke-dasharray="2 1">',
  rect(
    layout.batteryBankCentre,
    layout.batteryBankSize[0],
    layout.batteryBankSize[1],
    '#61788d',
    'none',
    3,
  ),
  rect(
    layout.testClipCarrierCentre,
    layout.testClipCarrierSize[0],
    layout.testClipCarrierSize[1],
    '#61788d',
    'none',
    2,
  ),
  '</g>',
  ...mechanicalStructure.registrations
    .filter((v) => v.id.startsWith('carrier-'))
    .map((v) =>
      rect(
        [(v.probe.min[0] + v.probe.max[0]) / 2, (v.probe.min[1] + v.probe.max[1]) / 2],
        v.probe.max[0] - v.probe.min[0],
        v.probe.max[1] - v.probe.min[1],
        '#61788d',
        '#dce5ed',
        0,
      ),
    ),
  ...mechanicalStructure.ties.map((v) => {
    const x0 = Math.min(...v.segments.map((s) => s.min[0])),
      x1 = Math.max(...v.segments.map((s) => s.max[0])),
      y0 = Math.min(...v.segments.map((s) => s.min[1])),
      y1 = Math.max(...v.segments.map((s) => s.max[1]));
    return rect(
      [(x0 + x1) / 2 + v.frame.at[0], (y0 + y1) / 2 + v.frame.at[1]],
      x1 - x0,
      y1 - y0,
      '#8c659a',
      'none',
      0,
    );
  }),
);
for (const [index, at] of layout.batteries.entries()) {
  const xt = layout.connectors[index];
  svg.push(
    rect(at, layout.batteryPocket[0], layout.batteryPocket[1], '#61788d', 'white', 1),
    rect(at, layout.batterySize[0], layout.batterySize[1], '#354b5e', '#c1d0db', 1.5),
    text([at[0], at[1] + 4], `${layout.batteryLabelTexts[index]} / 4S1P`, 3.5),
    text([at[0], at[1] - 3], '88 x 24 / H74 / lift from above', 2.7),
    line([at[0] - layout.batterySize[0] / 2, at[1]], xt, '#a56b18', '2 1'),
    rect(xt, 12.1, 27.1, '#ac751d', '#f2cc69', 2),
    `<path d="M ${[
      [-7.85, -4.15],
      [5.775, -4.15],
      [7.85, -2.075],
      [7.85, 2.075],
      [5.775, 4.15],
      [-7.85, 4.15],
    ]
      .map(([u, v]) => point([xt[0] - v, xt[1] + u]).join(','))
      .join(' L ')} Z" stroke="#ac751d" fill="#f7e0a5"/>`,
    ...[-10.25, 10.25].flatMap((dy) => [
      circle([xt[0], xt[1] + dy], 2.55, '#8a641f', 'white'),
      circle([xt[0], xt[1] + dy], 1.5, '#8a641f'),
    ]),
    text([20, xt[1] - 18], `XT60E-M / ${layout.batteryLabelTexts[index]}`, 2.5),
  );
}
for (const [i, at] of layout.batteryLabels.entries())
  svg.push(text(at, layout.batteryLabelTexts[i], 3.5));
for (const at of layout.bodyMountAxes)
  svg.push(circle(at, 5, '#61788d'), circle(at, 1.7, '#334452', 'white'));
for (const [index, at] of [layout.arm1, layout.arm2].entries()) {
  if (index === 0) svg.push(rect([at[0], at[1] + 7], 19, 42.6, '#b94842', '#efd9d5', 2));
  svg.push(
    circle(at, 9.3, '#636d75', '#d6dce0'),
    circle(at, 6.3, '#293b49', '#fafbfc'),
    text([layout.arm1Legend, layout.arm2Legend][index], ['ARM 1', 'ARM 2'][index], 3.5),
  );
}
const servoAxis = [layout.arm2[0] - 28, layout.arm2[1]],
  servoCentre = [layout.arm2[0] - 40.5, layout.arm2[1]];
svg.push(
  rect(servoCentre, 57, 53, '#3d5e74', '#b8c9d5', 2),
  circle(servoAxis, 13, '#a67224', '#e7b967'),
  line([servoAxis[0], servoAxis[1] - 33], [servoAxis[0], servoAxis[1] + 33], '#a67224'),
  text([servoCentre[0], servoCentre[1] - 29], 'ST3215', 2.6),
);
for (const [index, at] of layout.indicators.entries())
  svg.push(
    circle(at, 9.5, '#58636b', ['#edbbb8', '#f2dd9a', '#cbe9cc'][index]),
    circle(at, 8, '#334452'),
    text([at[0], at[1] - 1], String(index + 1), 3),
  );
for (const legend of layout.sp20Legends) svg.push(text(legend.centre, legend.text, 3.5));
for (const legend of layout.indicatorLegends) svg.push(text(legend.centre, legend.text, 3.5));
svg.push(text(layout.clipLegend.centre, layout.clipLegend.text, 3.5));
for (const [index, at] of layout.sp20Connectors.entries()) {
  const [x, y] = point(at),
    halfFlat = Math.sqrt(10.25 ** 2 - 9.25 ** 2);
  svg.push(
    circle(at, 14.5, '#35434e', '#565f68'),
    `<path d="M ${x - halfFlat} ${y - 9.25} L ${x + halfFlat} ${y - 9.25} A 10.25 10.25 0 1 1 ${x - halfFlat} ${y - 9.25} Z" stroke="#b2c0cc" fill="#e4e9ed"/>`,
    text([at[0], at[1] - 1], `SP20-4 / ${index + 1}`, 2.5),
  );
}
for (const [index, at] of layout.testClips.entries())
  svg.push(
    rect(at, 55, 18, '#4c555d', index ? '#34383d' : '#c9483e', 1.5),
    rect([at[0] - 10, at[1]], 31, 16.5, '#5f6265', index ? '#454a50' : '#e25c50', 1),
    circle([at[0] - 15, at[1]], 4, '#9ea6ac', '#bfc5ca'),
    rect([at[0] + 19.5, at[1]], 3.4, 11.8, '#987528', '#d2af58', 1.7),
    text([at[0], at[1] + 1], index ? 'BLACK' : 'RED', 2.6, 'white'),
  );
svg.push(text([181, -7], 'CONTACTS +X / SPRINGS -X', 2.4));
for (const component of components.filter((c) => /^case-(?:lid|fit)-screw-/.test(c.id))) {
  const at = component.placement.translation;
  svg.push(circle(at, Number(component.parameters.headSize ?? 3.8) / 2, '#57616a', 'white'));
}
svg.push(
  line([layout.min[0], layout.max[1] + 7], [layout.max[0], layout.max[1] + 7]),
  ...[layout.min[0], layout.max[0]].map((x) =>
    line([x, layout.max[1] + 4], [x, layout.max[1] + 10]),
  ),
  text([layout.centre[0], layout.max[1] + 8.5], `${layout.width}`, 3),
  line([layout.min[0] - 8, layout.min[1]], [layout.min[0] - 8, layout.max[1]]),
  ...[layout.min[1], layout.max[1]].map((y) =>
    line([layout.min[0] - 11, y], [layout.min[0] - 5, y]),
  ),
  text([layout.min[0] - 12, layout.centre[1]], `${layout.height}`, 3),
  `<text x="20" y="${paperHeight - 12}" font-family="Arial,sans-serif" font-size="2.6">Dashes: below-panel framework/carrier and lead routes. Purple: nylon-tie reserves. Confirm AD16 dimensions and actual cable exits.</text>`,
  `<text x="20" y="${paperHeight - 6}" font-family="Arial,sans-serif" font-size="2.6">Yellow is midway between battery rows and SP20 sockets. Hole geometry and STL are the manufacturing reference.</text>`,
  '</svg>',
);
writeFileSync(resolve(output, 'case-panel-operator-layout.svg'), svg.join('\n') + '\n');
writeFileSync(
  resolve(output, 'case-wall-mount-layout.svg'),
  caseWallMountDrawing(wallMounts.mounts, caseEnvelope.grooveFloorZ, codeSha256),
);
writeFileSync(resolve(output, 'case-electronics-grid-layout.svg'), caseElectronicsGridDrawing(mechanicalStructure.modularElectronics));
writeFileSync(resolve(output, 'case-seat-ring-mount-layout.svg'), caseSeatRingDrawing(caseEnvelope));
// Finalize native-generated drawings during the post-export documentation refresh.
// The nominal cavity radius and taper remain reference data; the plate has its own outline.
if (prepared) {
  const undersidePath = resolve(output, 'case-panel-underside-layout.svg');
  if (existsSync(undersidePath)) {
    const source = readFileSync(undersidePath, 'utf8'),
      prefix = `<rect x="20" y="30" width="${layout.width}" height="${layout.height}" rx="`,
      start = source.indexOf(prefix);
    if (start < 0 || source.lastIndexOf(prefix) !== start)
      throw new Error('The native underside drawing must contain one matching plate outline.');
    const valueStart = start + prefix.length,
      valueEnd = source.indexOf('"', valueStart);
    writeFileSync(
      undersidePath,
      source.slice(0, valueStart) + layout.panelCornerRadius + source.slice(valueEnd),
    );
  }
  const sidePath = resolve(output, 'case-side-clearance.svg');
  if (existsSync(sidePath)) {
    const source = readFileSync(sidePath, 'utf8'),
      previous =
        'User-measured ideal taper and lid height. CornerR6 is inferred. Lid ribs and local molded features are not modeled.',
      qualification = `Reference taper/R${caseEnvelope.cornerRadius}; the ${layout.width} x ${layout.height} mm R${layout.panelCornerRadius} panel perimeter is a fit prototype. Full case fit and boss gaps are unverified.`;
    if (!source.includes(previous) && !source.includes(qualification))
      throw new Error('The native side drawing must retain an explicit fit qualification.');
    writeFileSync(sidePath, source.replace(previous, qualification));
  }
}
let referenceSliceSummary = '';
let referenceSupportSummary = '';
const referenceSlicePath = resolve(output, 'native-slicer-comparison.json');
if (existsSync(referenceSlicePath)) {
  const study = JSON.parse(readFileSync(referenceSlicePath, 'utf8')) as {
    sourceCodeSha256: string;
    slicer: {
      name: string;
      printer: string;
      nozzleMm: number;
      layerHeightMm: number;
      wallGenerator?: string;
      supports: string;
      processBase: string;
    };
    baselineTotals: { estimatedSeconds: number; filamentGrams: number };
    currentTotals: { estimatedSeconds: number; filamentGrams: number };
  };
  if (study.sourceCodeSha256 === codeSha256) {
    const duration = (seconds: number) => {
      const wholeSeconds = Math.round(seconds);
      return `${Math.floor(wholeSeconds / 3600)} h ${Math.floor(wholeSeconds / 60) % 60} min ${wholeSeconds % 60} s`;
    };
    referenceSliceSummary =
      `Reference slicing of the core assembly prints: ${duration(study.baselineTotals.estimatedSeconds)} / ${study.baselineTotals.filamentGrams.toFixed(1)} g for the previous kit; ${duration(study.currentTotals.estimatedSeconds)} / ${study.currentTotals.filamentGrams.toFixed(1)} g for this kit.\n` +
      `${study.slicer.name}, ${study.slicer.printer}, ${study.slicer.nozzleMm} mm nozzle, ${study.slicer.layerHeightMm} mm layers; ${study.slicer.processBase}; ${study.slicer.wallGenerator ?? 'perimeter generator specified in the included process'}; ${study.slicer.supports}. Both revisions use identical reference profiles and prescribed orientations. These are slicer estimates for an unselected reference printer, not measured print times or ready machine instructions. Profiles and exact STL checksums are in native-slicer-comparison.json. The alternative matched-process comparison is included separately with its own reference profiles.\n\n`;
  }
}
const supportComparisonPath = resolve(output, 'native-support-comparison.json');
if (existsSync(supportComparisonPath)) {
  const study = JSON.parse(readFileSync(supportComparisonPath, 'utf8')) as {
    sourceCodeSha256: string;
    baselineTotals: { supportFilamentGrams: number };
    currentTotals: { supportFilamentGrams: number };
  };
  if (study.sourceCodeSha256 === codeSha256) {
    const previous = study.baselineTotals.supportFilamentGrams,
      current = study.currentTotals.supportFilamentGrams;
    referenceSupportSummary = `Matched normal-support estimate for all separately printable parts: ${previous.toFixed(1)} g support in the previous kit; ${current.toFixed(1)} g in this kit (${Math.abs((current / previous - 1) * 100).toFixed(1)}% ${current <= previous ? 'less' : 'more'}). Exact mesh bindings and per-part values are in native-support-comparison.json. Use the per-part results to select local supports beneath fitted ledges and small receiving pockets.\n\n`;
  }
}
const recommendedSupportPath = resolve(output, 'native-support-recommended-comparison.json');
if (existsSync(recommendedSupportPath)) {
  const study = JSON.parse(readFileSync(recommendedSupportPath, 'utf8')) as {
    sourceCodeSha256: string;
    baselineTotals: { supportFilamentGrams: number };
    currentTotals: { supportFilamentGrams: number };
  };
  if (study.sourceCodeSha256 === codeSha256)
    referenceSupportSummary += `Optional support-process combination: the per-part process selections in native-support-recommended-comparison.json estimate ${study.currentTotals.supportFilamentGrams.toFixed(1)} g supports across this kit versus ${study.baselineTotals.supportFilamentGrams.toFixed(1)} g in the previous all-normal kit. This includes both geometry and a process change; it is separate from the matched-normal comparison above. All TPU rows use the same PETG profile solely to compare geometry; select suitable TPU production settings separately.\n\n`;
}
writeFileSync(
  resolve(output, 'PRINT-KIT-README.txt'),
  `MODULAR CASE PANEL\n\n` +
    `Panel: ${layout.width} x ${layout.height} x ${layout.panelThickness} mm. All files use millimetres.\n` +
    `Reprint only case-lower-cradle, case-fit-seat-ring and case-panel-gasket for this reinforcement. The other25 STL files match the preceding modular release exactly, including the carrier, faceplate, printed external ST3215 frame, universal tray and all seven adapters.\n` +
    `R${layout.panelCornerRadius} working outline: 1 mm trimmed from each side and 0.5 mm from each front/rear edge of the previous 216 x 151.6 mm plate after the latest physical trial. This corrected perimeter remains a fitting prototype. The earlier 214 x 150 mm upper-cavity reference is superseded for this finite plate band; no new full taper or seven boss gaps have been measured. Reports show the previous-reference mismatch separately and do not verify a full real-case fit.\n` +
    `Assembly: ${components.length} components, including ${components.filter((component) => component.supply === 'manufactured').length} separately printable parts.\n` +
    `The separate STL files are already oriented with their print bed at Z=0.\n` +
    `Print each STL as a separate part. Do not print the purchased hardware in the assembly STEP.\n\n` +
    `The lower tray now uses one regular 20 mm M3 grid and seven separate electronics adapters. Reprint case-lower-body and the new or changed small electronics parts listed in the manifest; reuse the fitted faceplate, external ST3215 frame and unchanged mechanical prints. Later board substitutions require only the applicable small adapter and keeper.\n\n` +
    referenceSliceSummary +
    referenceSupportSummary +
    `Materials, print dimensions and file checksums: print-mesh-validation.json.\n` +
    `Part-specific assembly and manufacturing requirements: case-panel-manufacturing.json.\n` +
    `Editable assembled model: servo-toggle-case-panel.FCStd.\n` +
    `Neutral assembled exchange model: servo-toggle-case-panel.step.\n` +
    `Preview images are rendered directly from the frozen native CAD. The inspection GLB is bound to the same source and CAD checksums; browser display was not observed for this revision.\n` +
    `Dimensioned operator layout: case-panel-operator-layout.svg (print at 100%).\n\n` +
    `Dimensioned underside layout: case-panel-underside-layout.svg (viewed from below; print at 100%).\n` +
    `Measured-case height study: case-side-clearance.svg (projected envelopes; print at 100%).\n` +
    `Seven-hole wall mounting layout: case-wall-mount-layout.svg (interior datums only; physical wall features must be checked).\n` +
    `Electronics adapter mounting grid: case-electronics-grid-layout.svg (20 mm square M3 interface; print at 100%).\n` +
    `The separate case-seat adapter uses the earlier case reference ${caseEnvelope.grooveSize.join(' x ')} mm free recess. Its ${caseEnvelope.ringOuterSize.join(' x ')} mm flange is ${caseEnvelope.ringFlangeThickness} mm thick over a ${caseEnvelope.gasketThickness} mm TPU pad, leaving ${caseEnvelope.grooveHeightClearance} mm height clearance.\n` +
    `The working face is ${caseEnvelope.grooveFloorZ - layout.panelTop} mm below that ledge. The insert bottom is ${caseEnvelope.grooveFloorZ - layout.batteryFloorBottom} mm below it, leaving ${layout.batteryFloorBottom - caseEnvelope.innerFloorZ} mm above the measured case floor.\n` +
    `The closed covers leave ${Number((caseEnvelope.lidCeilingZ - caseEnvelope.closedCoverTopZ).toFixed(3))} mm below the measured lid roof. Open covers require the lid open. R${caseEnvelope.cornerRadius} corners are inferred; lid ribs and local molded features are not modeled. Confirm the actual case before production.\n` +
    `The adapter prints on its complete upper flange face, already flipped in its STL. Its four corner M3 x ${caseEnvelope.screwLength} screws have recessed heads and join the adapter to the panel through locating tongues and underside washers/nuts.\n\n` +
    `Seven integral faceplate bosses accept captured M3 nuts in side-entry slots. Before fitting the lower body, introduce each nut through the rear-open loading well in the bare plate and slide it into its hex seat. Removable assembly tape can retain it until its wall screw is fitted. The user-confirmed axes are 20 mm below the upper edge of the 2 mm groove, or 18 mm below its floor (operator Z+0.5). Offsets from internal corners of the 214 x 150 mm opening: front X30/X184, rear X60/X154, right Y25/Y125 and one central left mount at Y75. The screw axes follow the nominal tapered-wall normals. The drawing uses interior datums; transfer centres from the fitted print and check the complete exterior washer footprint.\n` +
    `Confirmed orientation: toggle row toward the handle, batteries toward the hinges.\n` +
    `The user-measured wall is approximately 4 mm. The nominal exterior stack is a diameter 7 x 0.5 mm steel washer and diameter 10 x 0.8 mm compressed sealing washer. Use M3 screws with an effective under-head length of 11 mm, shortened from the available 15 mm stock, with deburred restored end threads. At nominal dimensions this gives full 2.4 mm nut engagement, 1.1 mm tip beyond the nut and 0.5 mm before the boss end. Verify actual wall and seal thickness; 8 mm screws are too short. Seal each penetration and spread the head load. If a fit gap remains, fill it with a measured insulating shim before tightening; the fit shim is not modeled. Do not bend the case wall to close the gap. The nominal modeled seal stack is not a certified ingress rating.\n` +
    `The faceplate forms the horizontal flange of the T sections. Ribs reinforce the seven boss roots, with a spine and cross-rib supporting the SP20 side outside the rear tool envelopes. Added features stay behind the flat lettered front.\n\n` +
    `The ring and TPU cushion extend only1mm toward the handle. Their outer contour is217.4 x154.4 mm at[107,74.5]; all original M3 axes, tongues and head seats stay fixed. Four full-height4mm T roots now connect each corner post to both adjacent walls. Nine horizontal diameter3.4 mm self-tapper clearances have diameter6.2 mm90-degree countersinks1.4 mm deep in5 mm pads. Hole axes are at Z16; the dimensioned case-seat-ring-mount-layout.svg gives their final plan positions. Access is qualified with both batteries removed, other controls/connectors fitted and ARM1 guard closed, using a compact diameter6 x20 mm shaft and diameter8 x20 mm handle through5 mm axial engagement. Actual screw length/drive/pilot fit remain to be selected. The finite front-edge fit correction does not widen the earlier reference case globally.\n\n` +
    `The lettered FRONT face of the faceplate is the print bed. The fitted faceplate retains its 214 x 150.6 mm outline, all cutouts and fixing axes. The printed external ST3215 frame (case-top-bridge) is retained. The lower cradle keeps its fitted mechanism seat and receives the straight full-depth carrier-support ladder. The updated lower tray carries generic M3 nodes rather than board-specific plinths; seven separate adapters carry HAT, Heltec, ADS1220, both converters and both LC filters. The front-insert cassette has one continuous 2 mm face flange with ARM1/ARM2 legends. The lower assembly has two core mechanical prints plus its separate electronics adapters: case-lower-body is the floor tray with battery pockets and universal mounting nodes; case-lower-cradle retains the fitted 21.2 mm-deep ST3215 seat, shoulder lands, cable opening, ARM1 pocket and control ring, with four feet reaching the tray. The four original bottom M3 x 8 screws clamp those feet and the tray into the existing FF50 brass posts. This joint stays captured when the four lid screws are removed. A uniform 3 mm apron follows both long window edges, with left end returns and open terminal corridors. Regional bearing and root checks establish the intended contact distribution separately from total area. Four FF40 brass posts retain the clip carrier.
` +
    `The cassette prints on its flat locator underside. The tray prints floor down; the separate cradle prints inverted on its upper frame, with its four feet pointing upward and a 51 mm print height. The clip carrier prints floor down; its descending MOSFET wall is a separate case-pwm-backing printed on its broad face. Clear all local supports from fitted ledges, receivers and post routes before assembly. The hood and keeper bridges also print broad face down. All exported STL files already have their print orientations applied, with their beds at Z=0. The new sleeve extensions have outward 2.4 mm cleaning slots between Z=-47.5 and -19.7; the full 2 mm feet and original upper collars stay closed. Straight4.3/3.5mm spines and two4mm cross ribs form a full-depth carrier-support ladder rooted on the inverted print-bed face. Local support remains beneath internal closing ledges. Clear the routes through the side openings before inserting the brass posts.
` +
    `The uniform ${mechanicalStructure.lowerSplit.floorFootprint.size.join(' x ')} mm R${mechanicalStructure.lowerSplit.floorFootprint.cornerRadius} floor retains every brass-support root within its outline. The complete tray remains inside the unchanged nominal lower-case cavity. Its ${electronicsHoneycomb.cells.length} hexagonal openings occupy free grid cells, with ${electronicsHoneycomb.minimumWeb} mm minimum nominal webs and ${electronicsHoneycomb.perimeterWidth} mm continuous perimeter lands. Structural screw islands, battery seat strips and the analogue-pod floor remain solid. Every PCB-specific seat and tie port belongs to a small adapter rather than the common tray. Battery footprints retain their recessed seat datum.
` +
    `The ${mechanicalStructure.modularElectronics.grid.pitchMm} mm square grid has ${mechanicalStructure.modularElectronics.grid.nodeCount} identical diameter ${mechanicalStructure.modularElectronics.grid.boreDiameterMm} mm M3 nodes. Seven small adapters use ${mechanicalStructure.modularElectronics.adapters.reduce((sum, adapter) => sum + adapter.anchors.length, 0)} stock M3 x 8 screws from below, with ordinary AF5.5 x 2.4 mm nuts loaded into their open-top antirotation seats before installing the boards. Hold loose nuts during underside installation. A 2.9 mm node web and 2 mm adapter foot give 4.9 mm grip, full nut engagement and nominal 0.7 mm thread beyond the nut. The heads remain 0.1 mm inside the floor. Reconfiguration takes place on the supported insert on the bench. Check complete board, plug, wiring, heat and analogue zoning clearances before selecting another free grid location. The separate library section Electronics / Electronics mounts / Electronic module adapters contains seven exact fitted variants and editable horizontal/upright templates.
` +
    `Seven independently removable adapters on the tray carry HAT (A), Heltec V4, provisional CJMCU-1220, two vertical BEC12S-PRO converters and two iFlight LC filters. The user-measured 26 x 16 x 6 mm PWM body stands vertically against the separate straight backing below the clip carrier. A locating tongue enters a blind receiver; two shoulders bear against the carrier underside. The two existing PWM ties capture the backing and module with the compact keeper, without adding screws. The nominal key engagement is 2.1 mm; the modeled tie-channel travel leaves at least 1.8 mm engaged. Check actual nylon ties and printed fit during assembly.
` +
    `HAT and Heltec preserve their library geometry. The five smaller board recipes use provisional supplier-family envelope assumptions. Broad low seats support PCB edges and source-cleared lands. Six alternate BEC tie lanes allow other strap positions while preserving solid material between ports. Replacement boards need their own edge, component, thermal and keeper fit checks. Independent low removable retainers take nylon-tie pressure on printed features; assumed ties are 2.5 mm wide and at most 1 mm thick. Verify actual boards, solder lands, ties and temperatures before fabrication.
` +
    `HAT uses its four original M2.5 fixing axes with M2.5 x 8 screws, washers and nuts on the removable adapter. Four stock M3 x 15 lid screws engage the FF50 brass posts by 3.2 mm. Eight bottom M3 x 8 screws anchor all brass supports. The main four each clamp a 2.9 mm tray web plus a 2.0 mm cradle foot: the combined 4.9 mm grip preserves their 3.1 mm brass engagement. The carrier four retain their 2.9 mm tray web and 5.1 mm engagement. Main female ends require at least 3.5 mm usable depth; the user confirmed at least 5.5 mm for the FF40 stock. Bottom heads keep their original 3.1 mm recesses.
` +
    `Assemble the lower unit before fitting electronics: place the four cradle feet on the tray pads, insert the four FF50 posts through their AF5.3 guides and tighten the four existing main M3 x 8 screws from the tray underside. Fit the other four M3 x 8 screws and FF40 carrier posts. All eight bottom screws stay fitted during ordinary service. For bench service, remove the nine ring self-tappers and seven external wall screws and lift the insert from the case, disconnect leads and extract both batteries upward. Remove the rotor/discs, four M3 x 15 lid screws and servo lid. Support the servo, switches and cassette before lowering the joined tray/cradle. The carrier, clips, backing, PWM and keeper lower together with their nylon ties installed. On the bench release the two carrier-retaining ties to lift that populated carrier clear. After releasing the PWM ties, support and remove the module and keeper; withdraw the backing 3 mm downward, then 15 mm away from its carrier.
` +
    `Source-sized HAT XT60 installation and provisional 15 mm compact USB-body reserves are studies without physical cables. USB access is checked on the detached lower body; selected plugs, strain relief, wire bends and insertion overlap remain unverified.
` +
    `The ADC and LC2 quiet zone has a removable insulating hood. Apply foil tape only to its exterior, with at least 10 mm seam overlap and at most 0.15 mm per wall or seam layer. Keep foil off cable entries, open rim, PCB and SP20 pins. Make one intentional washer/lug bond using the actual circuit reference; verify seam continuity. No EMI attenuation is guaranteed.
` +
    `Remove hood/keepers before SP20 nut work and soldering. Keep switching-power leads and paired returns separate from analogue leads; routes and electrical settings are installation intent, without modeled wires or GPIO assignments. Full assembly order is in GUIDE.md and ASSEMBLY-UA.txt.

` +
    `The 0.7 mm case-servo-shim is a separate TPU print. Confirm the printed thickness.\n` +
    `Two closed battery guide pockets continue the common lower floor. Continuous 1.6 mm outer walls, a shared middle divider and solid 2.4 mm seats guide the packs and protect the internal electronics from debris, with additional push stops at the panel connectors. The seat bottom is ${layout.panelTop - layout.batteryFloorBottom} mm below the panel top, including the 2.4 mm seat floor.\n` +
    `Each 88 x 24 x 74 mm pack inserts from above and projects ${(layout.batteryTop - layout.panelTop).toFixed(1)} mm above the faceplate. Use nonconductive pull ribbons for extraction. The front row is marked B2 and the rear B1. Their existing positions and dedicated XT60 sockets are retained.\n` +
    `The two joined 55 mm downward-contact clips are in the lower right, contacts right (+X) and springs left (-X), mounted at Z=-7 mm below the closed toggle covers. Their housings and nests shift 2 mm left within the existing carrier to clear the right-front wall mount.\n` +
    `Their reinforced carrier has a 5 mm floor and bears on short left body lands plus four AF5 brass 40 mm standoffs in 2.5 mm underside sockets. Two left body keys and all four hex sockets locate it; two nylon loops retain withdrawal. The long redundant front/rear shelves are removed to reduce printing supports. Each stock clip uses two rear-hole locating pins and one nylon loop through its original front slot. No clip/carrier mounting screws remain. No load rating is assigned.\n` +
    `The 0-30 degree clip press check is an installation study; actual supplier travel and spring compression require fit checks.\n` +
    `Three indicator library instances share X136 with red/yellow/green at Y130.75/107.75/84.75, and rear reliefs leaving a 2 mm front web. Yellow is centred between both battery rows and both SP20 sockets. The red/yellow/green indicators are marked I/R/P on their right. The upper/lower SP20 sockets are marked TS/PS on their right; ICT sits above the spring clips.\n` +
    `Two SP20-4 panel-socket library instances form the right vertical pair. Their diameter 35 mm rear reliefs leave a valid 4 mm web, with diameter 20.5 mm openings and positive-Y flats giving a 19.5 mm opening height.\n` +
    `The supplied library nuts and seals are retained. Indicator dimensions and undimensioned SP20 details remain provisional; fit the real hardware before production.\n` +
    `ARM1, the servo and ARM2 are shifted together 12 mm left, preserving their relative geometry. The separate power toggle, its bay and gasket, and the pushbutton opening/reserve are omitted.\n` +
    `XT60E-M connectors fit from below into 12.7 x 27.7 mm underside pockets, 3 mm deep. Their corrected 3 mm nose reaches the front face. Four M2.5 x 6 button screws with diameter 4.7 x 1.5 mm T8 heads enter downward from the front. Diameter 5.1 x 1.5 mm head recesses make that selected head flush, leaving 1.5 mm panel bearing web. Nominal adopted insert overlap is 2 mm, with 0.5 mm rear screw projection; usable thread engagement must be checked on the delivered connector. Insert outer dimensions are reconstructed, not manufacturer dimensions. Fit the purchased connectors, indicator rear bodies, ARM1 protective cover, wire exits and case seal before production.\n` +
    `No enclosure ingress protection, clamp load, electrical function or servo force rating is assigned.\n`,
);
console.log(JSON.stringify({ input, output, codeSha256, components: components.length }));
