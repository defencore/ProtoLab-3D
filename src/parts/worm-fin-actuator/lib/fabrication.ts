import type { FabricationFile, Parameters } from '../../../core/types';
import { gearProfiles } from './gear';
import { housingLayout } from './housing';
import { layout, tr8, type Groove, type Station } from './layout';
import { pieces } from './model';

type Point = [number, number];
const scalar = (value: number) => String(Number(value.toFixed(6)));
const xml = (value: unknown) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const csv = (rows: unknown[][]) =>
  rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n') + '\n';

/** Millimetres, closed 1:1 cut loops; the tool-finished tooth surface is a separate operation. */
export function blankDxf(p: Parameters): string {
  const profile = gearProfiles(p);
  const data: (number | string)[] = [
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
    9,
    '$MEASUREMENT',
    70,
    1,
    0,
    'ENDSEC',
    0,
    'SECTION',
    2,
    'ENTITIES',
  ];
  for (const [index, points] of [profile.blank, profile.square].entries()) {
    data.push(
      0,
      'LWPOLYLINE',
      100,
      'AcDbEntity',
      8,
      index === 0 ? 'SECTOR_BLANK_OUTER' : 'SQUARE_DRIVE',
      100,
      'AcDbPolyline',
      90,
      points.length,
      70,
      1,
      ...points.flatMap(([x, y]) => [10, x, 20, y]),
    );
  }
  data.push(0, 'ENDSEC', 0, 'EOF');
  return data.map((value) => (typeof value === 'number' ? scalar(value) : value)).join('\n') + '\n';
}

export function blankSvg(p: Parameters): string {
  const profile = gearProfiles(p),
    all = [...profile.blank, ...profile.square];
  const minX = Math.min(...all.map(([x]) => x)) - 2,
    minY = Math.min(...all.map(([, y]) => y)) - 2;
  const width = Math.max(...all.map(([x]) => x)) - minX + 2,
    height = Math.max(...all.map(([, y]) => y)) - minY + 2;
  const loop = (points: Point[]) =>
    `M ${points.map(([x, y]) => `${scalar(x - minX)} ${scalar(height - (y - minY))}`).join(' L ')} Z`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${scalar(width)}mm" height="${scalar(height)}mm" viewBox="0 0 ${scalar(width)} ${scalar(height)}"><title>TR8 fin sector laser blank · ${scalar(Number(p.plateThickness))} mm sheet · 1:1 millimetres · finish teeth after cutting</title><g fill="none" stroke="#000" stroke-width="0.1"><path id="SECTOR_BLANK_OUTER" d="${loop(profile.blank)}"/><path id="SQUARE_DRIVE" d="${loop(profile.square)}"/></g></svg>\n`;
}

function turningOutline(stations: Station[], grooves: Groove[]): Point[] {
  const start = Math.min(...stations.map((s) => s.from)),
    end = Math.max(...stations.map((s) => s.to));
  const events = [
    ...new Set([
      ...stations.flatMap((s) => [s.from, s.to]),
      ...grooves.flatMap((g) => [g.center - g.width / 2, g.center + g.width / 2]),
    ]),
  ]
    .filter((x) => x >= start && x <= end)
    .sort((a, b) => a - b);
  const upper: Point[] = [];
  for (let i = 0; i < events.length - 1; i++) {
    const from = events[i],
      to = events[i + 1],
      middle = (from + to) / 2;
    const station = stations.find((s) => middle >= s.from && middle <= s.to);
    if (!station) continue;
    const groove = grooves.find((g) => Math.abs(middle - g.center) <= g.width / 2);
    const radius = (groove?.diameter ?? station.diameter) / 2;
    upper.push([from, radius], [to, radius]);
  }
  return [...upper, ...[...upper].reverse().map(([x, y]): Point => [x, -y])];
}

