import { Vector3 } from 'three';
import { motorDimensions as dimensions2845 } from '../../surpass-2845/part';
import { motorDimensions as dimensions2838 } from '../../surpass-2838/part';
import type { FabricationFile, Parameters } from '../../../core/types';
import { eskdIdentity } from '../../../core/eskd';
import single, {
  pieces as sourcePieces,
  libraries as sourceLibraries,
  fixed as sourceFixed,
} from '../../tr8-geared-rocker-actuator/part';
import { defaults, neutralParameters, angleKeys } from '../configurator';
import { pieces, libraries, channelTransform, panelTransform, roleIds } from './model';
import {
  fixed,
  channelAngle,
  driveParameters,
  sourceTransform,
  enclosureDiameter,
  endDiscWireCenters,
  endDiscWireStations,
  standMountPattern,
  standMountStations,
} from './layout';
import {
  sheetPanel,
  sheetPanelFlatPattern,
  sheetPanelClampPositions,
  sheetPanelMotorSide,
} from './sheet-panel';
import { sheetPanelDxf, sheetPanelSvg } from './sheet-fabrication';
import { coverValues, coverMountStations } from './plastic-cover';
import { endDiscFlatPattern, lighteningValues } from './lightening';
import { cableRouting } from './cable-routing';

const prefix = 'TR8x4-four-output-geared';
const lever = sourceFixed.lever;
const channelIds = ['a', 'b', 'c', 'd'] as const;
type Component = ReturnType<typeof pieces>[number]['component'];
type BomGroup = {
  libraryId: string;
  configuration: string;
  name: string;
  state: string;
  supply: string;
  quantity: number;
  occurrences: string[];
  component: Component;
};
const csv = (rows: unknown[][]) =>
  rows
    .map((row) =>
      row.map((value) => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(','),
    )
    .join('\n') + '\n';
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
function panelExecutionVariants(bom: BomGroup[]) {
  return bom
    .filter((row) => row.occurrences.some((id) => id.endsWith('-' + roleIds.case)))
    .map((row, executionIndex) => {
      const index = channelIds.findIndex((channel) =>
        row.occurrences.some((id) => id.startsWith(channel + '-')),
      );
      if (index < 0) throw new Error('A panel execution requires its actual channel occurrence.');
      const fold: 1 | -1 = index % 2 === 0 ? 1 : -1;
      const motorSide = sheetPanelMotorSide(index);
      return {
        id: `panel-execution-${executionIndex + 1}`,
        configuration: row.configuration,
        name: row.name,
        quantity: row.quantity,
        occurrences: row.occurrences,
        channels: channelIds
          .filter((channel) => row.occurrences.some((id) => id.startsWith(channel + '-')))
          .map((channel) => channel.toUpperCase()),
        fold,
        direction: fold === 1 ? 'up' : 'down',
        motorSide,
        flatPattern: sheetPanelFlatPattern(fold, motorSide),
      };
    });
}
function panelCutPatterns(variants: ReturnType<typeof panelExecutionVariants>) {
  const groups = new Map<
    string,
    {
      id: string;
      quantity: number;
      executionIds: string[];
      pattern: {
        thickness: number;
        material: string;
        loops: ReturnType<typeof sheetPanelFlatPattern>['loops'];
        circles: ReturnType<typeof sheetPanelFlatPattern>['circles'];
        bends: [];
      };
    }
  >();
  for (const execution of variants) {
    const flat = execution.flatPattern;
    const pattern = {
      thickness: flat.thickness,
      material: flat.material,
      loops: flat.loops,
      circles: flat.circles,
      bends: [] as [],
    };
    const key = JSON.stringify(pattern);
    let group = groups.get(key);
    if (!group) {
      group = { id: `panel-cut-${groups.size + 1}`, quantity: 0, executionIds: [], pattern };
      groups.set(key, group);
    }
    group.quantity += execution.quantity;
    group.executionIds.push(execution.id);
  }
  return [...groups.values()];
}

function selectedMotor(p: Parameters) {
  const component = sourcePieces(
    { ...single.defaults, motor: p.motor ?? defaults.motor, outputAngle: 0 },
    'drive',
  ).find((piece) =>
    ['surpass-2838', 'surpass-2845'].includes(piece.component.libraryId),
  )!.component;
  const definition = sourceLibraries.find((part) => part.id === component.libraryId)!;
  const dimensions = component.libraryId === 'surpass-2838' ? dimensions2838 : dimensions2845;
  const tangentExtent = Math.max(sourceFixed.outputX, dimensions.length - sourceFixed.outputX);
  const transverseExtent = fixed.channelRadius + dimensions.diameter / 2;
  return {
    model: String(component.parameters.model),
    name: component.name,
    libraryId: component.libraryId,
    state: component.state,
    supply: component.supply,
    quantity: 4,
    bodyEnvelope: { diameter: dimensions.diameter, length: dimensions.length },
    nominalCanCylinderDiameter: 2 * Math.hypot(tangentExtent, transverseExtent),
    envelopeScope:
      'Nominal motor-can envelope about the common axis. These motor-only dimensions do not define the covered assembly cylinder; use the actual cover and full-assembly dimensions. Nominal can dimensions and native fit checks are separate from a load rating.',
    source: definition.sources?.[0]?.url ?? '',
    preparation: component.manufacturing,
  };
}

function metalLightening(p: Parameters) {
  const values = lighteningValues(p);
  const assumedDensity = 2.68;
  const grams = (volume: number) => (volume * assumedDensity) / 1000;
  return {
    ...values,
    assumedDensity: { value: assumedDensity, units: 'g/cm³', material: '5052-O aluminium' },
    nominalMassReductionGrams: {
      perPanel: grams(values.panels.nominalRemovedVolumePerPanel),
      fourPanels: grams(values.panels.quantity * values.panels.nominalRemovedVolumePerPanel),
      perDisc: grams(values.discs.nominalRemovedVolumePerDisc),
      twoDiscs: grams(values.discs.quantity * values.discs.nominalRemovedVolumePerDisc),
      total: grams(values.nominalReliefVolume),
    },
    calculationScope:
      'Exact dedicated through-relief volume multiplied by an assumed density of 2.68 g/cm³. The comparison retains the current cable ports and all other geometry, suppressing only the dedicated lightening cuts. It is a nominal CAD mass reduction, not a finished assembly weight or load rating.',
  };
}

/** Actual physical definitions, independent of all four inspection angles. */
export function bomRows(p: Parameters = defaults): BomGroup[] {
  const groups = new Map<string, BomGroup>();
  for (const { component } of pieces(neutralParameters(p), 'assembled')) {
    const definition = libraries.find((part) => part.id === component.libraryId)!;
    const identity = eskdIdentity(
      definition,
      component.parameters,
      component.state,
      component.presetId,
      { ...component, designation: component.procurement?.designation ?? '', revision: 'A' },
    );
    const key = identity.configurationKey + '/' + component.supply;
    let group = groups.get(key);
    if (!group) {
      group = {
        libraryId: component.libraryId,
        configuration: identity.configurationKey,
        name: component.procurement?.designation ?? component.name,
        state: component.state,
        supply: component.supply,
        quantity: 0,
        occurrences: [],
        component,
      };
      groups.set(key, group);
    }
    group.quantity += component.quantity;
    group.occurrences.push(component.id);
  }
  return [...groups.values()];
}

export function caseManifest(p: Parameters = defaults) {
  const bom = bomRows(p);
  const standStations = standMountStations();
  const clampPlacements = pieces(neutralParameters(p), 'assembled')
    .filter(({ component }) => component.id.startsWith(roleIds.caseBolt + '-'))
    .map(({ component }) => ({
      occurrence: component.id,
      translation: component.placement.translation,
      rotation: component.placement.rotation,
    }));
  const panels = bom.filter((row) => row.occurrences.some((id) => id.endsWith('-' + roleIds.case)));
  const cross = bom.find((row) => row.occurrences.includes(roleIds.cross));
  const discs = bom.filter((row) =>
    row.occurrences.some((id) => id.endsWith('-' + roleIds.endDisc)),
  );
  if (
    panels.reduce((sum, panel) => sum + panel.quantity, 0) !== 4 ||
    !cross ||
    cross.quantity !== 1 ||
    discs.length !== 1 ||
    discs[0].quantity !== 2
  )
    throw new Error(
      'The assembly requires four actual panel occurrences, two end discs and one separate central bearing joint.',
    );
  const hardwareCount = (role: string) =>
    bom.reduce(
      (sum, row) =>
        sum +
        row.occurrences.filter((id) => id.startsWith(role + '-') || id.endsWith('-' + role)).length,
      0,
    );
  return {
    units: 'mm',
    detail: 'Four formed panels with plain bearing holes and actual motor-seat faces',
    quantity: 4,
    configurations: panels.map((panel) => ({
      configuration: panel.configuration,
      name: panel.name,
      quantity: panel.quantity,
      occurrences: panel.occurrences,
    })),
    occurrences: panels.flatMap((panel) => panel.occurrences),
    material: 'Aluminium alloy 5052-O',
    process: 'Laser cutting, bending and secondary seat finishing',
    lightening: metalLightening(p),
    canonicalWall: {
      normalSpan: [
        fixed.wallRadius - fixed.panelThickness / 2,
        fixed.wallRadius + fixed.panelThickness / 2,
      ],
      tangentSpan: [-fixed.panelHalfWidth, fixed.panelHalfWidth],
      zSpan: [fixed.panelLow, fixed.panelHigh],
      wallThickness: fixed.panelThickness,
    },
    forming: {
      ...sheetPanel,
      blankQuantity: 4,
      cutPatterns: panelCutPatterns(panelExecutionVariants(bom)),
      variants: panelExecutionVariants(bom),
      coordinates: 'Flat u is panel tangent T; flat v is developed Z.',
      bendMarks:
        'BEND_UP and BEND_DOWN are forming marks viewed from the indicated blank face. Cut only CUT contours; qualify the neutral-axis allowance and springback with the selected tooling.',
      secondaryOperations:
        'Finish the plain Ø10.02 bearing holes without chamfers or flange recesses. The MF106 flange remains outside the 3 mm sheet. Machine motor countersinks only from the execution-specific installation face. Inspect bearing datums after shell welding.',
    },
    panelPlacementFrames: channelIds.map((channel, index) => ({
      panel: channel.toUpperCase(),
      level: index % 2 === 0 ? 'Upper X pair' : 'Lower Y pair',
      normalReversed: index % 2 !== 0,
      matrixColumnMajor: panelTransform(index).toArray(),
    })),
    outputPlacementFrames: channelIds.map((channel, index) => ({
      channel: channel.toUpperCase(),
      radialAxisDegrees: index * 90,
      matrixColumnMajor: channelTransform(index).toArray(),
    })),
    drivePlacementFrames: channelIds.map((channel, index) => ({
      channel: channel.toUpperCase(),
      sourceAngleSign: index % 2 === 0 ? -1 : 1,
      matrixColumnMajor: channelTransform(index)
        .multiply(sourceTransform(index % 2 === 0))
        .toArray(),
    })),
    externalClamps: {
      boltOccurrences: hardwareCount(roleIds.caseBolt),
      nutOccurrences: hardwareCount(roleIds.caseNut),
      bolt: `M3×${fixed.clampLength} low-head screw`,
      nut: 'M3 DIN934',
      boltLength: fixed.clampLength,
      tabStack: 2 * fixed.tabThickness,
      axisPositions: sheetPanelClampPositions(),
      placements: clampPlacements,
      direction: 'Vertical through the integral interlocking tabs',
    },
    standMounting: {
      count: standStations.length,
      perPanel: standMountPattern.length,
      axisReference: 'The local output-shaft axis defines T=0 and Z=0',
      referenceAxisTZ: [0, 0],
      layoutDescription:
        'Two lateral holes at Z=0 and three centerline holes at T=0 above the output axis',
      boundsCenterTZ: [
        (Math.min(...standMountPattern.map(([t]) => t)) +
          Math.max(...standMountPattern.map(([t]) => t))) /
          2,
        (Math.min(...standMountPattern.map(([, z]) => z)) +
          Math.max(...standMountPattern.map(([, z]) => z))) /
          2,
      ],
      spansTZ: [
        Math.max(...standMountPattern.map(([t]) => t)) -
          Math.min(...standMountPattern.map(([t]) => t)),
        Math.max(...standMountPattern.map(([, z]) => z)) -
          Math.min(...standMountPattern.map(([, z]) => z)),
      ],
      integratedEarStock: sheetPanel.standEars,
      thread: `M${fixed.standThreadDiameter}×${fixed.standThreadPitch}`,
      threadLength: fixed.panelThickness,
      pilotDiameter: fixed.standPilotDiameter,
      accessPassageDiameter: fixed.standPassageDiameter,
      localPattern: standMountPattern,
      stations: standStations,
      existingCoverThreads: coverMountStations(p).length,
      totalMetalPanelM3Threads: standStations.length + coverMountStations(p).length,
      includesStand: false,
      includesStandHardware: false,
      passagePurpose: 'M3 shank clearance only; stand-bolt heads remain outside the PETG',
      instruction:
        'Laser-cut the five-point sketch pilots and shallow ears from the same 3 mm blank, then tap the through threads. Use the output axis as coordinate reference, retaining the original bearing foot and separate cover threads. PETG passages admit M3 shanks only; bolt heads remain outside. The external stand and its fasteners are not part of this mechanism BOM.',
    },
    endCaps: {
      quantity: 2,
      configuration: discs[0].configuration,
      occurrences: discs[0].occurrences,
      diameter: enclosureDiameter(p),
      thickness: fixed.endDiscThickness,
      tongue: {
        length: fixed.endTongueLength,
        span: sheetPanel.endTongueSpan,
        width: fixed.panelThickness,
        profile: 'Rectangular laser-cut tongue in the constant-thickness sheet',
      },
      throughSlot: { span: fixed.endSlotSpan, width: fixed.endSlotWidth, through: true },
      weldProjection: fixed.endTongueLength - fixed.endDiscThickness,
      joining:
        'Weld the projecting tongues to the end discs while the shell is bare, before fitting the separate bearing joint, bearings, shafts, nuts, forks, motors or gears. Both main panels and end discs use5052-O.',
      wireHoles: {
        quantityPerDisc: endDiscWireCenters().length,
        diameter: fixed.endWireHoleDiameter,
        pitchRadius: fixed.endWireHoleRadius,
        patternAngleDegrees: fixed.endWirePortAngle,
        positions: endDiscWireCenters(),
        worldStations: endDiscWireStations(),
        chamferBothFaces: fixed.endWireChamfer,
      },
      upperInsideZ: fixed.panelHigh - fixed.endTongueLength,
      upperOutsideZ: fixed.panelHigh - fixed.endTongueLength + fixed.endDiscThickness,
      placement:
        'The lower disc is indexed 90 degrees without flipping the blank. Both ends retain the same global positive cable-port clock. Use the world inner/outer port stations for routing; both discs share one manufactured geometry.',
      metalFrameTipHeight: 2 * fixed.panelHigh,
    },
    functionalJoint: {
      role: roleIds.cross,
      quantity: 1,
      configuration: cross.configuration,
      classification: 'Separate four-bearing shaft connector; not a main housing wall',
      manufacturing: cross.component.manufacturing,
    },
    housingArchitecture:
      'Four 3 mm 5052-O panels form two opposite-bend pairs. Plain bearing holes have no flange recess or chamfer. Motor countersinks follow each installed motor face. Finished configurations and cutting-pattern groups are derived from the actual parts; no identical-part requirement is imposed.',
    requirements: [
      'Laser-cut the four panel blanks from their actual cutting patterns. Form the two opposite-bend pairs. Keep bearing holes plain Ø10.02 without recesses or chamfers; finish motor countersinks only on the actual motor side. Cut two matching-alloy through-slotted end discs with cable holes.',
      'Cut the dedicated panel and end-disc lightening contours from the actual DXFs. Preserve the modeled lands around bores, taps, welding slots, bend tangencies and outer edges; qualify application loads separately.',
      `Retain the circular central bearing foot, diameter ${2 * sheetPanel.bearingFootRadius} mm and bottom Z=${fixed.panelLow} mm. Its ${2 * sheetPanel.bearingHoleRadius} mm plain bearing hole leaves ${sheetPanel.bearingFreeEdgeLand.toFixed(2)} mm nominal metal to the free edge. This dimension applies to the central foot.`,
      `Interlock the upper X panels with the lower Y panels, then clamp their ${2 * fixed.tabThickness} mm tab stack with four external M3×${fixed.clampLength} screws and nuts before installing motors or gears.`,
      'Fit the separate central bearing connector and the shaft/bearing hardware before completing the source-drive installation through the open wall regions.',
      'Qualify bend allowance, springback, rolling direction and bend reliefs with the specified5052-O sheet and tooling. Finish bearing fits, slot clearances, fixture datums and clamp preload from the formed assembly.',
    ],
  };
}

/** Nut shift is measured along each local source screw axis, not along global Z. */
export function motionTable(p: Parameters = defaults) {
  return channelIds.map((id, index) => {
    const angle = channelAngle(p, index),
      radians = (angle * Math.PI) / 180;
    const sourceAngle = Number(driveParameters(p, index).outputAngle);
    const nutShiftAlongScrew = -lever * Math.tan((sourceAngle * Math.PI) / 180),
      frame = channelTransform(index).multiply(sourceTransform(index % 2 === 0));
    const screwAxis = new Vector3(1, 0, 0).transformDirection(frame);
    const nutCenter = new Vector3(sourceFixed.outputX + nutShiftAlongScrew, 0, 0).applyMatrix4(
      frame,
    );
    return {
      channel: id.toUpperCase(),
      angle,
      sourceAngle,
      radialAxisDegrees: index * 90,
      nutShiftAlongScrew,
      nutCenter: nutCenter.toArray(),
      screwAxis: screwAxis.toArray(),
      screwTurns: -nutShiftAlongScrew / 4,
      motorTurns: nutShiftAlongScrew / 4,
      followerRadius: lever / Math.cos(radians),
    };
  });
}

export function machiningSchedule(p: Parameters = defaults) {
  const bom = bomRows(p);
  const printedRows = bom.filter((row) =>
    row.component.manufacturing?.processes.includes('printing'),
  );
  const nut = bom.find((row) => row.occurrences.some((id) => id.endsWith('-' + roleIds.nut)));
  const outputShaft = bom.find((row) => row.occurrences.some((id) => id.endsWith('-output-shaft')));
  return {
    units: 'mm and degrees',
    coordinateSystem:
      'Fixed radial outputs are +X, +Y, -X and -Y. After exchanging the lower A/C drives, source screw directions are +Y, -X, -Y and +X. A/C use the negative commanded source angle; B/D use the positive commanded source angle. Actual source frames are listed in the cage manifest.',
    selectedMotor: selectedMotor(p),
    case: caseManifest(p),
    cableRouting: {
      ...cableRouting(p),
      preparation:
        'Confirm the purchased motor lead-exit clock and rear boot, then clock its leads into the modeled inboard rear collector. Lay motor and reserve leads in their assigned open cover grooves before fitting the quadrants. Preserve the separate upper/lower reserve service entries and keep leads outside moving-hardware pockets and stand-shank passages.',
      assemblyScope:
        'Cable routes are geometry reservations. Cables, connectors, strain relief and the external harness are not modeled or included in the mechanism BOM. Check actual cable bend limits, shared port packing, edge protection and covered travel before use.',
    },
    covers: {
      ...coverValues(p),
      material: 'PETG',
      processes: ['printing'],
      quantity: printedRows.reduce((sum, row) => sum + row.quantity, 0),
      outputPorts: { quantity: 4, diameter: coverValues(p).accessDiameter },
      mounts: coverMountStations(p),
      standAccess: {
        count: standMountStations().length,
        diameter: fixed.standPassageDiameter,
        stationIds: standMountStations().map((station) => station.id),
        purpose: 'M3 shanks only; external stand-bolt heads do not pass into the PETG',
      },
      attachment: `Attach each indexed quadrant with one DIN7991 M3×${coverValues(p).screwLength} screw at its API mounting station; the actual BOM records the supplied configuration.`,
      assembly:
        'Install the four model-indexed pocketed quadrants after internal assembly and travel checks. Preserve the acoustic overlaps and nominal running gaps. Keep the output ports and cable passages clear, then recheck covered travel and motor temperature.',
      printRequirements:
        'Use dense PETG perimeters and 100% infill in modeled closed regions around the clearance pockets. Preserve intentional motor/gear windows without thin films; minimum-land requirements apply only to closed regions. Keep the existing motor positions, nominal gap fits and overlapping joints. Qualify print fits and duty-cycle temperatures. Acoustic attenuation requires measurement; no dB rating is assigned.',
    },
    printedParts: printedRows.map((row) => ({
      configuration: row.configuration,
      name: row.name,
      quantity: row.quantity,
      occurrences: row.occurrences,
      manufacturing: row.component.manufacturing,
      instruction:
        'Use the actual native pocketed detail and its manufacturing route. Print dense PETG perimeters and 100% infill in modeled solid regions, preserving clearance pockets, intentional film-free windows, acoustic overlaps and gap fits. Qualify orientation, supports, shrinkage and attachment fits.',
    })),
    centralJoint: {
      role: roleIds.cross,
      quantity: 1,
      purpose: 'Four inward-shaft bearing connector',
      bearing: 'EZO MR52ZZ 2×5×2.5',
      nominalBlank: '13×13×8 envelope clipped by Ø16',
      endRadius: 6.5,
      accessDiameter: 2 * fixed.coreWindowRadius,
    },
    sourceDrive: {
      package: single.id,
      quantity: 4,
      workingThread: {
        designation: 'TR8x4(P2) RH',
        lead: 4,
        pitch: 2,
        starts: 2,
        length: sourceFixed.threadEnd - sourceFixed.threadStart,
        sourceAxialSpan: [sourceFixed.threadStart, sourceFixed.threadEnd],
      },
      source:
        'Use the public source TR8 thread, prepared motor bodies, bearings, retainers and shaft-pin interfaces. Machine the quad screw journals and retaining grooves to the local bearing-retention schedule. The quad also has local 22-tooth gears, countersunk motor screws and inward motor placement; the standalone source package remains unchanged.',
      bearingRetention: {
        coordinateSystem: 'Local source X',
        bearingCenters: [-2.1, 33.1],
        clipCenters: [-3.9, 34.9],
        grooveCenters: [-3.92, 34.92],
        frontNeckSpan: [-5.24, -3.6],
        frontJournalSpan: [-3.6, 0],
        rearJournalSpan: [31, 34.6],
        rearNeckSpan: [34.6, 36.6],
        plainPanelHoleDiameter: 10.02,
        flangePosition: 'Outside the sheet; no bearing recess or chamfer',
        nominalGearClipGap: 0.2,
      },
      gears: {
        teeth: fixed.gearTeeth,
        module: 1,
        pressureAngle: 20,
        ratio: '1:1',
        faceWidth: 5,
        outsideDiameter: fixed.gearTeeth + 2,
        centerDistance: fixed.motorSpacing,
        sourceAxialToothFace: [
          sourceFixed.gearStart + fixed.gearFaceShift,
          sourceFixed.gearEnd + fixed.gearFaceShift,
        ],
        hubAxialSpan: [-15, sourceFixed.gearStart + fixed.gearFaceShift + 0.05],
        pinionMeshPhaseDegrees: 180 / fixed.gearTeeth,
        hubDiameter: 12,
        pinStationFromMotorFace: 13,
        screwPin: 'DIN1481 Ø2×10',
        motorPin: 'DIN1481 Ø1×10',
      },
    },
    motorMount: {
      quantity: 8,
      preset: 'gvyntok-040-070-001',
      designation: 'DIN7991 M3×5 countersunk',
      totalLength: 5,
      headDiameter: 6,
      headHeight: 1.7,
      countersinkAngle: 90,
      headRimHeight: 0.2,
      nominalMotorInsertion: 2,
      sourceBoltCenterX: -0.5,
      sourceMotorY: fixed.motorSpacing,
      countersinkFaces: panelExecutionVariants(bom).map((execution) => ({
        configuration: execution.configuration,
        channels: execution.channels,
        faceN: execution.flatPattern.motorCountersinkFaceN,
        side: execution.motorSide,
      })),
      instruction:
        'Use the complete sourced preset; overall length includes the head. Match the conical seat and cylindrical rim only on the actual screw-entry face, while retaining2 mm nominal motor insertion. No reverse-side motor seat is added.',
    },
    nut: {
      quantity: 4,
      sourcePackage: single.id,
      geometry: 'New compact body using the exact public source female thread and end reliefs',
      material: 'Bearing bronze',
      length: fixed.nutLength,
      width: fixed.nutWidth,
      height: fixed.nutHeight,
      effectiveFemaleEngagement: fixed.nutLength - 2 * fixed.nutEndReliefDepth,
      workingStroke: sourceFixed.threadEnd - sourceFixed.threadStart - sourceFixed.nutLength,
      sourceStopCenters: [
        sourceFixed.threadStart + sourceFixed.nutLength / 2,
        sourceFixed.threadEnd - sourceFixed.nutLength / 2,
      ],
      femaleThreadPhaseRadians: (2 * Math.PI * sourceFixed.outputX) / 4,
      manufacturing: nut?.component.manufacturing,
      instruction:
        'Machine the 16×12×12 body and two follower pins using the public source female thread. Set stop contact at ±20 degrees with 15 mm total travel; retain the source end-face bearing clearances.',
    },
    fork: {
      quantity: 4,
      material: 'Steel; grade and heat treatment to drawing',
      process: 'One-piece three-dimensional CNC milling and drilling',
      lever,
      hubRadiusStation: fixed.forkHubR,
      hubDiameter: fixed.forkHubDiameter,
      cheekWidth: 2 * fixed.forkArmHalfWidth,
      webWidth: 2 * fixed.forkWebHalfWidth,
      eyeEntryPinRecess: (fixed.forkHubDiameter - 10) / 2,
      webSidePinRecess: fixed.forkWebEnd - 10 / 2,
      fixationGuideBore: {
        diameter: 2,
        axis: 'Local arm Y; vertical global Z at neutral',
        start: -6.1,
        end: fixed.forkWebEnd + 0.1,
        instruction: 'Drill through the eye and straight arm to the opposite web face.',
      },
      followerAxisRadius: fixed.channelRadius,
      cheekThickness: fixed.forkThickness,
      cheekRadialSpans: [
        [fixed.forkInnerStart, fixed.forkInnerStart + fixed.forkThickness],
        [fixed.forkOuterStart, fixed.forkOuterStart + fixed.forkThickness],
      ],
      followerPinProjection:
        fixed.followerEnd - (fixed.forkOuterStart + fixed.forkThickness - fixed.channelRadius),
      slot: {
        width: fixed.slotWidth,
        closedEndCenter: fixed.slotRoot,
        mouth: fixed.slotMouth,
        lipEnd: fixed.forkTip,
        neutralPinEndClearance:
          fixed.lever - fixed.followerDiameter / 2 - (fixed.slotRoot - fixed.slotWidth / 2),
      },
      travelGeometry: {
        maximumPinCenter: fixed.lever / Math.cos((fixed.outputLimit * Math.PI) / 180),
        maximumPinEdge:
          fixed.lever / Math.cos((fixed.outputLimit * Math.PI) / 180) + fixed.followerDiameter / 2,
        lipCaptureMargin:
          fixed.forkTip -
          fixed.lever / Math.cos((fixed.outputLimit * Math.PI) / 180) -
          fixed.followerDiameter / 2,
        straightMouthMargin:
          fixed.slotMouth -
          fixed.lever / Math.cos((fixed.outputLimit * Math.PI) / 180) -
          fixed.followerDiameter / 2,
        scope: 'Nominal kinematic distances; not a load or fatigue rating.',
      },
      straightEyeArm: {
        thickness: fixed.forkArmThickness,
        radialSpan: [
          fixed.forkHubR - fixed.forkArmThickness / 2,
          fixed.forkHubR + fixed.forkArmThickness / 2,
        ],
        eyeDiameter: fixed.forkHubDiameter,
        webJoinWidth: 2 * fixed.forkWebHalfWidth,
        transition:
          'Straight tangent sides join the eye to the web in the same full-thickness plane.',
      },
      crossWeb: {
        width: 2 * fixed.forkWebHalfWidth,
        length: fixed.forkWebEnd - fixed.forkCrossWebStart,
        cornerRadius: 1,
        leverSpan: [fixed.forkCrossWebStart, fixed.forkWebEnd],
      },
      nominalBearingGap: fixed.outerBearingStart - (fixed.forkHubR + fixed.forkHubLength / 2),
      nominalNodeMargin: fixed.forkHubR - fixed.forkHubLength / 2 - 6.5,
      fixation:
        'One cross-pinned hub station per output shaft; pin access is vertical global Z at neutral',
      instruction:
        'Machine the straight eye arm in the same 6 mm plane as the hub, joining the clevis web and both cheeks as one CNC detail. Terminate both cheeks flush with the shaft-facing web plane at local Y=9.8 and use R1 rear corners. Finish the slots and shaft opening; set the fork index and match-drill the single hub/shaft pin joint.',
      layoutFields: Object.fromEntries(
        Object.entries(fixed).filter(([key]) => /^fork|^slot/.test(key)),
      ),
    },
    outputShaft: {
      quantity: 4,
      material: 'Steel; grade and heat treatment to drawing',
      axis: 'Radial outward',
      head: {
        startRadius: fixed.neckEnd,
        faceRadius: fixed.headEnd,
        thickness: fixed.headEnd - fixed.neckEnd,
        backDiameter: fixed.headBackDiameter,
        backSpan: [fixed.neckEnd, fixed.headReliefEnd],
        rimDiameter: fixed.headDiameter,
        rimSpan: [fixed.headReliefEnd, fixed.headEnd],
        threadStartRadius: fixed.headThreadStart,
        boltCircleDiameter: 2 * fixed.headHoleRadius,
        headHoleCount: 4,
        headHoleThread: 'M3',
        nominalBearingGap: fixed.neckEnd - fixed.outerBearingEnd,
        nominalForkRimGap: fixed.headReliefEnd - (fixed.forkOuterStart + fixed.forkThickness),
      },
      manufacturing: outputShaft?.component.manufacturing,
      instruction:
        'Turn coaxial bearing journals and the stepped output head: Ø19 back, Ø20 front rim, 5 mm total thickness. Preserve four M3 PCD14 locations, 0.25 mm nominal bearing/head clearance and the actual fork/rim clearance in the schedule. Keep small inner retention features outside the Ø6 torque path; finish head holes and the cross-pin station to their assigned fits.',
      layoutFields: Object.fromEntries(
        Object.entries(fixed).filter(([key]) => /shaft|Bearing|Groove|Clip|head|neck/i.test(key)),
      ),
    },
    bearingInterfaces: bom
      .filter((row) => ['ball-bearing', 'flanged-ball-bearing'].includes(row.libraryId))
      .map((row) => ({
        quantity: row.quantity,
        designation: row.name,
        preset: row.component.presetId,
        parameters: row.component.parameters,
        source: row.component.procurement?.source,
      })),
    assemblyStatus:
      'Proposed route: confirm side-window insertion, fixtures and the5052-O weld procedure with native insertion checks and production preparation.',
    assembly: [
      'Laser-cut the actual 3 mm 5052-O panel blanks and form the two opposite-bend pairs, keep bearing holes plain and finish motor countersinks only on their installed sides, and cut two matching-alloy through-slotted end discs with cable holes. Machine the separate bearing connector, four CNC forks, radial shafts and compact source-thread nuts.',
      `Tap ${standMountStations().length} additional M${fixed.standThreadDiameter}×${fixed.standThreadPitch} through threads at the stand stations, ${standMountPattern.length} per panel. Retain the four separate cover threads and inspect the threads after welding. The external stand and its fasteners are not included.`,
      `Interlock the bare panels and fit the four M3×${fixed.clampLength} waist clamps and nuts before drive hardware blocks the vertical tools. Fit the end discs with the ${fixed.endTongueLength} mm tongues projecting ${fixed.endTongueLength - fixed.endDiscThickness} mm through the slots, then weld the bare5052-O shell. Inspect alignment and bearing seats after welding.`,
      'Load forks through the SIDE windows after shell welding: in the base fork frame, shift Z by -15 mm, move radially inward from an outside +X offset of40 mm to0, then lift to neutral Z=0. Carry that path through each output frame; native insertion verification is required.',
      'Feed each nut separately through a side window so its follower pins enter the open fork mouths. Fit the output bearings, fixture the central bearing connector, insert the radial shafts and install the vertical fork pins at neutral.',
      'Helically feed each bare TR8 screw through its located nut using the4 mm lead before fitting its screw bearings or gears; then install screw bearings and retention.',
      'Install motors and pinned gears after the internal hardware, retaining A/C negative and B/D positive source-angle signs and all shaft cross-drill stations. Use the local 22-tooth gears and countersunk motor screws. Route cables through the chamfered end-disc holes.',
      'Check every output through -20 to +20 degrees, including stops, bearing end float, fork and connector clearance, gear clearance and control limits.',
      'Lay the four motor leads from the inboard rear collectors into their assigned end-port grooves. Use the separate upper/lower reserve grooves from their inner service entries; no reserve passage crosses the Z=0 stand-shank barrier. Confirm the actual motor boot, cable bend limits and shared end-port packing. Cables and connectors are external to the mechanism BOM.',
      'Fit the four pocketed PETG quadrants after internal assembly and travel checks, preserving the modeled overlapping seams and laid cable routes. Use the selected cover hardware and API mounting stations from the BOM. Check output and cable clearances, complete travel and motor temperature with the covers installed.',
    ],
    fixedLayout: fixed,
  };
}

export function fabricationFiles(p: Parameters): FabricationFile[] {
  const motor = selectedMotor(p),
    bom = bomRows(p),
    schedule = machiningSchedule(p);
  const bomCsv = csv([
    [
      'Quantity',
      'Component',
      'Library ID',
      'State',
      'Supply',
      'Physical configuration',
      'Occurrence IDs',
      'Source',
      'Material',
      'Blank',
      'Manufacturing processes',
    ],
    ...bom.map((row) => [
      row.quantity,
      row.name,
      row.libraryId,
      row.state,
      row.supply,
      row.configuration,
      row.occurrences.join('; '),
      row.component.procurement?.source ?? '',
      row.component.manufacturing?.material ?? '',
      row.component.manufacturing?.blank ?? '',
      row.component.manufacturing?.processes.join('; ') ?? '',
    ]),
  ]);
  const sweeps = [
    ['Selected pose', p],
    ...[-20, 0, 20].map((angle) => [
      `All ${angle} degrees`,
      { ...p, ...Object.fromEntries(angleKeys.map((key) => [key, angle])) },
    ]),
  ] as [string, Parameters][];
  const motionCsv = csv([
    [
      'Scenario',
      'Channel',
      'Output angle deg',
      'Source drive angle deg',
      'Radial axis deg',
      'Nut shift along screw mm',
      'Nut center X mm',
      'Nut center Y mm',
      'Nut center Z mm',
      'Screw axis X',
      'Screw axis Y',
      'Screw axis Z',
      'Screw turns',
      'Motor turns',
      'Follower radius mm',
    ],
    ...sweeps.flatMap(([name, pose]) =>
      motionTable(pose).map((row) => [
        name,
        row.channel,
        row.angle,
        row.sourceAngle,
        row.radialAxisDegrees,
        row.nutShiftAlongScrew,
        ...row.nutCenter,
        ...row.screwAxis,
        row.screwTurns,
        row.motorTurns,
        row.followerRadius,
      ]),
    ),
  ]);
  const panelExecutions = panelExecutionVariants(bom);
  return [
    ...panelCutPatterns(panelExecutions).map((cut) => ({
      id: `${cut.id}-dxf`,
      label: `Panel cutting pattern · quantity ${cut.quantity}`,
      description:
        'Exact laser contours in millimetres. Executions share this file only when their actual cutting contours and holes coincide; no bend or finishing cuts are included.',
      name: `${prefix}-${cut.id}.dxf`,
      type: 'application/dxf',
      content: sheetPanelDxf(cut.pattern),
    })),
    ...panelExecutions.map((execution) => ({
      id: `${execution.id}-svg`,
      label: `${execution.name} · quantity ${execution.quantity}`,
      description: `${execution.channels.join('/')} panel execution: 90-degree fold ${execution.direction}; DIN7991 countersinks only from N=${execution.flatPattern.motorCountersinkFaceN}. Bearings use plain Ø10.02 holes without recesses or chamfers. Scale 1:1.`,
      name: `${prefix}-${execution.id}.svg`,
      type: 'image/svg+xml',
      content: sheetPanelSvg(
        execution.flatPattern,
        `TR8x4 ${execution.id} · fold ${execution.direction} · motor seats N=${execution.flatPattern.motorCountersinkFaceN} · quantity ${execution.quantity}`,
      ),
    })),
    {
      id: 'end-disc-dxf',
      label: 'End-disc cutting pattern · quantity 2',
      description:
        'Exact millimetre CUT contours for two identical end discs: outside circle, welding slots, cable ports and dedicated lightening holes. Cable-port chamfers are secondary finishing operations.',
      name: `${prefix}-end-disc-cut.dxf`,
      type: 'application/dxf',
      content: sheetPanelDxf(endDiscFlatPattern(p)),
    },
    {
      id: 'end-disc-svg',
      label: 'End-disc cutting drawing · quantity 2',
      description:
        'Scale 1:1 cutting drawing for the selected end-disc diameter, including relief holes and cable ports; finish the cable-port chamfers after cutting.',
      name: `${prefix}-end-disc-cut.svg`,
      type: 'image/svg+xml',
      content: sheetPanelSvg(endDiscFlatPattern(p), 'TR8x4 end-disc cutting pattern · quantity 2'),
    },
    {
      id: 'bom-csv',
      label: 'Physical bill of materials',
      description:
        'Actual physical definitions: actual finished panel configurations and quantities, one end-disc configuration×2, welded end closures and one central bearing joint.',
      name: `${prefix}-${motor.model}-BOM.csv`,
      type: 'text/csv',
      content: bomCsv,
    },
    {
      id: 'motion-csv',
      label: 'Four-channel motion table',
      description:
        'Independent pose, tangential screw axes and global nut positions at the stroke checks.',
      name: `${prefix}-motion.csv`,
      type: 'text/csv',
      content: motionCsv,
    },
    {
      id: 'fabrication-schedule',
      label: 'Forming, machining, printing and assembly schedule',
      description:
        'Selected drives, compact nuts, one-piece forks, radial shafts, formed panels and PETG cover printing routes with their actual component quantities.',
      name: `${prefix}-fabrication-schedule.json`,
      type: 'application/json',
      content: json(schedule),
    },
    {
      id: 'case-manifest',
      label: 'Main panels and slotted end discs',
      description:
        'Two opposite-bend panel pairs, two identical slotted caps, waist clamps, welded end closures and the separate functional shaft joint.',
      name: `${prefix}-case-quarters.json`,
      type: 'application/json',
      content: json(schedule.case),
    },
    {
      id: 'assembly-notes',
      label: 'Assembly instructions',
      description: 'Preparation and assembly of the selected four-output execution.',
      name: `${prefix}-assembly.txt`,
      type: 'text/plain',
      content: `${prefix}\nSelected motor: ${motor.name}; quantity 4.\n\n${schedule.assembly.map((step, index) => `${index + 1}. ${step}`).join('\n\n')}\n\nUse the layered flat pattern and bend schedule for the formed panels; use native CAD for their finished seats and the separate bearing connector, forks, shafts and compact source-thread nuts.\n`,
    },
  ];
}
