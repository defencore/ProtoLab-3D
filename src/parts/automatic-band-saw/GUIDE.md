# Automatic band saw — fixed 90 degree cuts

## Intended machine

One operator loads one aluminium tube, up to 2,000 mm long, on a passive roller bed. A short ballscrew shuttle indexes the bar from a carriage-mounted optical nose reference and motor encoder to make 30–100 mm parts. The bow pivots through 0–35 degrees about the driven wheel. The pivot is parallel to the feed axis: the blade stays in the X=0 plane, perpendicular to the stock. The motor, reducer and table are stationary. The previous circular-saw package remains a separate concept.

The design continues the OD120 x wall4 aluminium assumption from the earlier brief. Editable round, square, rectangular, triangular and oval sections span 30–120 mm. Other alloys, solid bars and arbitrary extrusion profiles require a cutting-load/tooling review. This is an engineering layout and executable process specification, not released manufacturing drawings or PLC firmware.

## Main moving mechanisms

1. **Indexing shuttle:** a 425 mm SFU1605 shaft, custom bored fixed/floating supports, two 400 mm MGN15 rails and an encoder-equipped NEMA23 index the stock through 155 mm. Both shuttle and station have an L datum and side/top pneumatic shoes. The station holds the stock during shuttle return.
2. **Pivoting bow:** two 6010 bearings support the bow on a fixed hollow D50 trunnion. A separate D30 wheel shaft runs inside it on two 6806/61806 bearings. This separates bow rotation from blade drive; the motor and reducer remain bolted to the frame. The 63 x 500 cylinder lifts the free end beside the idler wheel. Extension raises that end; controlled retraction lowers it. The cylinder pivots at both ends and carries no guide moment. Nominal pin distance changes from 735 to approximately 1149 mm, using approximately 414 mm of its stroke. The model has no vertical head rails.
3. **Dropping support:** a shelf begins 4 mm downstream of the blade and supports the short part during the complete cut. Blade guides remain outside the full support width. A cantilevered hinge shaft has two bearings beyond the 100 mm part zone. An MA32 x 100 cylinder drives a 70 mm crank through 70 degrees; a mechanical stop carries the closed shelf. After band standstill the shelf tips directly into a box through a short chute. No takeaway belt, powered rollers or sorting conveyor is used.

The moving bow uses a 60 x 60 x 3 mm steel crossmember, relieved wheel plates and aluminium wheels. The 40 kg moving-head allowance excludes the stationary motor/reducer; it is not a weighed assembly. Torque checks assume a bow centre of gravity 354 mm across and 65 mm above the pivot at the bottom position. The minimum calculated lift torque margin is about 7.63 at 6 bar with an 80% force allowance. Recalculate from the delivered parts and check frame stiffness under band tension.

The nominal band loop is 2360 x 20 x 0.9 mm around 300 mm pitch-diameter wheels. Wheel spacing is derived from loop length; blade twist and real wheel crowns require final tension adjustment. The band is flat on the rims and twists outside the cutting guides. The guide plane is perpendicular to the feed axis. Tooth pitch, blade alloy, tension, band speed and downfeed depend on the actual tube and delivered blade. The kerf setting is the measured tooth-set kerf, not the 0.9 mm blade body thickness.

## Loading, datum and accurate feed

Load with the head raised and retained, band stopped and motion isolated. Put the nose in X=-30 to -15 mm. The fixed vise holds the stock while the OPEN shuttle scans forward. A side-mounted reflective BGS sensor captures the nose with a hardware-latched axis count; the shuttle then returns home before gripping. Its nominal beam offset is +190 mm from the carriage centre, or X=-165 at home. Calibrate this offset relative to the blade; the loading mark is not the datum.

The first advance is `30 + kerf/2 - measured nose X`: 55.75 mm for nose X=-25 and kerf 1.5. This removes a nominal 30 mm sacrificial facing piece. It drops into the same box and must be separated. Production feed thereafter is `finished length + calibrated kerf`: 51.5 mm for a 50 mm part. The library NEMA23 encoder resolves 5/4000 = 0.00125 mm of nominal axis travel. Resolution is not finished-length accuracy.

The BGS optical sensor sits beside the fixed L reference. While crossing the station it can see the datum wall; the accepted leading end lies beyond that wall. Qualify uninterrupted detection through this passage and rejection of downstream background. Presence/tail detection is valid at carriage home, upstream of the wall. This is not a continuous stock-motion measurement; polished, wet and sloped surfaces require trials.

Both fixtures use the same L datum: horizontal support Z=900 and a fixed side face Y=-60. Changing section width does not recenter the stock. Two simple cylinder angles have vertical/lateral slots and large mounting washers; loosen, set the pressure shoe, then tighten before operation. Side pressure seats stock against the wall and top pressure seats it on the floor. The shuttle has the same side and top contacts as the station, avoiding a change of locating scheme during regrip. Its two cylinders share a process command; the gripper-closed/open proofs must combine both cylinder sensors.

Round and oval sections contact the floor and wall tangentially. Square/rectangular sections seat on two faces. Triangular tube is loaded base-down; a small replaceable side shoe follows its sloping flank. Top contact must be qualified for wall thickness and apex damage; no universal clamping force or roll stability is assumed. Slots provide setup adjustment, not automatic centring. Confirm dry/wet grip and alignment with a master bar before enabling the cycle.

