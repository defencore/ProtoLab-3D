# TR8 fin actuator with a split housing

A four-start TR8×8(P2) screw drives a thin sector wheel. A stepped metal sleeve runs in two unequal flanged output bearings. The compact housing consists of a base and lid split through the screw axis at Z=0. Both halves have open machining faces and rounded pockets, so the same construction can be machined or printed.

The previous removable fin platform, its two pins and its two mounting screws are excluded. Two blind M3 mounting holes remain in the exposed sleeve end for a separately designed attachment. No fin blade is included.

## Housing construction

The housing encloses the transmission with a continuous rounded exterior. The split exposes the gear pocket and the two half-round worm bearing seats. The output bearing bores are perpendicular to the split; the worm bearing seats lie along the split. Flange counterbores open toward the outside, and shaft ends and retaining rings remain accessible.

Four DIN 7991 M3 countersunk screws join the base and lid. The selected head envelope is Ø6 × 1.7 mm, with Ø6.2 × 1.8 mm housing recesses; match the purchased execution. Captured M3 hex nuts provide serviceable threads in both a machined or printed base. These fasteners close the housing; there are no separate bearing-clamp covers or screws. Two integral base bosses locate the lid at the split.

Machine each half from its open mating face and exterior datum face. Circular gear pockets and exterior counterbores permit face access. Use ball-end or form milling for the half-round screw trough and bearing-seat profiles, and a cutter that fits the rounded nut-pocket corners. Bearing seats and flange shoulders need their specified diameters, depths and coaxiality; finish or verify them with the halves joined when necessary. The generated SVG is a geometry and operation reference, not a toleranced manufacturing drawing or a CAM program.

For printing, orient each half on its flat exterior face with the open cavity upward. Check bridging and support in the slicer, especially around bearing counterbores and nut pockets. Use the configured seat allowance or a fit coupon for the actual material and printer. Finish the split faces, clear the fastener holes and verify bearing seats before assembly. Do not assume that a nominal machining clearance is a suitable as-printed fit.

## Bearing and shaft retention

The screw is supported at both turned ends by flanged bearings. Its TR8 thread remains between the bearing seats. Four retaining rings and thrust washers locate the screw's inner-ring stack. Opposed bearing flanges seat against housing shoulders, closing axial retention after the shaft and rings are assembled.

The output sleeve has a larger journal at the outside bearing and a smaller journal at the inside bearing. The default pair is F6802ZZ outside and F688ZZ inside. A square drive between the journals transfers torque to the separate sector. A retaining ring beneath the sector locates it against the sleeve shoulder. Another ring retains the sleeve beyond the inside bearing.

Bearing flanges locate the outer rings against their housing shoulders. Shaft shoulders, selected thrust shims and retaining rings locate the inner-ring stack. Loose bearings are not independently retained before the complete stack and housing are assembled. Specify the actual fits and axial float; do not preload the pair by forcing both inner and outer rings into an unintended rigid stack.

The square drive is 10 mm across flats with 0.25 mm × 45° chamfers on its four longitudinal corners. The laser blank's square opening is 10.08 mm across flats. Verify the laser kerf and corner clearance before finishing the mating sleeve.

## Assembly access

The split permits the following sequence without passing a flange or shaft shoulder through an undersize bearing bore:

1. Prepare the screw with its two bearings, four thrust washers and four retaining rings. Place it in the base's open half-round seats, with the bearing flanges facing outward.
2. Install the large output bearing in the lid from the outside. Fit the outside inner-race thrust shim and insert the sleeve from outside through the bearing.
3. With the lid underside open, slide the sector onto the sleeve's rear end and square seat. Fit its closed thrust washer and DIN 471-10 retaining ring by normal axial installation.
4. Bring the lid and sleeve assembly onto the base. Align the screw and sector teeth by hand, close the split faces and install the four housing screws and nuts.
5. Insert the small output bearing from outside the base over the Ø8 rear journal. Its outward-facing flange seats against the base shoulder. Fit the rear thrust washer and DIN 471-8 ring from outside.
6. Select thrust shims from the measured stack, check the specified axial play and turn through the complete configured travel before fitting the user's external attachment.

Do not preassemble the rear bearing onto the sleeve and then try to pass its flange through the base's smaller body bore. The front bearing flange similarly enters from outside its lid seat. Retaining-ring pliers need to engage the actual ring holes; the model does not simulate elastic installation.

The nominal thrust pieces are:

| Position                                                | Quantity | Nominal thickness |
| ------------------------------------------------------- | -------- | ----------------- |
| Outside output bearing inner race to sleeve shoulder    | 1        | 0.15 mm           |
| Sector wheel to gear retaining ring                     | 1        | 0.65 mm           |
| Inside output bearing inner race to rear retaining ring | 1        | 0.65 mm           |
| Screw bearing inner races to retaining rings            | 4        | 0.75 mm each      |

