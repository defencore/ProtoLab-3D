# Configurable PCB carrier and sliding locks

## Function, acceptance criteria and scope

`pcb-retention-mount` is a reusable carrier for one to four bare-substrate PCB outlines, with independently selected lengths and widths. It supports the mixed 60 × 80 mm and 120 × 80 mm field-DAQ pair without scaling either board. The configured printed carrier and optional removable bridges are physical `manufactured-detail` definitions. PCB outlines are installation references, not purchased products, and are excluded from composition, STL and native fabrication exports.

Required controls are board size, quantity, underside seating height, lock presence and optional side or underside support. Acceptance criteria are positive connected physical solids; explicit running clearances; local lateral guides at every relevant corner; positive PCB capture when locks are fitted; an accessible lock-release and board service path; actual support geometry for every selected option; a documented attachment datum; consistent native/preview geometry and state-independent physical identities. Application loads, PCB material, populated-board keepouts, polymer grade, print orientation and life are unspecified. No universal board fit or stiffness rating is assigned.

Library path: Electronics → Electronics mounts → Module adapters. Family ID: `pcb-retention-mount`. Presets: `single-80-60`, `daq-mixed-60-120`, `three-side-supported`, `four-under-supported`, `single-open-top`. The stable physical occurrence IDs are `carrier` and `bridge-1` through `bridge-N`. Equal bridge designs use the same local recipe and explicit occurrence placement; they do not become new products because another board or enclosure uses them.

## TRIZ decision and alternatives

The baseline is a screw-mounted PCB on separate standoffs, or an edge clamp relying on friction. The ideal final result assigns location, underside support and serviceable retention to the printed host structure while preserving clear board areas. The useful interactions are underside support, outboard edge guidance and rigid groove capture. Harmful interactions are local substrate bending, solder interference and guides blocking the service path.

Tighter fits reduce board movement but make insertion sensitive to printing error. More underside support reduces unsupported span but consumes component and solder clearance. Permanent capture improves retention but makes board replacement difficult. Separate lateral location from vertical retention: open triangular corner seats locate Y without a roof or inward X stop, while a removable bridge supplies the missing X/top groove faces. Remove that bridge before moving the board. Separate optional distributed support from mandatory corner seats so only verified bare contact areas need to carry load.

The existing field-DAQ removable bridge was retained as the mechanism baseline. Its native construction now lives in the public `src/core/pcb-retention-bridge.ts`; both the field enclosure and this family use it. The open triangular guide is shared through `src/core/pcb-retention.ts`. Standoffs remain suitable when source mounting holes and hardware are available; straps are a different existing family; spring clips would introduce different deflection and fatigue questions. No novelty or contradiction-matrix claim is made.

## Datums, rows and host interface

The carrier underside is Z=0; its upper face is `baseThickness`. The first PCB starts at X=0. All PCB centerlines are Y=0 and their undersides lie at Z=`seatHeight`. Boards are laid out in +X, separated by `boardGap`. The mixed-DAQ preset becomes exactly the field-DAQ board layout after a rigid X translation of −94 mm: first board X−94…−34, second X−24…96, both Y±40 and underside Z8. The generic carrier does not replace the field enclosure's original outer corner pockets or floor.

With locks, the carrier top-to-board gap must be at least 5 mm. This preserves the existing mortise roofs, foot clearance and 0.2 mm web/plinth separation at the baseline. Without locks, a 1 mm minimum gives positive guide/support height. These are geometry guards for this construction, not universal FDM recommendations.

Optional mounting holes pass through the carrier floor. Four centers are derived from the carrier rectangle by `mountingEdgeInset`; their X/Y pitches and carrier dimensions appear in the assessment. Hole diameter and inset are editable. The carrier underside and first-PCB X datum are the host integration references. No screw head, nut, countersink or attachment hardware is selected by these bare bores; check the actual tool, mounting stack and enclosure floor before installation.

For integration without a separate carrier plate, the public core helpers emit native analytic `Shape` features that can be fused into an existing host floor with explicit placements. Keep the selected `baseZ`, PCB seating plane and bridge datums consistent. Do not import another package's private `lib/` helpers as an application interface. The host owns its actual connectors, cable bends, thermal paths and installation envelope.

## PCB contacts and anti-flex supports

Every triangular open pocket starts from a floor-connected body with a 10.5 mm X run on the PCB side of the selected edge, a 10.5 mm inward Y reach and a 6 mm outboard Y breadth. The substrate/service cavity is cut from the selected seating plane upward through the full X extent, leaving an underside ledge and a broad outboard body at the configured side clearance. This replaces the earlier narrow fin with a wider load path into the floor. There is no top roof or X stop. In the field-DAQ case these four inner pockets constrain local lateral/yaw movement near the key while preserving board withdrawal along X. Inspect component and solder keepouts over the complete larger seating footprint.

When locking is enabled, the first board's far-left and the last board's far-right corners retain outer envelopes with short roofs. A single-board carrier has outer envelopes on the left and a free-side bridge on the right. Interior corners remain open; a middle board can lift vertically once both adjacent bridges are removed. Without locks, all corner seats are open-top and separate outboard X stops locate the outlines without upward capture.

Enabled locks also have mandatory 4 × 10 mm underside lands directly beneath each real PCB contact edge. Their Y centers are `stationCentre−1.5`, so the entire 9 mm key sweep stays over a 10 mm land. These lands carry local bridge contact loads into the carrier rather than bending the PCB to distant corner seats. The single-board free-side key omits the unused phantom-side lands. They are part of the basic seating system, separate from additional anti-flex supports.

Additional support modes have different physical geometry:

