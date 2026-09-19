import { transmissionReport } from './lib/transmission';
import { wingLayout } from './lib/wing-layout';
import { wingReport, wingSources, wingPreset } from './lib/wing-package';
import type { PartDefinition, Preset } from '../../core/types';
import { springReport } from './lib/spring-assessment';
import { electronicsReport } from './lib/electronics';
import { hatData } from './lib/hat';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import { batteryLayout, batteryPosts } from './lib/balance';
import { packWirePorts, seatOuterRadius, packFlatEdge } from './lib/pack-support';
import { servoTiePosts } from './lib/servo-retention';
import { layout, at, springAngles } from './lib/motion';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'rocket-release',
  name: 'Rocket Release Mechanism',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'gear',
  complexity: '4 drive layouts · 8 retaining points',
  description:
    'Eight-point rotating release ring with four gearmotors or one central servo and four idlers. Spring-assisted tube separation; Ø80/76 default.',
  keywords: [
    'release mechanism',
    'separation',
    'bayonet',
    'keyhole',
    'spring',
    'rocket',
    'servo',
    'sun gear',
    '80/76',
    'release',
    'lock',
  ],
  assessment: (p) => [
    ...transmissionReport(p),
    ...springReport(p),
    ...electronicsReport(p),
    ...wingReport(p),
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Both tube sections and the release mechanism.',
    },
    {
      id: 'cutaway',
      label: 'Housing cutaway',
      description: 'Quarter of the housing removed to inspect drive and locks.',
    },
    {
      id: 'open',
      label: 'Tubes removed',
      description: 'Carrier, drive, eight studs, rotating disk and four spring pushers.',
    },
    {
      id: 'mechanism',
      label: 'Mechanism only',
      description: 'The operating components with tubes and carrier hidden.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'cutaway', 'open', 'mechanism'].includes(state))
      errors.push('Select a valid assembly view.');
    if (
      !['four-motors', 'central-servo', 'st3215-nose', 'wing-mini-nose'].includes(String(p.drive))
    )
      errors.push('Select a drive layout.');
    if (p.drive === 'four-motors' && !['12', '16'].includes(String(p.motor)))
      errors.push('Select a motor installation envelope.');
    if (+p.tubeOD - +p.tubeID < 1 || +p.tubeOD - +p.tubeID > 12)
      errors.push('Tube wall must be between 0.5 and 6 mm.');
    const m = layout(p);
    if (!['none', '3x18650'].includes(String(p.batteryPack)))
      errors.push('Select a battery compartment.');
    if (p.drive === 'st3215-nose' && (+p.tubeOD < 90 || +p.tubeID < 86))
      errors.push('ST3215 nose layout requires Ø90/86 mm or larger.');
    if (p.drive === 'st3215-nose' && +p.extractionDistance < +p.springTravel)
      errors.push('Extraction distance must include the full spring stroke.');
    if (m.pitchRadius + m.module * 1.25 + 0.8 > m.lockRadius - 3.05)
      errors.push('Insufficient material between the gear root and retaining slots.');
    if (!m.centralServo && m.driveRadius + m.motorRadius > m.lockRadius - 4.2)
      errors.push('Gearmotor body would intersect the spring-seat support.');
    if (m.centralServo && 2 * (m.pinionRadius + m.module) >= Math.SQRT2 * m.driveRadius)
      errors.push('Adjacent idler tip circles need clearance.');
    if (+p.separation < +p.springTravel + 4)
      errors.push('Show at least 4 mm separation beyond the spring travel.');
    if (p.drive === 'wing-mini-nose') {
      if (+p.tubeOD < 90 || +p.tubeID < 86)
        errors.push('MG996R / WING MINI nose requires Ø90/86 or larger.');
      if (p.batteryPack !== 'none')
        errors.push(
          'The LiPo layout uses its own cassette; select the WING MINI layout or preset again.',
        );
      if (!['2', '3'].includes(String(p.lipoCells))) errors.push('Select a 2S or 3S LiPo.');
      if (+p.extractionDistance < +p.springTravel)
        errors.push('Extraction distance must include the full spring stroke.');
      const w = wingLayout(p);
      if (!['lipo', '2x18650'].includes(String(p.wingBattery)))
        errors.push('Select a supported WING MINI battery arrangement.');
      if (w.cylindrical) {
        const radius = +p.wingCellDiameter / 2;
        if (radius < 9 || radius > 9.5 || +p.wingCellLength < 64 || +p.wingCellLength > 67)
          errors.push('Measure the unprotected 18650 cells: supported envelope Ø18–19 × 64–67 mm.');
        if (+p.wingCellMass < 35 || +p.wingCellMass > 55)
          errors.push('18650 mass must be 35–55 g per cell.');
        if (Math.abs(w.batteryX) + radius + 2 > 21)
          errors.push('Cell balance trim leaves the supported heel/end-seat region.');
        if (Math.hypot(w.batteryX, 24) + radius + 2 + 0.5 > +p.tubeID / 2)
          errors.push('18650 cups need 0.5 mm radial tube clearance.');
        if (
          [-24, 24].some((y) =>
            springAngles.some((a) => {
              const [sx, sy] = at(m.lockRadius, a);
              return Math.hypot(w.batteryX - sx, y - sy) < radius + 2.5 + 5 + 0.5;
            }),
          )
        )
          errors.push('Cell balance offset leaves insufficient spring-cartridge clearance.');
      } else {
        if (
          Math.hypot(Math.abs(w.batteryX) + w.width / 2 + 4, w.length / 2 + 4) + 0.5 >
          +p.tubeID / 2
        )
          errors.push('LiPo retention stops need at least 0.5 mm tube clearance.');
        if (w.thickness > 18 || w.width > 33 || w.length > 63)
          errors.push('Measured pack exceeds this cassette installation envelope.');
        if (w.leadY + 4 > 38)
          errors.push('Battery length leaves insufficient lead-port edge margin.');
      }
      if (
        +p.wingHolePitchX < 17 ||
        +p.wingHolePitchX > 18.3 ||
        +p.wingHolePitchY < 20 ||
        +p.wingHolePitchY > 22
      )
        errors.push('PCB pitch exceeds the adjustable frame support range.');
    }
    if (p.drive === 'st3215-nose' && m.batteries) {
      if (hatData.radialEnvelope + 0.5 > +p.tubeID / 2)
        errors.push('HAT requires at least 0.5 mm radial clearance from the tube.');
      const cells = batteryLayout(p);
      for (const [i, [x, y]] of cells.entries()) {
        if (Math.hypot(x, y) + 12.2 > m.radius)
          errors.push('Battery holder does not fit this tube and mass distribution.');
        if (Math.hypot(x, y) + seatOuterRadius > m.radius - 1.5)
          errors.push('Cell seats need more clearance from the common plate edge.');
        if (Math.max(Math.abs(x), Math.abs(y)) + seatOuterRadius > packFlatEdge(m.radius) - 0.5)
          errors.push('Cell seat needs more material inside the mounting-wall clearance flats.');
        if (packWirePorts.some(([px, py]) => Math.hypot(x - px, y - py) < seatOuterRadius + 5.2))
          errors.push('Cell seat intersects a harness port. Adjust the mass balance.');
        if (
          [...batteryPosts(m.radius), ...servoTiePosts].some(
            ([px, py]) => Math.hypot(x - px, y - py) < seatOuterRadius + 2.8,
          )
        )
          errors.push('Cell seat intersects a structural post. Adjust the mass balance.');
        if (
          cells.some(
            ([px, py], j) => j !== i && Math.hypot(x - px, y - py) < 2 * seatOuterRadius + 0.5,
          )
        )
          errors.push('Common plate cell seats overlap. Adjust the mass balance.');
        const dx = Math.max(-10.12 - x, 0, x - 35.12),
          dy = Math.max(Math.abs(y) - 12.37, 0);
        if (Math.hypot(dx, dy) < seatOuterRadius + 0.4)
          errors.push(
            'Battery would intersect the ST3215. Adjust the mass or centre-of-mass inputs.',
          );
      }
    }
    return [...new Set(errors)];
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  updateParameters(p, key) {
    if (key === 'drive' && p.drive === 'wing-mini-nose')
      return {
        ...p,
        ...wingPreset(3),
        wingBattery: 'lipo',
        tubeOD: Math.max(90, +p.tubeOD),
        tubeID: Math.max(86, +p.tubeID),
        fitClearance: 0.25,
        batteryPack: 'none',
        noseMass: 0.35,
      };
    if (key === 'lipoCells') return { ...p, ...wingPreset(+p.lipoCells) };

    if (key === 'drive' && p.drive === 'st3215-nose' && +p.tubeID < 86)
      return {
        ...p,
        tubeOD: 90,
        tubeID: 86,
        fitClearance: 0.25,
        batteryPack: '3x18650',
        noseMass: 0.5,
      };
    if (key === 'drive' && p.drive === 'st3215-nose') return { ...p, batteryPack: '3x18650' };
    return p;
  },
  notes:
    'The MG996R + Tattu 650 mAh 2S/3S + SpeedyBee F405 WING MINI package is an additional Ø90/86 nose layout. It includes a dedicated LiPo cassette and controller support; fit-reference interfaces must be measured before fabrication. The original four-motor and MG90S layouts remain unchanged and start without batteries. ST3215 nose release is a separate Ø90/86 layout: the servo is attached to the nose-side mounting disk, turns with the nose during unlocking and separates towards +Z. The body locking ring and its integral 30 mm rim form one machined part, fixed to the tube by two screw rows. No U-bolts or parachute brackets. Four metal standoffs and one lightened machined rear plate clamp the servo against the thin nose disk. The nose disk has integral curved mounting walls and axle supports. Four POM idlers rotate on captive steel axles held by a common retaining disk and four screws. A one-piece input pinion fits the output spline. The diagonal spring barrels screw 3.5 mm into integral threaded bosses and are open at their gear-side mouths, with through-rod pistons, integral internal piston stops, backup external retaining rings and rear guide plugs. The powered layout uses a 3S1P 18650 pack and Waveshare Bus Servo Driver HAT (A), with separate retention on a common metal frame tied to the servo disk. Masses and load assumptions are editable; the compact unpowered layout remains available. The preview illustrates a positional sequence, not flight dynamics or a certified load-bearing design.',
  sources: [
    ...wingSources,
    {
      label: 'Waveshare Bus Servo Driver HAT (A) · supplier STEP and electrical specifications',
      url: 'https://www.waveshare.com/wiki/Bus_Servo_Driver_HAT_(A)',
    },
    {
      label: 'Lee Spring · compression spring design considerations',
      url: 'https://www.leespring.com/learn-about-compression-springs',
    },
    {
      label: 'Waveshare ST3215 · supplier specification and CAD',
      url: 'https://www.waveshare.com/wiki/ST3215_Servo',
    },
  ],
};
export default part;