Select actual shim thicknesses after measuring purchased bearings, rings and machined shafts. Centered nominal rings retain 0.05 mm clearance at each groove side. This does not guarantee zero endplay or establish bearing preload, internal bearing clearance or ring deflection.

## Screw and bearing references

TR8×8(P2) means nominal 8 mm diameter, 8 mm advance per revolution, 2 mm axial pitch and four starts. The trapezoidal thread has a 30° included angle. Its designation does not establish delivered root diameter, runout or machining allowances. Measure the blank before turning clean Ø5 journals and retaining grooves; the displayed thread is a nominal reconstruction.

| Role                         | Designation | Bore × body OD × overall width | Flange OD × thickness |
| ---------------------------- | ----------- | ------------------------------ | --------------------- |
| Outside output support       | F6802ZZ     | 15 × 24 × 5 mm                 | 26 × 1.1 mm           |
| Inside output support        | F688ZZ      | 8 × 16 × 5 mm                  | 18 × 1.1 mm           |
| Screw support, two positions | F685ZZ      | 5 × 11 × 5 mm                  | 12.5 × 1 mm           |

Closure suffixes and flange dimensions must match the purchased execution. Open bearings can differ in width from shielded versions. Configurator envelopes do not establish load capacity or availability at a particular supplier.

References: [TR8×8(P2) screw specification](https://makerstore.co.uk/products/8mm-metric-lead-screw-acme), [igus trapezoidal profile](https://www.igus.com/lead-screws/trapezoidal-screw-thread), [AST F6802](https://www.astbearings.com/catalog/thin_section_metric/F6802), [EZO F688ZZ](https://www.ezo-brg.co.jp/english/product/spec.php?eid=00877), [NSK miniature bearing catalogue](https://www.nsk.com/content/dam/nsk/common/catalogs/ctrgPdf/bearings/e1258f.pdf).

## Travel and fixed screw geometry

Travel is symmetric. Total travel of 40° means −20° to +20°. Bearing or travel changes select tooth count and sector size without stretching the TR8 thread.

```text
axial pitch = 2 mm
screw lead = 8 mm
screw starts = 4
axial module = 2 / π mm
ratio = equivalent full-wheel teeth / 4
wheel pitch diameter = 2 × equivalent full-wheel teeth / π mm
full-travel input turns = total travel × equivalent full-wheel teeth / (4 × 360)
```

The selected travel, bearing interfaces and requested motion determine an integer tooth count and a sector with engagement margin beyond both limits. The motion table reports the resolved input turns. Output position moves the sleeve and sector together, with the screw coupled at the calculated ratio.

The fixed TR8 thread differs from an arbitrary stock 20° worm pair. Its central cross-section uses the trapezoidal screw profile, and the numerical tooth surface follows relative screw and wheel motion with the configured clearance and sampling.

Four starts do not establish self-locking. Select drive holding torque or a brake from the applied fin load and verified transmission behavior.

## Laser blank and tooth finishing

The default route uses a 3 mm metal sheet blank cut by laser, followed by finishing to the screw-generated tooth surface. The DXF contains flat 1:1 cut loops and the square drive opening. It is not a finished conjugate tooth contour.

The screw's matching surface varies through the sheet thickness. A flat contour extruded through 3 mm cannot reproduce it. The blank retains machining material; verify the cutter, kerf, heat effects, flatness and square fit before release.

[KHK explains worm-envelope generation](https://khkgears.net/product-category/worm-gear-pair/). Sampled swept-tool geometry supports prototype planning and interference review; it does not establish tooth strength, efficiency, wear, self-locking or a qualified contact pattern.

## Fabrication outputs

Downloads include the housing reference, sector blank DXF/SVG, sleeve and screw machining references, a physical component list, resolved dimensions and a motion table. Dimensions are millimetres unless marked otherwise. SVG references do not replace toleranced component drawings.

The sleeve is turned with a milled square drive. The screw starts from purchased TR8 stock and receives clean journals, runouts and retention features. Bearings, rings, selected thrust shims and housing fasteners remain separate physical occurrences.

The two retained sleeve mounting holes are M3 × 0.5; use a 2.5 mm tap drill before tapping to the specified class and depth. The model's 0.04 mm radial thread allowance is for CAD assembly inspection and is not a tap-drill allowance. The removed platform, locating pins and their fasteners are not included in the bill of materials.

## User-supplied references

The revised user views showed the fin and output bearings and a section through
the stepped sleeve. The original oblique, fin-side, front and section views
established the arrangement of the sector and bearings. Dimensions, fits and
material ratings require separate engineering evidence.
