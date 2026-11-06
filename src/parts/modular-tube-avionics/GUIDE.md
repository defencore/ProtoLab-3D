# Modular Ø90/86 tube avionics

## Current construction for new manufacture — 2026-11-06

Use `modular-tube-avionics:d90-86-imx577-19x19` for the selected camera, or
`modular-tube-avionics:d90-86-ov9281` for the sourced OV9281 cartridge. These are
configurations of the existing family, not separate packages. All linear dimensions are millimetres unless stated otherwise. The current
construction is supplied as a complete new-print product. The Type-C flange
fastener holes are transferred from the actual receptacle. The other mounting
holes, coupling seats, bearing faces and cable passages are present in its
native geometry. Earlier conversion instructions and auxiliary drill masks are
historical and are not part of this construction or its manufacturing kit.

The organizer and curator retain **Vehicles → Vehicle structures → Model
rockets → Modular tube avionics**. New manufactured occurrences use the existing
`manufactured-detail` contract and native ESKD identity resolver. Purchased
products retain their source models, dimensions and identities. The Type-C
example reuses Connectors & Interfaces → PCB connectors through the
`signal-connector:nikom-a448027` source reference. Avionics presets, parameters
and inspection states retain their existing IDs.

**Copy for FreeCAD** and the standalone macro include the cut Ø90/86 tube as
a separate reference in the All and Flight assembly views. The Cutaway view
copies the half tube. **Show tube reference** controls browser visibility.
STL, print layouts and the project bill of materials use the physical pieces.
Magenta identifies TPU in both the browser and the standalone FreeCAD model.

### Requirements, resources and concept decision

Established inputs are the D16T tube OD90/ID86, Ø85.6 inserted core, PETG
structure, TPU 95A interfaces, two Ø6 wire bundles, Ø1.5 insulated terminal wires,
user-measured M3×10 couplings and the two actual camera choices. The user also
confirmed the lower holder's 78 × 59.6 × 21 exterior, separate 4 mm terminals,
57.3 overall three-can width and 1 mm can-to-rim recess. The receiver/antenna
remain the user-defined 25 × 13 × 4 and 20/10/25 mm fitting references.

The function is to locate the electronics positively while keeping vibration
isolation, service access, straight assembly paths and simple printable stock.
The ideal result uses the enclosure, frame and existing fasteners to retain
components without separately handled conversion gates or hidden flexible
latches. The main contradiction is positive capture versus easy insertion and
printing. The selected transformations separate assembly stages: load open
seats vertically, then close them with rigid bolted members; put compression
stops in the frame and compliant contact in simple TPU pieces.

| Subsystem         | Selected construction                                                                                                               | Alternatives and selection basis                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coupling capture  | Four integral compression towers and side-loaded M3×10 couplings in the flight frame. Opposed flats resist tightening torque. | Loose compression posts required Grandado to be fitted before the couplings were secure. Integral towers preserve the bearing faces. The side opening also gives access to apply a small positioning dab on the blind end of the pocket if needed. |
| Flight controller isolation | One rigid PETG carrier holds WING on top and LCH7 underneath. A single TPU isolator carries the cassette on four supported screw axes. | The individual platforms needed shelves, folded flanges and access from opposite sides of the frame. A full TPU deck would carry the board stack in bending. Separate the rigid mounting and damping functions, then assemble the cassette on the bench. |
| Flight USB access | Put USB/Wireless on the forward Grandado pillar and a field-drilled Type-C panel on the aft side. Both ports face the lower access window. | The previous deck mount put its port inside the tube. The aft candidate for the USB/Wireless board crowded the WING aft harness. The existing pillars and lower window provide bench mounting and service access without another tube opening. |
| Pi isolation      | Wider keyed TPU frame and one hard carrier. Four integral TPU eyelets are closed by the original four Pi stack bolts and boards.    | Separate lined bars require more parts and fasteners; a direct soft clamp needs additional metal stops. The hard insert and integral eyelets preserve the original clamp stack and close with its existing bolts. |
| Auxiliary devices | Two open TPU cases with keyed screw feet: buzzer ahead of Pi, tracker beneath it.                                                   | An enclosed roof crowds the Pi port reserves. Open cases and thin removable tape preserve service faces; the forward foot uses a verified pre-camera bench order.                                                 |
| Power             | Five PETG pieces and one lower-holder TPU liner; UPS sockets face the XT60 panel.                                                   | The delivered UPS already bears on the separator, and an additional TPU layer prevented closure. No speculative second liner is added.                                                                            |

These decisions use functional trimming, reuse of existing bearing/clamping
resources and separation by assembly stage. No unverified numbered TRIZ mapping
or load rating is asserted. The engineering boundaries are the electronics
mounting structure and its tube interfaces; the vehicle's recovery attachment
remains a separate metal/tube load path.

### Retain the already printed TPU — current carrier revision

The user's existing TPU frame `7E3C91D1F656A6E5`, nose frame
`2BB05A1C3249F318` and camera keeper `F9BE7C866E6E7052` are fixed physical
interfaces. Their complete parameter records, native recipes, factory forms,
poses and delivered files are preserved exactly from release `6321f6f583eb`.
Only the hard Pi carrier changes, from `6EBA2A0036122634` to
`16962BC3FBEC90B7`. All suffixes are `PL3D.MANUFACTURED.DETAIL-…` executions.
The intervening `67D126…` / `3F045…` paired design is historical and is not the
carrier/bed pair for these retained prints.

The required function is to support the same four bolted board stacks and close
its soft retention keys without thin pad connections, extra hardware or a new
TPU print. The ideal result uses the existing carrier slot and backed cup floors
as the load path. The contradiction is mounting-pad strength versus the fixed
12.4 mm cup and R6 eyelet envelope. Widened/deeper pads and low full-width ribs
conflict with that printed envelope; forcing their fit is rejected.

The selected design retains the original 12 mm deep pads and adds six short
integral PETG compression feet inside the existing cups. Four forward feet are
3 × 2.4 mm; two rear outboard feet are 6 × 2.4 mm. They extend from Z−8.2 to
−8.7: a 0.2 mm root overlap and 0.3 mm external projection provide 0.1 mm nominal
compression into the unchanged Z−8.6 TPU floors. All six full footprints have
2.4 mm of existing TPU and the actual printed PETG frame immediately underneath.
Rear inner feet were rejected because that location is not directly backed;
shifting them onto the aft bar would require a different, thinner-floor support.
The chosen fore/rear nominal contact areas are equal at 28.8 mm² each.

Broad 3 mm-thick in-plane return bars and four 3.7 mm-wide ties route load around
the eyelet recesses. The old inner/outer 0.2 mm feather margins are removed,
while the ties retain the original central end bars and their axial TPU contacts.
The rear return center is fully open to the tie edges, preserving the real
microSD keepout without a 0.35 mm leftover bridge or unused inward fingers.
All root sections and the single-solid connection are checked in native CAD.

The selected resource reassignment puts pad reaction directly onto existing
supported TPU and uses free space above it for stiff return paths. Feet alone
would leave the notched returns; full-depth trimming without new ties would
isolate the original end-bar centers. The combined design removes those harmful
interactions without changing the user's printed pieces or four source clamps.
This is one complete replacement carrier, not separately glued-on feet or a
conversion kit.

The original PCB, sleeve, nut and bolt planes remain unchanged, including the
3.03 mm hard bosses and actual nut/PCB bearing faces. Old carrier/TPU contacts
are retained exactly; six new foot contacts add 5.76 mm³ of bounded soft
compression, giving 17.34 mm³ total. Source board poses, old eyelet geometry,
source hardware, ribbon/port reserves, both Ø7 routes and assembly paths remain
unchanged or are checked against the newly added stock.

The durable native verifier checks the removed feather regions, full 3 mm
return/tie/end-bar sections and all six complete carrier/TPU/PETG backing
footprints. Its actual superseded-carrier negative control fails and the new
carrier passes. These are geometric load-path checks. No vibration spectrum,
service mass/CG, clamp preload, actual printed fatigue/creep allowable or
physical fatigue life has been established. Generic PETG properties or eight
walls/100% infill do not constitute such qualification. The paired-strengthening
study and its material-source boundary remain in the historical record below.

### Layout and fixed interfaces

X increases aft. Z points toward the Grandado lid. Source electronics remain in
their own local frames and are placed by explicit occurrence transforms.

| Interface              | Current nominal geometry, mm                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Tube and inserted core | OD90 / ID86, coreØ85.6; covers and fairing are fitted after insertion.                                                               |
| Nose module            | X−255…−70; removable 175 mm shell, aft keyed disc, camera and compute assembly.                                                      |
| Flight module          | X−70…70; Grandado source body translated Z26.7, WING above LCH7, USB access at both ends of the lower window.                         |
| Wiring spool           | X70…120; accessible connector and wire reserve.                                                                                      |
| Power and tail         | Power begins X120; integrated PETG rear closure ends X257, separate TPU buffer ends X262.                                            |
| Main wire passages     | Two continuous Ø7 reserves for the requested two Ø6 bundles; common straight centers Y±37.3/Z−10, with source-safe nose transitions. |
| Cover fastener axes    | X±36.5/Y±24, upper/lower bearing planes Z35.6/−34.2, total grip69.8.                                                                 |
| Grandado ears          | X±49.5/Y0; M3×16 DIN912, broad M3 washer and supported DIN934 M3 nut at each ear.                                                    |

Both camera presets use the same tube profile and external marking kit. Diameter
changes beyond D90/D86 are not qualified or exposed as arbitrary sliders.

### Bench-captured coupling mount

`pcb-standoff:user-m3x10-af4-7-ac5-2` is the measured M3×10 coupling: AF4.7,
maximum corner envelope5.2. The native source model is a hexagon intersected
with a cylinder; unknown chamfers, irregular corners and thread details remain
unknown. The Dremec AF5.5 execution remains a different, unchanged library product.

The flight frame has 4.9 mm between opposing flats and a 10.2 mm high side
entry at each M3×10 coupling. The integral Ø9 towers terminate on the unchanged
Grandado floor at Z9.2. Load each coupling from the side on the bench. The flat
walls react tightening torque and the upper and lower PETG bearing faces react
the corresponding cover screw tension. The side opening remains accessible for
a small positioning dab at the blind end if the coupling slides during handling.
Keep adhesive off both bearing faces, the flats and the threads.

The objective is to keep the two cover screw paths and the user's measured
couplings while removing four loose compression posts. Assembly access improves
when the nut loads sideways. Integrating the post avoids loose print parts and
preserves the original tube fit. Side handling retention and structural clamp
loads act at separate faces.
The frame, cover and fastening axes remain in the same library family for both
camera presets. The revised frame and representative coupon have new executions.

Fit the measured coupling in the printed coupon first.
Check that both cover screws can be started by hand and do not meet inside the
nut at the actual bearing heights. Remove support from every socket, keep the
printed bearing faces flat and confirm the actual tightening torque on a sample.
The screw axes of the Grandado ears are outside the window. Fasten both ears
before inserting the module. The existing lower window and cover remain in the
assembly for the ELRS receiver, antenna and lower cover screw bearings. Remove
the cover for access to both service ports. Withdraw the core for access to
the original LCH7 USB connector.

### Shared flight cassette

The required function is to service the two flight controllers as one rigid unit
while keeping the TPU isolation and retaining the carrier during a pullout
event. The 3 mm `flight-board-carrier` replaces the three separately shaped
board platforms. The `flight-board-isolator` is one TPU 95A ring with four
through eyes. WING attaches to rigid lands on top. LCH7 hangs
from rigid hole lands underneath. WING and LCH7 use the tube centerline Y0.
The previous 6 mm WING offset belonged to the earlier flight layout. USB/Wireless
now uses the front pillar independently of the isolated controllers.

Both controllers now clamp at all four source holes. The previous diagonal
fasteners held two corners of each PCB and the remaining corners could lift
or flex under a moment about that diagonal. Four equal fasteners distribute
the clamp across the entire mounting pattern. WING uses four M2 × 6 DIN 912
screws from below in cylindrical counterbores. LCH7 uses four M2.5 × 10 DIN 912
screws, Ø6 washers and locking nuts in the open hex seats of the deck. Only two
diagonal LCH7 lands locate the PCB. The other two provide clearance and clamp
without forcing all four printed locators to agree with the hole pitch.

The common isolation separates the load path from the retaining screw path.
Four M3 × 16 screws pass through wide washers and Ø5 / Ø3.4 × 6 mm plain hard
sleeves into raised nuts seated under the PETG frame. The six-sided working
seat is closed around each nut. Load each nut from below through its straight
hexagonal seat before inserting the frame into the tube. The sleeves take
tightening compression. Each washer overlaps the carrier's clearance bore to provide
a hard pullout stop. The washer contacts the TPU lip at nominal 0.2 mm free-form
compression with clearance to the rigid carrier. Specify measured equivalent
metal sleeves or a DREMEC custom order of these nominal dimensions. Tool access,
thread engagement, printed fit, clamp torque and flight loads require checks
on the actual hardware.

Assembly is on the bench with the flight module withdrawn and Grandado removed.
Load the four LCH7 locking nuts from above before installing WING. Fit WING from
below, then bolt LCH7 to the underside. Gauge all four
WING blind thread depths and verify the LCH7 washers clear actual components
before applying clamp torque. Engage
the flexible eyes in the carrier before inserting the rigid sleeves. Lower the
cassette straight onto the four frame seats and fit the sleeve, washer and screw
at each seat. Plug
the boards after fastening the cassette and retain slack in the harness.
Reinstall Grandado by its two ear screws before sliding the module into the
tube. The lower radio cover and its screw bearings are reused.

Native checks passed for the 55 mm bench drop at 111 positions, the individual
source PCB contact and driver paths, four underside nut entries, six rigid
clearance probes at ±0.5 mm, and the axial insertion envelope. Each washer
provides 21.76 mm² of nominal hard backup bearing after 1.0 mm of lift. This
geometric check does not assign a load rating to the printed stack.

The revised PETG frame `3725F44FE80CE24B` and shortened deck `EBE46609B310C525`
share the same executions across both camera presets. The original centered
deck `E32BB570584E4ADC` fits with its USB hardware removed. The old tongue leaves
5.9 mm above the modeled Type-C body. Check the real socket, solder joints and
harness in this space before retaining the original deck. The TPU
isolator `1DFC14A21284A926` retains its physical definition. The earlier
two-screw deck `0D124007D02D6A23` and offset deck `7C79F0C65BB39F4A` are
historical. Clear the four cylindrical WING head wells before inserting hardware.

### Lower-window service ports and nut seats

Fit the SpeedyBee USB/Wireless board to the forward Grandado ear pillar on the
bench. Its M2 × 6 screws engage side-loaded M2 nuts. Load the nuts slightly
toward the nose to pass the neighboring coupling column, then draw them against
the bearing faces with the screws. Two rooted pads bear against the bare PCB
near the mounting holes. Stops 0.1 mm above its upper edge limit upward travel.
The port faces down through the existing lower window and a 7.2 × 14 mm opening
in the frame. Confirm the actual plug housing reaches the recessed socket.
Route the upper lead clear of the Grandado ear screw and the controller cassette.

The opposite pillar supports a 4.5 mm PETG drilling land. A nominal
5.6 × 10.4 mm access opening leaves both ends of the flange land solid.
Use the actual NIKOM A448027 receptacle and mating plug to check reach and
to transfer-drill the two fastener holes before electronics installation.
The supplier lists an unordered 10 × 7 × 14 mm envelope and Ø2.1 mm holes.
The flange thickness, centres, fit through the land and plug travel require
measurement. The LCH7 harness and panel fasteners are not specified.

The two wire passages are Ø3 through the PETG pillars at X±50.5 and Y−8.5.
Route wires before terminating them. The Grandado shell and the tube use their
previous openings. Each cassette nut loads straight into a 5.8 mm across-flats
hexagon from below. The straight hexagon replaces the rectangular entry relief
in frame `1833020301C09B8F`. The bearing height and fastener stack are identical.
The Grandado pillars
are 12 mm across X and leave 3.4 mm above the side-loaded ear nuts. The cover
coupling columns leave 3.3 mm above their nut slots. Use the existing
anti-rotation couplings and load them from the side before inserting the frame.
The optional coupling coupon follows the new roof thickness. Its working slot
dimensions are the same as those on the previous coupon.

Native bench-path checks covered the USB/Wireless board, its screw driver and
staged nut entry, the Grandado ear nuts, the cassette nuts and the cover
couplings. A 6.4 × 12 mm plug-body gauge reached the USB/Wireless mouth through
the 3.15 mm recess with 0.20 mm minimum nominal frame clearance. The raised
cassette sockets retain at least 2.20 mm around the hex section in the measured
planes. Both Ø3 bores are straight and clear of the modeled hardware. These
checks establish geometric clearance and assembly access on the CAD model.

The centered WING rear connector reserve reaches the aft ear pillar at X43.5.
Its full 25 mm gauge has zero nominal clearance and overlaps the pillar when
shifted aft by 0.5 mm. Check the selected right-angle connector and wire bend
with the loaded cassette before inserting the frame. A straight plug gauge in
the original LCH7 USB port intersects the TPU ring even with a slim
7.8 × 2.1 mm cross section. A wired panel receptacle must therefore use a
physically verified connection and routing. The verified lower-window access
is to the panel receptacle and the SpeedyBee accessory.

### Open compute and auxiliary mounts