The carriage remains servo-held and gripped while the station closes. Axis drift or overshoot faults the cycle. The motor encoder cannot see tube slip, clamp-induced tube shift, screw lead error or backlash. These errors must be controlled mechanically and measured in cut trials.

The requested tolerance is ±0.20 mm. Default planning allowances sum to ±0.20 mm: 0.03 initial optical datum, 0.05 axis positioning, 0.05 unobserved grip transfer, and 0.07 kerf/alignment. These are acceptance allocations, not measured capability or supplier guarantees. The initial optical datum primarily affects the facing cut; subsequent lengths depend on each commanded index and grip transfer. Calibrate the screw against an external length standard across its working stroke, approach feeds in one direction, measure real kerf and qualify dry/wet grip. Measure at least 30 consecutive parts per selected length/profile at the beginning and end of a bar; record every error and reject any part outside tolerance.

The roller nearest the shuttle is at X=-580: its downstream surface is X=-555, whereas the moving fixture begins around X=-400 at home. No roller lies in the carriage's horizontal sweep. The common frame has four main legs and two infeed legs. Lower side ties and bolted corner straps connect the frame; the infeed bolts to saddles on it. The lift-base bracket shares the frame, and the cabinet uses one profile on a cantilever from that frame, with no separate floor feet. Stiffness and vibration still require load qualification.

The same cylinder brackets cover stock heights 30–120 mm: side-cylinder vertical slot centre range Z=915–960, and top-angle fastening range Z=1129–1219. Loosen the collar/angle bolts, move the hardware, then retighten. The post does not change height with the stock parameter. L shoes remain tooling sized to the profile.

## Cycle and lower switch

The cut sequence is optical setup scan → return and grip → encoder-controlled feed → stop and clamp → run band → controlled descent → lower switch cancels contactor request → measured standstill → tip shelf and confirm discharge → restore shelf → raise head → open/return/regrip shuttle.

The lower switch has an NC contact in the contactor command chain, and a separate PLC position input. A lower-switch event cancels the contactor request immediately. The controller does not equate an open contactor with zero speed: independent standstill proof is required before dumping or raising. The stock remains held during stopped-blade withdrawal through the kerf. Validate that return does not drag teeth or mark the remaining stock; adjust guide alignment and kerf relief if required.

The pneumatic downstroke requires meter-out flow control and a separately regulated descent branch. Do not apply unrestricted shop pressure downward. Air compressibility can cause stick-slip at low speed: commissioning must demonstrate stable cutting descent across the load range. If air control cannot achieve that, a separate hydraulic checking damper is required; an end-of-stroke pneumatic cushion is not a full-stroke speed regulator. No oil may be substituted into an ordinary air cylinder.

A monitored spring-applied head retention device is reserved around the lift rod. Its exact supplier model, capacity and release circuit remain to be selected. The 5/2 process valve alone is not head retention on air loss. Fixed containment, loading access interlocks, enclosure locks, inlet isolation and standstill monitoring must be completed before automatic operation.

## Tail and reload

The 400 mm tail reserve ensures the remaining tube still reaches the home-position gripper. After the next full cut would violate that reserve, the machine finishes the current part, raises/retains the head and stops for operator removal and a new bar. There is no unmodeled promise to automatically eject a long remnant. A 2 m bar yields 30 production parts of 50 mm after the facing piece, with approximately 423.5 mm remaining at the default 1.5 mm kerf.

The support reduces sag and tearing at breakthrough. It cannot guarantee zero burr: blade sharpness, tooth pitch, cutting conditions and fixture stiffness still determine the edge. The preview illustrates stages; it is not a dynamics or cutting simulation.

See [PROCUREMENT.md](PROCUREMENT.md) for commercial references and [CONTROL.md](CONTROL.md) for the I/O contract.

## Profiles and visible hardware

Round, square, rectangular, triangular (apex up) and oval hollow sections share the fixed L datum. Both clamps open 12 mm. The stationary floor ends before the kerf; a separate shelf supports the finished side. Real bow, twist, seam and profile tolerances need a loading trial and slow approach. The model uses adjustable bracket slots and separate fasteners, with drilled mating holes.

Bearings now show separate inner/outer races, rolling elements and cages. The feed screw has stepped support journals, a flange nut and return pickup. Pneumatic bodies have separate barrel/end-cap surfaces, ports, rod wipers, switches and rod connections. `Feed drive · bearings and ballscrew` and `Head · pivot and pneumatic lift` isolate assemblies for close inspection. Standard mounting envelopes are not interchangeable with supplier-certified CAD; internal bearing race/cage geometry is illustrative.

Threads are always shaded with their specified helical pitch in the normal preview. This is render-only flank relief on the nominal surface: it adds no helical triangles to STL and no helical faces to Python. The preview's silhouette and exported nominal diameter remain unchanged. Manufactured thread size, direction and depth still require the drawing callouts.

## Reused library components

The machine composes the existing `linear-guide` renderer and Python builder directly. Feed uses four MGN15C blocks on two 400 mm rails. The head uses the coaxial pivot described above. Confirm rail/bearing loading, preload and delivered dimensions before manufacture.

The feed motor is the library closed-loop NEMA23 23HS30-2804-ME1K with laminated body, end shields, mounting pilot, shaft, bearing rings and encoder cover. The band drive reuses the BEVI 90L-2 library motor, including cooling ribs and fan cover, behind a provisional reducer. Reducer ratio, torque rating, input/output adapters and band speed still need final selection. Visible motor internals and casting contours are representative. The old circular saw now also reuses library feed guides and the detailed feed/lift motor.
