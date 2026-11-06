import type { FabricationFile, Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { componentPython } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { cylinder, subtract, union, type Shape } from '../../../core/assembly/boundary/shapes';
import { libraries } from './channel';
import { cncFramePieces } from './frame';
import { forkBlankShape } from './linkage';
import { linkage, nutTravel, outputBearing, type CncLayout } from './layout';

type Circle = { center: [number, number]; radius: number };
type Edge = { kind: 'line'; from: [number, number]; to: [number, number] } |
  { kind: 'arc'; center: [number, number]; radius: number; start: number; end: number };
const prefix = (l: CncLayout) => l.variant === 'coplanar-64' ? 'TR8-CNC64' : 'TR8-CNC56';

export function outerPlateCircles(layout: CncLayout, motor: boolean, pilot = true): Circle[] {
  const circles: Circle[] = [{ center: [0, 0], radius: layout.diameter / 2 }];
  for (let i = 0; i < 4; i++) {
    const phi = (layout.postClock + i * 90) * Math.PI / 180;
    circles.push({ center: [layout.postRadius * Math.cos(phi), layout.postRadius * Math.sin(phi)], radius: 1.7 });
    const a = (layout.clock + i * 90) * Math.PI / 180;
    const point = (z: number): [number, number] => [layout.outputRadial * Math.cos(a) - z * Math.sin(a), layout.outputRadial * Math.sin(a) + z * Math.cos(a)];
    if (motor) {
      circles.push({ center: point(layout.lever), radius: 3.1 });
      for (const off of [-5.25, 5.25]) circles.push({ center: point(layout.lever + off), radius: 1.1 });
    } else circles.push({ center: point(layout.lever), radius: pilot ? 6.4 : 6.51 });
  }
  return circles;
}

export function outerPlateBlankShape(layout: CncLayout, motor: boolean, pilot = true): Shape {
  const [outer, ...holes] = outerPlateCircles(layout, motor, pilot);
  return subtract(cylinder(outer.radius, 3, [0, 0, 0]), union(...holes.map(c => cylinder(c.radius, 3.2, [...c.center, -.1]))));
}

export function forkContours(layout: CncLayout): { outer: Edge[]; slot: Edge[]; bore: Circle } {
  const half = linkage.forkArmHalfWidth, top = layout.lever / Math.cos(Math.PI / 9) + .30822227524088;
  const chord = 4, angle = Math.atan2(3, chord), root = layout.lever - .3, sr = linkage.slotWidth / 2;
  return { outer: [
    { kind: 'line', from: [chord, 3], to: [half, 3] },
    { kind: 'line', from: [half, 3], to: [half, top] },
    { kind: 'arc', center: [0, top], radius: half, start: 0, end: Math.PI },
    { kind: 'line', from: [-half, top], to: [-half, 3] },
    { kind: 'line', from: [-half, 3], to: [-chord, 3] },
    { kind: 'arc', center: [0, 0], radius: 5, start: Math.PI - angle, end: 2 * Math.PI + angle },
  ], slot: [
    { kind: 'line', from: [sr, root], to: [sr, top] },
    { kind: 'arc', center: [0, top], radius: sr, start: 0, end: Math.PI },
    { kind: 'line', from: [-sr, top], to: [-sr, root] },
    { kind: 'arc', center: [0, root], radius: sr, start: Math.PI, end: 2 * Math.PI },
  ], bore: { center: [0, 0], radius: 2.9 } };
}

function dxf(circles: Circle[], loops: Edge[][] = []): string {
  const p: (number | string)[] = [0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES'];
  for (const c of circles) p.push(0, 'CIRCLE', 8, 'CUT', 10, c.center[0], 20, c.center[1], 40, c.radius);
  for (const loop of loops) for (const e of loop) {
    if (e.kind === 'line') p.push(0, 'LINE', 8, 'CUT', 10, e.from[0], 20, e.from[1], 11, e.to[0], 21, e.to[1]);
    else p.push(0, 'ARC', 8, 'CUT', 10, e.center[0], 20, e.center[1], 40, e.radius, 50, (e.start * 180 / Math.PI) % 360, 51, (e.end * 180 / Math.PI) % 360);
  }
  return [...p, 0, 'ENDSEC', 0, 'EOF'].join('\n') + '\n';
}
function svg(circles: Circle[], loops: Edge[][], bounds: [number, number, number, number], title: string): string {
  const point = (c: [number, number], r: number, a: number) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  const paths = loops.map(loop => {
    const first = loop[0], from = first.kind === 'line' ? first.from : point(first.center, first.radius, first.start);
    return `<path d="M${from.join(',')} ${loop.map(e => e.kind === 'line' ? 'L' + e.to.join(',') : `A${e.radius},${e.radius} 0 ${e.end - e.start > Math.PI ? 1 : 0},1 ${point(e.center,e.radius,e.end).join(',')}`).join(' ')} Z"/>`;
  });
  const [x, y, w, h] = bounds;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="${x} ${y} ${w} ${h}"><title>${title}</title><g transform="scale(1,-1)" stroke="#111" fill="none" stroke-width="0.08">${circles.map(c => `<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}"/>`).join('')}${paths.join('')}</g></svg>\n`;
}

export function cncMachiningSchedule(l: CncLayout) {
  const margin = Math.min(...l.outputStations.map(x => l.threadEnds[1] - (Math.abs(x) + nutTravel(l, 20) + 7.5)));
  return { units: 'mm', variant: l.variant, diameter: l.diameter, screwPitchRadius: l.screwPitchRadius,
    centreToAxis: l.screwPitchRadius, axisToDiscRim: l.diameter / 2 - l.screwPitchRadius,
    middleBody: { billetDiameter: l.diameter, billetLength: l.endPlateX - l.motorPlateX - 3,
      baseSpan: l.middleBase, integralPosts: 4, postDiameter: l.postDiameter, postRadius: l.postRadius, postClock: l.postClock,
      postTaps: { count: 8, designation: 'M3x0.5', depth: 8, nominalEngagement: 5 },
      outputBores: { count: 4, nominalDiameter: 10.02, flangeClearance: l.variant === 'staggered-56' ? 11.4 : undefined },
      screwBearingBores: { nominalDiameter: 13.02, rearFlangeRelief: 15.2, counterboreDepth: 2 } },
    screw: { quantity: 4, stockLength: 250, diameter: 8, pitch: 2, starts: 4, lead: 8,
      finishedEnds: l.screwEnds, finishedLength: l.screwEnds[1] - l.screwEnds[0], threadEnds: l.threadEnds,
      threadLength: l.threadEnds[1] - l.threadEnds[0], journals: [
        { from: l.screwEnds[0], to: l.stubEnd, diameter: 4 },
        { from: l.stubEnd, to: l.threadEnds[0], diameter: 5 },
        { from: l.threadEnds[1], to: l.screwEnds[1], diameter: 5 }],
      grooves: l.screwClipCentres.map(center => ({ center, width: .7, rootDiameter: 4.8 })), fullNutEndMargin: margin },
    output: { quantity: 4, axisStations: l.outputStations, shaftEnds: [linkage.shaftInnerEnd, l.outputTail], diameter: 6,
      bearingCentres: l.outputBearingCentres, bearing: { designation: 'EZO SMF106ZZ', ...outputBearing },
      groove: { center: l.outputClip, width: .8, rootDiameter: 5.7 },
      crossPin: { centerY: linkage.pinCentreY, diameter: 2, length: 10, quantityPerShaft: 1, nominalShaftEndLand: linkage.pinCentreY - 1 - linkage.shaftInnerEnd },
      dFlat: { from: l.outputTail - 6.2, to: l.outputTail, planeFromAxis: 2.5 },
      thrustSleeves: { bore: linkage.spacerBore, outer: linkage.spacerOuter, lengths: [l.outputInnerSleeve, l.outputInterSleeve, l.outputOuterSleeve] } },
    linkage: { lever: l.lever, carrierWidth: 13, forkThickness: 3, slotWidth: 4.1, slideGap: .05,
      nominalFirstRollContactDegrees: .723642, guidePolicy: 'One outward fork face blocks both carrier-roll directions; the nominal running gap permits finite play.' },
    requirements: [
      'Assign actual bearing fits, coaxiality, material grades, corner reliefs, surface finish and application loads.',
      'Finish four end-disc bearing pilots from diameter 12.8 mm; the CAD fit envelope is diameter 13.02 mm.',
      'Finish the fork shaft pilot from 5.8 to 6.05 mm, then match-drill and ream the transverse 2 mm joint.',
      'The plain closed shaft end has no enlarged head. Verify pin end land, single-fork shear and short bearing span for the load.',
      'EZO inner-ring abutment diameter is 6.8 to 6.9 mm; assign sleeve bore/OD/concentricity tolerances together.',
      'Tap geometry uses CAD inspection allowances; the production tapping drill, fit class and thread tolerance require a drawing.',
    ] };
}

export function cncFabricationFiles(layout: CncLayout, _p: Parameters, pieces: ConfiguredPiece[]): FabricationFile[] {
  const stem = prefix(layout), out: FabricationFile[] = [];
  const file = (id: string, label: string, type: string, name: string, content: string) => out.push({ id, label, description: label, type, name, content });
  for (const motor of [true, false]) {
    const role = motor ? 'motor-disc' : 'end-disc', circles = outerPlateCircles(layout, motor);
    file(role + '-dxf', role + ' · 3 mm steel · scale 1:1', 'application/dxf', `${stem}-${role}-3mm.dxf`, dxf(circles));
    file(role + '-svg', role + ' · 3 mm steel · scale 1:1', 'image/svg+xml', `${stem}-${role}-3mm.svg`, svg(circles, [], [-layout.diameter/2-2,-layout.diameter/2-2,layout.diameter+4,layout.diameter+4], role));
  }
  const f = forkContours(layout), top = layout.lever / Math.cos(Math.PI / 9) + .30822227524088 + linkage.forkArmHalfWidth + 1;
  file('fork-dxf', 'Single outward fork · 3 mm steel · quantity 4', 'application/dxf', `${stem}-fork-3mm.dxf`, dxf([f.bore], [f.outer, f.slot]));
  file('fork-svg', 'Single outward fork · 3 mm steel · quantity 4', 'image/svg+xml', `${stem}-fork-3mm.svg`, svg([f.bore], [f.outer,f.slot], [-6,-top,12,top+6], 'Quantity 4 · shaft pilot 5.8 · match-drill transverse pin'));
  const frame = cncFramePieces(layout).find(x => x.component.id === 'cnc-middle-body')!;
  const source = componentPython(libraries, [frame]);
  file('cnc-body-native', 'One-piece CNC middle body · native BRep', 'text/x-python', `${stem}-middle-body.FCMacro`,
    `import FreeCAD as App, Part, math\ndoc=App.newDocument(${JSON.stringify(stem.replaceAll('-','')+'MiddleBody')})\n${source}\nitem=doc.addObject('Part::Feature','CncMiddleBody')\nitem.Label=${JSON.stringify(frame.label)}\nitem.Shape=shape\nitem.addProperty('App::PropertyFloatList','SourceRGB','Appearance')\nitem.SourceRGB=component_colors[0]\nif App.GuiUp:\n    item.ViewObject.ShapeColor=tuple(component_colors[0])\n    Gui.activeDocument().activeView().viewAxonometric()\n    Gui.activeDocument().activeView().fitAll()\ndoc.recompute()\n`);
  const blankPieces = [true, false].map((motor, i) => {
    const component = detailComponent('blank-' + i, (motor?'Motor':'End') + ' disc laser blank', {kind:'transform',translation:[i*(layout.diameter+5),0,0],rotation:[0,0,0],child:outerPlateBlankShape(layout,motor)});
    return { component, label: component.name, color: 0xb6bec6, requireSingleSolid: true };
  });
  for (let i=0;i<4;i++) {
    const component=detailComponent('fork-blank-'+i,'Fork blank '+(i+1),{kind:'transform',translation:[2*layout.diameter+20+i*15,0,0],rotation:[0,0,0],child:forkBlankShape(layout)});
    blankPieces.push({component,label:component.name,color:0x759bb3,requireSingleSolid:true});
  }
  file('laser-blanks-native', 'Six laser blanks · pilots before finishing', 'text/x-python', `${stem}-laser-blanks.FCMacro`,
    `import FreeCAD as App, Part, math\ndoc=App.newDocument('CncQuadLaserBlanks')\n${componentPython(libraries,blankPieces)}\nfor i,s in enumerate(components):\n    ob=doc.addObject('Part::Feature','Blank'+str(i))\n    ob.Label=component_labels[i]\n    ob.Shape=s\ndoc.recompute()\nif App.GuiUp: Gui.activeDocument().activeView().viewAxonometric(); Gui.activeDocument().activeView().fitAll()\n`);
  file('machining', 'Current CNC, turning and drilling schedule', 'application/json', `${stem}-machining.json`, JSON.stringify(cncMachiningSchedule(layout),null,2)+'\n');
  file('cut-manifest','Two outer discs and four single forks','application/json',`${stem}-cut-manifest.json`,JSON.stringify({units:'mm',scale:'1:1',laserStockThickness:3,mainOuterDiscs:2,integralMiddleBodies:1,forks:4,shaftPilotDiameter:5.8,endBearingPilotDiameter:12.8,partId:layout.variant},null,2)+'\n');
  const quote=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
  file('bom','Complete bought and manufactured component list','text/csv;charset=utf-8',`${stem}-components.csv`,[
    ['ID','Component','Quantity','Library','Supply','Designation','Material'],
    ...pieces.map(({component:c})=>[c.id,c.name,c.quantity,c.libraryId,c.supply,c.procurement?.designation,c.manufacturing?.material]),
  ].map(row=>row.map(quote).join(',')).join('\n')+'\n');
  file('motion','Per-channel travel and screw rotation','text/csv;charset=utf-8',`${stem}-motion.csv`,'Angle_deg,NutTravel_mm,ScrewRotation_deg\n'+[-20,-10,0,10,20].map(a=>[a,nutTravel(layout,a),-360*nutTravel(layout,a)/8].join(',')).join('\n')+'\n');
  return out;
}
