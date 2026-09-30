import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { machinePieces } from './lib/model';
import { dimensions, geometry, python } from './lib/assembly';
import { engineering, section, TAIL_RESERVE, SHUTTLE_TRAVEL } from './lib/layout';
import { sources } from './lib/procurement';

const part: PartDefinition = {
  id: 'automatic-band-saw',
  name: 'Automatic band saw',
  category: 'MACHINE TOOLS',
  subgroup: 'CUTTING MACHINES',
  icon: 'gear',
  complexity: '90 degree cut-off cell',
  description:
    'Straight-cut band saw for operator-loaded 2 m tube and 30–100 mm parts. Pivoting pneumatic bow, stationary drive and L-datum clamps, short ballscrew indexing shuttle, carriage-mounted optical datum and a dropping support shelf. Fixed table; no mitre axis or powered outfeed.',
  keywords: ['bandsaw', 'band saw', '90', 'tube', 'pneumatic', 'automatic', 'Prom', 'aluminium'],
  parameters,
  defaults,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Ready · head raised',
      description: 'Fixed table, pivoting bow and shelf at stock height.',
    },
    {
      id: 'mechanism',
      label: 'Mechanism · guards hidden',
      description: 'Inspect wheel loop, short shuttle and shelf linkage.',
    },
    {
      id: 'loading',
      label: 'Load 2 m bar',
      description: 'Isolated operator loading; nose is placed in the X=-30 to -15 loading window.',
    },
    {
      id: 'scanning',
      label: '0 · Optical nose scan',
      description:
        'Fixed vise holds stock; open shuttle scans forward, captures the edge and returns before gripping.',
    },
    {
      id: 'feeding',
      label: '1 · Feed to length',
      description: 'Head raised, shuttle grips, station vise open, shelf closed.',
    },
    {
      id: 'clamped',
      label: '2 · Clamp and verify',
      description:
        'Both vises hold the stock; motor encoder checks axis holding; stock slip is not independently measured.',
    },
    {
      id: 'cutting',
      label: '3 · Controlled descent',
      description:
        'Band running; pneumatic head descends with metered flow. Shelf supports the free end.',
    },
    {
      id: 'bottom',
      label: '4 · Bottom switch stops band',
      description:
        'NC lower limit opens the contactor command. Head and stock remain held until standstill.',
    },
    {
      id: 'dropping',
      label: '5 · Drop part into box',
      description:
        'After standstill the shelf tilts 70 degrees. A passage pulse and empty confirmation are required.',
    },
    {
      id: 'raising',
      label: '6 · Raise stopped head',
      description: 'Shelf restored; head cylinder extends, stock stays clamped.',
    },
    {
      id: 'returning',
      label: '7 · Return open shuttle',
      description:
        'Fixed vise holds stock while the carriage opens and returns for the next index.',
    },
    {
      id: 'stroke',
      label: 'Motion inspection',
      description:
        'Inspect independent head and shuttle positions; not a permitted control sequence.',
    },
    {
      id: 'feed-detail',
      label: 'Feed drive · bearings and ballscrew',
      description: 'Inspect the journals, races, balls, nut and guided gripper.',
    },
    {
      id: 'head-detail',
      label: 'Head · pivot and pneumatic lift',
      description: 'Inspect head bearings, stationary drive and free-end pneumatic lift.',
    },
  ],
  validate: (p) => {
    const { w, h, wall } = section(p),
      e = engineering(p);
    const issues: string[] = [];
    if (p.profile === 'oval' && wall >= Math.min((w * w) / h, (h * h) / w) / 2)
      issues.push('Oval wall must be below the minimum curvature radius.');
    if (2 * wall >= Math.min(w, h)) issues.push('Wall must leave a hollow tube section.');
    if (e.firstAdvance > SHUTTLE_TRAVEL || e.advance > SHUTTLE_TRAVEL)
      issues.push('Index exceeds the 155 mm working shuttle stroke.');
    return issues;
  },
  buildGeometry: (p, s) => geometry(machinePieces(p, s)),
  dimensions: (p, s) => dimensions(machinePieces(p, s)),
  python: (p, s) => {
    const pieces = machinePieces(p, s);
    return (
      python(pieces) +
      '\ncomponent_groups = ' +
      JSON.stringify(pieces.map((q) => [q.group])) +
      '\ncomponent_manufactured = [' +
      pieces.map((q) => (q.procurement === 'MAKE' ? 'True' : 'False')).join(',') +
      ']'
    );
  },
  assessment: (p) => {
    const e = engineering(p);
    return [
      '90 degree cuts only. Stationary stock bed; bow pivots 0–35 degrees around the driven wheel. Motor and reducer stay on the frame. No rotating table or downstream conveyor.',
      `Operator loads ${Number(p.stockLength)} mm stock onto passive rollers. A 425 mm SFU1605 screw indexes a short 155 mm shuttle; fixed vise retains the datum during regrip.`,
      `Feed ${e.advance.toFixed(3)} mm per finished part = ${p.cutLength} mm + ${p.kerf} mm calibrated kerf. The open shuttle scans the fixed bar nose, then returns home before gripping. First facing advance is at most ${e.firstAdvance.toFixed(2)} mm.`,
      'A carriage-mounted BGS side sensor replaces the separate motorised stop and top measuring wheel. Calibrate the sensor-to-blade offset and screw lead map. The first 30 mm facing cut establishes a square end.',
      'Side and top shoes seat stock against Y=-60, Z=900. Common 30–120 mm height slots adjust the same mounting hardware; recheck grip after adjustment.',
      `Motor encoder increment ${e.axisIncrement.toFixed(5)} mm. It measures axis motion, not tube slip or movement within the jaws. ±0.20 mm requires measured cut capability.`,
      `Planning allocation ±${e.errorBudget.toFixed(3)} mm: 0.03 scan datum, ${p.stopWindow} axis positioning, ${p.gripAllowance} unobserved grip transfer, 0.07 kerf/alignment. ${e.errorBudget > 0.2 + 1e-9 ? 'Above target; tighten settings and qualify.' : 'These allowances must be established by measurement.'}`,
      'Six floor supports carry the common frame and infeed. The controller uses one frame-mounted post. The last roller is at X=-580, clear of the shuttle sweep. Frame corner straps use through bolts, nuts and crush sleeves.',
      `Shelf supports ${e.offcutMass.toFixed(3)} kg of aluminium at the chosen length. It drops only after lower limit, contactor-off feedback and measured band standstill. Support reduces sag tearing; it cannot guarantee burr-free cutting.`,
      'Lower NC switch is wired in the band contactor command chain. Opening the contactor does not prove zero speed. Raise only after a qualified standstill input; never feed with the head down.',
      `63x500 extending lift estimate ${e.liftForce.toFixed(0)} N; minimum torque margin ${e.liftMargin.toFixed(2)} for ${p.headMass} kg head. ${e.liftMargin < 2 ? 'Below the 2.0 planning margin.' : 'Verify actual moving mass, centre of gravity and pivot friction.'}`,
      `MA32 clamp estimate ${e.clampForce.toFixed(0)} N; feed grip margin ${e.feedMargin.toFixed(2)}, holding margin ${e.holdMargin.toFixed(2)}. ${Math.min(e.feedMargin, e.holdMargin) < 1.5 ? 'Below the 1.5 planning margin: revise grip/pressure.' : 'Validate on wet tube without crushing.'}`,
      `${e.parts} production parts after a 30 mm sacrificial facing piece; estimated remaining tail ${e.remainder.toFixed(1)} mm. ${TAIL_RESERVE} mm minimum tail reserve; stop for operator removal/reload. The first facing piece goes into the same box and must be segregated.`,
      'Pneumatics: Prom.ua Festo DSBC-63-500-PPSA-N3, 4 x MA32x50-SCA, MA32x100-SCA, 5 x 4V210-08 DC24V, AFR2000 and AR2000. Supplier mounting contours remain envelopes.',
      'Engineering concept: qualify descent against air stick-slip, head retention on pressure loss, blade tracking/tension, guarding and cut accuracy before manufacture. Process sequences are acceptance specifications, not PLC firmware.',
    ];
  },
  notes:
    'Aluminium tube assumptions continue the previous machine brief. Frame, guards and purchased-component mounting interfaces require detailed drawings. No angle adjustment exists. The roller table accepts one manually loaded bar; automatic bundle loading and tail purging are intentionally absent.',
  sources,
};
export default part;
