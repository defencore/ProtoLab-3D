import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { componentDimensions, componentGeometry } from '../../core/assembly/detail-instances';
import single from '../tr8-geared-rocker-actuator/part';
import { defaults, parameters, motorModels, angleKeys, neutralParameters } from './configurator';
import { pieces, libraries } from './lib/model';
import { nativePython } from './lib/native';
import { fabricationFiles } from './lib/fabrication';
import product from './product.json';
import presetData from './presets.json';
import { Mesh, MeshStandardMaterial } from 'three';

export { pieces, libraries, channelTransform, panelTransform, roleIds } from './lib/model';
export {
  fixed,
  layout,
  channelAngle,
  driveParameters,
  enclosureDiameter,
  standMountPattern,
  standMountStations,
  endDiscTransform,
  endDiscWireCenters,
  endDiscWireStations,
} from './lib/layout';
export { fabricationFiles, machiningSchedule, motionTable, caseManifest } from './lib/fabrication';
export { motorModels, motorChoices } from './configurator';
export { sheetPanel, sheetPanelFlatPattern, sheetPanelClampPositions } from './lib/sheet-panel';
export { sheetPanelDxf, sheetPanelSvg } from './lib/sheet-fabrication';
export {
  lighteningValues,
  panelLighteningValues,
  endDiscLighteningValues,
  endDiscFlatPattern,
  endDiscLighteningCircles,
} from './lib/lightening';
export { coverValues, coverSectionShape, coverMountStations } from './lib/plastic-cover';
export { cableRouting, cableRoutingCuts, cableRouteTool } from './lib/cable-routing';

