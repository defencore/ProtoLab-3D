# Modular tube marking kit

`modular-tube-marking-kit:d90-86` is a separate manufacturing-tool kit for
both `modular-tube-avionics:d90-86-imx577-19x19` and
`modular-tube-avionics:d90-86-ov9281`. Find it under **Workshop → WORKSHOP TOOLS →
DRILLING JIGS**. It does not add tools to the installed electronics assembly.

## Supported tube profile

The physical `tubeProfile` selector uses the same readonly registry as the
avionics. Its only supported entry is `d90-86`: OD90/ID86,2mm wall and associated
avionics insert85.6mm with0.4mm total clearance. These are derived information,
not independent size controls. Tool-bore `fitAllowance` remains separate; the
avionics insertion clearance does not change these marking tools.

Additional profiles require separately checked geometry, hardware, workpiece
fit, opposed interfaces, pattern and printing before they become supported
options. Purchased hardware is not scaled. Unknown/missing runtime selections
are rejected. Old version-1 links/JSON/projects for this known kit gain only
the missing `d90-86` selection on import; explicit unknown profiles and other
missing fields remain errors. Existing family/preset IDs, states and operating
controls are preserved.

## Function and design basis

Transfer both opposed service-window outlines and all sixteen radial hole
centers onto a nominal Ø90/86 tube using its front end as the axial datum. The
project front X−100 becomes jig X0. Window geometry, hole stations and finishing
sizes derive from the avionics package. Fitting allowances do not resize this
pattern.

The fixed frame locates a nominal Ø90 tube against two perpendicular tangent
lands at Y−45 and Z−45. A diagonal pressure shoe pushes it against both lands.
The free bore has separate diametral clearance, 0.8 mm by default. The frame
stays fitted while only the window stencil and two rails move between opposed
registers. No drilled pilot pair or rotation of the complete base is required.
Actual tube diameter, ovality, end squareness and clamping behavior remain
physical fit checks; nominal centering does not establish precision for every
real tube.

The ideal result uses the existing front end, five printed bodies and the same
three removable pattern tools for both passes. Moving the whole base would lose
its seating, while separate guides would multiply setup errors. The selected
concept assigns holding/centering to a fixed frame and shoe, and pattern transfer
to the removable stencil/rails. Four registers derive from one interface at
0°, 90°, 180° and 270°. A registered rail overlap keeps each print below the bed
length. This replaces the former split slip-fit collar and pilot-index procedure.

Alternatives were the former sliding base with first-hole index shanks and a
flexing split ring. The first retained an avoidable drilling/reseating sequence;
the second relied on printed deformation to combine holding and registration.
The selected fixed tangent lands and separately driven shoe give an explicit
locating and pressure path. Actual holding force, friction, deflection and wear
still require a prototype; a nominal CAD contact is not a clamp-force rating.

## Physical composition and identity

| Occurrence ID                     | Function                                    |
| --------------------------------- | ------------------------------------------- |
| `modular-tube-jig-collar-a`       | Fixed front-datum frame with four registers |
| `modular-tube-jig-clamp-shoe`     | Captive diagonal pressure shoe              |
| `modular-tube-jig-window-stencil` | Removable window scribing saddle            |
| `modular-tube-jig-rail-front`     | Removable forward side-hole rail            |
| `modular-tube-jig-rail-rear`      | Rear rail and registered overlap            |

All five bodies use `manufactured-detail` with separate native recipes and
manufacturing records. The four standard occurrences are:

| Occurrence ID                          | Exact library execution                          |
| -------------------------------------- | ------------------------------------------------ |
| `modular-tube-jig-pressure-screw`      | `bolt-screw:gvyntok-040-190-008` · M3×20 DIN 912 |
| `modular-tube-jig-pressure-nut`        | `hex-nut:gvyntok-474adfbe1cd7` · M3 DIN 934      |
| `modular-tube-jig-shoe-retainer-screw` | `bolt-screw:gvyntok-040-190-009` · M3×25 DIN 912 |
| `modular-tube-jig-shoe-retainer-nut`   | `hex-nut:gvyntok-474adfbe1cd7` · M3 DIN 934      |

The full frame preserves the original front-datum function and ID. The former
second collar half, `modular-tube-jig-collar-b`, is retired; the pressure shoe has
its own ID. The four old collar-join hardware occurrences are retired rather
than relabeled as simultaneous extra fasteners. The family and `d90-86` preset
remain unchanged. The reference workpiece is excluded from composition and
fabrication exports. The avionics square-key/M3 fitting coupon remains separate
and does not test these tool registers. The former avionics pilot collar is
retired because this kit provides the complete tube marking pattern; no avionics
process aid is duplicated inside this nine-piece kit.