- **No additional rails or ribs:** corner seats and any enabled lock lands, without continuous rails or distributed underside ribs.
- **Side edges:** 3 mm-wide contact strips lie 1…4 mm inboard of each Y edge, extending along X4…length−4. Confirm these exact underside strips are clear.
- **Underside ribs:** 2.4 mm-wide ribs contact lines across Y−width/2+6…width/2−6, leaving 6 mm side-edge relief. First/last rib centers are 8 mm from the X ends. The number is chosen so actual center spacing is `(length−16)/ceil((length−16)/supportPitch)`, never greater than the selected pitch.
- **Both:** the union of side strips and underside ribs.

Rib clear span is the center spacing minus 2.4 mm; X end overhang is 6.8 mm. Side rails leave a central transverse span of `width−8` mm. These are unsupported geometric spans, not deflection results. PCB stiffness, actual loading and component placement determine whether any support arrangement is sufficient. Solder tails, exposed conductors and components must not bear on printed support features.

## Lock, contact lands and service

For multiple boards a bridge sits in each adjacent-board gap. One board uses a single free-side bridge. Each bridge has two Y stations based on 30% of the narrower neighboring width, shifted +1.5 mm to center its complete 3 mm service sweep. At the 40 mm minimum width the stations are 24 mm apart, leaving distinct 13.5 mm plinth envelopes. The release leaf is extended beyond the widest neighboring PCB edge when widths differ. The single-sided bridge has an unused outer arm but no unused pad or purchased item.

Reserve bare 4 mm-deep × 10 mm-long edge lands centered at the station locations before the +1.5 mm shift. The rigid generic bridge roof has `clearance` above the substrate; it does not press down through an unspecified soft pad. The field-DAQ configuration retains its existing four TPU pad pockets and physical pads through the same kernel's explicit TPU mode. Its board dimensions and physical boundaries remain separate from this generic example.

Install the outer board edges in their envelopes first. Hold a bridge's release leaf 0.9 mm lifted while lowering it at Y−3 mm, slide +Y3 mm, then release into the unloaded catch. The foot/roof geometry provides positive retention. For removal, lift the leaf, slide −Y3 mm and lift the bridge before moving a board. Outermost boards withdraw 9.5 mm toward a cleared central bay then lift; a middle board lifts after both adjacent bridges are removed. A one-board carrier withdraws +X toward its cleared free-side bay. Maintain that service space in the host enclosure and check real populated-board protrusions.

The prescribed leaf fixture is geometric. A uniform 18 × 3 × 1 mm cantilever lifted 0.9 mm has nominal small-deflection strain `1.5*t*delta/L² ≈ 0.417%`; root notches, print anisotropy, local contact and fatigue are excluded. No insertion force, release force or cycle rating is established. Tall seating heights also increase stem and carrier compliance; working loads, material properties and attachment boundaries are required for structural release.

## States, printing and identity

The canonical state is **Assembled**. **PCB service** and **Exploded** are available only with the lock enabled; they move occurrences for inspection without changing physical definitions. Disabling a lock reconciles unavailable states through the common application state selector. **For 3D printing** places the carrier underside and bridge roofs on Z=0 with 8 mm gaps. References are always omitted from print/native fabrication exports. Large custom arrays can exceed a printer or host envelope; inspect the actual footprint, brims and service clearance.

Use separately qualified printed material and layer orientation. Inspect mortise roofs, hook feet, release slots, corner fit and elephant-foot effects. Clear the key with a suitable tool through its modeled lifting window; tool loads and populated-board access still require a physical trial. No full enclosure electronics, fasteners or wiring is invented by this carrier.

## Verification and remaining evidence

Focused tests cover complete presets, active states, mixed-board datums, optional-support geometry changes, repeated local bridge identity, reference exclusions, bed gaps, public geometry guards and dependent seat-height reconciliation. Root integration checks execute generated native geometry, compare the unchanged field-DAQ parts after kernel extraction, test local corner witnesses, board/bridge paths and STEP/FCStd round trips. Reports and generated exports belong under ignored `test-results/pcb-retention/`.

The wider open-pocket revision passed an integrated native run of 13 configuration sets: three field-DAQ fit combinations and ten carrier configurations covering all five presets, tight/loose clearances, maximum seating height, mixed widths, maximum gap and four boards without locks or holes. All 45 production macro/STEP/FCStd checks, eleven carrier bridge release/slide/lift cases, twenty board service cases, local corner witnesses, broad pocket floor/rim-root material probes, mandatory lock-land and selected side/rib contact probes, printing Z=0/8 mm separation checks and reference-exclusion checks passed. The independent pocket regression also passed all four orientations at three clearances; the complete focused suite passed 66 tests.

The prior portable workbench export includes both public kernels and passed its own TypeScript and production build checks; that snapshot predates the wider-pocket geometry. The current application build and test typecheck passed after the pocket revision. Detailed reports are under `test-results/pcb-retention/` and the previous portable handoff under `test-results/pcb-curator-handoff/`.

Actual board fit, substrate bearing, support deflection, attachment strength, polymer creep, vibration, contamination and release life remain unverified until specified and tested. A valid CAD solid or a beam screening formula is not a physical release qualification.

Sources: [Protolabs Network enclosure/component layout guide](https://www.hubs.com/knowledge-base/enclosure-design-3d-printing-step-step-guide/), [Formlabs printed snap-fit guidance](https://formlabs.com/blog/designing-3d-printed-snap-fit-enclosures/), [TRIZ Body of Knowledge](https://www.aitriz.org/triz/triz-body-of-knowledge), and [MATRIZ terminology](https://wiki.matriz.org/docs/triz/glossary-6146/). They inform the method and manufacturing considerations; none supplies these authored dimensions or a universal PCB fit.