The Pi's USB-A/Ethernet faces point toward the camera. Its source Pi, PCIe
adapter and SSD form a rigid island on the carrier. Four metal compression
sleeves and board fasteners stay on that island; they do not clamp it directly
to the main frame. The existing custom sleeve execution is 5.6 OD/2.8 ID/
19.694 length; it is a custom-order metal item, not an automatically printable
part or a stock availability claim. The full BOM retains that distinction.

The wider TPU frame engages closed, bevelled grooves in the PETG body. A hard
carrier is the anti-collapse key: installing it prevents the outer TPU keys from
contracting through the groove throat. Four closed TPU eyelets then fold into
side-open carrier mounting rebates. The original four Pi stack bolts and boards
close those eyelets, providing explicit upward carrier capture as well as bed
retention. No separate upper bars, upper liners or eight bar fasteners remain.
Groove entry requires about 4 mm overall reversible narrowing of the empty TPU
frame. Its insertion force and elastic recovery must be checked with the actual
95A print; the CAD does not establish either value. Insert it before its nuts,
hard carrier or electronics.

Central Ø5.6 hard bosses meet the actual PCB underside and preserve the original
board, sleeve, nut and thread planes. The bolts clamp the hard stack, rather
than an added serial TPU layer. Captive nut cages permit top-entry tightening
after the nuts, empty TPU frame and carrier are seated. The reinforced carrier
is printed with the dense structural process because it transfers mounting
loads and prevents bed withdrawal.

Independent source-bound checks measure 18.4726 mm² hard-boss contact on the
actual Pi PCB and 13.4223 mm² nut-to-carrier bearing at each of the four mounts.
The entire nut bearing lies beneath the hard boss projection. The 3.03 mm hard
load path preserves the original clamp planes. Four straight nut-loading hulls
through the empty TPU frame and four top driver corridors are clear. The actual
thread nominally passes the Nyloc element by 0.62 mm; this is a nominal source
check, not a fastener-tolerance or TPU material qualification.

The TPU frame has distinct native installed and manufacturing forms. Its eyelets
are printed upright, then folded on R6 hinges after the empty frame and hard
carrier are seated. The straight free length equals the developed neutral arc
length; material-volume equality is a manufacturing gate. Both forms are one
physical component with one parameter record, ESKD identity and material quantity.
Only the selected geometry state differs. No installed horizontal overhang is
silently used as its support-free print file.
Fold the eyelets manually before placing Pi; do not use its bolts to force
upright TPU tabs into the rebates. The bolts tighten against the hard bosses.

The wide groove starts behind the narrowing fore ogive and stops before the
rear wire mouth. Its double-bevel section has self-supporting 45° faces. The
source USB-C service zone interrupts the key/roof rather than leaving a thin
roof beneath the connector cut. Actual clipped wall stock, key engagement,
intermediate eyelet folding, PCB underside clearance, tightening access and
±0.5 rigid-island reserves are checked against the retained source geometry.
The R6 bend gives an approximately 11.7% geometric outer-fibre assembly strain;
that number does not qualify the actual TPU grade's strength or fatigue life.

The four original stack bolts deliberately perform the closure function. To
remove the carrier, first remove the fairing and disconnect leads, then remove
those bolts, the upper adapter/spacers and Pi. Unfold the four TPU eyes before
lifting the bare hard carrier; only then flex the empty TPU frame out of its
grooves. A complete bolted Pi island is not the carrier's assembly/removal path.

JHE42B is installed transversely between the camera and Pi at nominal
[−202,0,−20.1], Z rotation90°. ZX908 sits below Pi at [−145,0,−24.3]. Their simple
TPU cases are open at service faces and fixed by broad keyed mounting feet,
sourced screws and broad washers. Thin removable tape follows recessed routes;
the finder route is limited to 0.2 mm to preserve its port clearance under the
Pi motion reserve. Source device clearances/tape remain accepted user inputs.
The finder foot and camera cartridge use the documented bench assembly order;
fully assembled vertical extraction is not assumed.
The finder mounting axis is X−217.5; the device itself keeps its stated source
pose. Open full-height service notches admit the Ø9 washers and nut tools after
the cases are seated. The nearby rigid camera stop retains 2.6 mm of stock.
The forward plate has a net 118.56 mm³ root lap after the tape slot, including
one continuous 5.9 × 3 mm side root. These are measured geometry sections, not
allowable-load ratings.

The old fairing is a fixed interface. Its source-native recipe and print
orientation are unchanged from the retained IMX577 manufacturing baseline
(SHA256 `ab95a58363a6bf974b18760a1e98e3d263b49005800d52705ee8a5ead262ec65`).
The wider frame and both devices clear the actual old circular-ogive cavity,
not only an approximate cylindrical envelope. The independently measured minimum
frame-to-shell clearance in the widened X−164.2…−96.8 region is 0.2987 mm.
The intentional aft locating lands are excluded from that clearance measurement.
The old shell can therefore be reused without cutting or reprinting it.

### Camera, power and wire access

The selected `board-camera-19:imx577-19x19-rear-mipi-m25` retains its 19×19 body,
M2.5 mounting pattern and 15 mm optical projection. The measured front objective
is Ø14.8 and the lower collar Ø16×5. Its front TPU bore is Ø14.9 with Ø16.2 collar
relief. The installed camera is clocked 90° clockwise when looking into the
optics; the rear ribbon passage follows that same source frame. A removable
PETG upper keeper and the two source-specific TPU liners form the cartridge.
The enclosure contacts the intended housing lands, not the optical barrel.
The sourced OV9281 cartridge retains its own geometry and clocked-port logic.
An independent section of the actual exported IMX577 front-liner STL measures
14.8815 mm minimum inscribed bore diameter, retaining 0.0407 mm nominal radial
clearance over the user-measured objective. This checks the delivered tessellation;
actual TPU print scale and fit still need inspection.

Power uses `power-forward-disc`, `power-aft-disc`, `power-main-frame`,
`power-upper-cage`, `power-lower-pan` and `power-holder-cell-liner`. The complete
UPS is rotated 180° about Z; its battery face remains toward the separator and
its power sockets face the forward XT60 panel. New-print separator windows are
aligned to the actual source connector frame. The two native R1 underside wire
grooves at X153.5/223.5 join the terminal slots; Ø1.5 insulation has 0.25 radial
allowance and the 3 mm floor retains 2 mm under the groove.

The delivered UPS dry fit is evidence for omitting its former TPU liner. The
source-derived generic reference cans have a separate nominal 1.0 backup gap;
that reference does not establish a different delivered unit's no-play fit.
Lower-holder generic references retain their bounded TPU contacts; known
supplier-proxy/contact approximations remain source limits, not hidden printed
interferences or permission to resize bought components.

Both fullØ7 bundle paths pass through all installed pieces. Camera/PCIe ribbon
and mating-port envelopes are inspected separately. A geometric reserve does
not select an electrical lead, minimum allowable bend radius or commercial plug.
Remove the two fairing screws and pull the shell forward for compute/camera
service. The camera keeper opens independently; neither optical alignment nor
tube-window position requires cutting a printed structural part.

### Manufacture and assembly

The full archive uses Ukrainian names for the Product and Template folders.
Each has `PETG` and `TPU` subfolders. The TPU template folder is intentionally
empty. Distinct STL definitions are named from actual native ESKD metadata.
Quantity is a separate BOM and print-list field.
The separate prepared P2S 0.4 3MF jobs already contain the required quantities.

Structural PETG uses 0.20 layers, 8 walls, 100% rectilinear infill and 8 top/bottom
layers; the per-part process record identifies exceptions and supports. The
dense fit coupon repeats the side-loaded coupling and modular-key interfaces.
Other PETG uses 4 walls/25% gyroid. TPU 95A reference jobs use 3 walls/20% gyroid,
supports off. All actual manufacturing files retain their authored orientations.
The cases and the free-form TPU frame have open accessible geometry. Local supports
on frame and camera keeper surfaces still need normal removal and gauging.
Print the dense hard Pi carrier inverted in its supplied pose, with the supplied
normal/snug automatic supports. Remove those local supports through the open
mounting rebates before fitting the TPU eyes, and gauge the hard boss faces and
nut/screw passages. The former support-off carrier process is superseded.

1. Print the fit coupon and gauge the actual M3×10 coupling and the
   modular keys before committing the complete frame.
2. Prepare the purchased Grandado blank's four Ø3.4 through bores and remove its
   original inserts as documented in its modified-blank record. Inspect stock.
3. Insert the four measured couplings into the flight frame's side sockets and
   check all four screw axes from both sides. If a coupling slides in handling,
   retain it with a small positioning dab against the blind end of the socket.
4. With Grandado off the frame, mount the service boards and assemble the
   controller cassette with its shared TPU isolator as described above.
   Attach Grandado after installing and connecting the cassette.
5. Assemble the power cage/pan, UPS and lower holder with only the lower-holder
   TPU liner. Mount both XT60E-F units with their source screws and seated nuts;
   route terminal wires through the underside grooves and axial harness ports.
6. Install the two auxiliary cases and devices in their verified bench order,
   with the camera, its liners/keeper, ribbons and Pi stack absent. Thread
   the thin tape before fastening the keyed feet; fit the camera cartridge next.
7. Insert the empty TPU frame into its grooves, preload its captive nuts and
   seat the hard carrier. Fold the four eyelets into their rebates, then place
   Pi and the unchanged upper stack. Start two diagonal original stack bolts,
   holding Pi down by hand until both have engaged, then start the remaining
   two before tightening. Work with the fairing removed.
8. Check the selected camera cartridge/keeper, route actual flexible leads,
   then connect modules and put wire/connector slack in the accessible spool.
9. Use the separate fixed-base tube-marking kit from the front tube datum. Keep
   the base clamped while transferring the stencil/rails to opposite registers.
   Remove tools before drilling/countersinking or cutting; finish and deburr.
10. With covers, external anchor bolts and fairing removed, insert the assembled
    core axially. Fit tube anchors, removable fairing and covers afterward.
    Withdraw the core before servicing Grandado ear fasteners.
11. Select the eight cover-screw lengths to the finished bearing planes and
    coupling engagement as agreed by the user; inspect tip gap and thread
    engagement. They remain deliberately unselected and uncounted in the BOM.

### Inventory and verification boundary

The avionics composition supplies 164 occurrences including one optional fitting
coupon. Its 29 printed occurrences comprise 20 PETG and 9
TPU pieces, including that coupon. The five printed
`modular-tube-marking-kit:d90-86` tools and its four sourced standard units remain
a separate nine-piece process kit. Tools are separate from installed avionics
hardware. The frozen `a5d486e2…` manufacturing handoff and later flight-seat
update both predate the common cassette. Reuse the tube templates, covers and
unaffected modules from those handoffs. Use the current frame, PETG carrier
and TPU isolator for the shared flight assembly.

Verification covers source identities, single-solid native and preview geometry,
material-volume equality between TPU forms, actual tube and retained-fairing
clearance, full wire routes, source-port reserves, hard/soft contact partition,
intermediate fold and installation paths, nut capture and tightening access.
The previous source-bound print capture is `a5d486e2…`; its application
macro source snapshot is `65bf1892…`. Older job results are reused only under
exact geometry, identity, pose, file, quantity and process parity.

| Previous frozen check | Result |
| --- | --- |
| Integrated native CAD | Valid printed bodies, zero unintended intersections, continuous lower-cover withdrawal, both full wire routes, STEP/FCStd round trips pass. |
| Real application exports | Assembled:137, print:34 and coupon:1 native occurrences; source snapshot unchanged; physical IDs and selected geometry states retained. |
| Actual individual files | All 36 STEP/STL definitions pass; each is one closed connected solid; zero open, nonmanifold, winding or degenerate STL edges/faces. |
| Prepared P2S jobs | All 36 jobs pass with the correct 39 copies, authored poses, selected material/process, zero repairs and zero slicer warnings. |
| Pi carrier support access | Each whole rebate and a 20 mm extraction sweep are open after removing the bare inverted print from the bed; the current job uses 0.490 g support. |
| Focused implementation checks | 37 affected source/identity/camera/power/coupling tests, 29 avionics/marking-kit tests and 22 generic identity/detail/native checks pass; production build and test type checks pass. This is an affected-scope check, not the entire repository suite. |

The complete product's 30 jobs contain 33 installed printed pieces and estimate
**42 h 45 min / 1125.19 g**, including 94.93 g support. The six template jobs contain
the five marking tools and optional coupon and estimate **8 h 24 min / 232.28 g**.
These are summed offline predictions for separate jobs, not measured print time
or one packed-plate schedule. The complete archive includes unchanged parts;
the handoff's `EXISTING-PRINTS.csv` identifies their exact retained geometry so
that a verified existing print, including the old fairing, can be reused.
Relative to the retained `6321` release, only the whole PETG carrier changes:
about **31 min 32 s / 9.30 g** in its prepared P2S job. The printed TPU
`7E3C91D1F656A6E5` and both printed PETG frames are retained exactly.
`OLD-TO-NEW.csv` records that one replacement and the 35 unchanged definitions.
The complete archive is provided for consistency, not as a request to reprint
those existing parts.

Physical assembly, filament behavior, TPU force/damping/creep, thermal behavior,
recording reliability and deployment/landing loads still require prototype
qualification. A 10–15 kg vehicle, release at300 m after a fall from1 km, and a
15 kg parachute label do not specify an opening force history. The intended
recovery load path is through the D16T tube and a separately qualified metal
attachment; that attachment is not qualified by this model.
The printed electronics structure and non-sealing CO2 baffle are not its rating.

## Historical design records

The following snapshots describe earlier executions and their evidence. They
are retained for traceability; names such as “current” inside these snapshots
refer only to the recorded historical stage. The new-print construction above
supersedes their assembly, inventory and manufacturing interpretations.

### Superseded paired carrier strengthening — release `10c55700`

The initial `6321f6f583eb` carrier, `6EBA2A0036122634`, passed geometry and
assembly checks but had an avoidable structural transition missed by those
checks. Its 12.4 mm eyelet rebate extended beyond the 12 mm deep mounting-pad
stock. The remaining 0.2 mm-wide rail/end-bar margins were only 1.4 mm thick on
the straight portion, tapering to approximately 0.13–0.05 mm near the curved
ends. Other axial return paths remained, so this was not proof of inevitable
fracture; it was an undesirable notch and bending path for repeated loading.

The correction reuses the same two manufactured occurrences and the existing
TPU floor. The ideal result is direct, backed pad support and a full connection
to the ring without extra hardware or changes to the already printed nose.
The contradiction is an open folding/service rebate versus a continuous load
section. Local material reallocation resolves it: widen the deep pads to 14 mm
and their mating TPU pockets to 14.4 mm, retaining a 0.8 mm shoulder beyond both
edges of the unchanged rebate. Two fully backed 3 × 2.4 mm TPU seats beneath
each pad give 0.1 mm nominal take-up; their roots overlap the retained floor by
0.2 mm. The eight seats replace reliance on a 0.2 mm pad backup gap. The rear
existing lower lands start at |Y|31.7 to clear the wider pads.

Full transverse ribs and a uniformly deeper ring were considered. They add
material, require broader soft-pocket changes and can introduce new support
roofs. The selected local correction addresses all pad tips while preserving
the key geometry, open center, four source bolt stacks and hard clamp planes.

| Physical occurrence | Superseded execution | Corrected execution |
| --- | --- | --- |
| Hard Pi carrier | `6EBA2A0036122634` | `67D126E4BBDD95E8` |
| Paired TPU frame | `7E3C91D1F656A6E5` | `3F045A22ACB5182E` |

Each suffix belongs to `PL3D.MANUFACTURED.DETAIL-…`; the paired parts must use
the corrected executions together. All other 34 print definitions, including
the already printed nose frame `2BB05A1C3249F318` and camera keeper
`F9BE7C866E6E7052`, remain byte-identical in native recipes, print poses and
delivered meshes. No new package, preset, state, part quantity or hardware is
introduced. The `manufactured-detail` neutral/installed form contract remains
unchanged.

Independent native checks give at least 2.44 mm remaining material in the former
tapered transfer regions, with 3.8 mm on the straight portions. Each new seat
has a full 2.4 mm backing, 1.44 mm³ root overlap and 0.600 mm³ intended contact.
The measured carrier/TPU contact is now 15.82 mm³; frame/TPU and PCB/TPU contacts
remain unchanged. The original 3.03 mm hard boss, 13.422 mm² nut bearing and
18.473 mm² PCB bearing remain unchanged. Centered screw preload and pad rocking
are distinct load cases; stronger pad connections do not establish a permissible
tightening torque.

At the compared transverse sections, the geometric bending section modulus
increases from approximately 1.68/1.74 to 18.61/19.53 mm³. This reduces the
nominal gross-section stress for the same local imposed moment by about eleven
times; it is not an assembly strength multiplier or a fatigue-life prediction.
Native entry, eyelet folding, direct support, source hardware, routes, printed
interfaces and current geometry states are checked separately.
The durable native verifier now probes eight known inner/outer transfer
sections and requires a continuous thickness of at least 2.4 mm. A control run
rejects the actual superseded carrier and accepts the corrected one; general
solid validity alone is not used as a structural check.

