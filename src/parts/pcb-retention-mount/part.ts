import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import detail from '../manufactured-detail/part';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters, catalogSelection, updateParameters } from './configurator';
import { components, pieces, layout, validate } from './lib/model';
import profile from './product.json';
import presets from './presets.json';
const libraries = [detail];
const part: PartDefinition = {
  id: 'pcb-retention-mount',
  browseLabel: 'PCB retention mount',
  name: 'Configurable PCB carrier and sliding locks',
  category: 'ELECTRONICS MOUNTS',
  subgroup: 'MODULE ADAPTERS',
  icon: 'circuit',
  preview: 'worker',
  complexity: 'Parametric mounting prototype',
  description:
    'Reusable carrier for one to four mixed-size PCBs, broad open triangular pockets, optional removable locks and side or underside anti-flex supports.',
  keywords: [
    'PCB',
    'board mount',
    'PCB carrier',
    'PCB holder',
    'electronics mounting',
    'sliding lock',
    'board retention',
    'anti-flex support',
    'triangular guide',
  ],
  defaults,
  parameters,
  catalogSelection,
  updateParameters,
  presets: presets as Preset[],
  presetMatchKeys: [
    'boardCount',
    'board1Length',
    'board1Width',
    'seatHeight',
    'lockEnabled',
    'antiFlexSupports',
  ],
  product: profile as ProductProfile,
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description:
        'Configured carrier and optional bridges in their canonical installed positions.',
    },
    {
      id: 'service',
      label: 'PCB service',
      description:
        'Removable bridges withdrawn after release; boards remain as reference outlines.',
      availableWhen: (p) => p.lockEnabled === true,
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Bridge inspection separation without changes to physical part definitions.',
      availableWhen: (p) => p.lockEnabled === true,
    },
    {
      id: 'print',
      label: 'For 3D printing',
      description: 'Carrier underside and bridge roofs on Z=0; PCB references omitted.',
    },
  ],
  identityParameters(p) {
    const physical = { ...p };
    delete physical.showReferences;
    for (let i = Number(p.boardCount) + 1; i <= 4; i++) {
      delete physical[`board${i}Length`];
      delete physical[`board${i}Width`];
    }
    if (!['under', 'both'].includes(String(p.antiFlexSupports))) delete physical.supportPitch;
    if (!p.mountingHoles) {
      delete physical.mountingHoleDiameter;
      delete physical.mountingEdgeInset;
    }
    if (Number(p.boardCount) === 1 && !p.lockEnabled) delete physical.boardGap;
    return physical;
  },
  validate,
  composition: (p) => ({
    components: components(p),
    issues: [
      'Authored mounting template. Confirm actual PCB outlines, bare-substrate thickness, reserved edge lands and all underside solder/component keepouts before fabrication.',
      'Qualify polymer, build orientation, carrier attachment hardware, support spans, working loads, creep, vibration and release cycles. No load or life rating is assigned.',
    ],
  }),
  buildGeometry: (p, s) => componentGeometry(libraries, pieces(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, pieces(p, s, false), true),
  python: (p, s) => componentPython(libraries, pieces(p, s, false)),
  dimensions: (p, s) => componentDimensions(libraries, pieces(p, s)),
  exportDimensions: (p, s) => componentDimensions(libraries, pieces(p, s, false)),
  assessment(p) {
    const d = layout(p);
    return [
      `${d.count} PCB(s), underside Z=${d.seatZ} mm; carrier ${d.width.toFixed(1)} × ${d.depth.toFixed(1)} × ${d.baseZ} mm. First PCB begins at X=0 and all board centerlines are Y=0.`,
      p.mountingHoles
        ? `Four Ø${p.mountingHoleDiameter} through holes; X/Y pitch ${d.holePitchX.toFixed(1)} / ${d.holePitchY.toFixed(1)} mm, coordinates referenced to the carrier underside datum.`
        : 'No carrier mounting holes; use the documented native feature interface and verify the chosen host attachment.',
      d.lock
        ? 'Seat boards in outer envelopes first, lift each release leaf 0.9 mm, insert the bridge at Y−3 mm, slide +Y3 mm and release. Remove adjacent bridges before servicing a middle PCB.'
        : 'Open-top corner guides locate the boards; direct vertical insertion/removal is available. There is no positive upward retention.',
      'Side strips and underside ribs are optional contact features. Match them to real bare support lands; no support location is safe for every populated PCB.',
      ...(['under', 'both'].includes(d.mode)
        ? d.boards.map((b) => {
            const spacing =
              (b.length - 16) / Math.max(1, Math.ceil((b.length - 16) / Number(p.supportPitch)));
            return `PCB ${b.index}: underside rib center spacing ${spacing.toFixed(1)} mm, clear span ${Math.max(0, spacing - 2.4).toFixed(1)} mm, X end overhang 6.8 mm and Y edge relief 6 mm. These are geometric spans, not a stiffness rating.`;
          })
        : []),
      ...(['side', 'both'].includes(d.mode)
        ? d.boards.map(
            (b) =>
              `PCB ${b.index}: side strips leave ${(b.width - 8).toFixed(1)} mm of central transverse span. Check actual PCB deformation for the application loads.`,
          )
        : []),
    ];
  },
  notes:
    'Reusable native geometry retains the same broad open triangular pocket and sliding-bayonet bridge kernels as field-daq-enclosure. Boards are reference outlines only. Inner pockets have no roof or X stop, preserving board service travel; lock-disabled pockets permit direct upward removal. Actual mounted electronics, solder clearance, attachment hardware and load qualification remain application responsibilities.',
  sources: [
    {
      label: 'Protolabs Network enclosure and component layout guidance',
      url: 'https://www.hubs.com/knowledge-base/enclosure-design-3d-printing-step-step-guide/',
    },
    {
      label: 'Formlabs printed snap-fit design and material guidance',
      url: 'https://formlabs.com/blog/designing-3d-printed-snap-fit-enclosures/',
    },
  ],
};
export default part;
