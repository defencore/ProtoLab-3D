# Stock SMB bearing set from Prom.ua

The default bearing set is now shared by the Ø54 and Ø64 twin-pin mechanisms. Every bearing component name includes its bore × body outside diameter × overall width in millimetres, including the reference configurations. Those dimensions are included when copying the name and in the component CSV. Flange dimensions are listed separately below. The `Bearing set` selector also retains the original reference construction, including its old bearing seats and sleeves. Do not mix the cutting files from the two bearing selections.

| Bearing | Body d × D × B, mm | Flange D × width, mm | Quantity per four-drive block |
|---|---|---|---|
| [SMB MF105 2Z](https://prom.ua/ua/p1448821262-podshipnik-smb-mf105.html) | 5 × 10 × 4 | 11.6 × 0.8 | 8 |
| [SMB MF106 2Z](https://prom.ua/p969387376-podshipnik-smb-106.html) | 6 × 10 × 3 | 11.2 × 0.6 | 4 |
| [SMB MF63 2Z](https://prom.ua/p1798156382-podshipnik-smb-3x6x25.html) | 3 × 6 × 2.5 | 7.2 × 0.6 | 4 |

MF105 and MF106 share a 10 mm body diameter but are not interchangeable: their bores are 5 and 6 mm and their overall widths are 4 and 3 mm. MF105 fits the turned Ø5 TR8 journals. MF106 keeps the previously assigned Ø6 output shaft and the thinner output bearing stack. One common bearing type would require bore adapters or a redesigned output shaft, crank bores and retention stack.

All three listings were marked ready to ship when checked on 2026-10-29; confirm stock when ordering. The supplied F695ZZ-JVB Prom listing was unavailable, so the default uses MF105 without bore adapters. The SMB manufacturer drawings verify flange thicknesses; rendered internal geometry remains illustrative.

For the SMB set, finish the eight screw-seat pilots from 9.8 mm to their assigned Ø10 fit (nominal model diameter 10.02 mm). Keep the Ø5 screw journals, the two external retaining grooves at X=±19.8 and the original screw lengths. Screw bearing centres move from −17/+17 to **−16.8/+16.8 mm**, so the underside of each 0.8 mm flange still contacts the outer face of its 3 mm disc. The 3.2 mm non-flanged body projects 0.2 mm beyond the inner sheet face.

Reuse the same sixteen screw thrust-sleeve occurrences with revised turned dimensions: bore 5.02 mm, outside diameter 5.9 mm, **0.7 mm outer lengths and 1.8 mm inner lengths**. Their axial spans are −19.5..−18.8, −14.8..−13, 13..14.8 and 18.8..19.5 mm. The 5.9 mm abutment is a preliminary inner-ring contact dimension; confirm the ordered SMB ring face before production. The two inner screw rings and their grooves are omitted. Each inner sleeve seats on the square thread-root shoulder at X=±13; keep the continuous nominal Ø5.5 root-core annulus intact at that face. Only two outer rings per screw remain: eight screw rings per block instead of sixteen. The block has 115 component occurrences instead of 123. No new pieces or bore adapters are introduced. Set the final sleeve lengths to provide assigned axial end float, avoiding unintended bearing preload. Qualify the root-shoulder contact area and actual thrust load.

MF106 and MF63 retain the old installed envelopes, bearing centres, output journals, guide seats and output sleeves. Their material changes from the former stainless EZO execution to SMB chrome bearing steel. The small inner bearings remain a separate size because a Ø10 bearing would require a new central guide and shaft design; it cannot be substituted in the existing Ø6 guide bore.

The lower load ratings of the smaller MF105 must be checked against actual screw thrust. Native geometric clearance checks do not establish actuator load capacity, bearing life, rigidity or production fits.

The sections below describe the retained **reference bearing construction**. Unless specified otherwise above, its nut, crank, guide, output-shaft and frame datums also apply to the new SMB set.

---

# TR8x8 twin-pin laser block, diameter64 mm

Search for **TR8 twin pin**. This corrected family leaves every previous design available. It has one manufactured nut and one monolithic crank per output. The former purchased H nut, separate nut carrier, flange screws, laminated crank and milled central spine are absent from this family.

## Nut and motion

Each nut is machined from one brass blank. Its axial length is8 mm, round body envelope is13 mm, and opposed flats are10 mm apart. Two integral4 mm trunnions project toward the solid outward crank and the fixed inward guide. The internal thread is four-start Tr8x8(P2) RH:2 mm axial pitch,8 mm lead and30 degree included angle. This is a new custom nut rather than an unmodified purchased H nut.

The crank is one3 mm laser plate. Finish its shaft bore and match-drill/ream the2 mm transverse pin joint with the shaft. There are no welded laminations. Its closed radial slot is4.1 mm wide. The opposite nut trunnion slides along a fixed straight4.1 mm guide slot at Z=10 mm, restraining nut roll in both directions. The nominal running clearance is finite; this is not a zero-backlash guide.

Output angle follows x=10*tan(angle). At+/-20 degrees the nut travels+/-3.639702 mm. The outward pin radius in crank coordinates is10/cos(angle), remaining inside the closed slot throughout the interval. The13 mm nut body stays0.5 mm above the rotating6 mm shaft. The retained26 mm working thread provides5.360298 mm end margin beyond the complete8 mm nut at either travel limit.

## Laser frame and bearing support

| Item | Quantity | Process |
|---|---:|---|
| Diameter64 x3 mm main discs | 3 | Laser cut; finish bearing pilots |
| Outer bearing cheeks | 4 | One common3 mm laser profile |
| Central slotted guide/bearing plates | 4 | One common3 mm laser profile |
| Monolithic output cranks | 4 | One common3 mm laser profile; finish bore and cross-drill |
| Standard30 mm columns | 8 | Purchased: four DREMEC115x30 and four215x30 |

All15 sheet blanks use3 mm stock and six unique contours. The four inner guide walls form an offset pinwheel, leaving their negative edges clear of adjacent plates. Local Y spans-8.05..-5.05 mm. Centred2.7 mm end tabs fit3.1 mm sockets in the middle/end discs. Their slot outlines do not enter the main screw-bearing seats. The bolted disc/column stack captures the guide and outer-cheek tabs; no central milling or welding is needed for the frame.

Each output has two bearings across a22.7 mm span: one original outer SMF106ZZ6x10x3 and one inner EZO SMF63ZZ3x6x2.5 in its laser guide. The inner bearing flange is7.2x0.6 mm and faces the nut. Source: [EZO official SMF63ZZ specification](https://www.ezo-brg.co.jp/english/product/spec.php?eid=00184&unit=mm). These dimensions do not rate the complete mechanism.

Turn the inner shaft journal to3 mm, with a3.6 mm inner-ring shoulder, while retaining the6 mm main body and outer journal. The shoulder contacts only the inner ring. The existing outer clip, sleeves and pinned crank locate the shaft stack; qualify its final axial float. This arrangement replaces the two former closely spaced outboard supports with one central and one outboard support.

## Manufacturing files

Download includes1:1 DXF/SVG for all six profiles, all15 laser blanks as native solids, a native one-piece nut, a native extended shaft, the component list, motion table, machining schedule and assembly instructions. Pilot holes are5.8 mm for the6.02 mm guide seats,9.8 mm for the10.02 mm outer cheek seats and12.8 mm for the13.02 mm screw-bearing seats. These are nominal inspection fits; assign actual tolerances and finish operations for the material and bearings.

The frame remains131x64x64 mm for the361:1 motor. The motor, screw, disc and column stations are unchanged. The custom nuts, turned screws/shafts and precision sleeves still need machining. Qualify the shorter nut engagement, brass wear, pin root strength,3 mm journal fatigue, tab bearing stress, frame stiffness, lubrication and application loads before manufacture.
