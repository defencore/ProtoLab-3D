import type { FabricationFile, Parameters } from '../../../core/types';
import { fixed as f, layout, thread } from './layout';
import { pieces, selectedMotor } from './model';
import { defaults } from '../configurator';
import { gearOutline, gearBoreOutline, forkPlateOutline, outputHoleCenters } from './shapes';

type Point = [number, number];
const scalar = (n: number) => String(Number(n.toFixed(6)));
const prefix = 'TR8x4-geared-fork';
const csv = (rows: unknown[][]) =>
  rows
    .map((row) => row.map((v) => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(','))
    .join('\n') + '\n';
const circle = (r: number): Point[] =>
  Array.from({ length: 96 }, (_, i) => [
    r * Math.cos((i * 2 * Math.PI) / 96),
    r * Math.sin((i * 2 * Math.PI) / 96),
  ]);
const motorPinSource = 'https://www.stuermer-werkzeuge.de/product/view/2319285/2971748';
const motorPinManufacturerCatalog =
  'https://www.reyher.de/fileadmin/user_upload/Downloadbereich/REYHER_Catalogue_2020_04_EN_Web_ks.pdf';

function profileDxf(loops: [string, Point[]][]): string {
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
  for (const [layer, points] of loops)
    data.push(
      0,
      'LWPOLYLINE',
      100,
      'AcDbEntity',
      8,
      layer,
      100,
      'AcDbPolyline',
      90,
      points.length,
      70,
      1,
      ...points.flatMap(([x, y]) => [10, x, 20, y]),
    );
  return (
    [...data, 0, 'ENDSEC', 0, 'EOF']
      .map((v) => (typeof v === 'number' ? scalar(v) : v))
      .join('\n') + '\n'
  );
}
function profileSvg(
  title: string,
  loops: Point[][],
  bounds: [number, number, number, number],
): string {
  const [x, y, w, h] = bounds;
  const path = (points: Point[]) =>
    'M ' + points.map(([px, py]) => scalar(px) + ' ' + scalar(-py)).join(' L ') + ' Z';
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    'mm" height="' +
    h +
    'mm" viewBox="' +
    [x, y, w, h].join(' ') +
    '"><title>' +
    title +
    '</title><g fill="none" stroke="#000" stroke-width="0.08">' +
    loops.map((p) => '<path d="' + path(p) + '"/>').join('') +
    '</g></svg>\n'
  );
}
export function gearProfileDxf(pinion = false): string {
  return profileDxf([
    ['GEAR_TOOTH_REFERENCE', gearOutline()],
    [pinion ? 'PINION_ROUND_BORE' : 'DRIVEN_GEAR_ROUND_BORE', gearBoreOutline(pinion)],
  ]);
}
export function gearProfileSvg(pinion = false): string {
  return profileSvg(
    (pinion ? 'Motor pinion' : 'Driven gear') +
      ': 24 teeth, module 1, 5 mm face; round bore; 1:1 millimetres; transverse pin hole is a secondary operation',
    [gearOutline(), gearBoreOutline(pinion)],
    [-15, -15, 30, 30],
  );
}
export function forkPlateDxf(): string {
  return profileDxf([
    ['FORK_OUTER_WITH_OPEN_SLOT', forkPlateOutline()],
    ['SHAFT_OPENING_6_05', circle(f.forkBore / 2)],
  ]);
}
export function forkPlateSvg(): string {
  return profileSvg(
    'Fork plate: quantity 2 identical; 3 mm steel; round 6.05 mm bore; 1:1 millimetres; transverse 2 mm edge hole is a secondary drilling operation',
    [forkPlateOutline(), circle(f.forkBore / 2)],
    [-8, -28, 16, 36],
  );
}
export function laserManifest() {
  return {
    units: 'mm',
    blanks: [
      {
        id: 'fork-plate',
        quantity: 2,
        thickness: f.forkThickness,
        material: 'Steel sheet; grade to drawing',
        dxf: prefix + '-fork-plate-1to1.dxf',
        svg: prefix + '-fork-plate-1to1.svg',
        occurrences: ['fork-upper-plate', 'fork-lower-plate'],
        nominalRoundBore: f.forkBore,
        openSlotWidth: f.slotWidth,
      },
    ],
    secondaryOperations: [
      'Deburr both plate faces and open follower slots. Finish the nominal 6.05 mm shaft openings to the assigned fit.',
      'Align the plates and round shaft, then match-drill one 2 mm transverse hole through each plate EDGE and shaft at the 1.5 mm sheet mid-plane. This is not a through-face laser hole.',
      'Use a guided drilling fixture; the nominal 2 mm hole in 3 mm sheet leaves 0.5 mm above and below. Support each plate during DIN1481 diameter 2 x 10 spring-pin installation.',
    ],
  };
}

