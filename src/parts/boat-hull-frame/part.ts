import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import detail from '../manufactured-detail/part';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters } from './configurator';
import {
  cuttingDxf,
  frameStations,
  panels,
  pieces,
  occurrence,
  bottomAt,
  topAt,
} from './lib/model';
import product from './product.json';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'boat-hull-frame',
  name: 'Boat hull frame kit',
  icon: 'wing',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'BOAT HULLS',
  product: product as ProductProfile,
  preview: 'worker',
  complexity: 'Slotted sheet keel and transverse frames',
  description:
    'Cut-sheet model boat skeleton with complementary keel/frame half-laps, perimeter webs and flat manufacturing layout.',
  keywords: [
    'boat',
    'hull',
    'marine',
    'bulkhead',
    'keel',
    'rib',
    'frame',
    'plywood',
    'CNC',
    'laser',
    'sheet',
    'skiff',
    'launch',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  presetMatchKeys: ['length', 'beam', 'depth', 'thickness', 'frameCount'],
  catalogSelection: [],
  validationNotice: 'Frame kit · skin and load checks required',
  states: [
    {
      id: 'assembled',
      label: 'Frame assembly',
      description: 'Keel and transverse frames at their mating half-lap datums.',
    },
    {
      id: 'cut',
      label: 'Flat cutting layout',
      description: 'Every physical panel at Z=0, using the same contours as the DXF.',
    },
    {
      id: 'frame',
      label: 'Middle transverse frame',
      description: 'One midship panel at its installed datum.',
    },
    {
      id: 'keel',
      label: 'Keel',
      description: 'Longitudinal panel with complementary frame slots.',
    },
    {
      id: 'exploded',
      label: 'Separate panels',
      description: 'Inspection offsets only; component fabrication definitions are unchanged.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'cut', 'frame', 'keel', 'exploded'].includes(state))
      errors.push('Choose a frame-kit inspection view.');
    if (!Number.isInteger(+p.frameCount))
      errors.push('Transverse frame count must be a whole number.');
    if (+p.keelHeight / 2 < +p.web)
      errors.push(
        'The half-lap must leave at least one perimeter-web height below each keel slot.',
      );
    if (
      frameStations(p).some(
        (s, i, all) => i > 0 && s.x - all[i - 1].x < 4 * +p.thickness + +p.fitClearance,
      )
    )
      errors.push('Frame spacing must leave material between adjacent keel slots.');
    if (+p.thickness + +p.fitClearance > +p.web)
      errors.push('Slot width must remain smaller than the central web allowance.');
    for (const s of frameStations(p)) {
      if (s.bottom + s.width * 0.35 * Math.tan((+p.deadrise * Math.PI) / 180) + 2 * +p.web >= s.top)
        errors.push('Reduce deadrise/web or increase hull depth to preserve the upper frame.');
      if (s.width * 0.35 < (+p.thickness + +p.fitClearance) / 2 + +p.web)
        errors.push('Bow frame is too narrow for its keel slot and side webs.');
    }
    if (
      [0, ...frameStations(p).map((s) => s.u), 1].some(
        (u) => bottomAt(p, u) + +p.keelHeight + +p.web > topAt(p, u),
      )
    )
      errors.push('Keel height and rocker must remain below the deck with a full upper web.');
    return [...new Set(errors)];
  },
  composition: (p) => ({
    components: panels(p).map((panel) => occurrence(p, panel)),
    issues: [
      'This is an authored structural kit, not a scale copy of a commercial hull. It is independent of Boat hull reference presets.',
      'The kit locates transverse frames on a slotted keel. Skin, gunwales, longitudinal stiffness, transom reinforcement and equipment hardpoints are not included.',
      'Specify stock grade, adhesive and waterproof finish; qualify material, joints, hull loading and buoyancy for the complete build.',
    ],
  }),
  buildGeometry: (p, s) => componentGeometry([detail], pieces(p, s)),
  buildExportGeometry: (p, s) => componentGeometry([detail], pieces(p, s), true),
  python: (p, s) => componentPython([detail], pieces(p, s)),
  dimensions: (p, s) => componentDimensions([detail], pieces(p, s)),
  assessment: (p) => [
    `${p.frameCount} transverse frames plus one keel; ${p.thickness} mm measured stock; slot width ${(+p.thickness + +p.fitClearance).toFixed(2)} mm.`,
    'Complementary half-laps use the same height datum. Width clearance is total across both slot sides; it is not a kerf compensation.',
    'Openings keep a normal perimeter inset and a full central web. Small bow openings are omitted rather than leaving a thin ligament.',
    'Sheet cutting contours are nominal. Apply tool-specific kerf and internal-corner relief in CAM after a fit coupon.',
    'Add a designed skin and longitudinal reinforcement before treating the skeleton as a hull. No waterproofing, flotation or load capacity is assigned.',
  ],
  fabricationFiles: (p) => [
    {
      id: 'cutting-layout',
      label: 'Panel cutting layout',
      description: 'Closed nominal contours and panel labels · mm',
      name: 'boat-frame-cutting.dxf',
      type: 'application/dxf',
      content: cuttingDxf(p),
    },
    {
      id: 'station-table',
      label: 'Frame positions and joints',
      description: 'Station, beam, deck and half-lap heights · CSV',
      name: 'boat-frame-stations.csv',
      type: 'text/csv',
      content:
        'Frame,X mm,Beam mm,Keel bottom mm,Deck mm,Lap height mm,Slot width mm\n' +
        frameStations(p)
          .map((s, i) =>
            [
              i + 1,
              s.x,
              s.width,
              s.bottom,
              s.top,
              s.bottom + +p.keelHeight / 2,
              +p.thickness + +p.fitClearance,
            ].join(','),
          )
          .join('\n'),
    },
  ],
  notes:
    'Authored hard-chine model boat frame kit. X is longitudinal, Y transverse and Z upward; the first station is forward. Frames and keel share complementary half-lap datums. Sheet grade, skin thickness, adhesive, corner relief, complete hull fairing and longitudinal stiffness need a build-specific design. DXF contours are the exact polygonal frame definition; no automatic kerf offset or commercial product identity is assigned.',
};
export default part;