`fitAllowance`, `jointAllowance` and `markDiameter` affect physical tool geometry.
`side` and `showTube` are setup/inspection controls excluded from product
identity. Both passes retain all nine physical occurrences. The base, shoe and
all four fasteners keep their placements; only three pattern tools change
registers. Project composition uses the canonical first setup with no reference
workpiece.

## Setup and marking

Print the five bodies in the **Printable tools** state. Each body has its own
print pose; the complete separated display may span multiple printer beds.
Use the supplied per-part 3MF settings: the fixed frame uses GRID supports and
the other four bodies use supports off. Remove supports and brims before fitting
the shoe, screws or nuts. Clean and gauge the shoe guide, pressure-nut loading
mouth, fastener seats and marking passages; the supported frame's nut mouth is
not support-free. Check free shoe movement and hardware seating without the
tube, then check the printed 100 mm rules against a physical rule.

Fit the pressure shoe and its captive metal nut/retainer hardware, leaving the
pressure screw loose and the shoe retracted for initial tube entry. To release
from the contacting position, back off the pressure screw two turns, withdrawing
it 1 mm, and pull the shoe handle outward until it lightly meets the withdrawn
screw, approximately 1 mm from the clamped position. The retainer pin keeps
the shoe captive; its larger capture stroke is not the operating release
target. The shoe has no automatic spring return. Slide the frame over the bare
tube front, seat the front stop and bring the tube against both fixed tangent
lands. Tighten the pressure screw sufficiently to hold that seating. Check the
actual contact and holding on the workpiece; do not infer a universal torque or
centering tolerance from nominal CAD.

Make paired witness marks on the fixed frame and adjacent exposed tube, clear of
the tool registers. Before each marking pass, check manually for axial sliding
or turning and confirm the marks have not moved. Keep the base tightened while
transferring the pattern tools; re-establish the seating before proceeding if
the check shows movement.

Place the rear rail first near X155 and retain it loosely at the rear band land.
Lower the front rail over the rear lap and the frame register, then seat the
visible X20/X155 shoulder faces. Fit the window saddle. The rear rail cannot pass
through an already seated front-rail lap roof. Use removable bands or tape strips
at most 6 mm wide at X45/146 and X195/240/330, with only enough tension to seat
the broad faces. Keep the outline and passages clear.

Mark the first window and hole line. Leave the base, pressure shoe and all its
hardware fixed. Remove the three pattern tools and fit them to the opposed
registers, using the same rear-rail → front-rail → window order. Mark the opposite
window and hole line. No initial pilot pair is needed for this transfer.
For convenient access, the tube and its still-clamped base may be turned
together on the bench. Keep the witness marks aligned: the base must not turn
or slide relative to the tube.

The window is the source projected 83.6×58.6 mm outline with R2.5 corners. Its
curve on the tube follows the source cylindrical geometry. Use a fine scribing
point with enough exposed reach for the side edges and keep its shaft angled
inward within the opening. There are eight axial stations, repeated on the
opposite side. The eight cover through-screw axes lie inside the removed windows
and are not extra tube holes.

| Tube-front distance X (mm) | Source project X (mm) | Finishing preparation          |
| -------------------------- | --------------------- | ------------------------------ |
| 11                         | −89                   | Nose shell cap-head seat       |
| 25.75                      | −74.25                | Countersunk radial anchor head |
| 35.75                      | −64.25                | Countersunk radial anchor head |
| 165.75                     | 65.75                 | Countersunk radial anchor head |
| 175.75                     | 75.75                 | Countersunk radial anchor head |
| 215.75                     | 115.75                | Countersunk radial anchor head |
| 225.75                     | 125.75                | Countersunk radial anchor head |
| 345.75                     | 245.75                | Countersunk radial anchor head |

Each row applies to both side lines. The geometry reads the source datums
directly. Default Ø3.2 passages accept a nominal Ø3 transfer tool; the final tube
holes remain Ø3.4. Remove the complete marking kit before powered drilling,
head-seat preparation or cutting, working through one wall at a time. Check
pilot positions against the actual insert/module attachment datums before
enlarging holes or cutting windows. No hardened drill bushing, compensated
cutter or powered-guide rating is selected.

## Views and verification

**Working setup**, **Separate components** and **Printable tools** implement the
same physical kit. Setup/exploded poses do not change procurement quantities.
Reference tube visibility affects inspection only.

Current profile-registry fixture:
`9be31dce6caf49bea1ee269f4466ac5da17c2a31cd477a83c31401015b7c7196`.
All physical recipes and poses are exactly equal to the executed `2e306d1d…`
fixed-base baseline; the new profile is explicit metadata for the same size.

