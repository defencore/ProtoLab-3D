import { isGuided, guidedLayout } from './lib/guided-layout';
import { guidedPciePlan } from './lib/guided-routing';
import { guidedNoseProfile } from './lib/guided-profile';
import { cameraCablePlans } from './lib/csi';
import { hasOV9281, opticalLayout } from './lib/optical-layout';
import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
import {
  geometry,
  dimensions,
  python,
  configuredPieces,
  layout,
  outerRadius,
  initializeGeometry,
  csiCablePlan,
} from './lib/model';
export {
  configuredPieces,
  libraries,
  layout,
  ethernetKeepout,
  serviceKeepout,
  shellShape,
  outerRadius,
  piHoles,
  shoulderFit,
  csiRoutingReserve,
  csiCablePlan,
} from './lib/model';
export {
  tpuCarrierShape,
  tpuHousingShape,
  tpuCoordinates,
  internalWindowRetainerShape,
} from './lib/tpu';
export {
  structuralCoordinates,
  structuralBodyAnchorAngles,
  structuralFrameShape,
  structuralHousingShape,
  structuralWallContactRibs,
} from './lib/structural';
export { equipmentFastenerMounts, equipmentRailSpecs, barrierShape } from './lib/equipment-mounts';
export { windowMountCoordinates, windowRetainerServicePoses } from './lib/window-mount';
export {
  accessoryCoordinates,
  accessoryDeviceSpecs,
  accessoryPrintedParts,
  accessoryServiceSpec,
  accessoryServiceKeepouts,
  accessoryHardwareSpecs,
  accessoryDriverKeepouts,
} from './lib/accessory-mounts';
export { printingRotations } from './lib/printing-poses';
export {
  rearCableCenters,
  rearCableRoutingKeepouts,
  rearCableGrommetShape,
} from './lib/cable-feedthroughs';
const part: PartDefinition = {
  id: 'rocket-camera-nose',
  name: 'Removable camera and Pi 5 nose cassette',
  browseFamily: { id: 'rocket-nose-cone', label: 'Rocket nose cone' },
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'camera',
  complexity: 'CSI / Pi 5 / 3S UPS / NVMe / GPS / finder',
  preview: 'worker',
  description:
    'Rocket nose with a removable camera, computer, storage and three-cell power cassette, with nose-facing Ethernet service access and camera-specific optical housings.',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'camera nose cone',
    'Raspberry Pi 5',
    'CSI',
    'OV9281-110',
    '21653',
    'dual camera',
    'Waveshare',
    'UPS Module 3S',
    'NVMe',
    'Ethernet',
    'removable cassette',
    '90 86',
    'JHE42B',
    'ZX908',
    'GPS tracker',
    'cable feedthrough',
  ],
  product: product as ProductProfile,
  defaults,
  parameters,
  presets: presets as Preset[],
  updateParameters(p, key) {
    if (key === 'cameraSetup' && p.packaging === 'structural-ogive')
      return {
        ...p,
        noseLength: 140,
        shoulderLength: isGuided(p) ? 98 : 94,
        wall: isGuided(p) ? 3 : 2.4,
        shoulderClearance: isGuided(p) ? 0.2 : 0.4,
      };
    if (key !== 'packaging') return p;
    const target =
      presets.find(
        (model) =>
          model.parameters.packaging === p.packaging &&
          model.parameters.cameraSetup ===
            (p.packaging === 'structural-ogive' ? p.cameraSetup : 'camera-19') &&
          model.parameters.tubeOD === p.tubeOD,
      ) ?? presets.find((model) => model.parameters.packaging === p.packaging);
    return target ? { ...p, ...target.parameters } : p;
  },
  catalogSelection: [],
  presetMatchKeys: ['cameraSetup', 'packaging', 'tubeOD', 'tubeID', 'shoulderLength'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Complete housing and installed cassette.',
    },
    {
      id: 'cutaway',
      label: 'Housing separated for inspection',
      description:
        'Move the fixed housing sideways to reveal the cassette. Native export retains the complete assembled housing.',
    },
    {
      id: 'extracted',
      label: 'Cassette extracted for service',
      description:
        'Release the cassette anchors and withdraw the complete cage rearward; Ethernet faces the optical end.',
    },
    {
      id: 'print-layout',
      label: 'For 3D printing',
      description:
        'Printed parts only, separated by 8 mm and placed on Z=0 in their preparation orientations. Check material, local bridging and printer bed layout in your slicer.',
    },
  ],
  initializeGeometry,
  validate(p, state) {
    const errors: string[] = [];
    for (const f of parameters) {
      const v = p[f.key];
      if (
        f.type === 'number' &&
        (typeof v !== 'number' || !Number.isFinite(v) || v < f.min! || v > f.max!)
      )
        errors.push(`${f.label} is outside its supported finite range.`);
    }
    if (errors.length) return errors;
    if (!['camera-19', 'ov9281', 'dual'].includes(String(p.cameraSetup)))
      return ['Choose a supported camera installation.'];
    const a = layout(p);
    if (a.guided && (a.tubeOD !== 90 || a.tubeID !== 86))
      errors.push('The guided prewired cassette currently supports the measured 90/86 mm tube.');
    if (a.guided && a.shoulderLength < 98)
      errors.push('Allow 98 mm insertion for the common cage and rear cable passages.');
    if (a.guided && (a.wall !== 3 || p.shoulderClearance !== 0.2))
      errors.push(
        'The guided prototype uses 3 mm normal shell stock and an 85.8 mm shoulder for the 86 mm bore (0.2 mm diametral clearance).',
      );
    if (a.guided && guidedPciePlan(p).slack < 0)
      errors.push('The routed PCIe lead exceeds the measured 40 mm / 13 mm free budget.');
    if (hasOV9281(p) && (!a.structural || a.tubeOD !== 90 || a.tubeID !== 86))
      errors.push(
        'The OV9281 camera layouts currently require the structural 90/86 mm configuration.',
      );
    if (hasOV9281(p))
      for (const cable of cameraCablePlans(p))
        if (cable.slack < 0)
          errors.push(
            `${cable.id} requires ${cable.totalLength.toFixed(2)} mm, exceeding the selected ${cable.availableLength} mm lead.`,
          );
    if (!['tandem', 'sandwich', 'tpu-compact', 'structural-ogive'].includes(String(p.packaging)))
      errors.push('Choose one-piece TPU, tandem or sandwich equipment arrangement.');
    if (a.shoulderLength < (a.tpu || a.structural ? 94 : a.compact ? 100 : 220))
      errors.push(
        a.tpu || a.structural
          ? 'TPU packaging needs at least 94 mm insertion length.'
          : a.compact
            ? 'Sandwich packaging needs at least 100 mm shoulder length.'
            : 'Tandem packaging needs at least 220 mm shoulder length.',
      );
    if (!['assembled', 'cutaway', 'extracted', 'print-layout'].includes(state))
      errors.push('Choose a supported inspection state.');
    if (a.tubeOD - a.tubeID < 2) errors.push('Keep at least 1 mm of mating tube wall.');
    if (a.shoulderID < (a.structural ? 79.2 : a.tpu ? 82.8 : a.compact ? 97 : 80.5))
      errors.push(
        a.structural
          ? 'The structural frame needs at least 79.2 mm clear insertion bore.'
          : a.tpu
            ? 'The TPU insert needs at least 82.8 mm clear inside diameter for this equipment layout.'
            : a.compact
              ? 'The sandwich stack needs at least 97 mm inner shoulder diameter; choose a wider measured tube or tandem packaging.'
              : 'The inner shoulder must provide at least 80.5 mm clear diameter for the tandem cassette and fasteners.',
      );
    if (a.tpu && (a.wall < 1 || a.wall > 1.5))
      errors.push(
        'TPU skin allowance must be between 1 and 1.5 mm; qualify the selected material and print.',
      );
    if (!a.tpu && !a.structural && a.wall < 1.6)
      errors.push('The rigid layouts need at least 1.6 mm radial allowance.');
    if (a.tpu && a.noseLength < 72.05)
      errors.push(
        'Use at least 72.05 mm nose length to keep the camera rear clip beyond the 35 mm Ethernet corridor.',
      );
    if (a.structural && (a.wall < 2.4 || a.wall > 3))
      errors.push('Use 2.4 to 3 mm radial allowance for the PETG structural layout.');
    if (a.structural && a.noseLength < 140)
      errors.push('The supported structural layout needs at least 140 mm nose body length.');
    if (a.structural && a.noseLength + a.shoulderLength + (a.guided ? 2 : 6) > 240 + 1e-8)
      errors.push(
        'The complete structural nose, insertion shoulder and optical projection must not exceed 240 mm.',
      );
    if (a.tpu && outerRadius(p, 12) - a.wall - a.shoulderOD / 2 < 0.2)
      errors.push(
        'The short lens collar needs at least 0.2 mm radial clearance around the TPU insert.',
      );
    if (
      !a.structural &&
      outerRadius(p, a.cameraZ + (a.tpu ? 13.2 : 14)) - a.wall <
        (a.internalWindow ? 15.5 : a.tpu ? 17 : 22.5)
    )
      errors.push(
        'Increase tube diameter or shorten the nose to retain 0.5 mm around the split camera clamp.',
      );
    return errors;
  },
  composition: (p) => ({
    components: configuredPieces(p, 'assembled').map((piece) => piece.component),
    issues: [
      ...(isGuided(p)
        ? [
            'The measured 40 mm PCIe lead has 13 mm beyond the adapter edge. Confirm the actual folds, contact marks and insertion before printing production parts.',
          ]
        : []),
      isGuided(p)
        ? 'Confirm the delivered CSI camera and TPU lens-shroud fit; this execution has no protective glass.'
        : 'Select the actual CSI camera, supported cable, optical window material and measured fits.',
      'Release the power wiring, insulation, battery restraint, cooling and all attachment loads before use.',
    ],
  }),
  buildGeometry: (p, s) => geometry(p, s),
  buildExportGeometry: (p, s) => geometry(p, s === 'cutaway' ? 'assembled' : s, true),
  python,
  dimensions,
  exportDimensions: (p, s) => dimensions(p, s === 'cutaway' ? 'assembled' : s),
  assessment: (p) => {
    const a = layout(p);
    const cable = a.structural ? cameraCablePlans(p)[0] : undefined;
    if (a.guided) {
      const pci = guidedPciePlan(p),
        profile = guidedNoseProfile(p),
        caseLength = profile.tipZ + a.shoulderLength;
      return [
        'One bench-wired cassette: formed TPU pockets locate the electronics inside two common PETG cage halves. Close the cage, connect power through the GPIO/UPS service openings and test the complete bench-wired cassette before inserting it camera-first into the continuous outer case.',
        `Aluminium tube 90/86 mm; ${(2 * profile.receiverRadius).toFixed(1)} mm shoulder diameter and ${p.shoulderLength} mm insertion. The rounded housing ends at Z${profile.tipZ}; case and overall envelope are ${caseLength} mm. The objective remains at that front datum. The exterior meets the D${p.tubeOD} tube without an added collar.`,
        'Both single-camera cartridges use the centered X=Y=0 optical axis and common case/cage interface. Pi, UPS, adapter and SSD retain their source-qualified placements; Ethernet faces the nose through a separate service corridor.',
        'The adapter bare rear face bears on a 4.2 mm TPU insulating divider, with the SSD facing away from the UPS. The common cage provides rigid capture while TPU separates the electronics from PETG; corrected UPS sockets, header and BOOT retain working space.',
        `40 mm PCIe lead: measured 27 mm adapter-side / 13 mm free. Authored free path with Pi insertion allowance ${pci.freeLengthWithInsertion.toFixed(2)} mm; remaining ${pci.freeSlack.toFixed(2)} mm. Verify the actual cable folds and matching triangle marks.`,
        `${cable!.availableLength} mm camera lead: longest-edge route plus ends ${cable!.totalLength.toFixed(2)} mm; remaining ${cable!.slack.toFixed(2)} mm. Bend and twist limits remain cable-specific.`,
        'The common case has a centered optical opening in a tangent circular cap, with a 3 mm normal wall and no flat annular crown. The selected camera has a fitted TPU shroud and a positive rear air-load stop; keep the rear cable/latch access open and the shroud behind the objective.',
        'The same four M4 tube fasteners positively locate the case and cassette. Two accessible cage joints replace individual board screw stacks; one M3 keeper retains the tracker/finder plate, and the source SSD retainer remains. Printed interlocks and broad stops carry restraint rather than small flexible latches.',
        `Print the case tip down (${caseLength} mm), the base on its broad back, the cover rear up (233 mm) and the accessory keeper rear up (52.5 mm). Broad V-shaped and fan roots support the cover. Review remaining roof bridges and overhangs in the slicer.`,
        'Inspect each exported preparation pose, material settings and local bridges in the slicer. Current layer and assembly reviews remain source-specific prototype checks.',
        'CAD fit and assembly checks do not qualify 15 kg lifting, 250 m/s flight, deployment shock, cooling or printed material strength.',
      ];
    }
    return [
      `Mating tube ${p.tubeOD}/${p.tubeID} mm; shoulder OD ${a.shoulderOD.toFixed(2)}, clear ID ${a.shoulderID.toFixed(2)}, insertion ${p.shoulderLength} mm.`,
      a.structural
        ? 'Three broad longitudinal PETG ribs bear against the sampled inner nose wall from Z32 to Z100, with nominal zero radial gap. Full-depth TPU dovetails, broad Pi side channels and a continuous UPS cover seat in the PETG frame. The window ring retains direct backing. Overall installed length is limited to 240 mm. Qualify printed wall fit, service friction, static lifting, angular and impact loads on the actual build.'
        : a.tpu
          ? 'One-piece TPU structural insert: integrated 1.2 mm divider, board clips, cell bands and slide-in camera cage. Pi-to-adapter spacing is 17 mm. The short lens shell has no deep second wall around the equipment.'
          : a.compact
            ? 'Sandwich arrangement: UPS and cells are 126 mm forward of the tandem layout. The shared mounting frame keeps the computer and power module in one short axial region; no complete mass/CG calculation is implied.'
            : 'Tandem arrangement keeps the UPS behind the computer to fit the 90/86 mm tube. The long shoulder holds both equipment regions.',
      `Pi 5 Ethernet opening faces +Z, towards the nose. An 18 x 20 x 35 mm plug corridor is kept clear. Cassette service withdrawal is ${a.extraction} mm towards -Z.`,
      hasOV9281(p)
        ? `${opticalLayout(p).dual ? 'Two forward-facing cameras, each with a separate D23 / D17 dome' : 'One forward-facing Waveshare OV9281-110'}. The broad optical crown and removable PETG backing deck locate the fitted TPU pockets; Pi 5 moves forward 8 mm. OV9281 objective front Z=140 mm. Supplier FOV is 93 horizontal, 70 vertical, 110 diagonal; the entrance pupil and delivered glass require optical verification.`
        : a.structural
          ? `Camera rear face Z=${a.cameraZ.toFixed(1)}; objective front extends 2.0 mm into the dome with a nominal 0.58 mm radial glass clearance. The TPU camera sleeve is open behind the rear MIPI latch. A 110-degree housing-clearance cone is reserved; actual optics and refraction require the selected camera and glass.`
          : `Camera rear face Z=${a.cameraZ.toFixed(1)}; objective ends 1.5 mm below the window underside. CSI routing and optical field of view require delivered-component verification.`,
      ...(hasOV9281(p)
        ? cameraCablePlans(p).map(
            (route) =>
              `${route.id} on ${route.port}: ${route.availableLength} mm lead; calculated longest-edge route with 10 mm connector allowance ${route.totalLength.toFixed(1)} mm, remaining ${route.slack.toFixed(1)} mm. Minimum centreline bend radius ${route.minBendRadius.toFixed(1)} mm; confirm the actual cable's bend/twist limits and contact orientation.`,
          )
        : []),
      ...(cable
        ? [
            `Pi and NVMe are shifted 2.2 mm sideways to make room for a continuous 2.2 mm insulating barrier to the UPS. NVMe keeps 5.53 mm PCB-face spacing. ${hasOV9281(p) ? 'Separate 100 mm CSI routes are listed above.' : `The authored CSI route needs ${cable.totalLength.toFixed(1)} mm including 10 mm end allowance, leaving ${cable.slack.toFixed(1)} mm from a 100 mm cable; verify actual connectors and permitted flex/twist.`}`,
            'One common flat TPU bed and a simple removable clamp locate JHE42B and the existing 35 x 20 x 4.5 mm ZX908 reference. Both printed parts have flat preparation poses; one screw retains the clamp. Verify delivered tracker dimensions, ports and antenna before printing. No separate tracker battery is specified.',
            'Two offset D6 rear cable passages have a linked flush TPU insert and integral frame tie-slot anchors. The nose remains secured in the tube during deployment. The parachute attaches to the separate shackle farther down the tube; retain cable slack clear of its harness. Opening-shock strength remains unqualified.',
          ]
        : []),
    ];
  },
  notes:
    'Printed PETG structure and replaceable TPU electronics contacts. The original 19 mm and OV9281 single-camera structural executions share a centered case/cage interface with fitted camera cartridges and rear air-load stops, formed TPU electronics contacts and UPS-side PCIe/NVMe. The dual-camera execution retains its separate window assembly. Inspection states preserve physical identity and BOM; the printing state changes preparation placements only. Source board dimensions remain fixed. Manufactured fits, cable routing and load capacity require the documented prototype checks.',
  sources: [
    {
      label: 'Bambu Lab P2S: official 256 × 256 × 256 mm build volume',
      url: 'https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/',
    },
    {
      label:
        'Factory-applied serviceable mechanical thread locking; qualify the selected small-screw execution',
      url: 'https://nylok.com/pre-applied-processes/mechanical-locking/nylok-blue-nylon-torq-patch-tuflok/',
    },
    {
      label: 'Waveshare UPS Module 3S',
      url: 'https://www.waveshare.com/product/ups-module-3s.htm',
    },
    {
      label: 'Raspberry Pi 5 product and interfaces',
      url: 'https://www.raspberrypi.com/products/raspberry-pi-5/',
    },
  ],
};
export default part;
