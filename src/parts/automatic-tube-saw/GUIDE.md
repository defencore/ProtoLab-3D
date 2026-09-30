# Automatic aluminium tube saw

## Operating envelope

Aluminium tube up to OD120 x wall4; 20–500 mm finished lengths; 230 V supply and compressed air; target accuracy +/-0.5 mm. Incoming stock defaults to an unconfirmed 6 m planning length. Square and rectangular profiles use interchangeable flat shoes; the custom-profile option is an envelope requiring matched tooling.

The rising blade, split datum fence, top and side pneumatic clamps, slotted metal table and enclosed cutting area follow the operating arrangement visible on the Metallkraft ULMS. This is an independent machine design, not a dimensional reproduction or a demonstrated equivalent of that commercial saw.

**Engineering review required.** Purchased component envelopes and modeled motions are useful for layout and review; they are not released manufacturing drawings or validated safety functions.

## Feed and length measurement

DDCS v4.1 controls the X shuttle and Z saw axes; a separate process PLC handles valves, sensors and stock identity. The assisted/automatic SFU1605 shuttle grips from the sides and moves stock along two HG20 rails. The standalone configuration removes infeed and discharge modules entirely, retaining the cutting table, hood and control cabinet. Assisted mode has measuring feed and discharge, but no automatic admission station. A spring-loaded Kuebler MWE21 contact wheel measures the tube itself, independently of the motor. With a 200 mm circumference and 1000-pulse encoder counted in quadrature, the increment is 0.05 mm. Resolution is not accuracy: wheel preload, surface condition, effective circumference and slip require calibration.

The recipe feeds `finished length + 4 / cos(mitre)` mm after establishing a faced datum. The per-cut travel counter resets once on entry to unclamping (or manual loading), independently of the whole-bar ledger. Feed stops within the adjustable measurement window; disagreement between material and axis travel beyond the slip limit, excessive overshoot or invalid measurement causes a latched fault. The PLC implementation must decelerate before the target; the TypeScript sequence does not implement the motion-control loop.

OMRON E3Z through-beam pairs observe material presence, receiver entry, receiver park position, chute passage and roller outlet. E2B inductive switches sense steel machine targets, not material length. The receiver entry signal must confirm the trailing edge has cleared; outlet-clear and chute-passage feedback must be qualified transitions after confirmed occupancy, not the raw idle beam state. E3Z/E2B process sensors do not replace safety-rated guard devices.

## Flat table and module boundary

All stock-contact surfaces share Z900. A continuous stiffened t8 infeed plate meets the t12 cutting table with a 0.5 mm assembly gap. No raised lower radius cradle remains in the shuttle: side jaws grip round, square or profile-specific inserts above the common support. The throat is flush and its only cutting opening is the 8 mm blade slot. A tapered steel bridge covers the belt nose recess; a 5 mm tangent clearance avoids a step or a large unsupported pocket. Grind/shim the real interfaces flush, break edges and verify stock sliding in both directions with chips present.

A generic custom-profile envelope does not ensure stable contact. Very thin lips or open sections need a matched sacrificial throat/tooling so an edge cannot enter the blade slit. The preview cannot replace those profile-specific checks.

The `Stock change` pose shows the admission stop between the old remnant and queued material. Read [DDCS integration and stock identity](CONTROL.md) for the I/O schedule, mode interchange, physical gap and restart contract.

## Workholding and cutting

The powered configurations have five ACE50X25SG workholding clamps (plus a separately regulated traction-nip cylinder): a guided side feed gripper, two vertical station clamps and two horizontal station clamps. Separate regulators set top and side force. The offcut top shoe is a narrow replaceable roller so a third, lower pressure setting can retain the piece during powered take-away. A stationary rear fence supports the side load. Slots and bolted feet reposition the tooling; external guide rods carry the offset shoe moment instead of side-loading the cylinder piston.

Round profiles use POM radius inserts; square/rectangular stock uses flat inserts. Adjustments shown for size and angle are manual setup changes with the machine isolated, not additional automatic axes. Jaw and fence dimensions must match the actual extrusion. Measure crushing/ovalisation and grip before accepting pressure settings.

The 500 mm blade rises through an 8 mm slot in a steel throat plate. Its carriage has two D25 guides, a screw lift beside the spindle, 2:1 belt reduction and a reserved normally engaged holding brake. A ballscrew is backdrivable. The brake, bearing housings, screw end machining, motor brackets and final fastener stacks need supplier-specific detail drawings and load verification.

Twenty-millimetre rings are limited to straight cuts. Tooling moves away from the blade at a mitre; for OD120 at 45 degrees the minimum allowed cut is 230 mm. Length is axial spacing between parallel faces. First trimming, opposite mitres and long-point/short-point dimensions require separate datum recipes.

## Offcut handling and cycle

1. Confirm guard locking, air, drives, blade down, receiver level and stock present. Grip the stock and release the station clamps.
2. Feed using the contact encoder and axis cross-check. Clamp from above and from the side on both sides of the kerf; confirm holding and spindle speed.
3. Raise and retract the saw with both station clamps closed. Only the down sensor permits side-jaw release.
4. Reduce the offcut top-roller pressure. Once side clearance and transfer pressure are confirmed, run the small-nose take-away belt and level receiver belt.
5. For a short part (automatic threshold adjustable up to 200 mm), confirm the leading edge at the receiver park beam and the trailing edge clear of its entry. Stop the belts, release the top shoe and tip the receiver 60 degrees into the enclosed chute and removable box. Confirm chute passage, return level and verify the receiver empty.
6. For a long part (at least 150 mm for the powered roller spacing), keep the receiver level and drive the piece onward to the closely spaced roller table. An additional powered roller at X2500 keeps positive drive while its trailing edge clears the outlet beam at X2470; do not rely on a free-coasting part to complete the cycle.
7. Open the feed gripper and return the carriage while the fixed stock clamp preserves the datum. Regrip and repeat. Reserve 1150 mm for the automatic home-gripper position (650 mm manual handling reserve). Stop before an ungrippable tail, open the shuttle and station clamps, then purge with the fixed traction nip and take-away belts. After cut-exit and receiver-entry tail clearance, select the scrap route and tip; require scrap passage followed by clearance and an empty receiver.

