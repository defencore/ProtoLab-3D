import type { FabricationFile } from '../../../core/types';
import * as d from './drive-layout';
export function screwMachiningSchedule() {
  return {
    partId: 'tr8-compact-actuator',
    units: 'mm',
    blank: {
      designation: 'Tr8x8(P2) RH',
      length: 250,
      starts: 4,
      pitch: 2,
      lead: 8,
      includedAngle: 30,
    },
    datum: 'X=0 is the midpoint of the retained thread; screw axis is Y=0, Z=10 in the assembly.',
    finishedLength: d.screwRightEndX - d.screwLeftEndX,
    finishedEnds: [d.screwLeftEndX, d.screwRightEndX],
    stations: [
      { from: d.screwLeftEndX, to: d.screwStubEndX, diameter: 4, operation: 'Turn coupling stub' },
      {
        from: d.screwStubEndX,
        to: d.screwThreadStartX,
        diameter: 5,
        operation: 'Turn clean bearing journal',
      },
      {
        from: d.screwThreadStartX,
        to: d.screwThreadEndX,
        designation: 'Tr8x8(P2) RH, four starts',
        operation: 'Retain stock thread',
      },
      {
        from: d.screwThreadEndX,
        to: d.screwRightEndX,
        diameter: 5,
        operation: 'Turn clean bearing journal',
      },
    ],
    grooves: [...d.screwClipCentres, ...d.screwInnerClipCentres]
      .sort((a, b) => a - b)
      .map((center) => ({
        center,
        width: 0.7,
        rootDiameter: 4.8,
        ring: 'DIN 471 Ø5, 0.6 mm thick',
      })),
    requirements: [
      'Cut with facing allowance, then finish the listed overall length and stations.',
      'Indicate the existing thread axis before turning; finish both journals coaxially.',
      'Verify actual root diameter permits a fully cleaned Ø5 journal. Do not use Ø6 journals with residual thread grooves.',
      'DIN 471 size5 grooves: Ø4.8 bottom, 0.7 H13 width; retain at least 0.3 mm end land. This layout leaves 0.85 mm nominal land at both outer grooves.',
      'Specify bearing journal fits, groove tolerances, runout and surface finish for the actual bearings and loads before machining.',
      'Deburr thread and groove edges without damaging the retained working flanks; verify full nut travel by hand.',
      'The four retaining rings and thrust spacers retain bearing inner races independently of the interrupted thread end faces.',
    ],
  };
}
export function screwTurningSvg(): string {
  const x = (value: number) => 70 + (value - d.screwLeftEndX) * 12;
  const y = (radius: number) => 125 - radius * 12;
  const stations = screwMachiningSchedule().stations;
  const radii = stations.map((station) => ('diameter' in station ? station.diameter! : 8) / 2);
  const upper = stations.flatMap((s, i) => [
    [x(s.from), y(radii[i])],
    [x(s.to), y(radii[i])],
  ]);
  const lower = stations
    .flatMap((s, i) => [
      [x(s.from), y(-radii[i])],
      [x(s.to), y(-radii[i])],
    ])
    .reverse();
  const outline = [...upper, ...lower].map((p) => p.join(',')).join(' ');
  const grooves = screwMachiningSchedule()
    .grooves.map(
      (g) =>
        `<path d="M${x(g.center - g.width / 2)} ${y(2.5)}V${y(g.rootDiameter / 2)}H${x(g.center + g.width / 2)}V${y(2.5)} M${x(g.center - g.width / 2)} ${y(-2.5)}V${y(-g.rootDiameter / 2)}H${x(g.center + g.width / 2)}V${y(-2.5)}"/>`,
    )
    .join('');
  const length = d.screwRightEndX - d.screwLeftEndX;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="115mm" viewBox="0 0 800 460">
<title>TR8 compact screw turning schedule, millimetres</title>
<rect width="800" height="460" fill="white"/>
<g font-family="sans-serif" font-size="16" fill="#111"><text x="40" y="30">TR8x8(P2) RH / 4 starts / 8 mm lead</text><text x="40" y="53">250 mm threaded stock; cut, face and turn to ${length} mm</text></g>
<polygon points="${outline}" fill="#e0e5e9" stroke="#111" stroke-width="1.2"/>
<g stroke="#111" fill="none" stroke-width="1.2">${grooves}<path d="M40 125H740" stroke-dasharray="12 4 2 4"/>
<path d="M${x(d.screwLeftEndX)} 178V213H${x(d.screwRightEndX)}V178 M${x(-13)} 66V55H${x(13)}V66"/></g>
<g font-family="sans-serif" font-size="15" fill="#111">
<text x="${x(-27)}" y="85">Ø4</text><text x="${x(-19)}" y="85">Ø5</text><text x="${x(15)}" y="85">Ø5</text>
<text x="${x(-3)}" y="72">26 thread</text><text x="${x(-4)}" y="207">${length} overall</text>
<text x="40" y="248">Axial stations from X=0 at the thread midpoint:</text>
${stations.map((s, i) => `<text x="40" y="${274 + i * 23}">${s.from} ... ${s.to}: ${'diameter' in s ? 'turn Ø' + s.diameter : 'retain TR8x8(P2)'}</text>`).join('')}
<text x="40" y="378">4 grooves: X=${screwMachiningSchedule()
    .grooves.map((g) => g.center)
    .join(', ')}</text>
<text x="40" y="402">Grooves 0.7 H13 wide, Ø4.8 root; DIN 471 Ø5 rings 0.6 thick.</text>
<text x="40" y="430">Set fits, tolerances and surface finish before production. Drawing is not to scale.</text>
</g></svg>\n`;
}
export function machiningFiles(): FabricationFile[] {
  return [
    {
      id: 'screw-machining-json',
      label: 'Screw turning schedule',
      description: 'Finished stations and four retaining-ring grooves from 250 mm TR8 stock.',
      name: 'TR8-compact-screw-turning.json',
      type: 'application/json',
      content: JSON.stringify(screwMachiningSchedule(), null, 2) + '\n',
    },
    {
      id: 'screw-machining-svg',
      label: 'Screw turning drawing',
      description: 'Dimensioned turning diagram in millimetres; production fits must be assigned.',
      name: 'TR8-compact-screw-turning.svg',
      type: 'image/svg+xml',
      content: screwTurningSvg(),
    },
  ];
}