| Check                     | Result and scope                                                                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library and identity      | Thirty-eight focused profile/import/component tests and all three affected package checks pass. This kit remains5prints+4standard units; avionics remains122kit/121installed with only its separate fitting coupon.                                                     |
| Physical composition      | Five manufactured prints and four exact standard occurrences; references excluded. All six base/shoe/hardware occurrences are unchanged between passes. Only the three pattern tools move.                                                                              |
| Actual geometry           | Five valid native single-solid prints, no unintended physical intersections, checked STEP round trips and nine FCStd identities.                                                                                                                                        |
| Actual application        | Six actual application macros pass on the explicit-profile source snapshot: both passes × working, exploded and print states. Native physical parity retains the preceding fixed-base geometry; source snapshots are recorded separately.                               |
| Opposed registers         | Both directed native material differences are zero in each opposed interface pair. Twenty-four actual-preview bearing-land probes also pass.                                                                                                                            |
| Pattern and reach         | All sixteen source wall targets and both windows match. Each pass has forty native edge/reach samples; maximum outline separation is below 0.000001 mm. The tilted point is an unprocured geometric envelope, not a selected tool or a marking-accuracy rating.         |
| Nominal locating contacts | All four fixed-land witnesses have zero nominal separation. The modeled concave shoe/tube contact area is approximately 286.669 mm². Small transverse displacement witnesses meet the frame or shoe.                                                                    |
| Hardware reactions        | Pressure-tip/shoe area is approximately 2.545 mm². Pressure-nut/frame, retainer-head/frame and retainer-nut/frame each have approximately 14.679 mm² of modeled bearing area. These areas do not establish allowable force.                                             |
| Assembly and release      | Nominal/minimum/maximum fitting cases pass exact continuous shoe entry, pin/nut loading, 0…1 mm selected release and axial tube entry certificates. The shoe is inserted before the pin and tube; no first pilot pair is required.                                      |
| Manufacturing             | All five actual P2S jobs pass with zero warnings or repairs. Four use supports off; the fixed frame uses the supplied GRID/full-support profile. Native cleanup-access probes pass, including the pressure-nut mouth; actual support removal still requires inspection. |

The selected P2S/0.4 mm jobs use PETG, 0.20 mm layers, four walls, 25% gyroid
and a 5 mm brim, with the frame-specific GRID supports enabled in its 3MF. The
five jobs estimate **223.4 g including brims and 2.13 g of supports, and 7 h
52 min**. These are offline slicer estimates; no physical print has been made.
The largest rail is 214 mm long, or 224 mm with its brim.

The default 0.8 mm free-bore clearance is entry clearance, not free radial play
once the tube is seated against the fixed lands. For an ideal circular tube
with radius 45+δ mm, those lands place its center at Y=δ/Z=δ. The illustrative
Ø89.8 and Ø90.2 cases therefore shift the center by −0.1/−0.1 and +0.1/+0.1 mm.
These are sensitivity examples, not measured tube tolerances or a universal
self-centering range. Ovality, end squareness, printed scale and register fit,
scriber offset and seating/holding behavior remain actual-workpiece checks.
A nominal Ø3 transfer shank in a default Ø3.2 marking passage also has 0.1 mm
radial center-transfer clearance per hole. This is marking-tool clearance, not
pilot-index or base play. Axial scale error at the last station equals
345.75 mm times the measured fractional print-scale error.

Axial and angular holding rely on the clamped contact and friction. Actual
holding force, indentation, stiffness, wear and achieved marking accuracy have
not been physically qualified. Use the paired witness marks and manual checks,
and compare pilot locations with the actual insert before final machining.

All current records are under
`test-results/modular-tube-marking-kit/fixed-base-redesign/`. The earlier fixture
`7f53bb2c…` and its print estimates belong to the superseded split slip-fit
mechanism; its sources and reports remain historical baseline evidence, not
verification of this fixed-base mechanism.

The subsequent avionics aid cleanup does not add, remove or reshape any item in
this marking kit. Avionics now supplies only its square-key/M3 fitting coupon
(122 kit items, 121 installed). That coupon uses `keyClearance`; these removable
tool registers use `jointAllowance`. The unchanged fixed-base native/application
and manufacturing evidence retains its original fixture and source hashes,
with current dependency and inventory checks under
`test-results/modular-tube-avionics/aid-cleanup/`.

The explicit-profile stage is recorded under
`test-results/modular-tube-avionics/parameterization-stage/`. Both profile
selection/import behavior and the user-confirmed IMX577 metadata in the parent
avionics family are covered without reshaping these tools or their hardware.
The five actual manufacturing jobs retain their source-bound evidence and
physical cleanup/fit/holding/accuracy qualifications.