export function machiningSchedule(p: Parameters = defaults) {
  const motor = selectedMotor(p);
  const outer = f.outputBearingZ + 1.5,
    inner = f.outputBearingZ - 1.5;
  const stroke = 2 * f.lever * Math.tan(Math.PI / 9);
  return {
    units: 'mm and degrees',
    coordinateSystem:
      'Screw +X at Y=Z=0; motor axis Y=' +
      f.motorY +
      '; output +Z at X=' +
      f.outputX +
      ',Y=' +
      f.outputY +
      '. Neutral plates point +Y.',
    scope:
      'Nominal geometry and machining schedule; assign actual fits, materials, finish and tolerances before manufacture.',
    selectedMotor: {
      name: motor.name,
      libraryId: motor.part.id,
      model: motor.parameters.model,
      dimensions: motor.dimensions,
      source: motor.source,
    },
    screw: {
      blank:
        'Unthreaded diameter 8 steel blank; finished length ' +
        (f.screwEnd - f.screwStart) +
        ' plus machining allowance',
      reason:
        'Cut the two-start thread between intact diameter 6 journals. The nominal 5.5 mm thread root cannot provide clean 6 mm journals by turning fully threaded stock.',
      thread: { ...thread, designation: 'Tr8x4(P2) RH', fromX: f.threadStart, toX: f.threadEnd },
      strokeBudget: {
        outputLimitDegrees: 20,
        workingLength: f.threadEnd - f.threadStart,
        fullNutStroke: stroke,
        nutLength: f.nutLength,
        endEngagementMarginEach: Number(
          ((f.threadEnd - f.threadStart - stroke - f.nutLength) / 2).toFixed(9),
        ),
        frontWallContact: {
          outputAngle: 20,
          nutCentreX: f.threadStart + f.nutLength / 2,
          nutEndX: f.threadStart,
          wallX: 0,
        },
        rearWallContact: {
          outputAngle: -20,
          nutCentreX: f.threadEnd - f.nutLength / 2,
          nutEndX: f.threadEnd,
          wallX: 31,
        },
      },
      stations: [
        {
          fromX: f.screwStart,
          toX: f.frontNeckStart,
          diameter: 6,
          operation: 'Turn round front gear drive',
        },
        {
          fromX: f.frontNeckStart,
          toX: -3,
          diameter: f.clipNeckDiameter,
          operation: 'Turn local E-clip neck immediately outside the front bearing',
        },
        {
          fromX: -3,
          toX: f.threadStart,
          diameter: 6,
          operation: 'Turn front bearing journal',
        },
        {
          fromX: f.threadStart,
          toX: f.threadEnd,
          diameter: 8,
          operation: 'Cut two-start trapezoidal working thread',
        },
        {
          fromX: f.threadEnd,
          toX: 34,
          diameter: 6,
          operation: 'Turn rear bearing journal',
        },
        {
          fromX: 34,
          toX: f.screwEnd,
          diameter: f.clipNeckDiameter,
          operation: 'Turn rear E-clip neck',
        },
      ],
      grooves: [
        { ...f.frontGroove, axis: 'X', designation: 'DIN 6799 3.2 x 0.6' },
        { ...f.rearGroove, axis: 'X', designation: 'DIN 6799 3.2 x 0.6' },
      ],
      gearCrossHole: {
        diameter: f.screwGearPinDiameter,
        centre: [f.gearPinX, 0, 0],
        axisAtNeutral: 'Global Z through outboard hub and shaft; clear of teeth',
        pin: 'DIN1481 diameter 2 x 10',
        pinPreset: 'gvyntok-2b5602414d16',
        pinEndsAtNeutralZ: [-5, 5],
        recessInsideHub: 1,
        operation:
          'Match-drill the outboard hub and round shaft after setting mesh and axial position',
      },
      bearingRetention:
        'All shaft retaining rings contact bearing INNER-race faces directly; each groove is immediately outside its bearing edge. There are no intermediate pieces.',
    },
    gears: {
      module: f.gearModule,
      teeth: f.gearTeeth,
      pressureAngle: 20,
      backlash: 0.1,
      faceWidth: f.gearWidth,
      toothFacesX: [f.gearStart, f.gearEnd],
      centreDistance: f.motorY,
      ratio: '1:1 external gears; opposite rotation',
      pitchDiameter: 24,
      outsideDiameter: 26,
      rootDiameter: 21.5,
      outboardHubs: {
        diameter: f.gearHubDiameter,
        facesX: [f.gearHubStart, f.gearHubEnd],
        crossPinCentreX: f.gearPinX,
        pinEndRecess: 1,
        toothRegion: 'Transverse holes stay wholly outside tooth faces X=-11...-6',
      },
      driven: {
        bore: 6.02,
        retention:
          'Diameter 2 x 10 spring cross-pin couples the round 6 mm shaft and outboard hub for torque and axial retention',
        crossHole: { diameter: 2, axialStationX: f.gearPinX, axisAtNeutral: 'Global Z' },
        pinEndsRadius: 5,
        hubRadius: 6,
      },
      pinion: {
        bore: 3.175,
        retention: 'Diameter 1 x 10 spring cross-pin couples the motor shaft and pinion',
        crossHole: {
          diameter: 1,
          motorLocalZ: -f.gearPinX,
          motorLocalAxis: 'X',
          globalCentreX: f.gearPinX,
          clocking: 'Match the pinion hole to the motor shaft hole at the installed mesh phase',
        },
        pinEndsRadius: 5,
        hubRadius: 6,
      },
      machining:
        'Set 5 mm tooth faces at X=-11...-6. Match-drill only the outboard diameter 12 hubs at X=-13, between hub faces X=-15...-11. Both 10 mm pins end at radius 5, recessed 1 within the hubs; the teeth are not drilled.',
      profileScope:
        'SVG/DXF show nominal sampled involutes and round bores in millimetres. Transverse pin holes are secondary operations and are not through-face cutting contours.',
    },
    motorSecondaryMachining: {
      purchasedProduct: motor.name,
      source: motor.source,
      bodyDimensions: motor.dimensions,
      sourceModel:
        'Factory installation model remains unchanged. This mechanism uses a separately identified motor-shaft machining execution.',
      operation:
        'Match-drill a 1 mm cross-hole in the exposed 3.175 mm shaft at motor-local Z=13, along local X, inside the outboard pinion hub. The hole and pin rotate with the rotor.',
      pin: {
        designation: 'DIN1481 diameter 1 x 10',
        manufacturer: 'F. REYHER Nchfg. GmbH & Co. KG',
        article: '001481960000010010',
        ean: '4043952375983',
        material: '1.4310 stainless spring steel',
        source: motorPinSource,
        manufacturerCatalog: motorPinManufacturerCatalog,
        geometryEvidence:
          'Diameter, length and product identity are catalog sourced. Wall, slit and chamfers are illustrative unless confirmed by the ordered pin drawing.',
      },
      fixture:
        'Support the exposed shaft and gear during match-drilling and pin insertion; control debris and avoid transmitting installation force through motor bearings.',
    },
    nut: {
      material: 'Bearing bronze',
      body: [f.nutLength, f.nutWidth, f.nutHeight],
      bodyCornerRadius: 1,
      endReliefs: {
        diameter: f.nutEndReliefDiameter,
        depthEach: f.nutEndReliefDepth,
        purpose:
          'Clear bearing faces while the remaining nut end lands meet the carrier walls at the travel limits',
      },
      thread: {
        ...thread,
        designation: 'Tr8x4(P2) RH',
        length: f.nutLength - 2 * f.nutEndReliefDepth,
        localThreadStartX: -f.nutLength / 2 + f.nutEndReliefDepth,
        phaseAtNeutralRadians: (2 * Math.PI * f.outputX) / thread.lead,
      },
      trunnions: { diameter: f.pinDiameter, axis: 'Z', endsZ: [-11.2, 11.2], integral: true },
      neutralCentre: [f.outputX, 0, 0],
    },
    fork: {
      construction: 'Two identical laser-cut plates individually cross-pinned to the round shaft',
      quantity: 2,
      thickness: f.forkThickness,
      roundBore: f.forkBore,
      nutFaceRunningClearancePerSide: 0.1,
      bearingFaceGapEach: f.outputBearingGap,
      occurrences: [
        { id: 'fork-upper-plate', facesZ: [f.forkInnerZ, f.forkOuterZ] },
        { id: 'fork-lower-plate', facesZ: [-f.forkOuterZ, -f.forkInnerZ] },
      ],
      crossDrill: {
        diameter: f.forkCrossPinDiameter,
        axis: 'Local X through plate edge and shaft',
        localSheetCentreZ: f.forkThickness / 2,
        installedCentresZ: [-f.forkCrossPinZ, f.forkCrossPinZ],
        minimumNominalFaceLigament: (f.forkThickness - f.forkCrossPinDiameter) / 2,
        operation: 'Guided secondary match-drilling after laser cutting and plate alignment',
      },
      crossPins: {
        designation: 'DIN1481',
        diameter: f.forkCrossPinDiameter,
        length: f.forkCrossPinLength,
        quantity: 2,
        libraryPreset: 'gvyntok-2b5602414d16',
        state: 'installed',
      },
      radialSlots: {
        width: f.slotWidth,
        blindEndCentreRadius: f.slotStart,
        outerCutExtent: f.slotEnd,
        openMouth: true,
        forkTipRadius: 25.5,
        maximumPinOuterRadius: f.lever / Math.cos(Math.PI / 9) + f.pinDiameter / 2,
      },
      neutralAxis: [f.outputX, f.outputY, 0],
    },
    outputShaft: {
      blank: 'Diameter-' + f.outputHeadDiameter + ' steel bar; turn the round shaft, neck and head',
      stations: [
        {
          fromZ: f.outputShaftEnd,
          toZ: -outer,
          diameter: f.clipNeckDiameter,
          operation: 'Turn lower E-clip neck immediately outside the bearing',
        },
        {
          fromZ: -outer,
          toZ: outer,
          diameter: 6,
          operation: 'Turn continuous round shaft through both bearings and plates',
        },
        {
          fromZ: outer,
          toZ: f.outputHeadBottom,
          diameter: f.outputNeckDiameter,
          operation: 'Turn integral upper inner-race abutment',
        },
        {
          fromZ: f.outputHeadBottom,
          toZ: f.outputHeadTop,
          diameter: f.outputHeadDiameter,
          operation: 'Retain enlarged attachment head',
        },
      ],
      groove: { ...f.outputGroove, axis: 'Z', designation: 'DIN 6799 3.2 x 0.6' },
      crossHoles: {
        diameter: f.forkCrossPinDiameter,
        axis: 'Local X',
        centresZ: [-f.forkCrossPinZ, f.forkCrossPinZ],
      },
      headThreads: {
        designation: 'M3x0.5',
        pitchCircle: f.outputHolePitchCircle,
        centresXYRelativeToShaft: outputHoleCenters(),
        fromZ: f.outputHeadThreadStart,
        nominalDepth: f.outputHeadTop - f.outputHeadThreadStart,
        blind: true,
        evidence:
          'Locations match ST3215 output-disc PCD14. Stock source holes are diameter 2.5; M3 threads belong to this custom head.',
      },
      lowerRetention:
        'DIN 6799 size 3.2 E-clip on a local diameter 5 neck directly meets the lower bearing inner-race face at Z=-13.3.',
    },
    directRingContacts: [
      {
        id: 'gear-clip',
        designation: 'DIN 6799 3.2 x 0.6',
        axis: 'X',
        bearingFace: -3,
        centre: f.frontGroove.clipCenter,
        nominalRingFaces: [-3.6, -3],
        grooveFaces: [-3.64, -3],
        grooveCentre: f.frontGroove.center,
        maximumLoadSideCornerRadius: 0.06,
        rootDiameter: f.frontGroove.rootDiameter,
      },
      {
        id: 'screw-rear-clip',
        designation: 'DIN 6799 3.2 x 0.6',
        axis: 'X',
        bearingFace: 34,
        centre: f.rearGroove.clipCenter,
        nominalRingFaces: [34, 34.6],
        grooveFaces: [34, 34.64],
        grooveCentre: f.rearGroove.center,
        maximumLoadSideCornerRadius: 0.06,
        rootDiameter: f.rearGroove.rootDiameter,
      },
      {
        id: 'output-clip',
        designation: 'DIN 6799 3.2 x 0.6',
        axis: 'Z',
        bearingFace: -outer,
        centre: f.outputGroove.clipCenter,
        nominalRingFaces: [-outer - 0.6, -outer],
        grooveFaces: [-outer - 0.64, -outer],
        grooveCentre: f.outputGroove.center,
        maximumLoadSideCornerRadius: 0.06,
        rootDiameter: f.outputGroove.rootDiameter,
      },
    ],
    ringFit: {
      designation: 'DIN 6799 3.2 x 0.6',
      libraryId: 'e-ring',
      preset: 'gvyntok-e-ring-3.2',
      source:
        'https://gvyntok.com/shop/shajby-koltsa/shajba-stopornaya-dlya-vala-din-6799/shajba-stopornaya-dlya-vala-din-6799-m3-2/',
      dimensionalSource: 'https://www.rotorclip.com/product/de-3-2/',
      localShaftNeckDiameter: f.clipNeckDiameter,
      sourceShaftDiameterRange: [4, 5],
      bearingJournalDiameter: 6,
      thickness: f.clipThickness,
      installed: { grooveDiameter: 3.2, maximumOutsideDiameter: 7.3 },
      groove: {
        form: 'Flat parallel walls',
        rootDiameter: 3.2,
        sourceRootDiameterRange: [3.13, 3.2],
        width: 0.64,
        sourceWidthRange: [0.64, 0.69],
        maximumLoadSideCornerRadius: 0.06,
        minimumOutsideEdgeMargin: 1,
      },
      contact:
        'Flat E-clips bear directly on inner-race faces at the bearing edge. Local diameter 5 necks honor the sourced shaft range. The 7.3 maximum installed outside envelope clears the stationary outer ring; the illustrated three-lug contour does not replace a supplier drawing. Verify actual bearing chamfers, groove fit and selected end float.',
    },
    frame: {
      construction: 'One open aluminium carrier directly supports all four bearing outer rings',
      frontPlateFacesX: [f.frontPlateStart, f.frontPlateEnd],
      rearPlateFacesX: [31, 34],
      backWallFacesY: [39, 42],
      rearPlateMotorPassage: { diameter: 28.6, centreY: f.motorY, centreZ: 0 },
      bearingSeatDiameter: f.bearingSeat,
      flangePocketDiameter: f.flangeSeat,
      flangePocketDepth: 0.6,
      bearing: {
        designation: 'SMB MF106 2Z',
        quantity: 4,
        bore: 6,
        outer: 10,
        overallWidth: 3,
        flangeOuter: 11.2,
        flangeWidth: 0.6,
      },
      bearingEnvelopes: [
        {
          id: 'screw-front-bearing',
          axis: 'X',
          centre: [f.frontBearingX, 0, 0],
          faces: [-3, 0],
          flangeFaces: [-3, -2.4],
        },
        {
          id: 'screw-rear-bearing',
          axis: 'X',
          centre: [f.rearBearingX, 0, 0],
          faces: [31, 34],
          flangeFaces: [33.4, 34],
        },
        {
          id: 'output-upper-bearing',
          axis: 'Z',
          centre: [f.outputX, f.outputY, f.outputBearingZ],
          faces: [inner, outer],
          flangeFaces: [outer - 0.6, outer],
        },
        {
          id: 'output-lower-bearing',
          axis: 'Z',
          centre: [f.outputX, f.outputY, -f.outputBearingZ],
          faces: [-outer, -inner],
          flangeFaces: [-outer, -outer + 0.6],
        },
      ],
      motorMount: {
        faceX: 0,
        axisY: f.motorY,
        axisZ: 0,
        clearanceHole: 3.2,
        shaftClearance: 3.6,
        boltCentresYZ: [
          [f.motorY, -8],
          [f.motorY, 8],
        ],
        screw: '2 x M3x5 low-head socket screws directly through the flat plate',
        underHeadPlaneX: -3,
        tipX: 2,
        nominalInsertion: 2,
      },
    },
    laserBlanks: laserManifest(),
    fastenerPolicy:
      'Two M3x5 motor screws and four M3x3 head screws. Two gear cross-pins and two fork cross-pins provide coupling. Three DIN 6799 size 3.2 E-clips on local diameter 5 necks directly retain bearing inner races.',
    finalInspection:
      'Inspect transverse pin seating, ring-to-inner-race contact, selected end float, shield freedom, matched-thread travel, mesh, plate integrity and motor screw depth through the full sweep.',
  };
}

