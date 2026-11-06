# Four radial TR8 drives on three round discs

This independent assembly preserves the single-drive TR8 and earlier SFK mechanisms. Exactly **three round Ø82×3 mm steel discs** share four standard threaded column stacks. Four outward output axes form an **X in the end view**, at 45°, 135°, 225° and 315°. All output axes lie at the same axial station X=0 mm. The four integral headed inner ends remain physically separate, so each drive can turn independently through ±20°.

## Placement and motion

The module mounting origins lie 23.5 mm radially from the common disc centre. Each module's local +Y axis points outward, and its local Z direction is tangential. The output centreline is local X=0, Z=0; its line therefore passes through the common centre in the end projection. Motors and screw axes run parallel to the disc normals. The discs start at X=−52, −19 and 16 mm, each 3 mm thick. No axial staggering or intermediate main plates are used.

The brass H-flange nuts follow the supplied 22×11×15 mm drawing and are clocked 90° around their screw axes. This places their long flange dimension tangentially and narrows the covers. Four-start TR8×8(P2) has a 90° azimuthal period, so this flange clocking preserves thread phase. Each nut has a stepped-bore aluminium cover with two integral Ø4 trunnion pins. Flat 3 mm steel forks capture the trunnion pins in radial slots; their adjacent faces restrain nut roll. Each fork has an unsplit Ø10 hub and a transverse Ø2×10 press pin through the shaft. Preserve the 0.05 mm slide gap at each cover face. Two 0.45 mm sleeves between the pinned hubs and bearing inner races replace the inner retaining rings. The cross pins provide both torque transmission and axial fork location. The trunnion pin roots retain 1.9 mm nominal wall beyond the carrier bore.

Local screw/output spacing is 14.5 mm. Travel follows `x = 14.5 tan(angle)`, giving ±5.277568 mm nut motion and 10.555137 mm total stroke. At an 8 mm lead, the screw turns 1.319392 revolutions between the two output limits. The output is directly below the neutral nut, allowing a shorter cover and a shorter axial frame. The running clearances permit small roll before contact; they do not remove purchased-nut backlash.

## Drive parts and machining

Each channel uses a GMP16T-TEC1636 gearmotor, a 3×4 flexible jaw coupling, two F695-2RS screw bearings and two F686-2RS output bearings. Screw journals are Ø5, turned fully below the purchased thread root; output journals remain Ø6. Bearing flanges, two outer retaining rings per output, pinned fork hubs and thrust sleeves retain the shafts. Each output is turned from Ø8 bar with an integral Ø8×1 mm closed inner head and a longer projecting D-flat outer end. There is no separate cup or M6 thread. The shaft is 45.8 mm overall; its inner head leaves 0.25 mm nominal clearance to the outer retaining ring.

Cut and turn each 250 mm TR8 stock to **52 mm finished length**, retaining 28 mm of TR8×8(P2) thread. The turning schedule lists the Ø4 coupling stub, Ø5 journals and four DIN 471 grooves. Four identical screws are required. The 28 mm working thread retains a nominal 1.2224 mm full-nut margin at each ±20° limit. Verify the actual stock root diameter and assign journal fits, groove tolerances, coaxiality and surface finish before turning.

## Frame and laser cutting

The three main discs use 3 mm steel. Eight thin output-bearing cheeks use 4 mm steel. These cheeks are local bearing supports between the fixed and end discs. Their centred bores and symmetric rails transfer load between the two discs. Four inner cheeks form clockwise interleaved bars with 0.2 mm butt seams, following the supplied sketch. Their bearing bores remain on the output axes. Four outer cheeks keep circular bosses. Balanced rails locate each support in matching disc slots and are captured by the disc stack. Bearing bores are Ø13.02 in the model. Laser files use Ø12.8 pilots; finish all sixteen pilots to the fits assigned for the actual bearings.

Each of the four column stacks uses a standard DREMEC115x30 female/female body and DREMEC215x30 male/female extension. The gaps are 30 and 32 mm; a 2 mm precision spacer completes the second gap. The 8 mm male stud crosses the 3 mm middle disc and the spacer, leaving 3 mm nominal engagement. M3×8 end screws pass through the outer discs and engage by 5 mm. Column axes lie at a 32.5 mm radius and are clocked 15°, 105°, 195° and 285° to clear the nut collars.

DXF and SVG files are millimetres at 1:1 scale and contain merged closed cutting contours. Keep 3 mm and 4 mm stock separate. Deburr slots and tabs before assembly. One common 3 mm fork DXF/SVG is supplied for quantity eight. Finish each Ø5.8 shaft pilot to Ø6.05 and the slot to its specified size. The transverse Ø2 hole is drilled and reamed through the located shaft/fork assembly after setting axial and slide clearances; it is not a through-laser feature. Select the actual pin fits for retention in the shaft and hub. Covers, shafts, integral heads and spacers still need dimensioned machining drawings.

Assign application loads, production tolerances, material grades, lubrication, travel stops and independent motor control before manufacture. Verify the M3 joints, including the spacer joint with 3 mm engagement, cheek tabs and plate webs against the intended loads. This is a geometric assembly, not a structural load certification.

## References

- [Supplied H-nut drawing](../../../public/references/tr8-h-nut/h-nut-drawing.png)
- [Supplied threaded stock](../../../public/references/tr8-h-nut/tr8-stock.png)
- [Multi-start screw lead and pitch](https://blog.igus.eu/multi-start-thread/)
- [DIN 471 ring dimensions](https://smarthost.maedler.de/datenblaetter/K43_726_EN.pdf)

Native FreeCAD export preserves component colours and editable solids. Full mode includes actual native four-start working flanks. Browser surfaces are tessellated for display.

## Compactness change

Removing the split-clamp bulges and M2 hardware permits a narrower bearing stack. Pressed pins, 0.45 mm sleeves and interleaved inner bars allow a 23.5 mm radial mounting offset. The block is approximately 133×82×82 mm, reduced from the archived clamped 133×92×92 mm version. Three round discs, X-arranged outputs and ±20° travel remain. Only the four D-flat attachment tails intentionally project outward.

The purchased pins follow [FIBRO ISO 8734 Ø2×10 nominal dimensions](https://static.shop.fibro.com/assets/EN/document/doc_2351_1_english.pdf). Their small end chamfers in the inspection model are representative; verify the supplied pin end form and actual fits before assembly. Standard 10 mm pins provide greater full-diameter hub engagement than 8 mm pins; their ends may stand about 0.1 mm proud of the curved Ø10 hub.