/** A coordinate schedule accompanies the silhouette; dimensions are explicit, not inferred from display scale. */
export function machiningSvg(
  title: string,
  axis: 'X' | 'Z',
  stations: Station[],
  grooves: Groove[],
  notes: string[],
): string {
  const outline = turningOutline(stations, grooves);
  const minX = Math.min(...outline.map(([x]) => x)),
    maxX = Math.max(...outline.map(([x]) => x));
  const radius = Math.max(...outline.map(([, y]) => Math.abs(y)));
  const scale = Math.min(5, 170 / (maxX - minX), 21 / radius);
  const centerY = 49,
    offsetX = (210 - (maxX - minX) * scale) / 2;
  const point = ([x, y]: Point) =>
    `${scalar(offsetX + (x - minX) * scale)},${scalar(centerY - y * scale)}`;
  const rows = [
    ...stations.map(
      (s) =>
        `${axis}${scalar(s.from)} … ${axis}${scalar(s.to)}  |  ${/square/i.test(s.label) ? 'AF' : 'Ø'}${scalar(s.diameter)} mm  |  ${s.label}`,
    ),
    ...grooves.map(
      (g) =>
        `${axis}${scalar(g.center)} centre  |  Ø${scalar(g.diameter)} × ${scalar(g.width)} mm groove  |  DIN 471-${g.ring}`,
    ),
  ];
  const tableY = 85,
    height = tableY + (rows.length + notes.length + 2) * 6.5 + 10;
  const boundaries = [...new Set(stations.flatMap((s) => [s.from, s.to]))].sort((a, b) => a - b);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="${scalar(height)}mm" viewBox="0 0 210 ${scalar(height)}"><title>${xml(title)}</title><rect width="210" height="${scalar(height)}" fill="#fff"/><g font-family="Arial, sans-serif" fill="#111"><text x="10" y="12" font-size="5">${xml(title)}</text><text x="10" y="20" font-size="3.2">Axial machining reference · dimensions in mm · drawing scale ${scalar(scale)}:1</text><line x1="10" y1="${centerY}" x2="200" y2="${centerY}" stroke="#9aa1a6" stroke-width="0.2" stroke-dasharray="2 1"/><polygon points="${outline.map(point).join(' ')}" fill="#e5edf2" stroke="#182a35" stroke-width="0.35"/>${boundaries.map((x, i) => `<line x1="${scalar(offsetX + (x - minX) * scale)}" y1="${scalar(centerY + radius * scale + 1)}" x2="${scalar(offsetX + (x - minX) * scale)}" y2="${i % 2 ? '78' : '73'}" stroke="#777" stroke-width="0.15"/><text x="${scalar(offsetX + (x - minX) * scale)}" y="${i % 2 ? '81' : '76'}" text-anchor="middle" font-size="2.6">${axis}${scalar(x)}</text>`).join('')}${rows.map((row, i) => `<text x="10" y="${scalar(tableY + i * 6.5)}" font-size="3.1">${xml(row)}</text>`).join('')}${notes.map((note, i) => `<text x="10" y="${scalar(tableY + (rows.length + i + 1) * 6.5)}" font-size="3">${xml(note)}</text>`).join('')}</g></svg>\n`;
}

/** Face-access reference; dimensions come from the same layout as the housing solids. */
export function housingSvg(p: Parameters): string {
  const v = layout(p),
    h = housingLayout(p),
    scale = Math.min(1.7, 76 / h.width, 81 / h.height);
  const seat = v.seatClearance,
    frontShoulder = v.frontTop - v.front.flangeWidth,
    rearShoulder = v.innerBottom + v.inner.flangeWidth,
    wormShoulder = v.wormBearingEnd - v.wormBearing.flangeWidth;
  const top = 44,
    viewBottom = top + h.height * scale,
    dimensionY = viewBottom + 7;
  const views = (['base', 'lid'] as const).map((half, i) => {
    const cx = i ? 155 : 55;
    const x = (n: number) => cx + n * scale,
      y = (n: number) => top + (h.yMax - n) * scale;
    const circle = (px: number, py: number, diameter: number, style: string) =>
      `<circle cx="${scalar(x(px))}" cy="${scalar(y(py))}" r="${scalar((diameter * scale) / 2)}" ${style}/>`;
    const rect = (x0: number, x1: number, y0: number, y1: number) =>
      `<rect x="${scalar(x(x0))}" y="${scalar(y(y1))}" width="${scalar((x1 - x0) * scale)}" height="${scalar((y1 - y0) * scale)}" fill="#dbe5eb" stroke="#516675" stroke-width="0.25"/>`;
    const trough = rect(
      -h.wormPocketEnd,
      h.wormPocketEnd,
      v.centerDistance - h.wormPocketRadius,
      v.centerDistance + h.wormPocketRadius,
    );
    const wormSeats = [-1, 1].map((sign) => {
      const segment = (start: number, end: number, diameter: number) =>
        rect(
          sign < 0 ? -end : start,
          sign < 0 ? -start : end,
          v.centerDistance - diameter / 2,
          v.centerDistance + diameter / 2,
        );
      return (
        segment(v.wormBearingStart, wormShoulder, v.wormBearing.outer + seat) +
        segment(wormShoulder, h.xHalf, v.wormBearing.flangeOuter + seat)
      );
    });
    const output = half === 'base' ? v.inner : v.front;
    const holes = h.boltPositions.map(([px, py]) =>
      circle(px, py, h.screwClearance, 'fill="#fff" stroke="#172f40" stroke-width="0.3"'),
    );
    const reverseFeatures = h.boltPositions.map(([px, py]) =>
      half === 'base'
        ? circle(
            px,
            py,
            h.nutPocketAF,
            'fill="none" stroke="#8c6472" stroke-width="0.2" stroke-dasharray="1 0.8"',
          )
        : circle(
            px,
            py,
            6.2,
            'fill="none" stroke="#8c6472" stroke-width="0.2" stroke-dasharray="1 0.8"',
          ),
    );
    const locators = h.locatorPositions.map(([px, py]) =>
      circle(
        px,
        py,
        h.locatorDiameter + (half === 'lid' ? h.locatorClearance : 0),
        `fill="${half === 'base' ? '#b5cbb7' : '#fff'}" stroke="#46634c" stroke-width="0.3"`,
      ),
    );
    const x0 = x(-h.xHalf),
      x1 = x(h.xHalf);
    return `<g><text x="${cx}" y="35" text-anchor="middle" font-size="4">${half === 'base' ? 'BASE · open face +Z' : 'LID · open face −Z'}</text><rect x="${scalar(x0)}" y="${top}" width="${scalar(h.width * scale)}" height="${scalar(h.height * scale)}" rx="${scalar(h.cornerRadius * scale)}" fill="#f4f6f7" stroke="#172f40" stroke-width="0.4"/>${circle(0, 0, 2 * h.gearPocketRadius, 'fill="#dbe5eb" stroke="#516675" stroke-width="0.25"')}${trough}${wormSeats.join('')}${circle(0, 0, output.outer + seat, 'fill="#fff" stroke="#172f40" stroke-width="0.3"')}${circle(0, 0, output.flangeOuter + seat, 'fill="none" stroke="#8c6472" stroke-width="0.25" stroke-dasharray="1 0.8"')}${holes.join('')}${reverseFeatures.join('')}${locators.join('')}<line x1="${scalar(x0)}" y1="${scalar(y(0))}" x2="${scalar(x1)}" y2="${scalar(y(0))}" stroke="#697b87" stroke-width="0.15" stroke-dasharray="2 1"/><line x1="${cx}" y1="${top}" x2="${cx}" y2="${scalar(viewBottom)}" stroke="#697b87" stroke-width="0.15" stroke-dasharray="2 1"/><line x1="${scalar(x0)}" y1="${scalar(dimensionY)}" x2="${scalar(x1)}" y2="${scalar(dimensionY)}" stroke="#333" stroke-width="0.2"/><path d="M ${scalar(x0)} ${scalar(dimensionY - 2)} v 4 M ${scalar(x1)} ${scalar(dimensionY - 2)} v 4" fill="none" stroke="#333" stroke-width="0.2"/><text x="${cx}" y="${scalar(dimensionY + 5)}" text-anchor="middle" font-size="3.2">${scalar(h.width)} mm</text><text x="${cx}" y="${scalar(y(v.centerDistance) + 1)}" text-anchor="middle" font-size="2.6">Worm axis Y${scalar(v.centerDistance)}</text></g>`;
  });
  const schedule = [
    `Coordinates: output axis X0/Y0; worm axis Y${scalar(v.centerDistance)}/Z0; split Z0.`,
    `Outside: ${scalar(h.width)} X × ${scalar(h.height)} Y × ${scalar(h.depth)} Z mm; corner R${scalar(h.cornerRadius)}.`,
    `Base Z${scalar(h.baseBottom)}…0 (${scalar(-h.baseBottom)} thick); lid Z0…${scalar(h.lidTop)} (${scalar(h.lidTop)} thick).`,
    `Gear pocket Ø${scalar(2 * h.gearPocketRadius)}, Z${scalar(h.pocketBottom)}…${scalar(h.pocketTop)}; opens at split.`,
    `Central worm trough Ø${scalar(2 * h.wormPocketRadius)}, X±${scalar(h.wormPocketEnd)}; semicircle in each half.`,
    `Front body bore Ø${scalar(v.front.outer + seat)}, Z${scalar(v.frontBottom)}…${scalar(frontShoulder)}.`,
    `Front flange recess Ø${scalar(v.front.flangeOuter + seat)}, Z${scalar(frontShoulder)}…${scalar(h.lidTop)}; exterior access.`,
    `Rear body bore Ø${scalar(v.inner.outer + seat)}, Z${scalar(rearShoulder)}…${scalar(v.innerTop)}.`,
    `Rear flange recess Ø${scalar(v.inner.flangeOuter + seat)}, Z${scalar(h.baseBottom)}…${scalar(rearShoulder)}; exterior access.`,
    `Worm body seats Ø${scalar(v.wormBearing.outer + seat)}, |X| ${scalar(v.wormBearingStart)}…${scalar(wormShoulder)}.`,
    `Worm flange recesses Ø${scalar(v.wormBearing.flangeOuter + seat)}, |X| ${scalar(wormShoulder)}…${scalar(h.xHalf)}; open ends.`,
    `4 joining holes Ø${scalar(h.screwClearance)}, X±${scalar(Math.abs(h.boltPositions[0][0]))}/Y±${scalar(Math.abs(h.boltPositions[0][1]))}.`,
    'Lid exterior: 4 countersunk head recesses, maximum Ø6.2 × 1.8 deep; match selected screw.',
    `Base exterior: 4 rounded nut pockets AF${scalar(h.nutPocketAF)}, corner R${scalar(h.nutCornerRadius)}, ${scalar(h.nutHeight + 0.2)} deep.`,
    `2 base locating bosses Ø${scalar(h.locatorDiameter)} × ${scalar(h.locatorHeight)} high at X±${scalar(Math.abs(h.locatorPositions[0][0]))}/Y0.`,
    `Lid locating sockets Ø${scalar(h.locatorDiameter + h.locatorClearance)} × ${scalar(h.locatorDepth)} deep from split.`,
    `Join with 4 DIN 7991 M3×${h.screwLength} screws and 4 DIN 934 M3 nuts (${scalar(h.nutHeight)} high).`,
  ];
  const tableY = dimensionY + 17,
    notesY = tableY + schedule.length * 5.4 + 6;
  const notes = [
    'Blue: split-face pockets. Dashed: opposite-face recesses; nut pockets shown schematically.',
    'Machine mating-face pockets and exterior bores/recesses in face setups; no hidden undercuts.',
    'Use ball-end/form milling for the half-round worm trough and bearing-seat profile.',
    'Verify joined-half alignment, bearing fits and flange shoulder depths before assembly.',
    'Print with flat exterior faces down; calibrate fits and finish critical bores/split faces.',
    'Geometry reference in mm; not a toleranced production drawing or a CAM/toolpath file.',
  ];
  const height = notesY + notes.length * 5.2 + 8;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="${scalar(height)}mm" viewBox="0 0 210 ${scalar(height)}"><title>Split housing machining and printing reference</title><rect width="210" height="${scalar(height)}" fill="#fff"/><g font-family="Arial, sans-serif" fill="#17212a"><text x="10" y="13" font-size="5">TR8 actuator · split housing</text><text x="10" y="23" font-size="3.1">Mating-face views · dimensions in millimetres · view scale ${scalar(scale)}:1 · Z0 parting plane</text>${views.join('')}${schedule.map((row, i) => `<text x="10" y="${scalar(tableY + i * 5.4)}" font-size="3">${xml(row)}</text>`).join('')}${notes.map((row, i) => `<text x="10" y="${scalar(notesY + i * 5.2)}" font-size="2.8">${xml(row)}</text>`).join('')}</g></svg>\n`;
}