export const assemblyInstructions =
  [
    'TR8x4 GEARED FORK: ASSEMBLY ORDER',
    'All dimensions in mm. Use the machining JSON and native model together.',
    '',
    '1. Laser-cut TWO IDENTICAL fork plates from 3 mm steel. Finish the round 6.05 shaft openings and deburr the open slots. The transverse 2 mm plate EDGE holes are later match-drilling operations at the 1.5 mm sheet mid-plane.',
    '',
    '2. Machine the carrier, round screw journals, matching nut, gears and output shaft. Screw length is 52, X=-16...36; working Tr8x4(P2) RH thread spans X=0...31 between the bearing inner faces. Turn diameter 6 drive/journal stock, reducing the local E-clip necks to diameter 5 at X=-4.64...-3 and 34...36. The nut is 16 long in X and travels 15. Counterbore BOTH nut ends diameter 10.4 x 0.4 deep: the remaining end lands stop against the carrier walls while clearing the bearing faces. Effective internal thread length is 15.2. Match its neutral helix phase at X=15.5.',
    '',
    '3. Mount the SELECTED motor directly to the flat plate X=-3...0 with two M3x5 low-head screws. Their under-head plane is X=-3; tips stop at X=2, giving nominal 2 insertion. Verify the delivered motor depth. Fit the motor before its pinion. Both motor families retain their 15 projecting shaft and pass through the rear diameter 28.6 opening; the selected body length is listed in this file header.',
    '',
    '4. With screw bearings and output shaft absent, preplace the nut INSIDE at X=15.5,Y=Z=0. Load both plates laterally over the integral nut pins through their open mouths. Fixture faces at Z=7.1...10.1 and -10.1...-7.1, with round bores coaxial at X=15.5,Y=-20.606080646, pointing +Y.',
    '',
    '5. Feed the round screw rear end through the EMPTY front seat and the nut nominal 6.1 mm pilot. Hand-turn the screw through the stationary nut while advancing along +X until the rear journal reaches its seat. Neither the complete nut nor the working thread passes through an installed 6 mm bearing.',
    '',
    '6. Fit the front MF106 from the left over the smooth 6 mm drive section directly into the carrier at X=-3...0. Fit the rear MF106 from the right at X=31...34. Their 0.6 mm outward flanges lie within the overall 3 mm bearing widths.',
    '',
    '7. Radially install the two screw DIN 6799 size 3.2 x 0.6 E-clips on their diameter 5 necks, directly at the bearing edges. Front groove X=-3.64...-3 has centre -3.32; the ring centre is -3.3 and faces are -3.6...-3. Rear groove X=34...34.64 has centre 34.32; ring centre is 34.3 and faces are 34...34.6. Both flat grooves have diameter 3.2 roots, width 0.64 and load-side corner radius at most 0.06. Keep at least 1 outside edge margin. The maximum installed ring outside diameter is 7.3. There are no intermediate pieces. Verify direct inner-race face contact, actual bearing chamfers, shield freedom and selected end float.',
    '',
    '8. Set both 5 mm tooth faces to X=-11...-6 at 24 axis spacing. Both diameter 12 outboard hubs span X=-15...-11. Match-drill ONLY the driven-gear HUB and screw diameter 2 at X=-13 along global Z at neutral. Install DIN1481 diameter 2 x 10, ends at radius 5 recessed 1 inside the hub. The hole spans axial X=-14...-12 and never enters the teeth. It transfers torque and retains the gear axially.',
    '',
    '9. Match-drill ONLY the pinion outboard HUB and exposed 3.175 motor shaft diameter 1 at motor-local Z=13, along local X, clocked to the mesh. Install sourced DIN1481 diameter 1 x 10, ends recessed 1 within the diameter 12 hub. Its hole spans axial X=-13.5...-12.5, outside the teeth. The motor shaft projects 15, leaving 2 from pin centre to its end. This is secondary machining of the selected purchased motor; factory source geometry is unchanged. Support shaft and gear and control debris/installation forces.',
    '',
    '10. Seat the output bearings at Z=10.3...13.3 and -13.3...-10.3. Insert the shaft, with its reduced diameter 5 tail first, through both bearings and aligned plate openings; the diameter 6 journals and integral upper neck locate the inner races. Match-drill the plate EDGES and shaft diameter 2 along local X at Z=+8.6 and -8.6, then press both DIN1481 diameter 2 x 10 pins with the plate centres supported.',
    '',
    '11. Radially fit the output DIN 6799 size 3.2 x 0.6 E-clip directly at the lower inner-race face on the diameter 5 tail. Its flat groove spans Z=-13.94...-13.3, centre -13.62, root diameter 3.2 and width 0.64; the ring centre is -13.6 and faces are -13.9...-13.3. Limit the load-side groove radius to 0.06 and maintain at least 1 outside edge margin. No intermediate piece is fitted. Remove the fixture and check seating, bearing-face contact and selected end float.',
    '',
    '12. The diameter 20 output head spans Z=14.2...19.2. Four blind M3x0.5 holes on ST3215 output-disc PCD14, at (7,0),(-7,0),(0,7),(0,-7), accept four M3x3 attachment screws. Original ST3215 disc holes are diameter 2.5; this is a custom M3 interface. The external attachment is not included.',
    '',
    '13. Turn by hand through -20...+20. At +20 the nut centre is X=8 and its left end meets the front wall X=0. At -20 its centre is X=23 and right end meets the rear wall X=31. Confirm REAL nut-end land contact without volume penetration; diameter 10.4 end reliefs keep the axial stop load off the bearing faces. Inspect all four pins, direct ring contacts, backlash, 0.2 plate/bearing gap and pin-slot freedom. Qualify prototype joints, the reduced clip-groove sections, sensorless reversal, thermal duty and cable routing.',
    '',
    'Motion: L=7.5/tan(20deg)=20.606080646; nut X=15.5-L*tan(theta); screw turns=L*tan(theta)/4; motor turns opposite. Stroke 15 and motor sweep 3.75 turns. Maximum follower-pin outer radius 23.928533= L/cos(20deg)+2, inside the 25.5 fork tip by 1.571467.',
  ].join('\n') + '\n';