The receiver has a captive pivot shaft, bearing lugs, hard stop and two ACE50X200SG cylinders on pinned adapters driving 120 mm cranks. Its calculated pin spacing includes 20 mm adapters at both ends and stays inside the actuator stroke across 0–60 degrees. The three discharge powered rollers plus fixed traction roller are Interroll EC5000 24 V selections; the belt, nose bend radius, controller and ordered shaft geometry require supplier confirmation. Test transfer with chips and lubricant, loss of traction, stuck parts and a missing collection box. The rendered offcut positions illustrate stages; they are not a rigid-body dynamics simulation.

The cycle module is a testable process specification, not deployable PLC code. Timeouts and contradictory inputs latch a fault and remove motion requests. External guard locking, standstill detection, contactors and pneumatic load retention remain independent of ordinary process control.

## Guards, manufacture and component library

Fixed lower panels enclose the saw and belt drive. A hinged hood has a retained inspection window, stock-access tunnels, a guard-lock mounting position and rear extraction connection. The preview has a `Show guards` switch for inspection and a separate isolated hood-open pose. Removing a guard visually does not make unguarded operation permissible. Final containment, access distances, braking time, window material and tunnel geometry require machine-specific validation.

Use welded S235 hollow sections with machined guide mounting lands, steel bolted brackets and Al6082 carriage plates. Deburr all stock/contact and belt edges. Buy the blade and rated spindle transmission parts. Nominal metal threads keep FreeCAD drawings manageable. FreeCAD separates frame, feed, workholding, measurement, powered outfeed, tilting receiver, saw mechanisms, controls, guards and workpiece into groups.

The library includes blades, passive/powered rollers, ACE cylinders, drive motors, control components and measurement sensors. Source notes distinguish verified dimensions from envelope assumptions. In particular the MWE21 spring arm contour and mounting face, EC5000 shaft/crown interface, regulator envelopes, lift brake and guard lock still need final ordered drawings. Multiple visible subparts of one purchased unit are not separate BOM purchases.

## Calculations and cost

At 6 bar, a 50 mm piston produces approximately 942 N after the assumed 20% loss. Conservative friction holding uses the lesser of top/side thrust times the entered friction coefficient; neither cutting load nor friction is measured. The UI also calculates stock mass, screw thrust using running torque, drive margin, projected kerf and blade rim speed.

The accuracy allocation remains +/-0.50 mm and must be established by cut measurements; encoder increments and command pulses do not establish that result. The current cost is calculated by module in `lib/bom.ts` and shown in the configurator; assisted feed adds the measuring shuttle and long discharge module; automatic feed additionally adds the separation gate and loading conveyor. These are planning allowances, not current quotes, and exceed the earlier $4000 target before tax, delivery and contingency.

Before release, finish spindle fatigue/balance and bearing preload, verify lift holding and all fasteners, obtain ordered component drawings, complete electrical/pneumatic schematics and I/O expansion, verify continuous swept clearances with tolerances, and commission behind validated guarding. The ATV12HU22M2 is not assumed to provide safety-rated STO; its full-load 230 V supply must not be assumed compatible with a 16 A outlet.

## Mitre setup and modular operation

The throat cassette is stationary and keyed; it must be exchanged for the selected mitre slot while isolated. The saw parks with its centre at Z570 and its top at Z820, beneath the table and belt. Yaw is a manual setup operation at that depth. The complete fixed-length discharge module slides by `70 × tan(abs(angle))` mm (0–70 mm), then locks. A matching flat infill closes the nose recess. The belt is not stretched or notched to imitate rotation. `Separate modules` and `Mitre setup` preview states expose these interfaces.

- Standalone: load under the stopped/open hood, confirm position, apply supervised clamping, close/lock, start the cut, retract, stop the spindle, then unload. No feed axis, receiver or box signals are required.
- Assisted: the operator supplies one bar through the measuring feeder; close/lock the loading access before automatic measuring and repeated cuts. The automatic admission module is absent.
- Automatic: an upstream single-bar source delivers to the guarded admission station. The stop separates successive bars, each gets a faced datum, and remnants use the scrap route. A bundle rack/singulator is not modeled; the upstream one-bar source and full-length guarding remain an integration interface.

The receiver belt spans X695–2370, with a short-part park beam at X945 and a remnant park beam at X2365. A maximum recipe remnant is below 1656 mm (1150 mm reserve plus one advance); at the remnant park beam its tail has passed X700. The scrap selector uses two ACE50X100SG actuators and separate good/scrap bins. Positions are shifted together by the mitre docking offset. A 20 mm part uses the short park beam, not the end of the long receiver.

The physical-length tracker latches the leading edge at X−310 and trailing edge at X−390; the 80 mm sensor separation enters the measured length. The material wheel at X−350 can no longer measure after the tail passes it. At contact loss, remaining-distance output becomes unknown; the purge uses ordered downstream beams instead. Initial facing travel is raised to the minimum fixture-supported length plus kerf at a mitre; facing scrap must be confirmed removed before activating the production ledger.
