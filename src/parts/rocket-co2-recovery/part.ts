import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
import { assessment, layout } from './lib/layout';
import { h7Spec, h7BoardOffset } from './lib/h7-controller';
import { blindTapDimensions, blindTapNote } from './lib/mechanical';
const states = [
  {
    id: 'cutaway',
    label: 'Cutaway assembly',
    description:
      'Sectioned tubes and bulkheads reveal the printed dispenser, opposed cells and controller.',
  },
  {
    id: 'assembled',
    label: 'Closed assembly',
    description:
      'Metal screws retain the avionics; nylon M2.5x8 countersunk screws retain the parachute tube.',
  },
  {
    id: 'mechanisms',
    label: 'Without tubes or fabric',
    description: 'All mechanical and electronic components, with pressure seals and anchors.',
  },
  {
    id: 'separated',
    label: 'Separated / extraction',
    description: 'Inspection displacement only; not a pneumatic or flight simulation.',
  },
  {
    id: 'bulkhead',
    label: 'Turned bulkhead',
    description: 'Single-piece turned profile with secondary drilled and tapped holes.',
  },
  {
    id: 'electronics',
    label: 'Electronics retention stack',
    description:
      'Captured cells, two structural plates, eight spacer tiers and a damped controller; layout follows the selected avionics variant.',
  },
  {
    id: 'finder',
    label: 'Nose tracker, buzzer and switch',
    description:
      'ZX908, JHE20B and a 17x13x10 mm PWM Switch in a shared turned POM-C tray under the dielectric fairing.',
  },
  {
    id: 'printed-parts',
    label: 'Printed parts / fit inspection',
    description: 'Separate printed dispenser, nut, adapter and battery insulators.',
  },
];
const part: PartDefinition = {
  id: 'rocket-co2-recovery',
  name: 'CO2 Parachute Recovery Assembly',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'gear',
  complexity: '16 g CO2 / 2S or 4S avionics',
  description:
    'Turned Al6061 bulkhead for a Ø90/86 tube, PA12 printed gas-unit holders and battery insulators, nickel series links, and damped F405 WING-MINI 2S/4S or LCH7 4S avionics.',
  keywords: [
    'CO2',
    'parachute',
    'recovery',
    'bulkhead',
    'shear screws',
    '18650',
    'F405',
    'H7',
    '4S',
    'PEM',
    'dispenser',
    'ZX908',
    'JHE20B',
    'PWM Switch',
    'payload',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states,
  validate(p, state) {
    const errors: string[] = [];
    for (const f of parameters) {
      const value = p[f.key];
      if (
        f.type === 'number' &&
        (typeof value !== 'number' || !Number.isFinite(value) || value < f.min! || value > f.max!)
      )
        errors.push(`${f.label} is outside its allowed range.`);
      if (f.type === 'select' && !f.options?.some((o) => o.value === value))
        errors.push(`Choose a valid ${f.label}.`);
    }
    if (errors.length) return errors;
    if (!states.some((s) => s.id === state)) errors.push('Choose a supported assembly state.');
    if (!Number.isInteger(+p.pinCount)) errors.push('Use an integer shear screw count.');
    if (!Number.isInteger(+p.plateThickness))
      errors.push('Use a 2, 3 or 4 mm plate to match the stocked controller mounting screws.');
    if (+p.printFemaleAllowance + +p.printMaleRelief > 0.35)
      errors.push(
        'Combined radial printed clearance must not exceed 0.35 mm on the M18x1 interface.',
      );
    if (layout(p).packBottom + +p.packLength + 55 > layout(p).bodyEnd)
      errors.push(
        'Extend the parachute bay or shorten the pack to retain 55 mm for the compact eye nut and stowed harness.',
      );
    if (+p.separation < layout(p).packBottom + +p.packLength + 25)
      errors.push('Inspection travel must fully extract the packed parachute.');
    if (+p.gasVolume > assessment(p).grossVolume)
      errors.push('Effective free gas volume cannot exceed the empty tube volume.');
    if (assessment(p).effectiveRecoveredMass <= +p.separatingMass)
      errors.push(
        'The recovered mass after removing the optional bay must exceed the separating mass.',
      );
    if (!layout(p).fourS && layout(p).controllerPlateBottom - 17.5 - layout(p).clampTop < 5)
      errors.push(
        'Reduce the dispenser gap or plate thickness to leave 5 mm beyond the F405 header tips.',
      );
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  assessment(p) {
    const a = assessment(p),
      v = layout(p);
    return [
      `Bulkhead: Al6061-T6 round blank, turned D90 x5 flange. Fixed electronics-side seat D86 x20; O-ring release-side seat D${(2 * v.releaseSpigot).toFixed(2)} x20 with ${p.releaseFitGap} mm nominal diametral clearance. Both walls are 3 mm before fitting. All other fixed bulkhead skirts and the nose cuff are nominal D86, independent of release clearance: finish-fit them to the measured tube bore by removing a little material as needed. Nominal D86 does not guarantee zero play in an oversized tube. Secondary drilling and tapping; no milled pockets. Deburr wire and harness interfaces. Tube alloy and temper must be verified separately.`,
      'Parachute exit: turn a continuous internal R1 at the nose-facing mouth of the D90/86 pressure tube. The opening is D88 at the end face and blends tangentially into D86 over 1 mm; the nominal flat end land is 1 mm. Deburr and polish the full fabric-contact path without sharp tool marks. The seal band and nylon shear-hole seats remain beyond the rounded mouth.',
      `Electronics plates: ${p.plateMaterial === 'steel' ? 'S235JR steel sheet, laser cut then drilled, tapped and deburred; protect against corrosion and contact with aluminium' : 'Al6061-T6 round stock or plate, turned then drilled, tapped and deburred'}. Spacer columns: Al6061-T6. Electrical series links: formed Ni200 nickel, spot-welded to the matched cells; size the strip for actual current.`,
      'Gas-unit holders and battery insulators: unfilled PA12, preferably SLS. Dry and calibrate PA12 filament if using FDM; print a thread/seat coupon first. Use solid material around shoulders, thread roots and bolt lands. No conductive or ESD-filled material for cell insulation. Controller disks and the finder tray are turned/drilled POM-C; use solid stock and deburr every wire hole. Silicone for controller dampers, EPDM for the modeled seals, and PA66 for purchased shear screws and cable ties. Confirm compound suitability for actual temperature, CO2 and service loads.',
      'Existing metal gas unit: D17.5 x30 seat, D10.1 throat and D13 nut access retained. Its valve, puncture pin, seals and actuation hardware are not supplied and are NOT modeled. Printed parts are holders/adapters, not a pressure-rated replacement for the metal gas path.',
      `Printed interfaces: M24x2 dispenser/nut; M18x1 protective adapter; 3/8-24 UNF cartridge connection. Female radial allowance +${p.printFemaleAllowance} mm, printed male relief ${p.printMaleRelief} mm. Total printed mating radial clearance ${(+p.printFemaleAllowance + +p.printMaleRelief).toFixed(3)} mm. These are calibration starting values, not a universal printer fit.`,
      v.fourS
        ? `Four ${v.cell.name} cells in 4S1P: nominal 14.4 V, 16.8 V fully charged. Symmetric 24.6x24.6 mm centre pitch. The D83 foundation is ${(-v.foundationTop).toFixed(1)} mm from the bulkhead, with ${p.dispenserDiskGap} mm axial clearance to the dispenser nut. The second disk captures all four insulating shoulders. Bulkhead-to-clamp depth ${(-v.clampBottom).toFixed(2)} mm. Estimated ${p.designG} g battery retention demand ${a.batteryForce.toFixed(1)} N; clamp strength is not certified.`
        : `Opposed ${v.cell.name} cells: nominal 2S1P 7.2 V, 8.4 V fully charged. Insulating seats bear directly on the bulkhead, with no intermediate foundation disk. Two D83 plates and four spacer columns retain the cells and controller. Bulkhead-to-outer-clamp depth ${(-v.clampBottom).toFixed(2)} mm; battery centres X +/-${v.cellX} mm. Estimated ${p.designG} g axial retention demand ${a.batteryForce.toFixed(1)} N. Clamp preload and impact strength are not certified.`,
      v.fourS
        ? '4S contacts: B1 and B3 are supported nickel bridges on the foundation; A formed B2 nickel lamella joins the two middle-cell terminals behind the clamp on a removable, metal-backed PA12 carrier; two M2 through-bolts retain it. Recessed B- and B+ power pads and five distinct balance nodes are retained. D19.7 insulating pilots enter D20 through-bores in both disks; D23 shoulders bear on metal. Four D10 relief holes and a D8 wire port lighten each disk. Contacts carry no retention load. Protection and current ratings require actual electrical data.'
        : 'Battery retention: D12.7 pilots locate the PA12 inserts in D13 bores. Bulkhead sockets are blind, 1.5 mm deep, leaving a 3.5 mm gas-side web. The compression disk has through-bores and continuous metal rings under the D23 insulating shoulders. Recessed B- and B+ pads are accessible on its outer face, with open wire notches and raised polarity marks; the supported bridge at the bulkhead is B1.',
      v.h7
        ? `LCH7 v3.2: PCB 50x44x${h7Spec.boardThickness} mm; four D4 holes on 30.6x30.6 pitch. Total envelope ${h7Spec.envelopeWidth}x44x${h7Spec.envelopeHeight} mm. Shared detailed library model, aligned with the carrier axes with its rear face ${h7BoardOffset} mm from the interchangeable POM-C D62 x6 carrier. Four ISO 4762 M2.5x20 screws enter M2.5x0.45 through-tapped carrier holes from the PCB side. Silicone D6/D4 grommets and stepped compression spacers isolate the board and limit preload; no PCB-side nuts. Verify damper fit and stiffness. Input-voltage, mass and pinout data are not specified; verify regulation before connecting a 16.8 V pack.`
        : `Library F405 WING-MINI three-board stack on four bonded silicone dampers. ${v.fourS ? 'A turned POM-C D62 x6 carrier stands 10 mm above the battery clamp on four Al6061 D6 spacers. ISO 4762 M2.5x25 screws and washers enter the common through-tapped clamp pattern; five D8 ports admit wires. Exchange this disk for the LCH7 version without changing the battery pack, tube or finder tray. The board and headers face the nose, clear of the four cells and contact lamellas.' : 'The stack is turned 90 degrees between the two cells. The outer plate leaves axial header clearance.'} Verify PCB pitches on purchased hardware. Supply the complete stack through PDB BAT+/GND (manufacturer input 7-26 V), not a regulated 5 V output. ${v.fourS ? '4S reaches 16.8 V fully charged.' : 'A 2S Li-ion pack can fall below the 7 V input minimum; set a suitable cutoff or regulator.'} Use a compatible isolated driver for the existing gas actuator.`,
      `${p.pinCount} PA66 DIN 965 M2.5x8 countersunk 90-degree shear screws, pitch0.45; assumed single-screw break force ${p.measuredPinForce} N. Axial force = pins + ${p.sealDrag} N drag + gravity on ${p.separatingMass} kg = ${a.force.toFixed(1)} N. Effective D86 piston area ${a.area.toFixed(1)} mm2; nominal threshold ${a.pressureKPa.toFixed(1)} kPa gauge. Measure break force of the actual screw lot and installed joint.`,
      `Ideal-gas screening at ${p.temperature} C and ${p.gasVolume} L free volume: only ${a.gasGrams.toFixed(3)} g additional CO2 corresponds to the nominal threshold. A complete 16 g charge would add approximately ${a.fullChargeKPa.toFixed(0)} kPa in a rigid, closed, isothermal chamber. This is not the transient release pressure: flow, cooling, leakage and separation are not simulated. No chamber or printed-part pressure rating is established.`,
      `Nose-up assembly: packed drogue + main D${p.packDiameter} x${p.packLength} mm inside the main D86 bore, leaving ${a.packRadialClearance.toFixed(1)} mm radial clearance. Axial gap to the CO2 cartridge is ${p.packFrontGap} mm; remaining space behind the pack is ${(v.bodyEnd - v.packBottom - +p.packLength).toFixed(1)} mm for the compact eye nut and stowed harness. The separating skirt leaves with the nose before the bag reaches the exit; its smaller bore is not the stationary extraction aperture.`,
      `Recovered mass used in load screening: ${a.effectiveRecoveredMass.toFixed(2)} kg${v.directMotor ? ` (${p.recoveredMass} kg with optional bay minus ${p.omittedPayloadMass} kg removed)` : ''}. Assumed peak tension/weight factor ${p.openingLoadFactor} gives ${a.peakHarnessLoad.toFixed(0)} N; screening factor ${p.structuralFactor} gives ${a.designHarnessLoad.toFixed(0)} N design demand. These factors are placeholders, not a prediction from parachute size. Drogue/main models and opening speed are unknown.`,
      `Body harness: central Osculati 39.306.08 compact M8 eye nut (D32.6 /20, H33.3), ISO 4762 M8x20 A4-80 through-bolt, ISO 7089 M8 washer and ${v.directMotor ? 'steel D74 x4 backing plate retained by four ISO 4762 M6x25 through-bolts on PCD62 in one double-sided bulkhead' : 'steel D84 x4 backing plate with four M6 ties connecting the two payload bulkheads'}. Equal-share axial stress at the M6 20.1 mm2 tensile area is ${a.tieAxialStressMPa.toFixed(1)} MPa. This excludes web bending, thread stripping, fatigue, eccentric loading and duralumin tube tear-out. Exact tube alloy/temper and hardware strength grades are not specified; no strength pass is claimed.`,
      `The separate nose branch screens at ${a.noseDesignLoad.toFixed(0)} N for ${p.separatingMass} kg, using the same assumed factor. It must not carry the complete body through the small nose eye. Use a shared parachute junction with independently retained body and nose branches; select abrasion-protected harnesses from actual opening data.`,
      v.directMotor
        ? 'No lower computer/camera bay or rear payload bulkhead. The lower bulkhead is L60: two D86 x26 skirts with 5 mm walls (ID76), separated by an 8 mm web. Each skirt has two rows of six M4 screws, staggered 30 degrees, with 8 mm nominal edge distance. The tube continues beyond the shorter aft collar to keep the motor-side datum 28.4 mm beyond the central M8 bolt head. Actual motor and thrust mount are not supplied. The D100 x80 lower blank leaves 20 mm gross axial reserve; the D100 x70 upper blank leaves 25 mm for its finished L45 bulkhead. These reserves include facing, cut-off and workholding; the machinist must confirm the jaws and setup. Thicker skirts alone do not verify the shorter joint or its tube wall.'
        : 'The body-side computer/camera bay lies behind the sealed recovery bulkhead. Four steel ties bypass its equipment. The motor-side plane is an interface reference only; equipment mounts, motor thrust mount and their verified attachment details are not supplied.',
      'Selected user-supplied envelopes: ZX908 35x20x4.5 mm, JHE20B 20x10x8 mm and PWM Switch 17x13x10 mm. All three sit on double-sided foam tape on a round POM-C machined tray beyond the metal tube. Two 2.5 mm cable ties per module pass through twelve D3.4 drilled holes; locking heads sit behind the tray. Adjustable heat-shrink and tape thicknesses affect the modeled fit. The flat tray leaves wired ends open; tape and ties locate each module. Verify strap positions against the antenna, buzzer outlet, buttons and actual PCB components before tightening.',
      `ZX908 uses the requested single-cell B- / B1 tap. Its current creates cell imbalance: verify input limits, protect and strain-relieve the tap, monitor every cell and balance-charge the ${v.cellCount}S pack. Do not feed it the ${(v.cellCount * 4.2).toFixed(1)} V pack output. JHE20B connects to the controller buzzer interface according to its manual.`,

      'The removable electronics module uses four ISO 4762 M4x16 A2-70 screws, 3 mm hex drive, with ISO 7089 M4 D9/4.3 x0.8 washers. Heads face the parachute chamber. The 5 mm bulkhead has four D4.5 clearance holes at R34 /45+90n degrees; the first-tier columns have female M4x0.7 threads at both ends. Remove these four screws to lift off the electronics stack without undoing its plates. First expose the gas face, remove the surrounding electronics tube and disconnect wiring. The 4S foundation keeps its cells clamped; support the loose bulkhead-backed cradle and cells when servicing 2S.',
      'Six bulkhead M3x0.5 dispenser holes remain through-tapped and require compatible removable pneumatic thread sealant. Seal the module screws at both head/washer and washer/web faces with compatible removable gas-rated gasket compound. Washers alone are not pressure seals; renew the sealing and leak-test after service.',
      `The new bulkhead-side female M4 ends accept 10.20 mm screw penetration and have 10.90 mm full-profile depth, plus tap lead, chip space and drill points. Opposite spacer ends: ${blindTapNote(blindTapDimensions(4, 8 - v.t))} Only the outer tiers retain male shoulders with 1.4 mm die-exit necks and 0.35 mm tip chamfers. Opposed drill tips leave at least 2 mm solid web; usable engagement excludes entry chamfers and screw-tip lead.`,
      'POM-C finder posts have independent M3 blind ends with tap-lead space, chip space and 118-degree drill points; their remaining central web is recorded in each part. Turn the posts from solid bar, then drill and tap from each end. Purchased screws and printed dispenser threads follow their own supplier/printing process, not these die-cut metal allowances.',
      'The avionics static port is separate from the parachute chamber. Flange gasket, anchor seal and spigot seal prevent an intentional pressure passage into the electronics; actual sealing depends on the existing gas-unit installation. Verify gas tightness and release on a restrained bench assembly.',
    ];
  },
  notes:
    'Prototype assembly with manufacturing and material notes. The existing metal gas unit is represented by its installation cavity only. Shear loads, printed fits, seal design, actuator response and recovery shock capacity require measured verification. Export preserves separate named solids and manufacturing metadata; no TechDraw sheets are generated.',
  sources: [
    {
      label: 'DIN 7991 countersunk head envelopes: Bossard BN 4719, distinct from ISO 10642',
      url: 'https://www.tme.com/Document/66de287134764435c21ce37255cb401b/BN4719.pdf',
    },
    {
      label: 'ISO 4762 / DIN 912 socket cap screw dimensions',
      url: 'https://www.westfieldfasteners.co.uk/Standards/ScrewBolt-SHCap-M.html',
    },
    {
      label: 'Formlabs unfilled PA12 SLS material properties',
      url: 'https://formlabs.com/products/nylon-12-powder-10/',
    },
    { label: 'Prusa PETG material guide', url: 'https://help.prusa3d.com/article/petg_2059' },
    {
      label: 'Guehring: blind-hole tap lead, core-hole depth and entry countersink',
      url: 'https://guehring.com/de-en/products/threading-tools/',
    },
    {
      label: 'OSG M4x0.7 cutting tap example: 2.5P modified-bottom lead',
      url: 'https://osgtool.com/1652001708/',
    },
    {
      label: 'Nyfast DIN 965 PA66 M2.5x8 countersunk screw: MS-M025-0045-CSKP008',
      url: 'https://nyfast.com/nylon-screws-metric-screws-and-bolts/10748-51315-countersunk-phillips-screw-nylon-metric-din-965',
    },
    {
      label: 'NASA recovery systems: harnesses, U-bolts and through-ties',
      url: 'https://www.nasa.gov/wp-content/uploads/2023/09/nasa-sl-2024-arw-recovery-systems-508.pdf',
    },
    {
      label: 'Osculati 39.306.08 compact M8 eye nut dimensions (catalogue p. 739)',
      url: 'https://www.yachtshop.eu/PDF/OSCULATI/ENG_2026/741_OSCULATI_ENG_2026.pdf',
    },
    {
      label: 'JHEMCU JHE20B connection reference (selected envelope from user)',
      url: 'https://jhemcu.com/e_productshow/?53-JHEMCU-JHE20B-Finder-BB-Ring-100dB-Buzzer-Alarm-with-LED-Light-Support-BF-CF-INAV-Flight-53.html=',
    },
    {
      label: 'ZX908 manual mirror (selected envelope from user)',
      url: 'https://manuals.plus/wapuno/zx908-4g-gps-car-tracker-manual',
    },
    {
      label: 'Bossard metric thread tensile areas',
      url: 'https://www.bossard.com/global-en/-/media/bossard-group/website/documents/technical-resources/en/f-004-en.pdf',
    },
    {
      label: 'Leland 82122Z: 16 g puncture cartridge, 3/8-24 UNF, dimensions',
      url: 'https://www.lelandgas.com/product-page/82122z-cartridge-small-20ml-16g-carbon-dioxide-3-8',
    },
    {
      label: 'SpeedyBee F405 WING-MINI manufacturer manual',
      url: 'https://www.speedybee.com/f405-wing-mini-download/',
    },
    {
      label: 'Molicel P28A manufacturer data',
      url: 'https://www.molicel.com/product/inr-18650-p28a/',
    },
  ],
};
export default part;
