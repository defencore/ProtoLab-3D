# DDCS v4.1 integration and stock identity

This is the machine's control design and acceptance-test specification. No controller firmware, executable DDCS cutting program, electrical drawing or safety validation is supplied by the CAD generator.

## Responsibilities

| Layer                      | Responsibility                                                                                       | Boundary                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| DDCS v4.1                  | Operator display, X shuttle and Z saw interpolation, spindle speed command                           | Ordinary motion controller, not a safety controller                                                       |
| Process PLC + expanded I/O | Valves, pressure/position proofs, contact encoder, loading gate, stock ledger and discharge          | DVP14SS211T base has insufficient I/O alone; expansion, counter frequency and interfaces must be selected |
| Independent safety circuit | Emergency stops, access locks, monitored stopping, lift holding, restart interlock and module guards | PNOZ X3 is only one component; further safety logic/standstill devices and validation are required        |

The [Digital Dream manual](https://cncmaster.org/files/DDCS-V4.1-Users-manual-in-English-V1-20220914.pdf) specifies 18 digital inputs, three sinking outputs rated at at most 50 mA and a separate 0–10 V spindle reference. Use separate system/I/O 24 V supplies as specified; preserve analog isolation. Do not connect solenoids directly. Purchased PNP E3Z/E2B sensors terminate at compatible PLC inputs. DDCS receives isolated, electrically compatible handshake signals; PNP sensors must not be wired to its sinking-contact input circuit without conversion.

Proposed allocation (confirm on the installed DDCS firmware before releasing the schematic):

| DDCS connection               | Assigned function                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| X pulse/direction             | Automatic shuttle driver; inhibited in manual configuration                          |
| Z pulse/direction             | Saw lift driver, independent power-off holding brake                                 |
| OUT1 M3/M5                    | Spindle request to PLC/VFD interface; independent safety permission remains required |
| VSO / isolated analog return  | Spindle speed demand                                                                 |
| OUT2 M8/M9                    | Process request handshake to PLC, isolated input                                     |
| OUT3 M10/M11                  | Second process handshake bit to PLC; not an additional valve output                  |
| IN1–IN6, preliminary          | X/Z home and limits, installed module status                                         |
| IN16, preliminary             | Safety circuit status; configure emergency-stop function #157                        |
| Remaining configurable inputs | Cycle start, pause and ordinary process handshakes; finalize mapping against manual  |

Do not infer an industrial fieldbus, arbitrary expansion bus or high-speed material encoder input from DDCS Ethernet/MPG connections. The material encoder belongs to a verified PLC high-speed counter. Two request bits are a constrained handshake, not sufficient to wire each actuator independently. Macro wait/acknowledge, timeout and abort behavior require a hardware bench test; no generated program may rely on fixed dwell delays in place of feedback. The main motion program and PLC must both abort on lost agreement.

## Required process I/O schedule

Names below identify signals, not unverified terminal assignments. Size the I/O and cabinet from this schedule before ordering.

| Inputs                                                                   | Required evidence                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Material encoder A/B and contact validity                                | Actual tube travel; quadrature, calibrated circumference, contact-loss detection            |
| X/Z home and limit switches; drive ready/fault                           | Axis position and health; independent overtravel handling                                   |
| Saw down/up; spindle speed/standstill                                    | Mutually consistent position proofs; safety standstill is a separate rated function         |
| Feed jaw open/closed; stock and offcut top/side proofs                   | Use cylinder position and pressure evidence; a pressure switch alone does not prove contact |
| Normal and transfer pressure switches                                    | Independent regulator changeover completed                                                  |
| Queue beam, tail-clear beam, cutting-entry beam                          | New front, departing old tail and material at cutting station                               |
| Admission gate open/closed                                               | Sense the steel gate itself; actuator command is insufficient                               |
| Loading cover locked, module present                                     | Process status from independently monitored guarding                                        |
| Receiver entry/park, level/tip, chute passage, outlet clear, box present | Occupancy then clearing transitions, never an idle clear beam alone                         |
| Safety healthy, reset, cycle start/stop, keyed mode                      | Reset does not start; changing mode requires isolation and reset                            |

Outputs: feed jaw; stock top/side; offcut top/side; transfer-pressure selection; take-away, receiver and outlet drives; tip/return valve; loading conveyor drives; admission gate; spindle request and ordinary status lamps. Each inductive load requires a properly rated interface with suppression. Safety outputs are separately engineered and must not be counted as spare process PLC outputs.

## Positive separation and ledger

The stop blade at X−1700 spans the profile path and stops 1 mm above the continuous Z900 table. A 40 mm crank and ACE32x50 open it above the maximum profile. A queued nose stays on its upstream side. The downstream tail-clear sensor sits at `stop X + separation distance` (default 200 mm, minimum 160). Gate endpoints are sensed directly. A closed stop and an empty downstream tail zone provide a real gap; a gap is never inferred from elapsed conveyor time alone.

Only one active bar may occupy the loading lane. While a long active bar still crosses the stop, the gate stays open and the loading cover remains locked: the upstream drive may not push a second bar against it. After its tail clears, stop the loader and close/prove the gate before accepting the next bar. The shown loading conveyor is the modular interface and local enclosed station. A full-length single-bar loading enclosure and supplier-specific loading/guard hardware remain to be detailed; this is not a validated unattended bundle singulator.

1. Preserve the active bar ID and cumulative consumed length, including each kerf. The infeed measuring wheel does not reset the whole-bar ledger on every cut.
2. Before a cut, reserve its full `length + 4 / cos(angle)` advance and the retained tail. Automatic mode reserves 1150 mm because the home jaw is centered at X−1100. A 650 mm tail cannot be regripped at that home position. Manual mode uses a separate conservative 650 mm handling allowance.
3. When there is insufficient remaining length, stop cutting and enter the remnant procedure. Keep the next bar behind the proven closed gate. The fixed nip and take-away drive the intact remnant into the long receiver. `reject-cycle.ts` requires occupancy before tail clearance, a selected scrap route, and a full scrap passage pulse before permitting empty-zone confirmation.
4. Confirm saw down, spindle stopped, loader stopped, old-remnant removal and all downstream zones empty. Require a fresh removal acknowledgement plus the configured stable clear dwell (1000 ms default). Point beams alone cannot prove the entire bed empty. Startup recovery needs operator inspection; automatic continuation needs the ordered reject acknowledgement with the same bar ID, receiver empty and passage evidence.
5. Lock the single-bar loading cover, open/prove the gate, then admit. Observe the downstream leading edge before accepting the cutting datum. Stop the loader, face the new end and confirm the new datum and removal of the facing scrap. Only this sequence creates the next bar ID and latches its supplied stock length.
6. Count each completed cut once using `(bar ID, cut number)`. Reject repeated/stale events, missing encoder data, unexpected early tail, contradiction, timeout or attempted datum reset on an active bar. A power loss invalidates automatic restart; inspect/remnant-clear and re-establish a datum.

`lib/stock-cycle.ts` is an executable specification of those transitions. `lib/cycle.ts` requires `stockAuthorized` from the same ledger (`stockCanCut`) for each ordinary cut. Do not hard-code this feedback true in a real controller. First-trim length includes its kerf. Changing the angle or facing strategy requires a new datum. The UI displays remaining complete cuts and rejects a cut which consumes the grip reserve.

## Manual / automatic interchange

The cutting cell, hood, DDCS panel and electrical cabinet remain common; both feed and discharge modules detach. The side-grip shuttle, rails/screw/driver and powered loading rollers are removable modules using bolted docking pads with locating bores. The standalone model omits the complete feed and output hardware. Assisted mode retains measuring feed/discharge but omits the automatic admission station. Install fixed guarding and the coded manual-module connection when the automatic unit is absent; never jumper emergency-stop channels to imitate an attached module.

Standalone mode is **load and unload under the hood between stopped cuts**. With the saw parked/stationary and motion inhibited, release clamps and let the operator place the stock against a setup gauge. The removable feeder carries the material wheel. Confirm length, close/lock access and require a new start action before cutting. Supervised clamping is a separate spindle-inhibited step; the process output is not a safety-rated two-hand or hold-to-run control. No X motion or loading conveyor may energize in manual mode. Cutting with a raised hood, hand-guided cutting under a rotating blade and automatic restart after closing the hood are not supported modes.

## Safety architecture and factory acceptance

Three modeled Schneider XB5AS8444 latching mushroom stations have two NC contacts in powered configurations: operator console, infeed and outlet. Standalone mode retains the console station; remote stations detach with the modules. Add stations/pull-cord coverage along an extended loading line after the reach/access assessment. The keyed mode selector, separate reset/start controls and hardwired safety path are common to both configurations.

Both E-stop channels go to validated safety logic with contactor feedback. DDCS IN16 receives status only. Resetting the mushroom and acknowledging reset must not initiate motion: a separate new start is required. See [Pilz's reset guidance](https://www.pilz.com/en-IE/support/faq/standards/articles/180045). Guards stay locked until monitored spindle standstill and secured lift are proved. Loss of electrical power or air must not drop the screw-driven blade or release a held workpiece into a rotating blade; select and validate load-holding valves/brake accordingly. Simply dumping all clamp air on E-stop is not an acceptable assumed response.

The ATV12 is not assumed to provide safety-rated STO. Select the stop architecture, contactors and brake with the drive manufacturer; do not open motor-side contactors under load as an improvised stop strategy. A lockable mains isolator and lockable pneumatic isolation/bleed point are required for maintenance, in addition to E-stops. The safety relay alone does not provide validated standstill detection or all guard-lock sequencing.

Production release requires a machine-specific risk assessment and applicable standards review, complete electrical/pneumatic diagrams, assigned required performance levels, validated safety functions, measured stop time/access distances, containment and extraction verification, an installation/commissioning checklist and operating instructions. The CAD model and unit tests do not establish factory-safe or certified operation. `lib/safety.ts` tests the restart contract only; it is not a safety controller implementation.

## New process interfaces

`material-tracker.ts` measures physical bar length from the front/tail edge counts (80 mm sensor separation). Send a `physical-tail` event with its matching bar ID and measured length to `stockStep`; disagreement latches a fault. Once the wheel loses contact, do not extrapolate its encoder as remaining material travel.

`reject-cycle.ts` controls purge → positioning → scrap selection → dumping → return. The upstream next-bar restraint must remain proved throughout. In assisted mode this is the locked, single-bar loading zone and inhibited loading permission; in automatic mode it includes the admission gate. Receiver park before tail clearance faults as an oversized remnant. Loss of clamp-open proof, scrap selection, bin presence or guard status removes motion requests. The scrap beam must be clear before dumping, then occupied, then clear again; a permanently blocked beam cannot acknowledge rejection. The returned `newBarPermitted` flag only permits a `reject-confirmed` request to the ledger: the stable empty dwell still applies.

Additional I/O: leading-edge datum X−310; physical-tail X−390; cut exit X610; short receiver park X945; remnant park X2365; outlet X2470; scrap passage; two bin-present switches; scrap-selector good/scrap endpoint proofs; receiver level/tip proofs; traction cylinder open/closed and regulated nip pressure. Debounce, diagnostics and all motion timeouts are supplied by the PLC integrator. Endpoint sensors and valve interfaces without finalized supplier hardware remain commissioning requirements.

For assisted loading use `StockRecipe.mode = 'assisted'` and `operator-loaded` only after inspection/empty dwell, a stopped drive, a present bar and locked access. No gate-opening or loading-conveyor command is issued. `faced` requires `scrapRemoved` in both powered modes. Mode changes invalidate the running sequence; use the common restart contract.

The first facing cut uses `cycle.ts` with `destination = 'scrap'` and `shortPart = true` (the box route), keeping the stock clamp closed during offcut transfer. It must not use the whole-remnant purge, which opens stock clamps. Wait for scrap-selector proof before transfer, and qualify `chutePassage` from the scrap beam. Select the X2365 receiver park beam for facing pieces too long to clear entry at X945. After confirmed scrap removal send `faced`; production recipes use `destination = 'good'`. Loss or contradictory route proof stops the transfer.
