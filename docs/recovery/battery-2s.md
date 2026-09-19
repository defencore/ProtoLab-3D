# Two-cell recovery battery wiring and service

This page covers the vertical 2 × 18650 WING-MINI configuration. Other presets keep their battery arrangements. Cell model, capacity, current rating and charge settings are not inferred from the editable cylinder dimensions.

## Electrical connections and orientation

One cell is inverted. The angled series bridge is at the **servo mounting disk**, behind the servo case. The fixed output pads are at the **opposite end, toward the nose tip**. This avoids long return leads around the controller. In the local geometry the disk end is +Z; the completed nose assembly inverts that axis.

| Node       | Connection                                | Access                                                              |
| ---------- | ----------------------------------------- | ------------------------------------------------------------------- |
| B- / MINUS | Cell 1 negative                           | Recessed fixed output pad at the nose-tip end                       |
| B1         | Cell 1 positive joined to cell 2 negative | Angled bridge in the open insulating channel, at the servo-disk end |
| B+ / PLUS  | Cell 2 positive                           | Recessed fixed output pad at the nose-tip end                       |

The two output guards have raised minus/plus marks. Labels and FreeCAD Manufacturing properties also identify each electrical node. B1 is a service midpoint, not a second power output. No battery connector or floating cable envelopes are modeled. The contact pads are supported by the printed end cups, with an open side for the installed leads to the controller. Power wiring, joints, strain relief and protection still require installation details.

## Insulation and retention

Four insulating cups retain the cell ends. The two nose-tip cups also support the output pads and incorporate three-sided recessed guards. One common PA12 backing supports the angled bridge behind the servo; its end flanges are captured between the disk seats and cell cups. In the installed orientation, the 4 mm wide, 0.2 mm thick nickel lamella lies on top of a 1 mm plastic substrate. Low 0.6 mm edge lips locate it laterally, leaving its upper surface exposed. The full bridge floor bears on a 3 mm high rail machined integrally with the nose disk, rather than spanning between its end flanges. The 1 mm PA12 substrate remains between the nickel lamella and this metal support. These are preliminary fabrication dimensions; conductor capacity and welds must be checked for the selected cells and measured load.

The 3 mm Al6061 retention plate has two closed cell rings, twin 6 mm longitudinal rails and four 8 mm arms leading to the metal columns. Four standard M2 × 8 screws secure it. Terminal bores remain inside the closed rings; no radial wire notch cuts a structural ring. The nose-tip cups route the leads on the outside face through 5.2 mm open plastic slots. The separate servo-disk seats retain their 10 mm bridge notches. Contacts and attached leads can be placed into the seats from the exposed assembly face, without feeding a connector or a long lead through a closed hole. The formed contact legs sit in the terminal wells; the exposed output pads sit on plastic, not on aluminium. The nose-tip cup flanges rest on the closed metal rings; their output guards are not battery-load supports. Cell loads pass through the shoulders and collars into the metal frame, not through the nickel contacts.

Use unfilled insulating PA12, with deburred metal edges. Print integrity, cell fit, conductor clearance, joints and restraint must be checked on the actual assembly. The geometry is not an electrical or impact qualification. The fixed contacts and bridge are fabrication parts, not loose-cell spring contacts; replacing one cell requires reworking its welded connection.

## Controller and wire routing

The FC is centered on the tube axis on four provisional Ø6 × 4 mm bonded elastomer dampers. Their upper and lower metal ends are separate; the heel screws do not bridge the rubber. The stack has a 4 mm heel clearance. Damper stiffness, compound and bond strength remain to be specified; the geometry does not establish vibration attenuation. The cells retain their opposite Y positions; their common X offset follows the mass-balance calculation. The servo heel retains its case-bearing perimeter and four column bosses, with two Ø16 mm and one Ø10 mm circular bores removing unused web material. Two Ø6 mm heel holes receive flanged silicone liners with Ø4.8 mm clear bores. These passages lie behind the servo and outside the controller board outline; their diameter is a routing allowance, not an assumed harness specification. Secure the installed harness separately from the soft liners.

## Assembly and service

1. Prepare the matched cells and formed contacts outside the metal assembly. Use pre-tabbed cells or a qualified cell-tab welding process; the geometry does not authorize soldering directly to a bare cell can.
2. Fit the open insulating cups and bridge backing around the contact routes. Lay the leads into the open notches, then fit the metal retention frame. The existing four frame screws capture the assembly; no additional connector brackets are required.
3. Check polarity and insulation from every electrical node to the aluminium structure before connecting the load. Secure the installed leads at their supports; an open notch alone is not strain relief.
4. Remove the nose shell for service. Disconnect the load before attaching charge leads or loosening the four end-frame screws. The modeled pad access volumes are small probe corridors, not a guarantee that arbitrary crocodile clips fit.

The node pairs for measuring or servicing one cell are **B- to B1 for cell 1**, and **B1 to B+ for cell 2**. Charging one cell while the series link remains installed requires a compatible, electrically isolated single-cell charger and only one cell connection at a time, with the rest of the system disconnected. Do not use two common-ground charger outputs across the two cells: that can short a cell through the shared ground. Clips are service tools and do not stay installed during flight.

For whole-pack balance charging, a temporary service lead must bring all three nodes to the charger's balance input and the two output nodes to its main charge connection as required by its manual. Match chemistry, cell count and charge limits to the actual cell specification. The [SkyRC B6neo manual](https://www.skyrc.com/download/100198%20B6neo%20Instruction%20Manual%20V1.1_240318.pdf), for example, requires a balance lead in Balance CHG mode and instructs users to connect leads to the charger before the battery. This reference is not a selection of that charger for an unspecified cell.

Three accessible nodes do not provide a BMS, fuse or charge controller. WING-MINI does not charge this pack. Its 7 V input minimum also limits usable 2S capacity under load.

In the damped 2×18650 layout, the complete FC stack is rotated 180° in its mounting plane: the PLS bank faces the positive-X side, away from the offset battery collars. This preserves the reserved plug and wire-bend volume. Configure the actual sensor orientation accordingly.
