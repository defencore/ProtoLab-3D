# Fixed-angle band saw process contract

`lib/cycle.ts` is an executable acceptance contract, not commissioned PLC firmware. Faults latch until an isolated reset/new-bar procedure.

## Coordinate and scan contract

`axis` is the encoder-derived carriage position in mm from referenced home, bounded to 0–155 mm. `axisReferenced`, `datumCalibrated` and `toolingConfirmed` must be qualified inputs. `sensorHomeX` is the measured position of the optical switching plane relative to blade centre X=0 when the axis is home; nominally -165 mm. Calibrate it with the selected surface, sensor height, switching direction and low scan speed. `edgeAxis` is a fresh hardware capture of the detected-to-clear transition, not a software polling position.

Load the nose in X=-30 to -15, head raised and retained, band stopped, shelf empty and axis home. The side sensor initially sees stock. `securing` closes the fixed vise and opens BOTH shuttle clamps. Only confirmed fixed side/top closure, open shuttle and an empty edge latch permit `scanning`. The open carriage advances relative to stationary stock. The captured nose coordinate is `sensorHomeX + edgeAxis`; a nose outside the loading window faults. The axis returns home OPEN before gripping. Scanning a bar gripped by the travelling carriage would not measure its nose.

The sensor is a single reflective BGS head, not a through-beam pair or distance meter. Its optical path can see the fixed L wall while passing the station. The first scan continues beyond that wall: wall ends at X=-35 and the accepted nose window begins at X=-30. Setup must demonstrate one continuous detected signal followed by the actual nose edge, without surface-induced dropout or a downstream background return. Adjust sensitivity/height for triangular, polished or wet stock. A failed scan faults; do not bypass it. Presence/tail checks are accepted only at referenced home, where the beam is upstream of the fixed wall. It cannot independently monitor slip during a production feed.

The first feed target from home is `30 + kerf/2 - noseX` (55.75 mm for nose X=-25 and kerf 1.5). Thereafter the feed target is `finished length + kerf` (51.5 mm for a 50 mm part). The fixed vise holds the tube while the open carriage returns; the shuttle grips before the station opens. Position windows apply to the motor axis. `axisDrift` checks movement of the held axis, not movement of the tube inside its jaws. No removed wheel/gauge feedback is assumed.

## Cut and discharge

Feed → stopped axis at target → fixed side/top clamps and supported part → band at speed → metered descent → lower switch cancels contactor command → contactor-off AND measured standstill AND head-held proof → tilt shelf → complete occupied-to-clear chute pulse and empty shelf → restore shelf → raise/retain head → open/return/regrip shuttle.

The lower NC contact must interrupt the contactor command independently of the process PLC. An open contactor is not proof of standstill. The shelf remains level throughout cutting. A pressure/guard/drive/box failure or phase timeout removes motor/feed/head movement requests, retains the head and does not command a blind shelf return. Actual valve rest positions and pressure-loss retention require the electrical/pneumatic design.

The shuttle's side/top cylinders can share one process valve, but both actuator proofs must contribute to open/closed feedback. The head cylinder extends to raise and retracts under metered flow to lower. Slots are locked setup adjustments, not powered axes.

The first 30 mm facing piece increments consumed stock but not production count. Each completed production discharge increments count once. Stop before the next cut violates the 400 mm grip reserve. The remaining tail is removed manually. The facing piece uses the same box and must be separated.

## Required physical proofs

Safety loop, guards locked, air pressure, drive healthy; head upper/lower and lower NC; monitored head retention; band speed/standstill and contactor auxiliary; shuttle open/closed and fixed side/top closed/vise-open; referenced axis position, home and stopped; calibrated optical datum and fresh latch; shelf level/tipped/part/empty; chute passage and box presence; qualified tooling and phase-specific timeouts.

The PLC must implement acceleration, same-direction positioning, screw lead compensation, signal qualification, fresh-latch arming, scan-speed limiting and watchdogs. Requalify length after changing blade, jaws, pressure, material or calibration. Motor feedback cannot detect clamp slip, screw pitch error, backlash or blade wander by itself.