export function assemblyText(p: Parameters = defaults): string {
  const motor = selectedMotor(p),
    d = motor.dimensions;
  return (
    'Selected motor: ' +
    motor.name +
    '\nModel: ' +
    String(motor.parameters.model) +
    '\nBody: diameter' +
    d.diameter +
    ' x' +
    d.length +
    '; shaft diameter' +
    d.shaft +
    ' x' +
    d.projection +
    ' projection\nSource: ' +
    motor.source +
    '\n\n' +
    assemblyInstructions
  );
}

export function fabricationFiles(p: Parameters): FabricationFile[] {
  const components = pieces({ ...p, outputAngle: 0 }).map((piece) => piece.component);
  const bill = csv([
    ['ID', 'Component', 'Quantity', 'Library', 'Supply', 'Material', 'Designation', 'Source'],
    ...components.map((item) => [
      item.id,
      item.name,
      item.quantity,
      item.libraryId,
      item.supply,
      item.manufacturing?.material,
      item.procurement?.designation,
      item.procurement?.source,
    ]),
  ]);
  const motion = csv([
    [
      'OutputAngle_deg',
      'NutCentreX_mm',
      'NutDisplacement_mm',
      'PinRadius_mm',
      'ScrewTurns',
      'MotorTurns',
      'ScrewAngle_deg',
      'MotorAngle_deg',
    ],
    ...Array.from({ length: 41 }, (_, i) => {
      const v = layout({ outputAngle: i - 20 });
      return [
        v.angle,
        v.nutX,
        v.displacement,
        v.pinRadius,
        v.screwTurns,
        v.motorTurns,
        v.screwAngle,
        v.motorAngle,
      ].map((n) => Number(n.toFixed(9)));
    }),
  ]);
  const file = (
    id: string,
    label: string,
    description: string,
    suffix: string,
    type: string,
    content: string,
  ): FabricationFile => ({ id, label, description, name: prefix + '-' + suffix, type, content });
  return [
    file(
      'bill-of-materials',
      'Component list',
      'Physical occurrences with four cross-pins and direct bearing retaining rings.',
      'component-list.csv',
      'text/csv;charset=utf-8',
      bill,
    ),
    file(
      'motion-table',
      'Motion table',
      'Full -20 to +20 degree stroke; lead 4 and 1:1 gear reversal.',
      'motion.csv',
      'text/csv;charset=utf-8',
      motion,
    ),
    file(
      'machining-schedule',
      'Machining schedule',
      'Round drive sections, gear cross-holes, motor-shaft machining and direct ring contacts.',
      'machining.json',
      'application/json',
      JSON.stringify(machiningSchedule(p), null, 2) + '\n',
    ),
    file(
      'assembly-instructions',
      'Assembly order',
      'Accessible insertion, supported pin installation and direct ring contact sequence.',
      'assembly.txt',
      'text/plain;charset=utf-8',
      assemblyText(p),
    ),
    file(
      'laser-manifest',
      'Laser cutting manifest',
      'Two identical 3 mm plates with secondary edge drilling.',
      'laser-manifest.json',
      'application/json',
      JSON.stringify(laserManifest(), null, 2) + '\n',
    ),
    file(
      'fork-plate-svg',
      'Fork plate SVG · quantity 2',
      '1:1 millimetres; plate edge drilling is secondary.',
      'fork-plate-1to1.svg',
      'image/svg+xml',
      forkPlateSvg(),
    ),
    file(
      'fork-plate-dxf',
      'Fork plate DXF · quantity 2',
      'Closed flat cutting outline and round shaft opening.',
      'fork-plate-1to1.dxf',
      'application/dxf',
      forkPlateDxf(),
    ),
    ...[false, true].flatMap((pinion) => {
      const role = pinion ? 'pinion' : 'driven-gear';
      return [
        file(
          role + '-svg',
          (pinion ? 'Pinion' : 'Driven gear') + ' profile SVG',
          '1:1 involute and round bore; transverse pin hole is a secondary operation.',
          role + '-1to1.svg',
          'image/svg+xml',
          gearProfileSvg(pinion),
        ),
        file(
          role + '-dxf',
          (pinion ? 'Pinion' : 'Driven gear') + ' profile DXF',
          'Closed millimetre reference contours; finish functional surfaces.',
          role + '-1to1.dxf',
          'application/dxf',
          gearProfileDxf(pinion),
        ),
      ];
    }),
  ];
}