No acceleration spectrum, mounted mass/CG measurement, clamp preload,
temperature history or actual filament fatigue/creep allowable is established.
For context, the [Bambu PETG HF TDS](https://store.bblcdn.com/3a230e260a3a47c2b0db0156e07eef91.pdf)
reports direction-dependent static specimen properties and specifies its test
preparation; those values are not adopted as fatigue allowables for this user's
unspecified PETG. Vibration, impact and long-term preload qualification remain
physical tests. The `6321` files are retained as superseded historical evidence;
the current manufacturing release is recorded below.

### Modular Ø90/86 tube avionics

This engineering reference develops the requested serial modular arrangement from
`grandado-tube-mount:d90-86-nominal`. It does not replace that saved execution.
Dimensions are millimetres unless stated otherwise. Purchased geometry retains
its original library identity and source limitations; a detailed appearance is
not evidence of a measured mounting interface or recovery strength.
The 2026-11-05 printed-prototype repair below is the current construction
record. Earlier digital audits are historical evidence for their recorded
configurations, not proof that the delivered prototype assembled successfully.
The prototype exposed real retention, entry-path and optical-profile errors.
Current repairs preserve the large printed parts wherever stock removal can
produce the corrected interfaces.

#### Printed-prototype repair — 2026-11-05

##### Requirements and chosen construction

The delivered prototype must close without the UPS TPU layer, orient its power
ports toward the XT60 panel, admit the tracker/finder trays, positively retain
the rigid Pi carrier within its TPU mount, and let the opposed covers be
assembled with the actual coupling nuts inside the tube. The measured camera
has a Ø14.8 objective and a Ø16 × 5 collar, with the existing 15 mm projection.
Rotate it clockwise by 90° when looking into the optics, and follow that frame
with the rear ribbon opening. Terminal wiring has Ø1.5 insulation. Preserve the
D90/D86 tube interfaces, Ø85.6 core, existing cover/window geometry and both full
Ø7 reserves for the requested two Ø6 bundles. TPU is 95A; physical damping and
load allowables remain unmeasured.

The ideal result is to recover the printed prototype with a few accessible
replacement pieces and local removal operations. The main contradiction is
strong positive retention versus simple printing and access inside the narrow
nose/tube. The selected transformations reuse existing solid sills, the tube as
a radial keeper stop, temporary bench fasteners as coupling locators, and small
removable stops instead of buried flexible catches. Functions are separated by
assembly stage and by location; no numbered TRIZ mapping is asserted.

Alternatives rejected here were reprinting every large frame, tightening the
old pockets around an incorrectly sized supplier coupling, deforming the wide
auxiliary tray through the narrow throat, and rigidly bolting the Pi carrier to
the frame through its TPU working travel. These either discard usable prints,
retain the wrong source interface, rely on an unverified forced insertion, or
bypass the requested isolation.

##### Changes and existing-part recovery

| Interface       | Current correction                                                                                                                                                                                                                               | Recovery of the printed prototype                                                                                                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UPS separator   | Rotate the whole sourced UPS occurrence 180° about Z. Move its connector/header service windows to that source frame.                                                                                                                            | Add the new windows to the existing spine; surplus former windows remain. Crossheads stay intact. Remove the UPS TPU cell liner.                                                                                                                                                                                             |
| Lower power pan | Two R1 semicircular wire grooves connect the three terminal slots near X153.5 and X223.5. A Ø1.5 wire has 0.25 radial allowance; the 3 mm floor retains 2 mm at the groove.                                                                      | Cut only these shallow grooves, preserving the adjacent bearing crossheads.                                                                                                                                                                                                                                                  |
| Camera          | Source-corrected stepped lens and source-specific Ø14.9 front bore with Ø16.2 collar relief. Clock camera and upper ribbon port together.                                                                                                        | Replace the small PETG upper keeper and both matching TPU liners. The camera correction alone does not change the large lower shoe, shell or aft disc.                                                                                                                                                                       |
| Couplings       | Four occurrences of one PETG side keeper constrain the measured AF4.7/corner-envelope5.2 M3×10 nut. The final opposed-flat opening is 4.80.                                                                                                      | Use the existing side-loading mouths. Install the keepers before entering the tube; temporary lower screws must locate the nuts before engaging the upper screws. The open upper/outward notches preserve both full Ø7 harness reserves without leaving a 0.2 mm tunnel roof.                                                |
| Grandado ears   | Add two Ø3.4 bores, side-loaded 5.8 × 3 nut channels and real M3×16/washer/nut stacks at X±49.5, Y0. The nut roof retains 2.6 mm stock.                                                                                                          | Remove Grandado, drill the supports and cut the accessible straight side channels. No new stock is required on the large flight frame. Tighten both ear screws on the bench before axial tube insertion; withdraw the core for ear service. The body-only source and all six ear hardware pieces lie within R42.8001.        |
| Tracker/finder  | Two narrow open TPU trays replace the wide trapped tray. Each has one M3 screw/nut fixing through the frame floor. Device clearance and optional tape are accepted by the user.                                                                  | Drill two frame-floor holes with the underside retrofit mask. Load tracker/tray 30 mm aft, lower it and slide forward beneath the crossbar; lower the finder/tray separately.                                                                                                                                                |
| Pi retention    | Two short PETG keeper bars use four M2.5×8 countersunk screws and plain nuts in supported seats. Hard stops retain 0.6 mm upward reserve around the isolated island. New small TPU lands and four carrier edge reliefs admit the preloaded bars. | Drill/countersink the existing nose sills using the top-seated mask. Replace the small cushion, bars and carrier. The carrier adds inward stock to retain a 3.2 × 3 rail beside the new reliefs; cutting the old carrier would leave only 1.4 mm and is not an accepted recovery route. The large frame only loses material. |

The obsolete inward auxiliary retaining roofs are trimmed to 45° backed wedges
inside their original stock. The full 3 mm wall and 6 × 8.5 primary rail stay;
0.3 mm volumetric laps join each wedge to the wall and rail. This removes the
old blind horizontal support roof while leaving at least 0.8 mm beside each
new narrow tray. The frame's combined gross vertical second moment changes by
approximately −0.101%; that is a geometric screen, not a material/load margin.
This is also a removal-only change. On an existing print, do not shave away the
retained primary rail at Z−21.5 or mistake its bottom overlap for an obsolete lip.
The minimum repair does not require printing another large nose frame.

Do not add the retired `power-ups-cell-liner` or `nose-auxiliary-tray` back to the
current stack. The lower holder's independent TPU liner remains required.
The Pi keeper screws attach to the frame sills, not through the moving Pi
carrier; ordinary support remains compliant. Overload stop clearance is a
geometric reserve, not a qualified displacement or acceleration rating.

##### Reuse, identity and process resources

The organizer and curator retain the existing family path **Vehicles → Vehicle
structures → Model rockets → Modular tube avionics**, the two canonical camera
presets, all seven state IDs, and the fixed D90/D86 profile. No duplicate camera,
frame or marking-kit package is added. Manufactured additions use existing
`manufactured-detail` recipes and unique occurrence IDs; four coupling keepers
share one physical local definition. Changed recipes receive their actual
native ESKD designations; historical exports retain their original identities.

The user's reported nose-frame designation `A86874B0EE06B754` has no retained
recipe in the available history. The frozen IMX577 export used for native stock
comparison identifies its frame as `113098B65A45255A`; these records remain
separate. The removal-only proof applies to that known recipe, not a recovered
shape inferred from an execution hash. Before transferring marks on the physical
prototype, the actual sill/floor/stop faces must seat all mask registers without
force. The repair map records both the reported and verified-baseline references.

The measured coupling reuses **Fasteners → PCB standoffs** as
`pcb-standoff:user-m3x10-af4-7-ac5-2`. The source is the user's measurements,
not Dremec. Its AF4.7/maximum-corner5.2/length10 envelope is represented by a
native hexagon intersected with a native cylinder. Unknown chamfers, actual
corner curvature and thread details remain unknown. The sourced Dremec AF5.5
execution is unchanged and is no longer selected for these four occurrences.
The existing camera ID `board-camera-19:imx577-19x19-rear-mipi-m25` retains its
product identity with corrected measured optical parameters; it is not a new
supplier execution or a generic resizable sensor.

The current kit has 38 printed occurrences (27 PETG, 11 TPU), of which three are
uninstalled aids: `square-key-fit-coupon`, `nose-pi-retrofit-drill-mask` and
`nose-aux-retrofit-drill-mask`. The two masks use the existing nose frame's real
stops and lift off directly after marking. They are optional repair tools for a
previous print; a newly printed current frame already contains their holes.
Tube windows and tube fastener positions remain the responsibility of the
separate `modular-tube-marking-kit:d90-86`. The complete kit has 148 physical
occurrences, 145 installed; the eight cover screws remain user-selected and
are not silently added to the BOM.

##### Evidence and remaining physical checks

Native checks bind their generated input and source snapshots under ignored
`test-results/modular-tube-avionics/prototype-repair/`. They check single-solid
prints, source orientations, tube/cable clearances, actual fastener bearing and
thread spans, the revised rigid assembly paths, and removal-only recovery of
the large frames. The Pi island clears six individual ±0.5 mm axis probes and
eight combined corners. The clocked ribbon envelope and source-relative latch
entry reserve clear the nose, fasteners and both full harness corridors; no
commercial cable bend-radius or electrical compatibility claim is inferred.

Independent coupling review rejected an earlier 4.85 opening because coupled
nut translation/rotation admitted a path. With the final 4.80 opening, the
least exposed actual modeled nut section at the blocking clock is 4.84152 wide,
including nominal M3/Ø3.4 locating play, cap play and tube-limited outward travel.
The two jaws take up 0.1 mm before the old mouth backs them. This is a nominal
geometric obstruction, not a measured PETG torque or creep rating. Print one
keeper, test the delivered nut and actual tube, then batch the remaining three.
Likewise dry-fit the small Ø14.9 front liner before the rest of the repairs.
The real irregular nut corner profile and printer/filament variation can affect
these close fits.

The final repaired configuration passes 95 affected automated tests, the test
TypeScript check and the application production build. The actual application
native macros pass for 145 installed assembly occurrences, 38 print occurrences
and three process aids. Their source snapshot fingerprint is
`1e00e84903325566cffa8bbd34976d85b896c0c21185768c5ee3de5d6f7676d5`.
The integrated native audit reports zero unexpected component intersections,
zero tube intersections and clear complete bundle routes. Source-conditioned
contacts remain separately bounded rather than being hidden as arbitrary clashes.

The minimum repair has nine unique product print definitions / 13 pieces:
eight PETG pieces and five TPU pieces. Four coupling keepers share one file;
two Pi keeper bars share another. Eleven actual P2S jobs, including the two
optional masks, pass without mesh repairs or slicer warnings and preserve the
authored orientations and quantities. Summed job estimates are 5.063 h / 64.99 g
for the product and another 1.115 h / 19.26 g for the optional masks. Product
supports total 2.06 g: the small open camera keeper and accessible 1.2 mm Pi
roof projections require cleanup; the other small repair jobs have supports off.
These are machine estimates, not measured print time or demonstrated adhesion.
STL and separate prepared 3MF archives each retain the requested product/template
and PETG/TPU directories. Actual native CAD metadata, SDK identities and selected
recipe/manufacturing/pose signatures agree; filenames do not use the old
BOM-only designation shortcut.

The Grandado ear installation needs two permanent M3×16 screws while four
M3×16 workshop transport screws are simultaneously locating the couplings.
Have six available on the bench. The four workshop screws are removed for the
lower lid and stay outside the finished product BOM.

The initial digital construction reports did not establish physical assembly,
TPU insertion forces, practical support extraction, vibration retention,
thermal performance, landing or parachute-opening survival. Prototype feedback
supersedes those readiness interpretations. The D16T tube and a separately
verified metal recovery load path remain outside this printed repair's load
qualification. Print/slicer evidence and the repair handoff must identify the
actual revised files rather than silently reusing old manufacturing claims.

#### Configuration and supported tube profile

Use this single family's **Camera cartridge** selector. `ov9281` selects
`waveshare-ov9281-110:waveshare-21653`; `camera-19` selects
`board-camera-19:imx577-19x19-rear-mipi-m25`, labeled **IMX577 19x19 · rear MIPI · M2.5
mounts**. Its library model is **IMX577 19x19 CSI camera · rear MIPI · M2.5 mounts**.
The user confirms the sensor in that existing module.
Its sensor attribution does not change the supplier identity. The prototype repair
corrects the measured objective/collar dimensions and the installed camera clock;
the body, rear latch and mounting assumptions retain their prior definition. The sensor name does not identify a module vendor,
connector pinout, driver or Raspberry Pi electrical compatibility.

The canonical presets are `d90-86-ov9281` and `d90-86-imx577-19x19`. Their
`cameraSetup` values are preserved. No extra sensor-only product or mechanical
model is invented.

The camera-specific Library IDs replace the former ambiguous preset IDs:

| Previous Library ID                      | Canonical Library ID                         |
| ---------------------------------------- | -------------------------------------------- |
| `modular-tube-avionics:d90-86`           | `modular-tube-avionics:d90-86-ov9281`        |
| `modular-tube-avionics:d90-86-camera-19` | `modular-tube-avionics:d90-86-imx577-19x19`  |
| `board-camera-19:19-rear-mipi-m25`       | `board-camera-19:imx577-19x19-rear-mipi-m25` |

Configuration and project imports migrate these exact old references. The
physical parameters, geometry, placements and occurrence IDs remain unchanged;
the active catalog contains only the canonical entries. The generic
`board-camera-19:user-csi-19-12-27`, supplier-qualified Waveshare model, tube
profile `d90-86` and `modular-tube-marking-kit:d90-86` retain their IDs.

The physical `tubeProfile` selector is shared with the standalone marking kit.
It currently has exactly one supported entry:

| Profile  | Tube OD / ID | Wall | Avionics insert | Total insert diametral clearance |
| -------- | ------------ | ---- | --------------- | -------------------------------- |
| `d90-86` | 90 / 86 mm   | 2 mm | 85.6 mm         | 0.4 mm                           |

One readonly registry in `lib/tube-interface.ts` supplies these values. There
are no independent diameter sliders and no arbitrary scaling of purchased
parts. Another profile must be added as a separately checked interface, with
frame/cover geometry, hardware reach, cable routes, assembly/printing and
matching marking tools verified before it becomes a selectable supported size.

Runtime validation, geometry, composition and export reject an unknown or
missing profile. Importing old version-1 links, configuration JSON and project
records for these two families explicitly upgrades only their previously
implicit missing profile to `d90-86`. Designations, occurrence IDs, camera choices
and other parameter values remain; the exact preset renames above are applied
separately. An explicitly unknown profile and unrelated
missing fields remain errors. This narrow import-only upgrade preserves the
requested old records; it does not introduce another geometry path.

#### Function and acceptance criteria

Retain serviceable camera/computer, Grandado/controller, harness and power modules
in a nominal Ø90 outside / Ø86 inside tube. Modules must be removable, repeatable
and independently retained, with two independent continuous Ø6 harness routes. The user
specifies a Ø85.6 insertion envelope, PETG structure, compliant TPU electronics
contacts, few internal screws and separate parts printable on a Bambu Lab P2S.
The requested deployment scenario is a 10–15 kg payload dropped from 1,000 m,
with parachute opening at 300 m; these altitudes do not specify opening speed,
deceleration or peak line tension.

| Requirement             | Acceptance evidence needed                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tube fit                | Actual inserted solids remain within R42.8; nominal Ø86 bore gives 0.2 mm radial clearance. Measure bore ovality, seams and printed diameter before committing to this fit.                                               |
| Serial interchange      | Each interface has matching square pins and sockets, closed bearing faces, continuous cable channels and independent axial retention. A rigid removal path must exist with the intended harness attached or disconnected. |
| Controller installation | F405 WING MINI above LCH7, F405 right-angle contacts directed aft (+X), LCH7 USB and separate SpeedyBee USB accessory accessible after module withdrawal; check actual connector mouth directions and plug insertion.     |
| Compliant mounting      | Broad TPU support lands avoid populated packages and connectors. PETG stops retain the carriers and bypass screw compression around electronics. Measure compression, free travel and retention with delivered devices.   |
| Power module            | Retain both purchased holders and each of six cell cans. Continuous carriers and a hard separator carry reactions to the end discs; verify actual cells, two XT60E-F bodies, fasteners, plugs and service paths.          |
| Camera/computer service | Either requested camera can be selected without scaling purchased components. Removing the fairing must expose Pi/SSD and camera service access; CSI/PCIe leads must not become withdrawal tethers.                       |
| Fabrication             | Every printed component is one connected native solid; no floating islands or unfinished cantilevered tabs. Check each oriented part, support and brim inside 256 × 256 × 256 mm, and inspect actual slicing.             |
| Recovery/impact         | A separately verified recovery attachment carries canopy force into the tube. Printed module structure is checked against measured electronics mass, deployment/impact acceleration and material/process allowables.      |

The baseline Grandado kit has a combined Grandado/battery cassette, keyed
captures, two substantial end discs, open cable routes, curved cover and marking
jigs. Its original sliding diameter is 85.4 mm, so the new 85.6 mm interface is a
deliberate change, not a claim that its old fit was already tested at this size.
The user confirmed a D16T duralumin tube and TPU 95A. Exact material grade and
certification, actual tube length/tolerance/ovality, printed mechanical properties,
temperature limits, impact surface and allowable device acceleration remain
unestablished project inputs. Hardness and temper names alone do not establish
printed damping, fatigue life or recovery strength.

#### Concept decision and TRIZ record

The useful interactions are rigid tube location, broad printed bearing faces,
positive device capture, compliant PCB contact and open harness access. The main
harmful interactions are clamp force through sensitive boards, vibration
transmitted through rigid supports, cable pinching during closure and recovery
loads assigned to small printed joints. The relevant system boundary includes
the tube, mating connectors, fairing, recovery attachment and CO2 exhaust, not
only the boards.

The ideal final result uses existing disc and rail material to locate and retain
the modules while electronics remain cushioned and can be serviced without a
large internal fastener count. Increasing rigidity improves positional retention
but increases vibration transfer; increasing compliance reduces vibration
transfer but permits device motion. Reducing fasteners improves access but can
reduce positive retention. These are meaningful contradictions, resolved here by
separating functions in space: PETG carries structural reactions and closes on
hard stops; TPU forms contact the electronics. Separate bench wiring from tube
insertion in time. Reuse the tube wall as the final module restraint rather than
asking a friction-only printed peg to resist recovery pullout.

Available resources are the existing Grandado axes and rim, tube wall, space
below the enclosure, repeated circular disc faces, existing library electronics,
square antirotation keys, open harness grooves and separate PETG/TPU printing.
Functional reassignment and trimming put alignment, carrier capture and cable
guidance into the substantial discs/rails. No contradiction-matrix entry,
numbered inventive principle or physical-effect performance is asserted. Method
references are the [TRIZ Body of Knowledge](https://www.aitriz.org/triz/triz-body-of-knowledge)
and [MATRIZ glossary](https://wiki.matriz.org/docs/triz/glossary-6146/).

| Concept                                   | Benefit                                                                         | Disadvantage / decision                                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original combined cassette                | Existing Grandado fit history and passive battery capture                       | Does not provide the requested independent controller, harness, computer and power modules. Retain as baseline only.                                                                    |
| Full-length threaded-rod stack            | Positive axial tie across the complete assembly                                 | Numerous intervening parts must be removed for module service; rods consume cable/board space. Optional tie provision does not establish that a sourced rod or load calculation exists. |
| Friction snap / bayonet modules           | Few loose screws                                                                | Thin flexures or locking lips concentrate strain and need fatigue/creep qualification. Not selected as the sole axial restraint.                                                        |
| Keyed disc modules with captured carriers | Repeated interfaces, local service, broad load paths and few internal fasteners | Needs tube anchors, calibrated fits and careful cable loading. Selected reference concept; keys align and resist clocking, while tube anchors provide installed retention.              |

##### Six-part power cassette (prototype-corrected)

The power function is to retain two complete supplier units and six individual
cell cans within the existing 130 mm module, with service access and both Ø6
harness corridors. The ideal result reuses the discs and central gap as bearing
and restraint surfaces. Fewer pieces simplify assembly, but merging all supports
can create short loaded fingers, trapped installation paths or poorly oriented
printed joints. The selected transformation separates functions: continuous PETG
carriers support each purchased unit, the separator provides a hard backup, and
the lower holder's independent TPU liner contacts its barrels. The prototype's
UPS bank already bears on the separator, so its extra TPU liner is omitted.

| Power concept             | Assessment                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Earlier 12-part cassette  | Two cradles, two keeper rails and six pads increased assembly count and primarily retained the supplier-unit edges. Replaced.                                                 |
| Interim five-part frame   | Reduced count, but short end-support fingers were rejected for FDM/vibration service. Static native fit did not establish their strength. Superseded.                         |
| Current six-part cassette | Two discs, separator spine, continuous upper Omega cage, continuous lower U pan and one lower-holder TPU liner. The UPS layer is removed following the physical closure test. |

The stable printed IDs are `power-forward-disc`, `power-aft-disc`,
`power-main-frame`, `power-upper-cage`, `power-lower-pan` and
`power-holder-cell-liner`: five PETG and one TPU piece. The UPS liner is retired. The former cradle, keeper and six pad occurrences are removed from the
current composition. Both bought units, their occurrences, XT60 bodies and
hardware retain their existing identities. No new screw, purchased cell family
or cell brand is introduced. The external square-key modular interfaces remain
unchanged; internal keys and broad bearing sockets locate the new carriers.

#### Authoritative datums and interfaces

`lib/shared.ts` owns the common geometry: X points aft, Z toward the upper
Grandado cover and Y completes the frame. Do not independently redefine module station
positions in individual parts.

| Module                           | Axial interval / interface                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Forward computer/camera module   | Joins the controller module at X−70; its own nose layout defines the forward envelope. |
| Grandado/controller module       | X−70…70; 140 mm nominal station length.                                                |
| Harness service spacer           | X70…120; 50 mm nominal station length.                                                 |
| Power module                     | X120…250; 130 mm nominal station length.                                               |
| Integrated tail closure / buffer | PETG body X240…257, compression posts to X262; separate TPU buffer X257…262.           |

These station lengths are authored packaging choices, not supplier dimensions
or a user-specified overall tube length. The insertion radius is 42.8. Common
end discs are normally 10 mm thick; the integrated power aft closure is 17 mm.
Common interfaces use three 6 mm square keys at Y/Z=(−26,18), (26,18)
and (0,−22), nominal 4 mm engagement and adjustable socket clearance. The
asymmetric pattern establishes clocking. The forward face accepts the preceding
module; the aft face keys the next. The keys do not independently establish an
axial latch, zero backlash or a load rating.

Two user-confirmed Ø6 harness bundles use independent side corridors centered
at Y±37.3/Z−10 from X−70 through the tail at X262. Manufactured Ø7 grooves give
0.5 mm nominal radial allowance. Their mouths open outward in ±Y, removing the
otherwise thin outer crescent and allowing bench loading before tube closure.
The former bottom holes are removed; they did not establish a continuous path.
Axial 0.6 mm, 45-degree lead-ins reach Ø8.2 at disc faces while retaining at least
2.65 mm stock below the anchor loading mouth.

The nose transitions inward over 20 mm to Y±30.5/Z−17.5, then continues forward
to X−175. This fits the narrower removable-shell bore and avoids Pi supports.
Its minimum authored centerline bend radius is 12.409 mm. Continuous native
Ø6/Ø7 witnesses and loading-path reports check the declared envelope against
actual source bodies; they do not define wire insulation, electrical pinout,
branch terminations, real connector bodies or a cable-specific bend limit.

Route the actual leads before closing the discs. Check strain relief, connector
bodies, bend radii, conductor count and the full closure/removal path with the
selected harness. A disc-to-disc interface must not cap either port. Square
socket corners, screw pockets and channels need local remaining-stock checks,
not only a nominal disc thickness. Unless a source-bound report explicitly
checks a complete route, treat that route as unresolved. Keep main bundle
clearance separate from the still-unselected device branches and connectors.

#### Opposed curved covers and lid fasteners

The upper and lower covers share the same external 102×76 mm footprint and
R47.6 curved outside, mirrored about the tube axis. Both are installed after
axial insertion of the internal R42.8 module. Their outside diameter over the
apex is 95.2 mm; this external cover envelope is distinct from the Ø85.6 insert.
The paired tube openings retain 83.6×58.6 bounds with projected XY corner R2.5.
Matched cap reliefs derive from the same datum; the external R45…47.6 wrap is
unchanged. The former controller side window is removed;
USB service occurs after withdrawing the module.

`grandado-through-cover` uses PETG execution `7F089D09CE338975` for both camera
presets. It restores the continuous seating skirt and groove of
`grandado-tube-mount:d90-86-nominal`. The groove is 1.8 mm wide and 2.0 mm deep.
Its straight ends are 2.05 mm wide to preserve the source 0.5 mm axial fit
allowance. The raised body rim enters this channel with 0.2 mm nominal floor
clearance. Check the delivered box, print tolerances and gasket compression.
The intermediate smooth structural lid `72C5E476B805AD3A` closed on screw feet
alone and lacked the mating skirt.

Both covers have a 4.6 mm central roof and a 2.6 mm wrap around the R45 tube.
The upper R6.5 screw cores run to the body at Z31.2 and support both flanks
of the groove around each screw. Native sections check the flanks and floor
at 24 stations along the closed groove. The lid clears the modeled body and
tube over a 50 mm vertical installation and removal path. The upper screw
bearing plane is Z35.6. The lower radio
cover `F63371820BD254C6` bears at Z−34.2 and its R5 posts reach the frame bed
at Z−29.9. The grip across the two bearing planes is 69.8 mm. The grooved
lid uses the existing rounded opening and the same four M3 axes. The rest
of the assembly uses the previous manufacturing files.

Retain the four M3 axes X±36.5/Y±24. The user will choose the lid screw lengths;
therefore the eight former `upper-through-screw-*` and `lower-through-screw-*`
M3×50/M3×20 occurrences are removed. No replacement length is silently selected
or added to procurement. The current coupling is the user-measured
`pcb-standoff:user-m3x10-af4-7-ac5-2`, length10, AF4.7 and maximum corner
envelope5.2, with four `m3-10-coupler-*` occurrences. Its supported keepers
replace the old incorrectly sized Dremec selection. Other independently specified
tube, board and camera fasteners retain their own identities.

For opposed screws, let G be the distance between under-head bearing planes,
La/Lb the under-head lengths, Lc the coupling length and g the tip gap:

`g = G − La − Lb`

`ea + eb = La + Lb + Lc − G = Lc − g`

The intended bearing planes are Z35.6 and Z−34.2, giving G=69.8. Check each
engagement separately against the final coupling position; a positive total
engagement does not establish that both screws reach the coupling. The current
10 mm coupling occupies Z−17.5…−7.5, giving nominal individual engagements
`ea = La − 43.1` and `eb = Lb − 16.7` before source tolerances/runout. Measure the
actual head/seat profile, screw length tolerances, thread runout, tip gap,
threaded depth, tightening and post stock before selecting the pair. No brass
thread-strength or clamping rating follows from these nominal equations.

A declared unprocured M3 shaft study with 0.3 mm tip chamfer and ±0.2 mm coupling
float gives an example 48 mm upper/20 mm lower pair: 1.8 mm tip gap and worst-float
full-diameter engagements 4.4/2.8 mm. Its screening criterion is 2.4 mm full-diameter
span per end plus 1.0 mm tip gap; this is a geometric comparison, not a thread
strength standard. The original 50+20 pair has 0.2 mm nominal tip overlap and
0.6304 mm³ modeled solid interference. Do not select permanent lengths from the
nominal sum alone. No eight permanent screw occurrences or stock SKU are added.

The purchased Grandado starts with blind post/insert geometry. The modified
`grandado-drilled-body` is one manufactured detail whose blank provenance is
`catalog-enclosure:grandado-83-58-35-clear`. Remove the original inserts and drill
the specified clearance passages only after checking delivered post walls and
access. Do not add another installed Grandado occurrence for that same blank.
Source identity, the deliberate drilling operation and sealing limitations remain
linked in its manufacturing record. Screw force must close through rigid frame
shoulders/posts and the couplings, without using a populated PCB or soft TPU
island as the structural grip stop. The assembly remains incomplete for final
fastening until the user-selected lid screws have been checked and recorded.

#### Lower-cover radio attachment

The receiver and T antenna attach directly to `flight-lower-cover` using straps
through five integral, fully rooted PETG saddles. Two straps cross the receiver
at X±8, two cross the antenna arms at X±18, and one crosses the junction at
Y−18.7. The receiver saddles run Y4.2…19.8; their underside passages run Y4…20.
Arm passages run Y−21.4…−16, and the junction passage runs X−6.7…6.7. All five
passages have a 3.5×2 mm section with true R0.4 corner arcs, 3.25 mm side webs
and a 3 mm supported roof. The enlarged structural cap backs the tunnel floors;
the earlier R46 floor probes already exceeded 3.1 mm, and the R47.6 outside adds
backing without reducing the seats or passages. The shallow circular arm
seats support the lower wire arc without flexible snap lips.

The separate `flight-radio-tpu-carrier`, `flight-radio-retainer`,
`flight-radio-closure-screw` and `flight-radio-closure-nut` are removed, together
with their locating bosses, closure post and unrelated clearance cuts in the
LCH platform/frame. No new strap model, length or procurement identity is
invented. Select actual straps that pass the finished tunnels and retain the
receiver/junction without crushing components or detuning/damaging the antenna.
The direct saddle arrangement is an authored fitting provision until the
straps, source devices and connected leads are installed and checked.

`lch7-tpu-platform` remains the separate LCH7-only support captured by the main
frame. Removing the lower lid therefore takes the strapped receiver and antenna
with it while leaving the LCH7 platform in the controller frame. Disconnect the
actual leads before lid withdrawal, or verify sufficient restrained service
travel with the delivered harness.

Use the dedicated `lower-cover` inspection state to see the one printed lid and
two reference witnesses outside the tube. Receiver and antenna witnesses retain
`flight-radio-receiver-reference` and `flight-radio-antenna-reference`; they are
user-dimensioned reference volumes, excluded from canonical procurement and
manufacturing exports. Inspection does not change the assembled BOM or add a
second physical receiver/antenna definition.

The receiver occupies 25×13×4 mm, with underside at Z−33 and center
[0,12.8,−31]. The antenna junction is centered [0,−18.7,−31.2], and its 20 mm
stem runs from junction edge Y−13.7 to receiver face Y6.3. Arms extend 25 mm
either side of the 10 mm junction, giving a 60 mm span. Antenna wire diameter
2.8 mm and junction thickness 3 mm remain fitting assumptions for an unidentified
product. These positions do not establish actual connector geometry, cable
strain relief or RF qualification.

#### Physical composition and source limits

The canonical product is the supplied installation kit, including one
`square-key-fit-coupon` fabrication aid. The coupon remains in kit composition
across inspection states but is omitted from the installed assembly view and
installed FCStd/STEP export. It tests the avionics 6 mm square-key sockets and
nominal Ø3.4 M3 clearance hole. It does not test the standalone marking kit's
registers or its `jointAllowance`. The obsolete `tube-pilot-collar` is retired
from both camera kits. RF witnesses remain excluded from installed physical
composition and kit procurement.

Reused products retain these qualified references:

- `catalog-enclosure:grandado-83-58-35-clear`, through the base kit's existing
  enclosure selection; resolve the qualified ID rather than the display name.
- `flight-controller:speedybee-f405-wing-mini` and
  `lch7-controller:lch7-v3-2`.
- `usb-wireless-extender:speedybee-f405-wing-mini-usb`; the separate accessory
  is not a fabricated connector added to the controller stack.
- `waveshare-ups-3s:ups-module-3s` and
  `li-ion-battery-holder:beilamoo-3s`.
- Two occurrences of `electrical-connector:xt60e-f`.
- `raspberry-pi:raspberry-pi-5`, `waveshare-pcie-m2-d:pcie-m2-d` and
  `m2-ssd:2280-reference`.
- `gps-tracker:zx908`, `jhe42b-finder:jhe42b`, and either
  `waveshare-ov9281-110:waveshare-21653` or
  `board-camera-19:imx577-19x19-rear-mipi-m25`.

The existing package guides remain authoritative for purchased fidelity. WING
MINI's published nominal envelope is 37×26×14; its hole pitch, bores and several
component/connector positions remain installation references. LCH7's current
library envelope is 50.97594×44×7.48268, with four Ø4 PCB holes on 30.6 mm square
pitch. The separate USB accessory has user-confirmed 24.5×21.5×7 packaging and
16 mm mounting pitch, while its bore offsets and plug access remain qualified
only as described in its guide. Merely rotating the appearance does not prove a
service plug can be inserted through the window.

The [Waveshare UPS evidence](https://www.waveshare.com/wiki/UPS_Module_3S)
establishes the module identity and battery arrangement. Its library definition
includes a fitted empty three-cell holder. The additional BeiLaMoo holder is a
second procurement unit, not a replacement for that fitted holder. Cells,
battery wiring, charge management, fusing and power compatibility are separate
project selections; the reference does not silently add a cell model or assume
that two 3S sources may be directly paralleled. The holder's nominal
77.70×59.69×21.54 envelope is sourced, while inherited fine moulding and mounting
features are not verified BeiLaMoo interfaces.

Six generic Ø18.6×65.2 mm can witnesses use stable IDs
`power-ups-cell-reference-1`…`-3` and
`power-holder-cell-reference-1`…`-3`. They are reference-only, without a selected
brand, electrical rating or procurement quantity. The same `powerCellFit`
datums drive the preview and native checks. All axes follow X at center X188.5.
UPS rows are Y−19.5/0/+19.5, Z13.4, opening −Z; the separate holder rows are
Y−19.3/0/+19.3, Z−14.8, opening +Z. The UPS seat follows the authored closed
back-wall datum. Neither set of internal seat details is a verified BeiLaMoo
or Waveshare cell drawing.

[Waveshare](https://www.waveshare.com/ups-module-3s.htm) specifies three 18650
cells with length strictly below 67 mm. The
[BeiLaMoo listing](https://www.beilamoo.com/sdp/1074412/4/pd-5180803/21007228-2986068/Three_18650_In_Series_Battery_Holder_with_Wire_Lea.html)
does not establish a finished-cell diameter/length tolerance or terminal form.
Its internal CAD is explicitly an MPD-derived proxy. The original MPD holder's
65–68 mm protected button-top condition cannot be transferred to BeiLaMoo.

In the historical fba26 reconstruction, lower outer-row Ø18.6 witnesses intersect
that inherited proxy plastic by
21.1941 mm³ each; the Ø18.0×65.0 sensitivity case still intersects the end
plastic by 3.2173 mm³. Uncompressed proxy leaf springs also overlap the cans.
These are separate source-fit gaps, not new TPU preloads or permission to trim a
purchased holder. The complete supplier/cell fit remains unverified. Match the
actual holder revision, can diameter, length, terminal form and spring travel
before qualifying the liners. The smaller sensitivity case is not a published
minimum tolerance and does not inherit the nominal preload claim.

Four occurrences `nose-pi-compression-sleeve-1`…`-4` now reuse
`dremec-spacer-sleeve` as a custom purchased aluminium execution, with no preset
ID: requested OD5.6, bore2.8 and length 19.694. The Pi PCB stays fixed while the
adapter, SSD, associated pad, stack screws and NVMe end hardware move 0.5 mm down.
The original top-entry M2.5×30 execution remains; four Nyloc nuts turn broad-base
up against the carrier. This replaces the former thin printed tubes without
changing purchased PCB dimensions. The
existing material family supports requested dimensions; these are not a stock
SKU, availability assertion or placed order. Exact supplier title, source,
material and custom dimensions survive strict project/native round trips.
The [supplier listing](https://dremec.ua/product/spacer-sleeves-alu/) publishes
±0.1 mm length tolerance and custom manufacture; its displayed minimum order
requires supplier confirmation for four pieces. Match actual sleeve lengths and
board parallelism before tightening. No generic family or invented stock preset
is added.

Pi 5 source CAD and public interface datums are reused without scaling. The
adapter's 85×56.5 PCB/58×49 pitch are published, but bore diameter, datum offsets,
height and the supplied flex's usable reach require sample checks. The generic
2280 SSD is an installation reference, not a selected supplier drive. The
standard JHE42B retains its published 23×17×17 model with an unresolved official
25 mm length photograph. ZX908 is a user-project board reference. None of those
limitations is cured by a close-fitting printed pocket.

The ELRS MINI is a **user-dimensioned installation reference**, 25×13×4, without
an established manufacturer, order code, supplier drawing or purchased-library
identity. The supplied antenna reference has a 20 mm stem, 10×10 junction and
25 mm arms either side, giving 60 mm overall span. These later detailed inputs
supersede interpreting the initial sketch as two 30 mm elements plus a junction.
Align the 60 mm span along the 83 mm lid length; the 58 mm lid width cannot
contain it with retaining stock. Its integral lid saddles are authored geometry;
straps are unselected, and no exact receiver or antenna procurement claim follows.

#### Camera capture and reinforced support

`nose-base-frame` and `nose-camera-keeper` retain their identities. They form a
closed, bolted rigid cage around the separate source-specific TPU rear cradle
and front liner. The purchased camera remains one unscaled library unit. The
shaped rear stop, front liner, body/board edge contacts and closed upper keeper
provide geometric capture; the objective and FFC connector are not structural
clamping surfaces.

The previous R24 barrel had a cable cut ending at Y23.9, leaving a 0.1 mm outer
feather. That unfinished cap is removed: the positive-Y channel now opens beyond
the entire barrel radius. The replacement uses an explicit R26 body meridian
and R15.75 front shroud with at least 4 mm nominal bulk PETG after the cartridge
fitting allowance. A dimensioned chamfered crosshead and 6 mm rear cheeks return
clamp reactions around the cable opening. The rear MIPI channel remains open
through the crosshead. The cage's narrowing outer shape is authored directly,
rather than relying on a large stock/cavity intersection to leave thin tips.
The positive-Y FFC opening now ends forward at X−243, covering the source
port ending at X−241.4 while retaining the complete 4 mm front shroud. Its
previous extension to X−251 left a 0.15 mm inboard skin beside the R11.75 lens
cavity. The upper cheeks retain their full 6 mm extrusion thickness, and their
exposed free corners have 2 mm flat lands rather than pointed projections.
Both camera nut-loading slots extend beyond the ears to |Y|31.5; the earlier
|Y|27.5 limit left a 0.5 mm cap. With the fairing removed and clamp screws
absent, each source M3 nut has a clear 10.5 mm lateral insertion path, checked
at 43 positions with 0.25 mm spacing against all nose printed details.
The camera head counterbores continue from Z7 beyond the complete keeper stock
to Z37. The former termination at Z15 left a roof over the screw/driver entry;
the 5.5 mm screw head has 0.35 mm nominal radial clearance in the open 6.2 mm
bore. Both 2.45 mm across-flats hex-key paths are clear at 61 positions from
tip Z45 to Z8.8 with the fairing removed. The final source-bound nut sweep also
passes at 61 positions from |Y|33 to |Y|21.5. These service checks do not
qualify the previous CSI cable route.

The main lower rails increase from 5×5 to 6×8.5, with a 6×4.25 front section and
a 45-degree rise. Their aft tie is 12 mm tall, covering the full 8.5 mm rib height
with 3 mm axial overlap; the earlier shallow tie did not root that full section.
For equal material, span and bending orientation, the full
section's second moment rises from 52.08 to 307.06 mm⁴, a geometric ratio of
5.90. That comparison does not qualify the front transition, roots, joints,
print anisotropy or shock capacity; any of those can govern actual behavior.

Supported contact lands provide approximately 0.1 mm nominal normal TPU
interference at the cage and camera interfaces. The front conical lands use
0.14 mm radial interference to obtain approximately 0.101 mm normal contact.
The rear TPU's obsolete Ethernet relief is filled only in
material outside the camera body envelope, so the new lands have substantial
backing. OV9281's front axial contacts are four solid D3 buttons at the existing
mounting bores, with 0.1 mm nominal contact and 0.2 mm relief from the rest of the
PCB face. The PCB's unchanged D2.2 holes make each contact an annulus; the printed
button is solid and backed, rather than a separate thin annular ring. Its side
contacts use the board edges. The 19 mm reference uses
housing contacts away from its factory side bores. These are declared compliant
contacts, not unintended rigid intersections or a supplier-certified pad size.
Actual contact pressure, allowable PCB edge loading, TPU grade and printed fit
still require a sample check.

Open the fairing, remove the two independently specified camera-keeper screws,
and lift the upper keeper before separating the two-piece TPU cartridge. The
0.1 mm contact lands require elastic release; do not pry against the lens, PCB
packages or ribbon latch. A native closed-solid or no-rigid-intersection report
alone does not demonstrate support-free printing, impact strength, cable-safe
service or repeated release of real TPU parts. The OV9281 cable path and the
restraint/approaches for a longer lead's surplus remain unresolved.

#### Recovery and impact load screen

Assume zero initial vertical speed, 700 m descent before opening and no drag.
With g=9.80665 m/s², the screening speed is
`sqrt(2 × g × 700) = 117.17 m/s`. The corresponding kinetic energy is 68.65 kJ
at 10 kg and 102.97 kJ at 15 kg. Air resistance, release velocity, orientation,
canopy inflation and line stretch change the result; this is an idealized
no-drag energy screen, not a trajectory prediction or bounded peak force.

For approximately vertical descent, an assumed mean opening interval Δt gives
`Tmean ≈ m × (g + (v1 − v2) / Δt)`. Alternatively, an assumed deceleration
distance s gives `Tmean ≈ m × g + m × (v1² − v2²) / (2 × s)`. At the screening
speed, v2=0 and assumed s=30 m, the latter is 2.386…3.579 kN for 10…15 kg; at
s=10 m it is 6.963…10.444 kN. These deliberately stated assumptions are not a
choice of canopy opening distance, and mean tension does not bound its peak.
Static vehicle weight is only 98.07…147.10 N. A canopy mass rating cannot be
substituted for measured deployment loads.

Use a separately engineered recovery bracket, bulkhead or load strap to carry
line tension into the tube and vehicle structure. The modular PETG/TPU sled,
electronics, cell contacts, square alignment keys and long lid screws are not
qualified recovery anchors. No recovery shackle or pressure-rated bulkhead is
specified by this package. For device mass me and measured acceleration ag in
g, its inertia load is `me × 9.80665 × ag`; four equal reactions would each be
one quarter only if actual joint stiffness and geometry justify equal sharing.
Board bending, captured-carrier pullout, radial anchor bearing/tear-out,
threaded-post failure, PETG layer splitting/creep and TPU bottoming are separate
checks. Landing impact requires measured/assumed approach speed, impact
orientation and available stroke. No common material allowable or universal
safety factor is invented.

The green tail item is a replaceable impingement/impact **baffle reference**.
Open cable passages and the sliding tube fit allow gas bypass, so it cannot be
called a pressure seal or a qualified CO2 barrier. Discharge pressure, jet
direction, distance, temperature, vent area and any seal must be defined and
tested. The baffle must not turn the electronics cavity into an unassessed
pressure vessel. [NASA-STD-5017B](https://standards.nasa.gov/standard/NASA/NASA-STD-5017)
is a mechanism-development/test method reference only; compliance is not claimed.

#### Assembly, printing and verification

Bench-assemble each module with its end faces and closure paths open. Install
captive hardware first, then TPU contacts and devices. Keep actual plug bodies,
radio/antenna regions, buzzer outlet, cancel control, USB access, cooling paths
and ribbon latches clear. Restrain the SSD at its intended fixing interface and
provide a compliant supported region without loading packages, socket or ribbon.
The stiffness/damping and compression of user-added cushioning require physical
validation; unrestrained extra foam can block cooling or overstress the board.

Wire the modules and place harnesses into the open grooves before closing the
carriers/discs. Use the spacer for a controlled service loop and separable
connectors; do not tightly twist leads to consume unspecified slack. Mate disc
keys axially without forcing wires, insert the modules into the measured tube,
install their tube anchors, then fit the external Grandado cover and removable
fairing. Reverse those operations for service. Fully connected extraction paths
and connector disconnection access still need delivered-harness verification.
Printed marking templates transfer a defined projected window and hole axes;
remove them before powered cutting. They are marking aids, not qualified drill
bushes or a substitute for checking remaining tube wall and recovery load paths.

Print discs, carriers and the fit coupon separately; flat broad bearing faces and
upward-open channels are preferred where their actual geometry allows. The lower
radio lid is printed on an axial edge with a brim and local support assessment,
rather than standing on four internal post tips. Support requirements of the
curved shell, radio saddle starts, recessed pockets and frame ledges must be
checked in the slicer. The [P2S build volume](https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/)
is 256×256×256 mm; a part bounding box inside that cube establishes only an
envelope, not completed slicing, support removal, first-layer adhesion or a
single-plate arrangement. Calibrate square-key, tube, hardware and TPU fits on
coupons before the complete print. Deburr cable contact edges and remove support
scars from all seating faces. Do not force a marginal fit by bending a PCB.

Release evidence must distinguish software/package checks, native CAD validity
and actual manufacture. Check all printed solids for connectivity, positive
volume, dimensions, interference, source identity and analytic curved surfaces;
execute the generated FreeCAD macro and inspect representative STEP/FCStd round
trips. Check both camera selections, module boundaries, all modeled states,
through-screw tip/engagement geometry, plug/tool sweeps and assembly travel.
Check canonical composition across inspection/printing views. Store generated
exports and reports only under ignored `test-results/`.

This record establishes the requirements, selected concept, source limitations
and analytical screens. Completed geometric/software results belong in the
task's actual verification report. Physical fit, wired installation, vibration,
temperature, opening/impact strength, recovery attachment and CO2 protection
remain unqualified until their measurements and tests exist; no production or
flight readiness is asserted.

#### Implemented configuration and current evidence

The nominal pipe occupies X−100…262 (362 mm); the camera tip is near X−255,
so the authored station envelope is 517 mm long, plus the aft tie heads. This
reduces the previous 602 mm station envelope by 85 mm. Confirm the available
pipe before adopting these station lengths. This is a layout choice, not a
measured user tube. Z+ and Z− locate the opposed upper and lower cover openings.
The two covers share the 102×76 external flange and 83×58 body/interface
footprint. Both are installed externally after inserting the internal module.
The former Y+ controller side window is removed. Fit the real USB plugs on the
withdrawn module before committing to its harness and service arrangement.

Two upper keys are used at the spool/power joint; its auxiliary lower key is
omitted to open the XT60 mating bays. The receiving socket remains compatible
with the common pattern. Couplers have AF5.8 hexagonal fitting pockets in 12 mm-wide frame columns,
leaving 2.5 mm side webs around the open loading mouths widened to 7 mm so they completely overtake the 6.697 mm hex
corner span. Native witness checks found eight residual 0…0.04863 mm triangular
feathers before this correction: each 10.4 mm high region contained
0.02289898 mm³; every corresponding corrected region contains zero material.
The frame's insignificant nominal lower corner excess is clipped
by a true R42.8 cylinder, preserving the specified insertion diameter.

The harness-spacer carrier has four integral 6×5 mm axial tongues, centered
at Y±32/Z9, engaging blind sockets in the two facing discs. Broad 8×10×20.5 mm
end blocks root them to the rails. This replaces a loose carrier that previously
only touched the disc faces. The paired tongues restrain transverse motion and
clocking; the disc faces restrain X motion, and the tube anchors retain the disc
pair. Engage the carrier in the forward disc, then slide the aft disc onto its
rear tongues before installing the assembled spacer in the tube. Native checks
cover 21 aft-disc insertion samples and six 0.5 mm translations: insertion is
clear and every translation intersects the intended disc restraint. Nominal
socket stock remains at least 3.1 mm above the radial nut pocket and 3.35 mm
below the common key. These are geometric capture checks, not a harness or
structural load qualification.

Common radial anchors use the authoritative 5.75 mm offset from each disc's
foreface. Their axes are X−74.25, −64.25, 65.75, 75.75, 115.75, 125.75 and
245.75, with paired ±Y bolts; the independent fairing axis stays at X−89.
Matching tube marks and hardware derive from the same constant. True AF5.8
hexagonal seats follow the actual installed ±15-degree nut clocking and retain
a closed forewall of at least 2.516 mm. The common 6.5 mm aft loading mouth overtakes
the 6.468 mm hex projection. The integrated tail closure instead loads its two
radial nuts from the fore side, before the upper carrier closes their mouths. A square 6.5 mm cavity was rejected because it let
an AF5.5 nut rotate freely. Forward module frames close their loaded nut exits
without extra parts; all nuts are loaded before the discs/frame are closed.

The integrated `power-aft-disc` has a continuous 17 mm PETG body at X240…257,
with two R4.1 compression posts extending to X262. The former separate
`tail-baffle` occurrence is retired; the 5 mm `tail-tpu-buffer` remains at
X257…262. Two existing axial M3×25 screws and captive M3 nuts retain the buffer.
Their posts have R1.7 bores and 2.4 mm walls, pass through R4.3 TPU clearance
holes, and bypass TPU compression when tightened. Two sourced DIN9021 M4 broad
capture washers, OD12/ID4.3/t1, replace the former OD9/t0.8 washers without
adding occurrences. Their intentional M4 designation does not change the M3
bolts. The washers bear on the posts; no axial buffer squeeze is assumed.
Open grooves continue through both pieces. They do not seal gas, and the
closure has no assigned recovery or CO2 pressure rating.

For computer access, release the two fairing screws at X−89 and slide the
fairing forward. The Pi, adapter, SSD, tracker and finder now all lie ahead of
the tube root and are exposed with the cover removed. Release the two module
anchors at X−74.25 and unplug intermodule leads when full core withdrawal is
needed. The ordinary core and either camera remain inside R40.1. Two local
R40.4 curved bearing lands at the shell anchor deliberately contact the R40.4
bore, with axial lead-outs. The complete nominal forward withdrawal is checked
with those lands present; actual sliding fit, friction and loose ribbon/harness
movement remain unqualified.

The Pi cushion has 0.1 mm authored preload on carrier and frame contact lands,
with no PCB interference. Its upper lands are now four fully backed, 6 mm-long
45-degree prisms against matching carrier bevels; the former floating flat
strips are removed. The 4 mm carrier rails retain 2.6 mm top flats, and the
mounting-hole pads retain 2.6 mm bore ligaments. Mid-height side/end ridges have
45-degree starts. Independent native root witnesses contain their full
1.2 mm³ each, rather than relying on a tangent join. Frame/cushion and
carrier/cushion contacts measure 45.15370849908 and 16.851168824 mm³,
respectively, within declared bounds of 45.18 and 16.87 mm³. The frame-side
contacts include four backed 8 mm diagonal shoulders. All six ±0.5 mm
translations and six ±1-degree rotations of either interface increase its
intended restraint; only the intended frame/cushion or carrier/cushion contact
is counted. These witnesses do not establish TPU stiffness or installation force. Power now uses two formed
single-face barrel liners. Each nominal Ø18.6 can has 0.1 mm radial interference
with its R9.2 seat: 29.761392 mm³ per UPS can and 28.917688 mm³ per lower can,
with declared maxima 29.78 and 28.94 mm³. These reference-only contacts are
separate from inherited holder-plastic and free-spring fit conflicts. Actual TPU grade, preload force,
creep and damping are not established by the geometry. The ELRS saddle spacing
follows the user envelope; its complete 20 mm stem route to the receiver and RF connector
remain to be checked on the delivered item.

`test-results/modular-tube-avionics/` contains the current native input/report,
assembly FCStd/STEP, individual PETG/TPU STL/STEP and 1:1 SVG marking sheets.
The full wrap uses the actual Ø90 outer-cylinder mapping S=45×asin(y/45), including
both projected 83.6×58.6,R2.5 openings. The full sheet height is one circumference
plus 40 mm. Six 180×180 mm tile viewports use 150 mm offsets and 30 mm overlap; the
former 165 mm height cropped the footer. The tiles fit ordinary paper.
Print at 100%, verify the 100 mm calibration line and align overlaps before
marking. The preferred reusable physical tools are the separate fixed-base
`modular-tube-marking-kit:d90-86`. Its base stays clamped while the three pattern
tools move to opposed registers; no initial pilot pair is required. Remove all
marking tools before powered cutting, drilling or countersinking. The avionics
`templates` state now shows only **Avionics fit coupon**.

#### Historical digital completion matrix — before the printed-prototype repair

<!-- current-full-audit-verification:start -->

The current profile-registry fixture is
`26b9ee4221762786422418d767aac8f97c9d55ee885ce66c6a91ef8ffc9efa18`.
Its geometry and source placements are byte-identical to the preceding aid-cleanup
configuration. The explicit supported profile and user-confirmed IMX577 display
annotation change metadata; no new tube size is qualified.
The authoritative current handoff record is
`test-results/modular-tube-avionics/parameterization-stage/final-report.json`.
The installed physical construction remains the exact b70 geometry through the
subsequent aid cleanup and explicit-profile stages. The later
decomposition audit changes only the nose-view membership of two existing NVMe
fasteners; the subsequent aid cleanup removes one uninstalled process aid.
The current record binds the explicit-profile selections and import rules,
while inheriting unchanged installed geometry and fabrication evidence.
The complete b169 tail stage and preceding 02d4 full-assembly stage retain their
original hashes. Relative to b169, the later b70 stage changes only
`nose-auxiliary-tray` in both camera sets. That correction's whole-native,
application, preview and manufacturing evidence is inherited unchanged by this
aid cleanup.
Physical qualification and complete delivered holder/cell fit remain false.

| Criterion                      | Completed evidence                                                                                                                                                                                                                                                                                                                                               | Scope or remaining input                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nuts and screw seats           | All 30 nuts and 33 source heads retain their exact checked source configurations, poses and reaction interfaces. The complete b169/02d4 thread, bearing and nut-loading evidence is inherited explicitly.                                                                                                                                                        | Source profiles, prevailing torque, tolerances and printed clamp strength remain unqualified.                                                                                           |
| Assembly and transport         | Unchanged nut/screw/tool and four workshop-coupler paths retain their original proof. The inherited b70 whole-assembly check excludes unintended collisions with the tray lands.                                                                                                                                                                                 | Flexible TPU handling is separate; eight permanent cover screws remain user-selected.                                                                                                   |
| Auxiliary tray                 | Eight broad base-backed frame lands add 52.8 mm³ and remove no material. One declared tray/frame pair measures 13.2 mm³ within 13.23 mm³; eight roots and 12 restraint witnesses pass.                                                                                                                                                                           | Original ZX908/JHE42B pocket clearances are accepted by the user; optional tape is unmodeled. No new device clamp/preload or adhesive qualification is claimed.                         |
| Controllers / compute / camera | Supplier geometries/poses, board mounts, camera/Pi supports, packaging probes, ports and fitting routes are exact unchanged recipes/interfaces.                                                                                                                                                                                                                  | Individual reserve probes do not establish simultaneous TPU travel, strain, force, damping or commercial plug fit.                                                                      |
| Measured holder                | Measured exterior and unbent-leg corridor studies remain unchanged; global collision checks retain every purchased item.                                                                                                                                                                                                                                         | Fitting witnesses are excluded from UI/FCStd/BOM. Complete actual internals and axial cell restraint remain unqualified.                                                                |
| Power / tail                   | Seven power prints and the integrated 17 mm closure retain their exact checked geometry, nut capture, washer seats, bearing faces and continuous routes.                                                                                                                                                                                                         | Nominal-clearance capture is not a tolerance, CO2-pressure or recovery-load qualification.                                                                                              |
| Covers / templates             | Unchanged R2.5 openings, cap reliefs, 50 mm removal paths and cylinder-unwrapped templates retain their source-bound proof.                                                                                                                                                                                                                                      | Support removal and D16T fatigue strength need physical qualification.                                                                                                                  |
| Identity / states              | 30 catalog prints (19 PETG/11 TPU), 29 installed plus 92 other physical occurrences: 121 installed, 122 supplied including one coupon; eight reference objects remain outside procurement. State and project checks retain the existing seven state IDs in both camera configurations.                                                                           | The obsolete pilot-collar occurrence is retired; retained IDs, camera selections, state IDs and supplier identities remain unchanged. Shared module views do not duplicate procurement. |
| Actual application exports     | Four current assembled/coupon avionics macros and six standalone marking-kit macros pass with unchanged source snapshots. Independent parity retains all30default/10alternate print recipes,92payload configurations/poses and both coupon bodies.                                                                                                               | Executed and inherited records retain their actual source fingerprints. Import/runtime tests distinguish the known missing-profile upgrade from invalid explicit selections.            |
| Native / preview / software    | Zero unexpected intersections or tube collisions; 129 FCStd identities; 426 STEP solids round-trip with relative volume error 1.49271×10⁻⁶. All 29 installed preview/native comparisons pass, max 0.3704%. All three package checks and38focused component/profile/import tests pass. Core import checks, type checking and build retain their separate records. | Geometric consistency is distinct from physical manufacture and loading.                                                                                                                |
| Offline printing               | The 40 remaining STL/3MF jobs retain their exact source-bound passes with zero actual warnings, repairs or audit errors; 12 embedded dense jobs are verified. The retired collar job is excluded.                                                                                                                                                                | No upload or physical print; adhesion, bridge sag, seat finish and material strength remain open.                                                                                       |

The selected complete finder is `jhe42b-finder:jhe42b`, nominal23×17×17 mm.
Its 25 mm manufacturer-photo conflict is retained as a library-fidelity note,
not a different requested execution or a measurement/approval blocker.
The source-labelled MPD holder proxy and the separate measured-envelope study
remain distinct; the latter does not reconstruct internal contacts or insulation.

##### P2S process and print verification

All five power PETG parts, `flight-frame`, `nose-base-frame`,
`nose-camera-keeper` and both covers use P2S 0.4/0.20 mm layers, 8 walls, 100%
Rectilinear infill and 8 top/bottom layers (1.6 mm). Alternate nose frame/keeper
jobs bring the dense count to 12. Longitudinal X lies in the layer plane for
the spine, cage, pan and frames. Covers use `[90,0,0]`, 5 mm brim and their
selected `bridge_no_support=1` policy. Supports in open interiors/head bores
need removal and gauging; actual radio tie tunnels stay clear.

The integrated closure uses `[0,-90,0]`, broad foreface on the bed and posts
printed last. Its selected support-off job has one 4997.94 mm² first-layer
island and 112.806 g estimated filament. Native review of its generated bridge
paths finds a maximum sampled unsupported span of 10.34 mm; prototype sag and
nut-seat finish remain unqualified.

Other PETG parts retain 4-wall/25% gyroid. TPU95A uses 3 walls/20% gyroid with
supports off. The 40 retained jobs inherit their actual slicing passes through
exact STL/profile hashes; the removed collar job is not part of the current
selection. Each changed tray has one 2821.75 mm² first-layer
island, zero supports, warnings or repairs, and 15.5263 g estimated filament.
Embedded profiles, hashes and all three process reviews bind the current fixture.
The current selected kit has 30 print bodies, including one coupon. The
OV9281 kit is estimated at 1139.56 g including 96.23 g support and 43.79 hours;
the 19 mm kit is 1140.44 g and 43.85 hours with the same support estimate. These are
separate one-part job totals, not measured prints or a packed-plate schedule.
Print one selected nose set. Earlier 31-print batch totals are historical.
See `print-audit/PRINT_SETTINGS.md`, `slice-report.json` and
`final-batch-report.json`.
<!-- current-full-audit-verification:end -->

##### Functional wall and root audit

The useful PETG free-wall/root target is 2.4 mm. Native sections and analytic
normal distances are applied at named functional features, not to a misleading
global minimum over bevels and Boolean edges. Purchased source geometry is not
thickened to satisfy a printed-part criterion.

| Feature                          |                              Earlier stock | Implemented correction                                                                   |
| -------------------------------- | -----------------------------------------: | ---------------------------------------------------------------------------------------- |
| Common radial nut forewall       |                                    1.75 mm | At least 2.5155 mm, axis offset 5.75 and real hex seat                                   |
| Flight coupler mouth side webs   |                                     1.5 mm | 2.5 mm from 12 mm columns around 7 mm mouths                                             |
| Earlier UPS keeper pocket lips   |                               0.2 / 0.3 mm | Keeper/pad architecture removed; continuous cage/pan and formed barrel liners replace it |
| Power continuous carrier corners |              Short support-finger baseline | 2.687 mm normal corner stock, 3 mm webs and broad captured disc bearings                 |
| Cover peripheral wrap            |                                       1 mm | 2.6 mm wrap and 4.6 mm central roof                                                      |
| Upper printed sealing skirt      | Open rim relief on the intermediate smooth cap | Source groove and skirt restored on the structural cover with supported screw cores |
| Pi compression tubes             |                           1.4 mm PETG wall | Four prints removed; custom aluminium sleeves retain the source interface                |
| Tail posts / closure             |          1.3 mm post wall / separate joint | 2.4 mm post walls and continuous 17 mm closure; obsolete joint voids removed             |
| Fit-coupon socket skins          |        0.75 mm default, 0.6 mm maximum fit | At least 2.7 mm floor/roof/sides at maximum fit                                          |

Most frame/shelf webs are 3 mm. The simple WING ledges are 4 mm thick,
with a 2.6 mm minimum at the intentional USB step. The nose side-sill edge
retains 2.585 mm after ogive clipping, its shell-nut locating floor 2.651 mm,
and the closed outer nut-bearing wall at least 2.76 mm. Pi carrier hole-pad
ligaments are 2.6 mm, camera
body/shroud stock 4.15/4 mm, camera root 6×4.25 mm, cheeks 6 mm, FFC-to-cheek
stock 2.5 mm and counterbore lands 3.4 mm. The source-matched XT60 panel has a
1.15 mm in-plane bridge between the opening and each M3 bore; it is supported
through the full 10 mm disc thickness, not a free snap arm. Keep that local
interface distinct from the free-wall target and inspect real flange bearing
and printed fit. Short TPU grommet walls, contact ridges and the 2 mm supported
USB floor intentionally provide compliance; their broad roots and slicer paths
are assessed separately.

`completion-audit/baseline-functional-walls.json` records measured earlier
sections; repaired source-specific reports record actual replacement walls.
`completion-audit/tail-nut-report.json` and `nut-exit-caps/report.json` distinguish
nominal clearance, transport retention and tightening reaction. These reports
add no invented receiver, antenna, strap or user-selected lid-screw product.

##### Ordered bench assembly and tube installation

1. With fairing/covers removed, bench-load captive nuts before closing their
   disc/frame interfaces. Load the four coupling spacers and retain them with
   four workshop `bolt-screw:gvyntok-040-190-007` DIN912 M3×16 screws from below.
   Their stable process IDs are `temporary-coupler-screw-1…4`; they are not in the
   finished/supplied BOM.
2. Bench-clamp WING+TPU with two underside M2 screws, then insert its complete
   rigid unit from above while only the outer TPU flanges flex 1.5 mm per X side.
   Bench-clamp LCH+TPU with two Accu bolts/two Nylocs, then load from below.
   Its 52.6 mm Y span fits the 53.2 mm window with 0.3 mm per side; its 55 mm outer X
   flange needs 4.5 mm folding per side through the 46 mm throat. USB goes in
   before WING; its lips need 0.5 mm per side flex and short Ø2.8 stems enter the
   reference Ø2.7 holes. These are declared manual elastic steps, not qualified
   TPU 95A force or strain limits. Tightening tools are used on the accessible
   bench subassemblies rather than through obstructing PETG ledges.
3. Assemble the power cassette with both discs absent. Support the UPS with its
   opening upward while loading cells and its liner/spine; do not rely on spring
   friction to retain loose downward-facing cans. Close upper cage and lower
   pan radially, with no rejected 10 mm axial lock shift. The measured-holder
   corridors admit its unbent legs; actual internal can seating remains unknown.
   Load the XT60 nuts into the true recessed hex seats and fit connector screws
   and bridging washers before closing the carrier/disc interfaces. Fit discs
   axially last, engaging the square keys and broad bearing seats.
4. Build the complete Pi rigid island on the bench. Its four Nyloc nuts bear
   broad-base-up; the whole loaded island uses the 62.6 mm throat with 0.3 mm per
   side geometric clearance after peeling the inner TPU lips. Camera cartridges
   use only their matching source-specific TPU liners. Do not clamp a lens,
   ribbon housing or populated package.
5. Lay both main bundles into the open channels and set service loops/disconnects
   in the spool/nose bays. Support and mate the keyed modules. Keep light axial
   closure through rigid end faces during transport; keys are not axial latches.
6. Insert the supported bare core aft-end first, maintain clocking and fit the
   14 radial tube anchors. The four temporary screws remain inside R42.8 during
   transport. Fit the upper cover and chosen upper screws first; confirm all
   four upper threads retain their couplings before removing temporary screws.
7. Remove all four temporary screws downward through the open rounded lower
   window, then fit the lower radio cover and chosen lower screws. Its posts
   occupy the temporary-head space, so the temporary screws cannot remain.
   Fit the fairing and its two independent radial screws along the recorded path.
8. For service, support the stack and disconnect actual leads first. Reverse
   the recorded rigid paths and explicit TPU peeling/folding steps. A service
   rendering does not prove motion of connected ribbons, plugs or loose wires.

#### Final compact layout decisions

The controller layout retains the horizontal LCH7 and separate USB accessory.
Their source port directions do not imply access through a now-removed side
window: service occurs after module withdrawal. WING MINI remains 6 mm toward
Y+, with its contact group aft. The lower lid now carries the receiver and antenna directly on integral strap
saddles, while the LCH7 support stays captured by the main frame.
All three flight TPU platforms have flat 3 mm locating flanges retained by
short, fully backed PETG lips. The common frame bed is Z−29.9; open side/end
girders and the four compression columns root on that plane. WING uses plain
4 mm ledges supported at both ends, with one broad USB step. Lowering the
unchanged LCH7 source occurrence 1.5 mm, from Z−22 to Z−23.5, removes the need
for small package-shaped reliefs. Its TPU base stays at Z−27.4; shorter posts
and board lips retain the same sourced board, USB direction and stable IDs.
The nominal LCH/frame gap is 0.67732 mm.

Fit the bench-clamped WING/TPU/screw unit sequentially under the short lips:
its 60 mm outer span needs 1.5 mm inward flange deflection per side at the 57 mm
entry; the rigid source and its two screws are not deformed. The loaded LCH source has a clear lower opening, while the TPU base
requires flexible edge folding before seating; the lower cover is absent and
is not its retaining part. The USB platform seats below its short lip and
onto the square locator; fit the USB source before WING. Rigid source-unit
installation envelopes are checked separately from these manual TPU steps.
Six source-qualified host fasteners are now added: two WING DIN965 M2×8 screws
and two LCH Accu M2.5×10 screws with two TR M2.5 Nylocs. No full soft wrap or rigid
C box is introduced. USB retains short solid locators and edge lips without
extra hardware. Physical TPU strain, nut-cage torque and insertion force remain
unqualified.

Native checks give zero nominal platform/frame penetration and all 36 TPU-only
±0.1 mm translation/±1-degree rotation restraint witnesses. Actual source
bodies are not used as capture stops. A broad open WING TPU top relief preserves
a 2.4 mm floor and the remote retaining flange while clearing the declared
20 mm USB housing-sized approach against the local supports. This is not a
straight-plug fit in the installed tube: at the full LCH housing height the
uncut Ø86 bore provides only about 12.46 mm from the mouth before first wall
contact. Select and check an actual compact/angled plug and its lead, or service
the withdrawn module. No side window is added for this arbitrary 20 mm gauge.
Exact commercial mating plugs remain unselected. Five 2.5×1.2 mm reference
strap gauges pass the radio tunnels;
they do not select a strap or prove its tightening force.

The user confirmed on 2026-11-02 that the F405 may use right-angle contacts
directed aft, along assembly +X. This is the required installation direction;
vertical mating above the board is not the selected arrangement. The rear
installation reserve spans X18.5…43.5, Y−7.2…18.7 and Z−4…7.2: 15 mm assumed
installed projection plus 10 mm axial withdrawal. These are fitting allowances,
not measured dimensions of a selected header or mating plug.

The existing `flight-controller:speedybee-f405-wing-mini` library component
retains its standard-shield reconstruction and straight visualization pins. It
does not yet represent an exact purchased right-angle header execution, and the
user's permission does not select the manual's separate inverted/custom-shield
assembly. Header body, bend, pin projection, female housing, lead exit and wire
bend limits still require the actual parts. Procurement identity and the
verified printed geometry are unchanged.

For that retained source reference only, the complete WING stack reaches Z7.3
below the Grandado bottom at Z9.2, leaving 1.9 mm; the metal pin tips at Z7.0
leave 2.2 mm. Those vertical gaps are not used to qualify the selected aft-facing
connection. See `wing-mini-source-review.json` and the aft-header confirmation
report in the result directory for the decision and bounded reserve checks.

The complete forward module is 185 mm, including its aft disc. Its shell is
175 mm and frame 173 mm. Pi USB-A/Ethernet face the camera (−X), with a 21.45 mm
nominal gap to the camera keeper and 20 mm authored service reserves. The aft
clearances ahead of the tube root are Pi 3.05, adapter 3.5, SSD 8.5, tracker
51.5 and finder 11.5 mm. Minimum native electronic-to-shell distance is
recorded in the current native report after lowering the adapter/SSD 0.5 mm;
these are geometric results, not connector-selection or thermal results.

The compact power module retains both supplier units in X120…250. UPS spans
X142…235. The published holder reconstruction spans X149.65…227.35; the
user-measured 78 mm envelope spans X149.5…227.5 with 0.5 mm authored end gaps.
Its 21 mm body height excludes the 4×1.5×0.5 mm bendable legs. Three 3 mm-wide,
78.6 mm-long through-floor corridors admit the unbent legs without assuming
their exact axial positions. These are project fitting observations, not a new
SKU, fake internal CAD or proof of electrical execution. The remaining 5.9 mm from XT60
terminal tips to the UPS leading edge still needs a measured harness-bend and
soldering/service check. The selected seven-part architecture replaces the old
perimeter keeper arches, edge pads and short support fingers.

Both continuous upper rails and the full lower U pan run between disc bearing
planes X130 and X240. The upper cage bears on the UPS's declared bare PCB edges;
the lower pan bears under the holder body. Their end hoops terminate in broad,
4 mm-deep bearing blocks captured inside closed disc recesses. The spine's
3 mm separator is reinforced by 10×6.46 mm full-width crossheads at X166…176 and
X201…211. Barrel reactions pass through the formed liner/hard-backup strips,
separator and crossheads into the long carrier walls, then into discs and tube
anchors. Spine stop-box sides provide the primary Y bearing against upper-rail
inner faces; outside collars supply secondary guidance/capture. Detachable
seams are not credited as a monolithic closed torsion box.

The formed contact band is X176…201, leaving 20.1 mm to each nominal can end
(20.0 mm for the smaller sensitivity case). Hard backup planes are Z2.5 and
Z−3.96. Without crediting TPU, nominal opening-direction travel is about 1.60 mm
for UPS cans in the original fixed-axis case. The current measured-unit lower
reconstructions retain 1.74 mm opening-direction hard-backup clearance; lower
axial can restraint and actual internal seating remain unqualified. Historical
smaller-can tests at fixed axes are distinct from varying unknown diameter while
retaining this one unit’s observed 57.3 mm bank width and 1 mm rim recess. The continuous separator's largest tube-side bypass is 9.6 mm,
smaller than either studied can diameter. This checks geometric escape barriers,
not zero play, a seal or cell impact pressure. Cylindrical barrel contact adds
no positive axial index: source plastic end walls and actual spring travel
still govern axial movement, with lower outer-row fit unresolved.

Independent native section checks confirm 2.687 mm diagonal carrier-corner
stock, 3 mm ordinary carrier webs, full crossheads and filled bearing-block
roots. The two TPU forms have 3 mm-wide supported side roots with 1.5/1.96 mm
backing; these compliant sections are assessed separately from the PETG
free-wall target. Six source-relative socket/header/BOOT approach reserves and
both Ø6/Ø7 routes clear the authored printed structure; they do not select an
actual mating cable or switch tool.

A gross-solid sectional calculation uses simply supported disc planes X130/240
and a radial force at X188.5. One upper rail carrying the entire 1 N unit force
gives 0.08832 MPa/N sampled bending stress; the lower pan gives 0.025025 MPa/N.
The old unperforated-pan deflection-times-modulus coefficient was
1.6001 mm·MPa/N. The current slotted-pan native screen gives max sampled stress
0.0249916 MPa/N and conservative deflection-times-modulus 1.686769 mm·MPa/N,
using the same ideal X130/240 bearings and X188.5 load. The upper-rail coefficient
remains 5.9286 mm·MPa/N. Compare model assumptions rather than combining these
coefficients as a flight-load margin. An independent 8 mm backup strip gives 0.1123–0.1160 MPa per
cell N; crossheads give 0.07261–0.07309 MPa per total bank N only under equal
three-cell sharing. These are distinct load models, not additive stresses or
allowables. They use actual native sections, ideal bearing and gross material;
no printed PETG modulus, strength, fatigue, creep, joint-slip or deployment
acceleration is established. Outer-row torsion and seam behavior require
physical qualification. Reports reside in `test-results/power-cell-retention/`.

The supplied Waveshare PCIe kit uses a 40 mm cable. A reference two-edge route
with assumed insertion allowances uses 35.963108 mm and clears the lowered-HAT
native assembly, leaving 4.036892 mm nominal length allowance. This result depends on the
stated cable/reserve dimensions and source contact orientation.

The latest OV fitting envelope uses a curved FFC passage and requires
126.70 mm for its longest edge including assumed ends, leaving 23.30 mm of a
nominal 150 mm lead. The 19 mm camera reference requires 105.32 mm, leaving
44.68 mm. Native ribbon/reserve envelopes clear both source camera executions;
physical ribbon developability, exact transitions and restrained surplus remain
distinct checks.

The [official Raspberry Pi PCN48](https://pip-assets.raspberrypi.com/categories/1267-pcn/documents/RP-010539-PC-1-PCN%2048_%20Zero%20Camera%20Cable%20form%20factor%20and%20manufacturing%20change.pdf)
records a 2026 form-factor change to the 150 mm Zero cable, with old and new
executions coexisting during transition. No numeric transition-length or bend
limit was found for the unidentified project lead. The modeled 11.5→16 mm
width evolution, 0.3 mm thickness, insertion allowances and bend limits remain
fitting assumptions, not a newly selected purchased cable. Generic 19 mm camera
pinout/Pi compatibility remains unestablished. See the source-specific reports
in the result directory.

#### Historical whole-structure review — baseline 2026-11-02

The review inventories all 32 prints: 30 installed pieces and two fabrication
aids, comprising 21 PETG and 11 TPU details. Functions, adjacent supports and
stable occurrence identities are listed in
`test-results/modular-tube-avionics/whole-structure-audit/inventory.md` and
`inventory.json`. Eight fitting references remain outside procurement. No
geometry, purchased dimensions, library IDs, states or manufacturing exports
were changed during that read-only stage. The following findings describe the
historical `6422ba09…` baseline, preserved under
`whole-structure-fixes/baseline/`. The four authorized corrections are now
implemented as recorded below; these historical probes are not current defects.

| Priority                  | Measured finding                                                                                                                                                                                                                                               | Baseline proposal; current status below                                                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correct first             | `nose-base-frame` front cushion stop is only 0.030 mm below the Pi PCB at X−178.3…−175.3/Y±28. A 0.05 mm downward island probe creates 3.36 mm³ overlap over 168 mm². This is separate from the intentional carrier-to-PCB interface within the bolted island. | Relieve the rigid stop under the board and preserve all TPU lands. A report-only 0.6 mm relief gives 0.630 mm clearance with the same 40.32 mm³ frame/TPU contact; revised assembly, travel and print checks would still be required. |
| Correct first             | `flight-frame` is 0.04532 mm from LCH7 package1057 at X−14.175…−12.925/Y−11.075…−9.075. A +0.1 mm Z probe produces 0.1367 mm³ overlap.                                                                                                                         | Reserve the moving source-package envelope and place intended stops on the carrier; coordinate this clearance with shelf reinforcement.                                                                                               |
| Reinforcement candidate   | WING support strips are 4.3 mm wide and 4 mm thick, projecting 16 mm left and 11.6 mm right beyond their risers.                                                                                                                                               | Study continuous source-safe ledges or rooted gussets while preserving the LCH/USB clearances and TPU isolation. No failed allowable load is inferred without mass, acceleration and process data.                                    |
| Secondary stiffness study | The nose bay X−214.5…−193.3 has two 6×8.5 mm ribs over 21.2 mm. Other parts of the 144 mm ribs are deepened by the auxiliary channel and Pi structure; those features are internal stiffeners rather than external supports.                                   | Study a shallow continuous channel across this short bay, checking both cameras, tracker withdrawal, ribbons, harness and fairing removal. The fairing has clearance and is not a preloaded front bearing.                            |

Rigid displacement probes diagnose clearance; they do not simulate TPU force or
establish a safe acceleration. The two baseline frame clearances could create hard contact bypassing isolation.
Their correction was prioritized over reducing printed part count.

Simple fusion of `spool-forward-disc` with its carrier, or `power-aft-disc`
with `tail-baffle`, blocks both actual radial nuts during axial loading from a
1.25 mm offset: 28 of 33 sampled positions collide in each case. These unions
are rejected without a new verified nut-loading route. The tail union would
also remove replaceable-baffle service and retain obsolete internal key/socket
fit gaps. Fusing the nose frame/disc, or the spool carrier/aft disc, remains a
conditional study requiring loading, service, bed-contact and support comparison.
The two flight end discs are geometrically identical after a 130 mm translation
and can share print-stock instructions at quantity two; this saves no installed
parts and does not rename their occurrences.

The current seven-part power cassette has two-end-bearing rails, crosshead-backed
backup strips and captured disc seats. No additional free support finger was
identified there. Its material and radial-assembly separations remain functional.
The external 6×6×4 mm keys locate and clock modules; installed tube anchors
provide axial retention. Recovery attachment, tube material/window strength,
actual cover screws and printed material/load qualification remain separate
open inputs. The consolidated trace is `whole-structure-audit/audit-summary.json`,
with source-specific gap, support, nut-entry and native nose reports alongside it.

The WING dimensions above describe the left positive strip exactly. The right
positive ledge is locally relieved into an L section by the USB opening; the
negative right region is part of the wider 3 mm USB shelf. Do not model all four
nominal strips as identical independent cantilevers.

#### Historical e22 isolation and support corrections

At that earlier stage, only `flight-frame` and `nose-base-frame` changed
geometry. The 32 printed IDs,
21 PETG/11 TPU materials, 112 installed physical occurrences, eight references,
all purchased dimensions/poses and seven Model states are retained. The frozen
sources are `flight.ts` at
`eb3b97f8d1dc2716bf3844156fb08cb4a2bed27c159feb5b20ee8912f409b999`
and `nose.ts` at
`1a67f6cef7423c5b4cd89d549816f79a4d46912388d6787a68bb4e847d0e8895`.

| Implemented change    | Measured evidence                                                                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pi front-stop relief  | The rigid stop is lowered 0.6 mm, giving 0.630 mm nominal frame-to-Pi clearance. Intended frame/cushion and cushion/carrier contact volumes remain 40.32 and 16.851168824 mm³.                                                                                                                                     |
| Nose front channel    | A 21.2×39×3 mm floor joins both ribs over X−214.5…−193.3, with 0.2 mm positive overlap: 25.44 mm³ per rib. A contained lap overlaps the floor and auxiliary end wall by 19.2 mm³ each. The local gross Iy changes from 614.125 to 2376.985 mm⁴. Both camera variants retain service, ribbon and fairing clearance. |
| LCH source reserve    | Independent 0.6 mm-inflated analytic bounds of every source piece replace the small package-specific notches. Nominal LCH/frame minimum clearance is 0.600 mm; the source geometry and pose are unchanged.                                                                                                         |
| Supported WING ledges | Both source-cleared bands connect to both risers instead of ending in the former free tips. Native roots retain 6.5 mm depth on the left and 5.1 mm after the intentional USB step on the right; minimum functional roof is 2.57732 mm. The thin USB-transition remnant is opened to the ledge edge.               |

The three flight TPU platforms retain zero nominal rigid-frame overlap and all
18 small geometric capture witnesses. Main Ø6/Ø7 corridors, lower-lid service
and the existing aft header allowance remain clear. The new flight material is
entirely at Z≤−13, below the disconnected lower-lid/radio withdrawal envelope.
Both nose variants retain all 34 service operations and the authored CSI/PCIe
fitting envelopes. These checks retain their actual-plug, flexible-lead and
manual TPU-deformation limits.

Each rigid island is checked at ±0.5 mm on X, Y and Z **one at a time**, with
all other islands fixed. The Pi group includes its rigid carrier, boards, SSD,
compression sleeves and fasteners. Frame-captured outer TPU flanges remain
fixed; their elastic behavior is not simulated. This is a per-axis packaging
reserve, not simultaneous anti-phase motion, a combined XYZ cube, qualified TPU
stroke or damping performance. The WING/USB source gap is 0.8 mm: opposed
0.5 mm Z moves create 4.248 mm³ source-envelope overlap. That diagnostic is a
remaining simultaneous-motion limit, not a change to their installed layout.

Actual variable-section unit-load screens for the source-cleared flight ledges
range from 0.7677 to 1.3929 MPa/N on the negative band and 0.7885 to
1.1747 MPa/N on the positive band. Different load positions and boundary models
prevent a universal strength/stiffness improvement claim. Dense printing and
continuous support do not supply material allowables, fatigue life or an
acceleration rating. Physical fit, TPU behavior and the independent recovery
load path remain qualification work.

The historical findings remain under `whole-structure-fixes/baseline/`; current
stage records are in `test-results/modular-tube-avionics/whole-structure-fixes/`.
Independent native review confirms full floor/root material, unchanged nominal
contacts and all 24 one-island-at-a-time axis probes against fixed rigid bodies
and the actual cut tube. Only the two authorized printed recipes change; all
other physical configuration identities and placements are unchanged.

The historical e22e4b… fixture passed whole native/STEP/FCStd checks, all 30
preview comparisons, all 14 actual application macros, ten focused tests,
type checking and production build. All 42 re-sliced jobs pass with zero actual
warnings, audit errors or mesh repairs. `print-audit/structural-process-review.json`
verifies the eight dense structural jobs, orientation and actual first-layer
policy. These are completed geometry/export/manufacturing checks; physical
material, fit, damping, fatigue and recovery qualification remain open.
See `independent-native-review.json`, `flight-supports-independent.json`,
`flight-access-independent.json`, `opposed-island-reserve.json` and the author
reports in the `flight/` and `nose/` subdirectories.

#### Historical fba26 rooted nose and simplified controller support forms

The final source hashes are `flight.ts` at
`130d5d71ade8c8610bc3474c0f270683124bf8185b6d7de2eac0a0965b17ce7a`,
`lower-cover.ts` at
`f63769aec99e6fe4a92004f5008adb3152131c79caad4a66a3ee0805035bed4e`,
and `nose.ts` at
`5d75aa3a7d0fc5bd95f28a14c32c491ec3b13a89f110f5a0ec55e24764e17999`.

A later physical-form review found that the former 71.3 mm nose side walls
were not supported by the nearby transverse bridges: a 1.3 mm Y gap separated
them, and the complete frame was connected only near the aft anchor. Native
clipping before that anchor produced three solids. This is why a whole-part
one-solid check alone did not establish an adequate local load path. The
e22 geometry and its successful checks remain historical evidence, not proof
for the replacement forms.

The selected nose replaces this arrangement with 3 mm U-cradle side sills at
Z−14…−11 and |Y|27.5…37.3, broad crossbars and an aft full-height return.
Four 6×6×6 mm roots overlap the lower ribs by 4 mm: 144 mm³ per joint, with the
full 216 mm³ root material retained. The side-wall stations and lower TPU
lands align with those crossbars. All fore-only clipping witnesses remain
one solid; native outer sill-edge stock is at least 2.585 mm after the ogive
cut. The previous 21.2×39×3 mm forward rib floor and 0.630 mm Pi stop clearance
remain in place.

Four backed, 8 mm-wide, 45-degree retainers replace the long rigid top clips.
The matching one-piece TPU underside sits nominally on the Z−11 sills, with
0.1 mm contact lands. A straight empty-seat insertion requires approximately
6 mm overall elastic squeeze; this is an explicit manual compliant operation,
not a successful rigid insertion simulation. The carrier/Pi stack, sourced
accessories and two camera layouts retain their installed poses.

The shell anchor now has a closed outer nut-bearing wall and a locating floor
of 2.651 mm. Its existing M3 nuts move 0.2 mm inward to |Y|34.8…37.2; screw
poses, M3×12 identities and 2.4 mm nominal full-nut thread overlap are unchanged.
Nut-bearing face area is 14.679 mm² per side. Local R40.4 curved frame lands
meet the real R40.4 fairing bore over approximately 90.235 mm² per side, with
1.5 mm axial lead-outs. The R42.8 shell shoulder retains 0.2 mm radial clearance
to the R43 tube. Native bearing and withdrawal checks do not qualify take-up of
that remaining fit gap, actual bolt torque, tube compliance or PETG creep.

The controller simplification reuses the existing bed, columns and material
interfaces instead of adding parts. Plain supported ledges replace the small
source-package stairs; short PETG lips and flat TPU flanges replace the rigid
C-shaped captures. The only electronics pose change is LCH7 down 1.5 mm. Its
purchased geometry and pin/USB directions are unchanged. Lower-cover compression
posts meet the new bed at Z−29.9 while head planes Z35.6/−34.2, four M3 axes,
10 mm couplings and 69.8 mm opposed grip remain unchanged. LCH support stays
captured when the radio cover is removed. The four actual lower-cover/frame
annular contacts total 277.842 mm² at Z−29.9, providing a rigid grip stop
separate from the TPU islands.

A native variable-section screen for the simple WING ledges uses ideal supports
at X±27 and a separate 1 N vertical load at either actual source mounting X.
The four stress coefficients range from 0.4369 to 0.9918 MPa/N. The sampled
functional stock is at least 2.6 mm; the single broad USB step remains open.
These gross-solid estimates omit printed allowables, root notches, TPU
compliance, torsion and fatigue. The differing deflection coefficients do not
establish a universal stiffness improvement over the earlier forms.

The function/contradiction is unchanged: broad rigid support must retain a
compliant island without contacting the populated source or creating narrow
support traps. Functional trimming removes unused wrap roofs and lower boots;
the existing bearing planes already stop downward motion. This retains all
32 printed IDs and materials, 112 installed physical occurrences, eight
references and seven Model states. No new purchased hardware or cell model is
introduced. Source-bound records are under
`test-results/modular-tube-avionics/whole-structure-redesign/`,
`flight-simple-rails/` and `nose-cradle-redesign/`.

The independent native gates check actual root material, named minimum stock,
intended contact volumes, six-DOF geometric capture and one-island-at-a-time
±0.5 mm rigid packaging reserves. These do not establish allowable TPU travel,
simultaneous anti-phase motion, connected-harness compliance, printed strength,
fatigue life, impact or deployment performance.

Fresh whole-assembly, export, preview and actual P2S records are bound to the
current fixture above. All 24 complete-island axis probes against the final
FCStd and cut tube pass. All 14 actual application macros pass with unchanged
source snapshots; all 30 installed preview-volume comparisons and all 42 P2S
jobs pass. Independent review checks the hashes/topology of all 42 STLs and
3MFs and reads the specified dense settings directly from all eight applicable
3MFs. The flight frame has one approximately 4773 mm² first-layer footprint;
both nose-frame jobs have one approximately 3448 mm² footprint. All TPU jobs
have one first-layer island and supports off. These are geometric and offline
process checks, not physical manufacturing or deployment qualification.

The trace includes `independent-final-native.json`,
`nose-capture-independent.json`, `nut-floor-independent.json`,
`flight-roots-independent.json`, `nose-shell-recipe-equivalence.json` and
`print-inventory-independent.json` under `whole-structure-redesign/`, with the
source-specific author records alongside it. Older e22 process totals are not
current manufacturing results.

#### Full-assembly fastener and measured-unit corrections

This section records the preceding `02d4ea15…` audit, inherited only where
`tail-merge/inheritance-report.json` proves unchanged configuration. The later
tail merge below supersedes its tail-specific geometry and washer execution.

That audit retained all printed IDs/materials and existing supplier
products. Its ten added standard occurrences are four DIN9021 M3 washers,
two DIN965 M2×8 WING screws, two Accu M2.5×10 LCH screws and two TR M2.5 Nylocs.
The workshop transport screws are a separate process resource. This trims
permanent transport clips and inaccessible wrench operations while retaining
positive clamping and the same modular interfaces.

The 14 common nuts move 0.4 mm to their reaction walls and their screw heads 0.2 mm
inward to the tube seats. Two tail nuts move 0.4 mm aft to X242.8 and use true AF5.8
recesses; two camera nuts move 0.2 mm to their roof faces. Every modeled plain
nut has its full 2.4 mm metal span within the full-diameter thread envelope.
No tightening torque or strength class is inferred.

Each XT60 head bears on `washer:gvyntok-e3f364f222e0`, OD9/ID3.2/t0.8. The same
M3×18 source screws move 0.8 mm forward. Each washer gives 30.4519 mm² connector
bearing and 15.7158 mm² head bearing. Four simple rear-open AF5.8 nut recesses in
`power-forward-disc` seat the nuts at X127.2…129.6, retain 7.2 mm forestock and
provide torque reaction without an obstructed rear wrench. The lower carrier
pad's inner Y edge moves 17→18 to leave at least 2.760 mm diagonal material at
maximum clearance. Native source-containment, continuous loading and angular
capture checks pass; no boss, extra print or purchased geometry change is used.

The four Pi Nylocs bear broad-base-up with 13.4223 mm² useful area each. The
modeled metal 2.0/nylon 1.53 mm spans are fully engaged; full-thread margin beyond
the modeled insert is 0.62 mm and tip protrusion 0.60 mm. Each 19.694 mm custom
metal sleeve has 18.4726 mm² nominal bearing at each PCB. The 0.030 mm Pi/carrier
CAD gap is small seating take-up inside this bolted island, distinct from
main-frame isolation clearance. The actual PCB stack, sleeve match and torque
still need physical checks. The TR source verifies 5 mm flats/3.8 mm height;
its generic 5.774 mm corner envelope differs from the drawing's 5.5 mm, and its
collar/nylon profile remains reconstructed.

WING uses `bolt-screw:gvyntok-040-030-002` in `wing-mount-screw-1/2`; source-safe
female engagement is 1.5 mm after the authored tip and blind-end gap 0.3 mm.
Actual female interfaces remain source references. LCH uses
`bolt-screw:accu-ssb-m2-5-10-a4` in `lch7-mount-screw-1/2` with
`nyloc-nut:tr-tr00000407-000` in `lch7-mount-nut-1/2`. The primary Accu sheet
verifies head D4.7/H1.5, L10, pitch 0.45, AF1.5/depth1.0; dome/fillet/thread runout
and tip remain authored reference geometry. Its modeled nylon full-thread
margin is 1.19732 mm. Broad backed TPU collars react the clamp without a rigid
fastener bypass to the frame. USB uses short solid locators and retained lips.

Two fully backed heels on `power-holder-cell-liner` take up lower-pan Y clearance:
0.25 mm nominal contact,0.10 mm minimum after 0.15 mm seat motion. Actual
contact is 22.9375 mm³ total; each root/backing face is 49 mm². Entry faces are
45 degrees, with no long free extension. This geometric take-up is not a TPU
force, strain, damping or creep prediction.

The user-measured holder record remains private project evidence in
`holder-fit.ts`/`holder-unit-observations.json`: 78×59.6×21 mm, 21 mm excluding
4×1.5×0.5 mm bendable legs, 57.3 mm overall installed-can bank and 1 mm rim recess.
Leg material/function, exact axial positions and delivered electrical execution
remain unknown. For the declared D18.6/65.2 fitting cans, equal-row assumptions
give Y±19.35/Z−15.0; three 3×78.6 mm through-floor corridors admit unbent legs.
Varying assumed diameter while retaining observed 57.3 mm/1 mm defines alternative
reconstructions of this one unit, not replacement-cell motion at fixed axes or a
published tolerance. Exterior and entry proofs do not qualify its cavity,
contacts, insulation, axial retention or full six-degree can restraint.

The preceding audit and exact source/artifact hashes are preserved in
`tail-merge/baseline-02d4/full-assembly-audit/final-report.json`. The current
master is `tail-merge/final-report.json`. The existing purchased holder model,
preset, published 77.7×59.69×21.54 dimensions and procurement identity remain
unchanged. No new holder family, SKU, parameter or Model state is created. Actual
material properties, delivered fits/cables, printed TPU mechanics, cooling,
recovery/impact and CO2 behavior remain unqualified.

#### Integrated tail closure revision

The selected simplification reassigns the adjacent PETG shield function to the
existing rear power closure. The ideal result uses the same material boundary,
existing carrier seats and tube anchors to remove a joint and one printed part.
Merging reduces assembly count but removes a convenient nut-loading face; this
is resolved by fore-loading the actual radial and axial nuts before closure,
with short, fully rooted stops on the existing upper cage. Keeping TPU separate
preserves its material, replacement and buffer functions. A monolithic torsion
box, pressure barrier or recovery rating is not claimed.

`power-aft-disc` retains its closing/bearing identity with a 17 mm PETG body.
`tail-baffle` is retired, and `tail-tpu-buffer` is unchanged. The internal fore
carrier seats and external modular interfaces remain faithful where required;
the former X250 male-key/socket joint is deliberately eliminated. Both local
Ø7 cable routes stay continuous. The two new cage noses have 2.4×2.4 mm roots,
and each added cap overlaps its existing rail by 108 mm³. Actual local native
sections verify the roots rather than relying only on one-solid validity.

Load all four source nuts from the open fore side first. Engage the existing
spine/cage/pan and slide the combined closure forward onto their retained fore
interfaces; the upper-cage caps close the radial loading mouths. Fit the
separate TPU buffer, the two broad washers and the existing M3×25 bolts.
The last radial tube anchors then locate the terminal unit. Bench disassembly
reverses this order. The axial nut recesses and their reaction faces remain
source-correct; both source-enclosing 12 mm loading bounds and finite angular
checks pass. For each radial nut, the assembled fore aperture is 2.8×4.25 mm
(diagonal 5.08945 mm), smaller than the actual source-contained 5.498 mm ring:
a rigid nut cannot escape through it at arbitrary tilt/clocking. Small fit
play remains; this is positive retention, not a zero-backlash claim.

The same two washer occurrence IDs now reference
`washer:gvyntok-e5f58c827639` (DIN9021 M4, OD12/ID4.3/t1). Each existing M3×25
bolt moves 0.2 mm aft to accommodate the thicker washer; nuts stay unchanged.
Native faces provide at least 9.2363 mm² head/washer bearing and 37.2831 mm²
post/washer bearing over the checked clearance stack, with full 2.4 mm nut
engagement and 2.4 mm tip protrusion. The independent nominal-clearance stack
0.65 mm washer/bolt +0.20 mm bolt/post +0.20 mm buffer/post still retains
0.65 mm radial TPU catch. This bound excludes manufacturing tolerances and
does not predict pull-through, material strength or actual simultaneous motion.

The `tail` selector keeps its key and now reads “Tail closure and TPU buffer”.
Its two prints and ten hardware occurrences overlap the power view as
inspection views of the same IDs, not duplicate physical products. Canonical
procurement and all seven Model-state IDs remain unchanged. The proven XT60
M3×18/OD9 washer/captive-nut scheme is retained: the delivered counterseat
angle/depth is not sufficiently sourced to certify a washer-free replacement.

The preceding tail-stage proof is in `tail-merge/final-report.json`, with its
fresh focused geometry,
source-delta inheritance, actual application-label equivalence and current
native/slicer/UI records. Earlier flight, nose, coupler and non-tail fastener
reports preserve their original `02d4ea15…` hashes. Actual holder internals,
axial cell restraint, TPU forces, fastener torque, adhesion/bridge quality,
thermal performance and recovery/impact/CO2 qualification remain open.

#### Historical remaining-assembly audit and auxiliary-tray seating correction

This records the b70 stage before aid cleanup; its 31-print count is historical.

The complete remaining-assembly review found that the auxiliary TPU tray had
0.3 mm end/top gaps to the frame. A valid single solid and a clean slice did
not establish its seating. The selected correction changes only
`nose-auxiliary-tray`, preserving both complete library devices, their positions,
all hardware, every ID and the 31-print kit count.

The ideal result uses the existing 3 mm TPU base to take up its own fit gaps.
New rigid catches would reduce motion but add narrow print gaps and service
barriers. The selected function reassignment adds short, broad backed TPU95A
end/top lands; the unchanged frame supplies the
backup. No Y-frame pads, separate pieces or new screws are added. Nominal 0.1 mm
authored interference is a free-state seating allowance, not a measured preload
force, travel range or damping property.

The user explicitly accepts clearance around the ZX908 and JHE42B and may use
double-sided tape if desired. Their original pockets/gaps remain; new device
clamps are not added. The one declared new contact pair is tray/frame only.
Tape is an optional unselected consumable, not an invented SKU or a modeled
extra component. Do not interpret the tray/frame seating test as rigid
six-degree retention of either device or as qualification of an adhesive.

The selected finder is the existing complete `jhe42b-finder:jhe42b` library
execution at nominal 23×17×17 mm. Its source is retained unchanged. The official
25 mm photo discrepancy and conservative alternative-envelope collision are
library-fidelity limitations, not a different requested execution, a required
measurement or a blocker. The lower holder's actual axial cell restraint,
exact WING mounting/header/plug geometry, SSD fixing thread and physical
TPU/material/recovery qualifications remain separate evidence limits.

The frozen tray recipe adds 52.8 mm³ and removes no material. Four end lands
project 0.4 mm beyond the base and four 6×2.5 mm top lands rise 0.4 mm from it.
The authored tray/frame interference is 0.1 mm, with 13.2 mm³ nominal native
contact and a 13.23 mm³ check bound. All eight native root witnesses are fully
present; six ±0.1 mm translations and six ±0.5° rotations meet the stated
restraint criterion. These are geometric seating tests, not TPU travel or force
qualification. Existing 32 mm base/26 mm frame-throat installation still needs
roughly 3 mm per-side empty-tray flex; no new rigid installation proof is implied.

The new material is confined to X−190.4…−101.6, |Y|≤15.8 and
Z−27.3…−23.9. This remains clear of the unchanged Pi nut-tool axes Y±24.5,
whose smallest nominal transverse separation is 8.7 mm before tool radius.
Every supplier occurrence/configuration/pose and all other printed recipes,
materials and orientations are unchanged in both camera sets. Current native,
application and manufacturing proof is consolidated in
`remaining-audit/final-report.json`; original b169/02d4 evidence retains its
original hashes.

#### Historical per-element decomposition review before aid cleanup

The pre-cleanup review records every then-selected physical element in both
camera configurations: 246 explicit rows, 123 per selection. Each kit contains 31
printed details, one modified nonprinted Grandado body, 21 purchased-unit
occurrences and 70 standard fasteners. There are 121 installed elements and two
reusable printed aids; eight fitting references remain outside procurement.
Native visualization solids stay inside their complete supplier units. The
Grandado enclosure blank is a manufacturing input to its one modified body,
not an additional installed case. Required but unselected cover screws, cells,
receiver/antenna, ties, wiring, cooling and recovery resources are listed
separately without inventing supplier executions or BOM quantities.

A real inspection bug was corrected: `nvme-end-screw` and `nvme-end-washer`
already existed in the complete physical assembly but were absent in the nose
module view. The narrow membership correction adds `nvme-` to that view's
filter. Both camera nose exports now contain all 42 selected physical elements.
Canonical physical construction, placements, source identities and production
printing files remain unchanged. Exact 14-macro/body/contract parity preserves
the original b70 execution evidence; two fresh nose-view executions and the
new regression verify the changed scope. The original executed and current
source fingerprints are recorded separately.

The review retains hardware with a distinct bearing, clamp, locking or service
function. An existing DIN967 M3×16 integral-flange screw could remove four XT60
washers and fits all four native locations, but its modeled bearing falls from
30.4519 to 12.2025 mm², minimum radial land from 0.85965 to 0.55965 mm, and
equal-force mean plastic pressure rises 2.50 times. Keep the existing broad
washer scheme; the candidate is not adopted.

Two same-geometry shell process trials are also not adopted. The bridge-policy
trial saves only 0.2445 g and 25.4 seconds; support OFF saves 34.24 g of consumed
filament and 54.06 minutes, but leaves the shoulder/rim finish and unsupported
layer advances physically unqualified. Production profiles, STL and 3MF hashes
remain unchanged. Reusing applicable marking/fit aids is a safer immediate
repeat-kit saving than deleting functional supports or fastening points.

The complete readable record is `decomposition-review/REVIEW.md`, with
`element-reviews.csv`/`.json`, `inventory.json` and `purchased-review.json`.
All 246 rows have a specific function, necessity, assessment and decision;
no row is missing or assigned to an unknown module. The source-bound archive
gate is `decomposition-review/handoff-master.json`. This audit does not assign
a material, damping, adhesive or recovery-load rating.

#### Historical marking-aid cleanup — before retrofit masks

The fixed-base `modular-tube-marking-kit:d90-86` covers both tube windows and all
sixteen wall-hole targets, so the old manually positioned `tube-pilot-collar` is
removed from both `d90-86-ov9281` and `d90-86-imx577-19x19` kits. Its ID is retired, not
reassigned. No installed part, supplier configuration, pose or interface changes.

The `square-key-fit-coupon` remains: it qualifies the avionics square-key socket
allowance and M3 clearance sample. Its recipe/material/pose are unchanged. The
existing state ID `templates` is preserved and relabeled **Avionics fit coupon**;
its only physical item is that coupon. The irrelevant camera selector is hidden
in this view, while the saved camera selection and all schema keys remain valid.

Both camera kits now contain 30 catalog prints (19 PETG/11 TPU), one of which is
the uninstalled coupon. They contain 122 physical kit items and 121 installed
items, with eight references excluded from procurement. The installed print
count stays 29; ten alternate-camera print bodies bring the manufacturing index
to 40. The separate marking kit stays five PETG bodies plus four standard
fasteners, with its three implemented states and fixed-base operation unchanged.

Current cleanup checks and artifact/inheritance bindings are recorded under
`test-results/modular-tube-avionics/aid-cleanup/`. Twenty-three focused tests and
both package checks pass. Four affected application macros are freshly executed;
ten other avionics macros and six standalone marking-kit macros inherit actual
execution through exact script/contract comparison. The retained 40 print jobs
use exact existing STL/profile/3MF bytes; no reslicing is needed. The earlier 123-item/31-print
review and delivered archives remain historical evidence. Their source hashes
and executed checks are retained rather than relabeled as current executions.

#### Explicit profile and IMX577 metadata verification

The profile registry exposes only `d90-86`. Both avionics presets and the marking
kit preset store that selection; camera option values and all family/preset IDs
remain unchanged. Derived OD90/ID86/wall2/insert85.6 values are assessment data.
No numeric diameter or insertion-clearance input is exposed. The marking kit's
independent fitting allowance still describes its tool-bore relief.

Thirty-eight focused tests cover both families and camera components, including
old preset reconciliation and old configuration/URL/project import. The
serialized records acquire only the known missing profile; configuration and
occurrence IDs, designations and leaf records are preserved. Unknown profiles
and unrelated missing fields fail. All three affected package checks pass.

Independent parity against the pre-profile snapshots retains all30default
prints,92payload occurrences,10alternate nose prints and all existing interface
contracts. The only camera occurrence metadata difference is the scoped
IMX577 label/name/notes for the user's existing 19x19 mm module. Exact purchased
parameters and source identities are preserved. Its generic companion preset
continues to assign no sensor; no supplier, pixel, performance or driver claim
is added. Current evidence is under `parameterization-stage/`; prior native,
manufacturing and physical-qualification limits retain their actual provenance.
