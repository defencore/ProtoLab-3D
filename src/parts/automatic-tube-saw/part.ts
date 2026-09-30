import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults } from './configurator';
import presets from './presets.json';
import { machinePieces } from './lib/model';
import { geometry, python, dimensions } from './lib/assembly';
import { moduleName } from './lib/modules';
import { engineering, issues } from './lib/engineering';
import { budgetFor, releaseBlockers } from './lib/bom';
const part: PartDefinition = {
  id: 'automatic-tube-saw',
  name: 'Automatic tube saw',
  category: 'MACHINE TOOLS',
  subgroup: 'CUTTING MACHINES',
  description:
    'Modular DDCS v4.1 aluminium tube saw with a flat stock table, standalone, assisted or automatic feed, a physical new-bar stop, independent stock ledger, emergency-stop stations and guided pneumatic clamps, a slotted steel table, vertical/side tooling, contact length encoder, powered take-away and a tilting short-part receiver. Engineering work in progress; not released for manufacture.',
  keywords: ['automatic', 'saw', 'ULMS', 'Metallkraft', 'aluminium', 'tube', 'conveyor', 'cutting'],
  icon: 'gear',
  complexity: 'Automatic cutting cell',
  parameters,
  defaults,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Ready · guarded',
      description: 'Saw down, stock held; short preview of incoming stock.',
    },
    {
      id: 'modules',
      label: 'Separate modules',
      description:
        'Exploded docking interfaces: standalone saw, measuring feeder, loading station and discharge.',
    },
    {
      id: 'mitre-setup',
      label: 'Mitre setup - blade deep parked',
      description:
        'Power isolated, blade below the fixed table. Exchange keyed throat/bridge insert, dock and lock outfeed to the angle scale; never yaw a raised blade.',
    },
    {
      id: 'mechanism',
      label: 'Mechanisms · guards hidden',
      description: 'Inspection view only; guards are required for operation.',
    },
    {
      id: 'bar-change',
      label: 'Stock change · separator closed',
      description:
        'Next bar blocked; old remnant removal and stable empty-zone confirmation precede a new stock record.',
    },
    {
      id: 'feeding',
      label: '1 · Feed to length',
      description: 'Gripper closed, fixed clamps open, saw below the workpiece.',
    },
    {
      id: 'clamping',
      label: '2 · Clamp stock and offcut',
      description: 'Both sides held before enabling the cutting stroke.',
    },
    {
      id: 'cutting',
      label: '3 · Saw raised',
      description: 'Blade at end of cutting stroke; both fixed clamps stay closed.',
    },
    {
      id: 'retracting',
      label: '4 · Saw returning',
      description: 'Clamps remain closed throughout saw return.',
    },
    {
      id: 'releasing',
      label: '5 · Release side jaw',
      description: 'Saw down; top rolling shoe uses reduced pressure for take-away.',
    },
    {
      id: 'transferring',
      label: '6 · Powered take-away',
      description: 'Belt carries the cut piece to the receiver; stock stays clamped.',
    },
    {
      id: 'sorting',
      label: '7 · Box / roller outlet',
      description: 'Short parts tilt into the enclosed chute; long parts continue on the rollers.',
    },
    {
      id: 'rejecting',
      label: 'Scrap reject · separate bin',
      description:
        'Long receiver tips a classified remnant through the selected scrap chute. Tail-clear and complete passage proofs are required.',
    },
    {
      id: 'stroke',
      label: 'Stroke inspection',
      description:
        'Inspect intermediate saw positions with the stroke slider; not an operating mode.',
    },
    {
      id: 'hood-open',
      label: 'Hood open · setup',
      description: 'Isolated setup pose; saw parked. Never an automatic operating state.',
    },
    {
      id: 'returning',
      label: '8 · Return feed carriage',
      description: 'Feed gripper open; fixed stock clamp preserves the datum.',
    },
  ],
  validate: issues,
  buildGeometry: (p, s) => geometry(machinePieces(p, s)),
  dimensions: (p, s) => dimensions(machinePieces(p, s)),
  python: (p, s) => {
    const pieces = machinePieces(p, s);
    return (
      python(pieces) +
      '\nimport json\ncomponent_groups = ' +
      JSON.stringify(pieces.map((q) => [moduleName(q), q.group])) +
      '\ncomponent_manufactured = [' +
      pieces.map((q) => (q.procurement === 'MAKE' ? 'True' : 'False')).join(',') +
      ']\ncomponent_metadata = json.loads(' +
      JSON.stringify(
        JSON.stringify(
          pieces.map((q) => ({
            Procurement: q.procurement,
            Process: q.process,
            ReleaseStatus: 'ENGINEERING_REVIEW_REQUIRED',
          })),
        ),
      ) +
      ')'
    );
  },
  assessment: (p) => {
    const e = engineering(p);
    return [
      `Control: DDCS v4.1 X/Z motion + process PLC/encoder I/O + independent safety circuit. Infeed: ${p.feedMode}.`,
      `Stock ledger: ${e.partsRemaining} further complete parts; ${e.usableStock.toFixed(1)} mm usable after trim, previous consumption and ${e.endRemainder} mm retained tail. Never join remnants to the next bar.`,
      `Stock identity: ${Number(p.clearDwell)} ms stable empty confirmation; a separate faced datum and bar ID after every reload. ${p.feedMode === 'automatic' ? `Admission gate spacing ${Number(p.stockGap)} mm.` : 'Operator initiates each new load.'}`,
      `First facing advance ${e.facingAdvance.toFixed(2)} mm including kerf; trim waste is routed to scrap before production counts begin.`,
      p.feedMode === 'manual'
        ? 'Standalone: load and clamp under the hood at standstill, close/lock and start the cut; wait for spindle standstill before unloading.'
        : 'Each bar has its own leading-edge datum and physical-tail check. Purge remnants through the long receiver into a separate scrap bin before admitting another bar.',
      'Mitre setup: park blade centre at Z570 (top Z820), exchange the stationary keyed throat insert and slide the complete outfeed module by 0–70 mm; lock before cutting.',
      'Stock bottom stays at Z900: flat steel infeed/cutting surface, flush throat and belt nose bridge; side gripper has no protruding lower cradle.',
      `Feed: ${e.advance.toFixed(3)} mm = finished length + ${e.kerfAxial.toFixed(3)} mm axial kerf; minimum length at this angle ${e.minimumLength} mm.`,
      `ACE50 estimated top clamp thrust ${e.clampForce.toFixed(0)} N after 20% loss; side ${e.sideForce.toFixed(0)} N; conservative friction hold ${e.holding.toFixed(0)} N per clamp; grip margin ${e.gripMargin.toFixed(2)} against the entered cutting load. ${e.gripMargin < 1.5 ? 'INSUFFICIENT 1.5 margin: fixture/load review required.' : 'Assumption-based screening only.'}`,
      `Feed drive estimate ${e.feedForce.toFixed(0)} N; stock grip margin ${e.feedGripMargin.toFixed(2)}. Independent contact encoder compares actual material travel with feed-axis travel; calibration and contact loss still require testing.`,
      `Material measuring wheel: 200 mm/rev, 1000 ppr, quadrature increment ${e.encoderResolution.toFixed(2)} mm. Stop window ±${Number(p.measuredTolerance).toFixed(2)} mm; disagreement trip ${Number(p.slipLimit).toFixed(2)} mm. These are process settings, not verified accuracy.`,
      `Offcut route: ${p.feedMode === 'manual' ? 'operator unload at standstill' : e.shortPart ? 'tilting receiver → enclosed chute → box' : 'level receiver → roller outlet'}. Box route maximum 200 mm; narrow toe shoes are repositioned near the kerf during isolated setup.`,
      `Rolling shoe transfer thrust ${e.transferForce.toFixed(0)} N at ${Number(p.transferPressure).toFixed(1)} bar. Verify belt traction, tube ovalisation and regulator changeover before acceptance.`,
      `Accuracy allocation ±${e.accuracy.toFixed(2)} mm versus target ±0.50 mm; pulse increment ${e.pulseDistance.toFixed(4)} mm is resolution, not accuracy.`,
      `Spindle rim speed ${e.rimSpeed.toFixed(1)} m/s; 80:100 pulley ratio requires approximately ${e.motorHz.toFixed(1)} Hz. Confirm blade rating and usable cutting feed.`,
      `Full incoming stock mass ${e.stockMass.toFixed(1)} kg; retained tail allowance ${e.endRemainder} mm.`,
      `Budget allocation $${budgetFor(String(p.feedMode))}, excluding quotation changes, delivery, taxes and contingency: above the $4000 target.`,
      'NOT RELEASED FOR MANUFACTURE: ' + releaseBlockers.join(' '),
    ];
  },
  notes:
    'This package exposes dimensions, sequencing and the remaining engineering work explicitly. It does not establish a safe or production-ready machine. Metal threads are nominal surfaces with callouts. All manufactured components require toleranced drawings and verification.',
  sources: [
    {
      label: 'DDCS v4.1 manufacturer manual',
      url: 'https://cncmaster.org/files/DDCS-V4.1-Users-manual-in-English-V1-20220914.pdf',
    },
    {
      label: 'Schneider XB5AS8444 two-NC emergency stop',
      url: 'https://www.se.com/us/en/product/XB5AS8444/',
    },
    {
      label: 'Kuebler MWE21 contact measuring wheel',
      url: 'https://www.kuebler.com/en/products/measurement/linear-measuring-systems/product-finder/product-details/MWE21',
    },
    {
      label: 'Interroll EC5000 for belt conveyors',
      url: 'https://www.interroll.com/products/rollerdrive/ec5000-crowned-0c-to-40c',
    },
    {
      label: 'OMRON E3Z optical sensor dimensions',
      url: 'https://www.ia.omron.com/products/family/407/dimension.html',
    },
    {
      label: 'Metallkraft ULMS 500 operating principle and capacity benchmark',
      url: 'https://www.stuermer-maschinen.de/schweisstechnik/metallbearbeitungsmaschinen-metallkreissaegen/ulms-500-3627500/',
    },
    {
      label: 'HIWIN guideway dimensions',
      url: 'https://www.hiwin.com/wp-content/uploads/Linear_Guideway-E.pdf',
    },
  ],
};
export default part;
