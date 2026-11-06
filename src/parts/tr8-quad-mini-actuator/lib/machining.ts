import type { FabricationFile } from '../../../core/types';
import { driveLayout as d, mechanismLayout } from './layout';
import { narrowOutputLayout } from './nut-linkage';

export function screwMachiningSchedule() {
  return {
    partId: 'tr8-quad-mini-actuator', units: 'mm', quantity: 4,
    blank: { designation: 'Tr8x8(P2) RH', length: 250, starts: 4, pitch: 2, lead: 8, includedAngle: 30 },
    datum: `Local X=0 is the thread midpoint; screw axis Y=0, Z=${mechanismLayout.screwZ}.`,
    finishedLength: d.screwEnds[1] - d.screwEnds[0], finishedEnds: d.screwEnds,
    stations: [
      { from: d.screwEnds[0], to: d.stubEnd, diameter: 4, operation: 'Turn coupling stub' },
      { from: d.stubEnd, to: d.threadEnds[0], diameter: 5, operation: 'Turn clean bearing journal' },
      { from: d.threadEnds[0], to: d.threadEnds[1], diameter: 8, operation: 'Retain Tr8x8(P2) RH four-start thread' },
      { from: d.threadEnds[1], to: d.screwEnds[1], diameter: 5, operation: 'Turn clean bearing journal' },
    ],
    grooves: d.clipCentres.map((center) => ({ center, width: 0.7, rootDiameter: 4.8, ring: 'DIN 471 Ø5, 0.6 mm thick' })),
    requirements: [
      'Cut with facing allowance; indicate the stock thread axis and turn journals coaxially.',
      'Verify the purchased thread root permits a fully cleaned Ø5 journal.',
      'Grooves: Ø4.8 bottom, 0.7 H13 width; minimum nominal outer end land 0.85 mm.',
      'Preserve the complete 28 mm working thread; nominal full-nut end margin is 1.2224 mm at ±20°.',
      'Assign bearing fits, runout, groove tolerances and finish; deburr and verify full travel by hand.',
    ],
  };
}
export function outputShaftMachiningSchedule() {
  return {
    partId: 'tr8-quad-mini-actuator', units: 'mm', quantity: 4,
    blank: 'Ø8 steel round bar', axis: 'Local Y', finishedEnds: d.outputShaftEnds,
    finishedLength: d.outputShaftEnds[1] - d.outputShaftEnds[0],
    stations: [
      { from: d.outputHeadSpan[0], to: d.outputHeadSpan[1], diameter: d.outputHeadDiameter, operation: 'Turn integral closed head' },
      { from: d.outputHeadSpan[1], to: d.outputShaftEnds[1], diameter: 6, operation: 'Turn shaft and bearing journals' },
    ],
    grooves: mechanismLayout.outputClipCentres.map((center) => ({ center, width: 0.8, rootDiameter: 5.7, ring: 'DIN 471 Ø6 outer retainer' })),
    crossBores: narrowOutputLayout.pinCenters.map((centerY) => ({ centerY, diameter: 2, axis: 'Local X', operation: 'Match-drill and ream with the located fork; select shaft/hub fits to retain the actual press pin.' })),
    pins: { designation: 'ISO 8734 Ø2×10 m6', quantityPerShaft: 2, source: 'https://static.shop.fibro.com/assets/EN/document/doc_2351_1_english.pdf', inspectionEndChamfer: 0.1 },
    outputFlat: { from: 21.3, to: 27.5, planeFromAxis: 2.5, operation: 'Mill a 0.5 mm deep D-flat' },
    thrustSpacers: { bore: 6.05, outer: mechanismLayout.outputSpacerDiameter, innerLength: mechanismLayout.outputInnerSpacer, outerLength: mechanismLayout.outputOuterSpacer },
    bearing: { designation: 'EZO SMF106ZZ', ...mechanismLayout.outputBearing, innerRingAbutment: [6.8, 6.9], source: 'https://www.ezo-brg.co.jp/english/product/spec.php?eid=00582' },
    requirements: ['The Ø7.5×1 head is integral; no separate cap or M6 thread is used.', 'Two outer retaining grooves and pinned hubs locate the bearing inner races through Ø6.85 thrust spacers.', 'Retain 0.25 mm nominal clearance from the head face to the outer retaining ring.', 'Set the axial sleeve/slide clearances before match-drilling both fork/shaft joints at the same angular index.', 'Pin end chamfers in the inspection model are representative; use the supplier end form and actual pin fits.', 'Assign production bearing fits, groove tolerances and surface finish.'],
  };
}
function screwTurningSvg() {
  const s = screwMachiningSchedule(), x = (v: number) => 50 + (v - s.finishedEnds[0]) * 12;
  const upper = s.stations.flatMap((v) => [[x(v.from), 130 - v.diameter * 6], [x(v.to), 130 - v.diameter * 6]]);
  const lower = s.stations.flatMap((v) => [[x(v.from), 130 + v.diameter * 6], [x(v.to), 130 + v.diameter * 6]]).reverse();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="120mm" viewBox="0 0 800 460"><rect width="800" height="460" fill="white"/><g font-family="sans-serif" fill="#111" font-size="16"><text x="30" y="30">TR8x8(P2) RH / 4 starts / 8 mm lead / quantity 4</text><text x="30" y="55">250 mm stock cut and turned to ${s.finishedLength} mm</text></g><polygon points="${[...upper, ...lower].map((p) => p.join(',')).join(' ')}" fill="#e0e5e9" stroke="#111"/><g stroke="#111" fill="none">${s.grooves.map((g) => `<path d="M${x(g.center - .35)} 100V101.2H${x(g.center + .35)}V100 M${x(g.center - .35)} 160V158.8H${x(g.center + .35)}V160"/>`).join('')}<path d="M30 130H740" stroke-dasharray="12 4 2 4"/><path d="M${x(s.finishedEnds[0])} 180V210H${x(s.finishedEnds[1])}V180"/></g><g font-family="sans-serif" fill="#111" font-size="15"><text x="325" y="204">${s.finishedLength} overall</text><text x="310" y="76">28 thread</text><text x="55" y="96">Ø4</text><text x="154" y="96">Ø5</text><text x="568" y="96">Ø5</text><text x="30" y="248">Axial stations from the retained thread midpoint:</text>${s.stations.map((v, i) => `<text x="30" y="${274 + 23 * i}">${v.from} ... ${v.to}: ${v.operation}</text>`).join('')}<text x="30" y="378">Groove centres: ${d.clipCentres.join(', ')} mm</text><text x="30" y="402">Grooves 0.7 H13 wide, Ø4.8 root; DIN 471 Ø5 rings 0.6 thick.</text><text x="30" y="430">Assign production fits and tolerances. Diagram is not to scale.</text></g></svg>\n`;
}
export function machiningFiles(): FabricationFile[] {
  return [
    { id: 'screw-machining-json', label: 'Four screw turning schedules', description: '52 mm finished length, 28 mm thread and four ring grooves per screw.', name: 'TR8-quad-mini-screw-turning.json', type: 'application/json', content: JSON.stringify(screwMachiningSchedule(), null, 2) + '\n' },
    { id: 'screw-machining-svg', label: 'Screw turning drawing', description: 'Turning diagram in millimetres; production fits require assignment.', name: 'TR8-quad-mini-screw-turning.svg', type: 'image/svg+xml', content: screwTurningSvg() },
    { id: 'output-shaft-machining-json', label: 'Headed output shaft turning schedule', description: 'Integral Ø7.5 head, Ø6 journals, compact retaining-ring grooves and output D-flat.', name: 'TR8-quad-mini-output-shaft-turning.json', type: 'application/json', content: JSON.stringify(outputShaftMachiningSchedule(), null, 2) + '\n' },
  ];
}