const part: PartDefinition = {
  id: 'tr8-quad-geared-rocker-actuator',
  name: 'TR8×4(P2) rotary actuator · Surpass Hobby 2838/2845 · 4 outputs · formed aluminium and PETG · ±20°',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'MOTOR ASSEMBLIES',
  icon: 'gear',
  product: product as ProductProfile,
  browseFamily: { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms' },
  description:
    'Four TR8x4 geared channels rotate radial shafts through ±20°. Four dense PETG cover quarters have local pockets and open windows at the closest motor and gear zones, forming a compact Ø76 mm cylinder for 2838 motors or Ø86 mm for 2845. Overlapped seams and close-fitting output collars reduce direct sound paths. Four recessed M3 screws attach the quarters to the metal panels. Twenty additional M3×0.5 panel threads provide stand mounting: three centerline stations and two lateral stations per panel, reached through Ø3.4 shank passages. The relieved metal end discs have the same Ø76/86 outside diameter and enlarged cable ports. The metal panels have rounded lightening contours. Internal PETG grooves route four motor lead sets and provide eight upper/lower reserve wiring paths. Select Without covers to inspect the complete internal mechanism.',
  preview: 'worker',
  complexity: 'Cylindrical covers · four independent outputs',
  keywords: [
    'TR8x4',
    'P2',
    'opposite pairs',
    'quad',
    'four outputs',
    'radial shaft',
    'CNC',
    'laser cutting',
    'sheet bending',
    '5052-O',
    'formed sheet panels',
    'one-sided seats',
    'opposite bends',
    '66 mm',
    'external clamps',
    'slotted end caps',
    'Surpass',
    '2838',
    '2845',
    'MF106',
    'MR52',
    '1:1 gears',
    'fork',
    'central bearing node',
    'PETG',
    'plastic covers',
    'cylindrical housing',
    '75 mm',
    '85 mm',
    'acoustic cover',
    'motor pockets',
  ],
  defaults,
  parameters,
  presets: presetData as Preset[],
  presetMatchKeys: ['motor'],
  identityParameters: neutralParameters,
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description:
        'Complete mechanism enclosed by four pocketed PETG quarters, with four output ports and recessed fasteners.',
    },
    {
      id: 'uncovered',
      label: 'Without covers',
      description:
        'Complete metal mechanism with the plastic covers and their four screws removed.',
    },
    {
      id: 'covers',
      label: 'Plastic covers',
      description:
        'Four pocketed PETG quarters with seam overlaps, integral mounts, four output collars, twenty stand screw shank passages and four recessed M3 screws.',
    },
    {
      id: 'quarter-a',
      label: 'Single housing panel',
      description: 'One canonical main wall panel without hardware or drive components.',
    },
    {
      id: 'housing',
      label: 'Interlocking housing',
      description:
        'Two opposite-bend panel pairs, two identical end caps and their fasteners, shown in their material colors.',
    },
    {
      id: 'center',
      label: 'Central node',
      description:
        'Four small inner bearings, shaft tips and the separate functional bearing cross.',
    },
    {
      id: 'drive',
      label: 'Drive inspection',
      description: 'Four motors, pinned 1:1 gears, lead screws and their bearing retention.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!motorModels.some((choice) => choice.value === p.motor))
      errors.push('Choose a listed Surpass Hobby motor for all four channels.');
    for (const key of angleKeys)
      if (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || Math.abs(Number(p[key])) > 20)
        errors.push(`Output ${key.slice(-1)} angle must be between -20 and +20 degrees.`);
    if (Object.keys(p).some((key) => !['motor', ...angleKeys].includes(key)))
      errors.push('Choose the common motor and four output angles.');
    if (
      !['assembled', 'uncovered', 'covers', 'quarter-a', 'housing', 'center', 'drive'].includes(
        state,
      )
    )
      errors.push('Choose an available inspection state.');
    return errors;
  },
  composition: (p) => ({
    components: pieces(neutralParameters(p), 'assembled').map((piece) => piece.component),
    issues: [],
  }),
  buildGeometry: (p, state) => {
    const model = componentGeometry(libraries, pieces(p, state));
    for (const occurrence of model.children) {
      if (!String(occurrence.userData.occurrenceId).startsWith('cover-section-')) continue;
      occurrence.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          if (!(material instanceof MeshStandardMaterial)) continue;
          material.metalness = 0;
          material.roughness = 0.7;
        }
      });
    }
    return model;
  },
  dimensions: (p, state) => componentDimensions(libraries, pieces(p, state)),
  python: (p, state) => nativePython(pieces(p, state)),
  fabricationFiles,
  notes:
    'Four removable PETG quarters retain solid material in the available zones and use separate pockets for motors, gears, screw/nut travel and the ±20 degree fork sweep. Print dense perimeters and solid infill in these acoustic barrier regions. Overlapped seams and close-fitting output collars reduce direct openings; actual sound reduction and temperature must be measured on the operating assembly. The common cylinder diameter is76 mm for2838 or86 mm for2845, including both welded3 mm aluminium end discs. Disc slots and panel tongues remain functional; four Ø10 cable ports per end are clocked away from the stand screw paths. Rounded relief holes and slots lighten the four metal wall panels and both end discs, preserving functional lands and the end-disc center/rim. Four motor lead routes connect the rear collectors to end ports. Eight broad reserve grooves terminate at inner service pockets and remain split across the central stand-shank barrier. Check purchased motor lead boots and cable bend requirements against the routing data before printing. The four3 mm5052-O metal panels retain plainØ10.02 bearing holes without recesses, one-sided motor countersinks and four tappedM3 cover mount holes. Each panel also has five separate M3×0.5 stand threads, twenty total: three along the centerline above the output and two beside the output at shaft height. The PETG has Ø3.4 shank passages; stand screw heads remain outside the plastic. The output bearings remain at radius17.6 with external flanges; head faces remain at radius24.35 with0.25 mm bearing clearance. Four recessed DIN7991 M3×6 screws attach the cover quarters. The original31 mm TR8x4(P2) working thread,15 mm nut stroke,20.606 mm lever, pinned1:1 gears and four independent±20 degree outputs remain. Without covers shows the complete metal mechanism; Plastic covers shows the removable quarters and their fasteners.',
  sources: [
    {
      label: 'OSHA noise-control manual · enclosure joints and acoustic openings',
      url: 'https://www.osha.gov/otm/section-3-health-hazards/chapter-5',
    },
    {
      label: 'NIOSH engineering noise controls · enclosure and vibration paths',
      url: 'https://www.cdc.gov/niosh/noise/prevent/engineering.html',
    },
    {
      label: 'Yieh 5052 sheet data · annealed O temper and bend-radius table',
      url: 'https://aluminum.yieh.com/Upfiles/EDUp/files/5000%20Series/TDS/AA5052/TDS-YIEH-5052-Coil%20%26%20Sheet.pdf',
    },
    {
      label: 'Atlas 5052 data · temper-dependent bend radii and weldability',
      url: 'https://atlassteels.com.au/wp-content/uploads/2021/08/Aluminium-Alloy-5052-Data-Sheet-24-06-21.pdf',
    },
    {
      label: 'EZO manufacturer miniature-bearing dimension table · MR52ZZ 2×5×2.5',
      url: 'https://www.ezo-brg.co.jp/english/product/result.php?product_category=1',
    },
    {
      label: 'EZO MR52 ZZ · 2×5×2.5 supplier dimensions',
      url: 'https://promtehimport.com.ua/offer/pidshipnik-mr-52-zz-ezo-japan-o7439/',
    },
    ...single.sources!,
  ],
};
export default part;
