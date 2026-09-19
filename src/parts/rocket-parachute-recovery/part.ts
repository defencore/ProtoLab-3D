import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import { layout, assessment, springDimensions } from './lib/motion';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'rocket-parachute-recovery',
  name: 'Parachute Recovery Assembly',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'gear',
  complexity: 'MG996R / 2S / WING MINI · three drives',
  description:
    'Library MG996R, two vertical 18650 cells and damped F405 WING-MINI stack in a separating Ø90/86 nose. Compare geared release, linear spiral hooks and eased spiral hooks with geometry-linked spring and drive calculations.',
  keywords: [
    'parachute',
    'recovery',
    'release',
    'airbrakes',
    'MG996R',
    '18650',
    '2S',
    'F405',
    'cam',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Recovery sequence',
      description: 'Unlock, spring push, bag extraction, schematic canopy opening.',
    },
    {
      id: 'cutaway',
      label: 'Cutaway',
      description: 'Open shells reveal avionics and the packed parachute.',
    },
    {
      id: 'no-shells',
      label: 'Without tubes',
      description: 'Remove body tubes and nose shell; retain the recovery pack.',
    },
    {
      id: 'mechanisms',
      label: 'Mechanisms only',
      description: 'Inspect rigid mechanisms without tubes or parachute fabric.',
    },
    {
      id: 'latch-section',
      label: 'Latch section',
      description:
        'Isolated latch; the nose cheeks and body receiver are sectioned to expose the blade and eye joint. Inspection geometry only.',
    },
    {
      id: 'packing',
      label: 'Packing safety pin inserted',
      description:
        'Nose removed; pusher retained by the removable side pin. Remove pin before arming.',
    },
    { id: 'stowed', label: 'Stowed', description: 'Locked assembly.' },
    {
      id: 'deployed',
      label: 'Deployed',
      description: 'Schematic line and canopy layout; not a flight trajectory.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    for (const f of parameters) {
      const v = p[f.key];
      if (
        f.type === 'number' &&
        (!Number.isFinite(Number(v)) || Number(v) < f.min! || Number(v) > f.max!)
      )
        errors.push(`${f.label} is outside its allowed range.`);
      if (f.type === 'select' && !f.options?.some((o) => o.value === v))
        errors.push(`Choose a valid ${f.label}.`);
    }
    if (+p.tubeOD !== 90 || +p.tubeID !== 86)
      errors.push('This assembly requires the 90/86 tube interface.');
    if (+p.packDiameter + 7 > 57)
      errors.push('Provide 0.5 mm radial clearance through the D57 upper guide support.');
    if (+p.packDiameter + 7 > layout(p).passage)
      errors.push('Provide at least 0.5 mm radial cassette clearance including its 2.5 mm wall.');
    if (+p.packDiameter / 2 + 3 + 2 + 0.3 > 31.5)
      errors.push('Cassette wall requires 0.3 mm clearance from the D4 ejector guide rods.');
    if (+p.packLength + 50 > +p.bayLength)
      errors.push('Recovery bay is too short for the bag and lines.');
    if (+p.separation < +p.packLength + 110)
      errors.push('Extraction travel is too short for bag clearance and line payout.');
    if (springDimensions(p).seat - 12 < -+p.bayLength)
      errors.push('Extend the recovery bay to contain the ejector bulkhead.');
    if (springDimensions(p).cassetteBottom + +p.springTravel < -25)
      errors.push(
        'The upper guide disk must remain inside the 30 mm body locking rim. Adjust stroke or pack length.',
      );
    if (springDimensions(p).cassetteBottom + +p.springTravel + 6.9 > 5)
      errors.push(
        'Reduce stroke: the upper guide support and nuts must stay below the locking ring web.',
      );
    if (!Number.isInteger(+p.springCoils)) errors.push('Use an integer number of active coils.');
    if (
      ![
        'assembled',
        'cutaway',
        'stowed',
        'deployed',
        'no-shells',
        'mechanisms',
        'packing',
        'latch-section',
      ].includes(state)
    )
      errors.push('Choose a valid assembly state.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  assessment(p) {
    const a = assessment(p);
    return [
      `MG996R / 2x18650 2S1P / F405 WING-MINI: shared detailed Rocket Release library geometry. Separating mass ${p.noseMass} kg is the user's estimate; pack pull ${p.extractionForce} N remains an editable assumption.`,
      p.mechanism === 'rotary-ring'
        ? '100T internal ring / 40T idlers / 20T input, module 0.6, 20 degree pressure angle. Nose unlock: 14 degrees; servo relative to nose: -70 degrees; speed ratio magnitude 5:1.'
        : `Three retracting hooks, 8 mm radial travel, ${p.camSweep} degree direct servo sweep. ${p.mechanism === 'spiral' ? 'Linear Archimedean' : 'Cosine velocity ramps / constant-speed middle'} cam derived from AirBrakes; slot width 3.4 / follower D3.0. Steel 8x4 R1 blades pass through two integral t3 nose cheeks and a t3 body eye between them. Closed blades engage both cheeks; withdrawal leaves 1.60 mm clearance from the body eye. Face clearance 0.15 mm. Use Latch section to inspect the joint.`,
      ...(p.mechanism === 'rotary-ring'
        ? []
        : [
            `Double-shear retention screening: external axial load ${p.retentionLoad} N (assumed) plus spring preload gives ${a.retentionForce.toFixed(1)} N total. Using a conservative 6x4 inscribed blade section and equal load sharing: blade shear ${a.bladeShear.toFixed(1)} MPa; conservative point-load blade bending ${a.bladeBending.toFixed(1)} MPa; body-eye bearing ${a.eyeBearing.toFixed(1)} MPa; each cheek bearing ${a.cheekBearing.toFixed(1)} MPa. No strength PASS: material grade, fillets, tear-out, ring web, tube fasteners, unequal loading and fatigue remain unverified.`,
          ]),
      `Three matched guide-rod springs push an open-mouth PTFE cassette out through the ring. Nose electronics separate together. Nose mass ${p.noseMass} kg + cassette/parachutes ${p.cassetteMass} kg = ${a.movingMass.toFixed(2)} kg moving mass.`,
      `Four short seam-assist cartridges add ${a.assistForce.toFixed(1)} N at the locked joint; total initial lock load ${a.lockLoad.toFixed(1)} N. Their energy is excluded from the three-spring budget.`,
      `Drogue deploys after cassette exit; the main canopy remains bundled until an external chute-release controller reaches the target ${p.mainReleaseAltitude} m. This target is documentation, not implemented flight logic.`,
      `Clear body passage D${layout(p).passage.toFixed(1)}; bag D${p.packDiameter} x ${p.packLength}. Sequence 0-30% unlock, 30-55% spring stroke ${p.springTravel} mm, 55-80% extraction, 80-100% schematic inflation.`,
      `Three guide-rod springs at 120 degrees: each mean D12, wire ${p.springWire}, ${p.springCoils} active coils plus 2 end coils; G=79 GPa assumed. each k=${a.rate.toFixed(3)} N/mm, combined k=${a.systemRate.toFixed(3)} N/mm; L0=${a.free.toFixed(1)} mm, closed ${a.closed.toFixed(1)} mm, solid estimate ${a.solid.toFixed(1)} mm.`,
      `Combined ejection force ${a.startForce.toFixed(1)} -> ${a.endForce.toFixed(1)} N; opposing load ${a.resistance.toFixed(1)} N including ${p.axialGravity} g axial gravity and ${p.guideForce} N guide friction. Initial force: ${a.forcePass ? 'PASS' : 'FAIL'}.`,
      `Available spring work ${a.energy.toFixed(3)} J; required ${a.required.toFixed(3)} J including ${p.energyFactor}x allowance and ${p.exitSpeed} m/s target after ${a.extractionDistance} mm extraction. Energy: ${a.energyPass ? 'PASS' : 'FAIL'}, margin ${a.energyMargin.toFixed(2)}x. Ideal exit speed ${a.speed.toFixed(2)} m/s.`,
      `Estimated servo torque ${a.torque.toFixed(3)} N m (includes ${a.thrustTorque.toFixed(3)} N m cassette thrust friction); comparison budget ${a.availableTorque.toFixed(3)} N m (${(+p.servoDerating * 100).toFixed(0)}% of published 4.8 V stall rating). Drive: ${a.torquePass ? 'PASS' : 'FAIL'}, margin ${a.torqueMargin.toFixed(2)}x. Ring friction ${p.lockFriction}${p.mechanism === 'rotary-ring' ? '' : ` plus support friction ${p.hookGuideFriction}`}, efficiency ${p.gearEfficiency} are assumptions; measure loaded unlock torque.`,
      `Per-spring peak force ${a.forcePerSpring.toFixed(1)} N; maximum Wahl-corrected spring wire shear stress ${a.stress.toFixed(0)} MPa. No supplier/material allowable has been selected: spring strength and fatigue remain UNVERIFIED even when the energy budget passes. The helix shows nominal coils; closed/ground end treatment needs the spring supplier drawing.`,
      `2S loaded voltage ${p.packVoltage} V: ${a.voltagePass ? 'within' : 'BELOW'} the controller's 7 V minimum. Servo power must use the regulated 5 V BEC, never raw 8.4 V battery power. Verify voltage sag and servo current with the actual hardware.`,
      'Assembly status: bench prototype, not qualified. Library spline, servo screw and individual PCB dimensions contain explicitly marked fit references. Verify them against purchased parts. Fabric, anchors, harness and recovery opening loads require physical qualification.',
    ];
  },
  notes:
    'Separate labeled parts and thread/manufacturing metadata are preserved in FreeCAD export. Load calculations cover release and initial extraction, not parachute inflation shock, descent rate or flight reliability. A passing analytical budget is not a claim of flight readiness.',
  sources: [
    {
      label: 'TowerPro MG996R dimensions and ratings',
      url: 'https://towerpro.com.tw/product/mg996R/',
    },
    {
      label: 'SpeedyBee WING MINI manufacturer manual',
      url: 'https://support.speedybee.cn/?a=p&d=SBFWC2&l=en&s=1000',
    },
    { label: 'Ben Jaynes Airbrakes', url: 'https://www.benjaynes.com/projects/airbrakes/' },
    {
      label: 'Lee Spring compression spring design',
      url: 'https://www.leespring.com/learn-about-compression-springs',
    },
  ],
};
export default part;