export function fabricationFiles(p: Parameters): FabricationFile[] {
  const v = layout(p),
    h = housingLayout(p),
    physical = pieces({ ...p, outputAngle: 0 }, 'assembled');
  const file = (
    id: string,
    label: string,
    description: string,
    extension: string,
    type: string,
    content: string,
  ): FabricationFile => ({
    id,
    label,
    description,
    name: `TR8-fin-mount-${id}.${extension}`,
    type,
    content,
  });
  const componentRows = [
    [
      'ID',
      'Component',
      'Quantity',
      'Library',
      'State',
      'Supply',
      'Designation',
      'Material',
      'Source',
    ],
    ...physical.map(({ component: c }) => [
      c.id,
      c.name,
      c.quantity,
      c.libraryId,
      c.state,
      c.supply,
      c.procurement?.designation ?? '',
      c.manufacturing?.material ?? '',
      c.procurement?.source ?? '',
    ]),
  ];
  const motionRows = [
    [
      'OutputAngle_deg',
      'ScrewAngle_deg',
      'ScrewTurnsFromNeutral',
      'Ratio',
      'WheelTeeth',
      'ScrewStarts',
    ],
    ...[-0.5, -0.25, 0, 0.25, 0.5].map((fraction) => {
      const position = layout({ ...p, outputAngle: fraction * v.travel });
      return [
        position.angle,
        position.wormAngle,
        position.wormAngle / 360,
        position.ratio,
        position.teeth,
        tr8.starts,
      ];
    }),
  ];
  const calculationRows = [
    ['Parameter', 'Value', 'Unit'],
    ['OutputTravel', v.travel, 'deg'],
    ['EquivalentWheelTeeth', v.teeth, ''],
    ['Ratio', v.ratio, ''],
    ['ActualFullTravelInputTurns', v.actualTurns, 'turns'],
    ['AxialModule', v.module, 'mm'],
    ['ScrewMajorDiameter', tr8.diameter, 'mm'],
    ['ScrewNominalPitchDiameter', tr8.pitchDiameter, 'mm'],
    ['ScrewRootDiameterInput', v.rootDiameter, 'mm'],
    ['ScrewPitch', tr8.pitch, 'mm'],
    ['ScrewLead', tr8.lead, 'mm'],
    ['ScrewStarts', tr8.starts, ''],
    ['ThreadIncludedAngle', tr8.includedAngle, 'deg'],
    ['WheelPitchDiameter', 2 * v.pitchRadius, 'mm'],
    ['CentreDistance', v.centerDistance, 'mm'],
    ['SectorAngle', 2 * v.halfSector, 'deg'],
    ['SheetThickness', v.plateThickness, 'mm'],
    ['SquareDriveAF', v.squareAF, 'mm'],
    ['SquareCornerChamfer', 0.25, 'mm at 45 deg'],
    ['M3TapDrill', 2.5, 'mm'],
    ['NominalFrontThrustShim', v.thrustShims.front, 'mm'],
    ['NominalGearThrustShim', v.thrustShims.gear, 'mm'],
    ['NominalRearThrustShim', v.thrustShims.rear, 'mm'],
    ['NominalEachWormThrustShim', v.thrustShims.worm, 'mm'],
    ['WormThrustShimQuantity', 4, ''],
    ['ThreadedScrewLength', v.wormLength, 'mm'],
    ['OuterBearing', v.front.id, ''],
    ['InnerBearing', v.inner.id, ''],
    ['WormBearings', v.wormBearing.id, ''],
    ['SleeveM3HoleSpacing', v.mountHoleSpacing, 'mm'],
    ['SleeveAxialLength', v.bodyDepth, 'mm'],
    ['HousingWidthX', h.width, 'mm'],
    ['HousingHeightY', h.height, 'mm'],
    ['HousingDepthZ', h.depth, 'mm'],
    ['HousingBaseBottomZ', h.baseBottom, 'mm'],
    ['HousingLidTopZ', h.lidTop, 'mm'],
    ['HousingSplitZ', h.splitZ, 'mm'],
    ['HousingWall', v.wall, 'mm'],
    ['HousingGearPocketDiameter', 2 * h.gearPocketRadius, 'mm'],
    ['HousingWormTroughDiameter', 2 * h.wormPocketRadius, 'mm'],
    ['BearingSeatDiametralClearance', v.seatClearance, 'mm'],
    ['HousingJoiningScrewQuantity', 4, ''],
    ['HousingJoiningScrewLength', h.screwLength, 'mm'],
    ['HousingNutPocketAF', h.nutPocketAF, 'mm'],
    ['HousingLocatorDiameter', h.locatorDiameter, 'mm'],
    ['HousingLocatorDiametralClearance', h.locatorClearance, 'mm'],
  ];
  return [
    file(
      'housing-machining',
      'Split housing machining and printing reference',
      'Both open mating faces, bearing and pocket dimensions, locating bosses and accessible joining hardware.',
      'svg',
      'image/svg+xml',
      housingSvg(p),
    ),
    file(
      'sector-blank',
      'Sector laser blank · DXF',
      'Closed 1:1 millimetre blank and square opening. Finish the 3D tooth flanks after laser cutting.',
      'dxf',
      'application/dxf',
      blankDxf(p),
    ),
    file(
      'sector-blank-preview',
      'Sector laser blank · SVG',
      'True-size preview of the same DXF cut loops.',
      'svg',
      'image/svg+xml',
      blankSvg(p),
    ),
    file(
      'sleeve-machining',
      'Stepped sleeve machining reference',
      'Axial station and retaining-groove dimensions, plus the milled square seat.',
      'svg',
      'image/svg+xml',
      machiningSvg(
        'Stepped output sleeve',
        'Z',
        v.sleeveStations,
        [v.gearClip, v.rearClip],
        [
          'Turn journals to the selected bearing fits; specify shoulder radii and groove tolerances.',
          'Mill the square gear seat to 10 mm AF. The illustrated square-section width is across flats.',
          'Chamfer all four longitudinal square-drive corners 0.25 mm x 45 degrees; check laser kerf.',
          `Sleeve attachment: two blind M3 x 0.5 holes at ${scalar(v.mountHoleSpacing)} mm centres; drill 2.5 mm before tapping.`,
          `Nominal front / gear / rear thrust shims: ${scalar(v.thrustShims.front)} / ${scalar(v.thrustShims.gear)} / ${scalar(v.thrustShims.rear)} mm; select from the measured stack.`,
        ],
      ),
    ),
    file(
      'screw-machining',
      'TR8 screw end-machining reference',
      'Keep the four-start thread; turn the Ø5 bearing journals and Ø4 drive stub.',
      'svg',
      'image/svg+xml',
      machiningSvg('TR8x8(P2) screw end machining', 'X', v.screwStations, v.wormGrooves, [
        'Retain the nominal Ø8 / 8 mm lead / 2 mm pitch / four-start trapezoidal thread.',
        `Root diameter input: Ø${scalar(v.rootDiameter)} mm. Measure the actual blank before turning.`,
        'Finish clean bearing seats, thread runouts and clip grooves from the same axial datum.',
        `Nominal thrust washers: ${scalar(v.thrustShims.worm)} mm at four positions; select from the measured bearing stack.`,
      ]),
    ),
    file(
      'components',
      'Component list',
      'Every neutral-pose physical occurrence, with its fabrication or procurement identity.',
      'csv',
      'text/csv;charset=utf-8',
      csv(componentRows),
    ),
    file(
      'motion',
      'Motion table',
      'Five positions from the negative limit to the positive limit and their coupled screw rotations.',
      'csv',
      'text/csv;charset=utf-8',
      csv(motionRows),
    ),
    file(
      'calculations',
      'Resolved mechanism dimensions',
      'Fixed TR8 screw facts and the selected bearing, sector and motion dimensions.',
      'csv',
      'text/csv;charset=utf-8',
      csv(calculationRows),
    ),
    file(
      'fabrication-notes',
      'Fabrication route',
      'Operations required after blank cutting and before assembly.',
      'txt',
      'text/plain;charset=utf-8',
      [
        'TR8 actuator fabrication route',
        '',
        `Housing envelope: ${scalar(h.width)} x ${scalar(h.height)} x ${scalar(h.depth)} mm. Base and lid split at Z0.`,
        '1. Machine each housing half from the open mating face and exterior face. Circular gear pockets, half-round screw trough and outward-facing bearing counterbores remain accessible.',
        '2. Use ball-end or form milling for the half-round screw trough and bearing seats. Match the rounded nut-pocket corners to the cutter. Specify fits, face finish and assembled bearing coaxiality.',
        '3. Alternatively print each half on its flat exterior face with its open cavity upward. Inspect supports and bridging in the slicer; calibrate seat and locator allowances with the chosen material and printer.',
        '4. Finish critical printed bores and mating faces as needed. Verify joined-half alignment, all flange shoulder depths, captured nut pockets and fastener clearance.',
        `5. Laser-cut the supplied sector blank from ${scalar(v.plateThickness)} mm metal sheet; apply the selected cutting kerf.`,
        '6. Finish the tooth flanks to the configured 3D swept-screw reference. A flat laser cut is not the final tooth surface.',
        '7. Finish the square opening to its specified fit and corner relief; deburr the plate and verify flatness.',
        '8. Turn the sleeve journals and retaining grooves. Mill the 10 mm AF square drive and chamfer its four longitudinal corners 0.25 mm x 45 degrees.',
        '9. Measure the purchased TR8x8(P2) screw and machine both bearing journals, runouts, grooves and the drive stub.',
        `10. Drill 2.5 mm and tap the two blind sleeve attachment holes M3 x 0.5 at ${scalar(v.mountHoleSpacing)} mm centres. The removable platform, pins and their screws are excluded.`,
        '11. The 0.04 mm radial thread allowance belongs to CAD assembly inspection; it is not a tap-drill allowance.',
        `12. Select bearings, clips, thrust shims, four DIN 7991 M3x${h.screwLength} joining screws and four DIN 934 M3 nuts. Case screws join the housing; they do not clamp individual bearings.`,
        '13. Measure the actual axial stack and select thrust shims for the specified endplay. Nominal rings are centered with 0.05 mm clearance at each groove side; this is not a zero-play or preload guarantee.',
        `Nominal shim schedule: front ${scalar(v.thrustShims.front)} mm, gear ${scalar(v.thrustShims.gear)} mm, rear ${scalar(v.thrustShims.rear)} mm, four screw-bearing shims ${scalar(v.thrustShims.worm)} mm each.`,
        '14. Verify the contact pattern, complete travel, axial retention and the required load before release.',
        '15. Four-start TR8 is not assumed self-locking. Select holding torque or a brake from the applied fin load.',
        '',
        'Assembly access:',
        'A. Fit both screw bearings, four thrust washers and four retaining rings to the turned screw, then place it in the base half-round seats with flanges facing outward.',
        'B. Insert the large output bearing into the lid from outside +Z. Add the front inner-race shim and insert the sleeve from outside.',
        'C. With the lid underside open, install the sector, closed gear thrust washer and DIN 471-10 ring axially over the sleeve rear stem.',
        'D. Lower the lid/rotor assembly onto the base, engage the teeth by hand, align the locating bosses and close with four case screws and captive nuts.',
        'E. Insert the rear F688 bearing from outside -Z over the rear journal, then fit the rear washer and DIN 471-8 ring. Its flange must not be forced through the smaller base body bore.',
        'F. Measure endplay, select shims and verify complete travel before installing the user-designed external attachment.',
        '',
        'SVG housing and station schedules are machining references, not toleranced production drawings or CAM programs.',
      ].join('\n') + '\n',
    ),
  ];
}
