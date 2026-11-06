# Four Surpass Hobby2845 drives

Separate version with four **Surpass Hobby KK2845 3100KV** inrunners and three **Ø70×3 mm** laser discs. The FAULHABER and all earlier variants remain. The new motors are also selectable as a standalone library product. Their external model is reconstructed analytically from the branded drawing; no original manufacturer CAD is claimed.

## Motor and coupling

Verified installation dimensions: Ø28×47 mm body, Ø3.175 shaft projecting15 mm, four M3 holes in an opposed16/19 mm cross. Source: [branded2845-3100KV dimension image](https://images-na.ssl-images-amazon.com/images/I/51uWegAEAqL.jpg); winding reference: [manufacturer catalog](https://www.ytk-group.co.jp/products/wp-content/uploads/2021/02/Catalog-from-Suprass-Hobby_compressed-1-1.pdf). The1 mm cap seams and2.5 mm nominal hole clearance depth in the external model are illustrative. Confirm permitted screw insertion on the ordered motor. The source does not dimension shaft flat depth, so a conservative round envelope is used. Free leads, rear cable boots and connectors are excluded and need separate routing space.

Mount each motor with two M3×5 screws through the3 mm disc, using the16 mm opposed pair: nominal insertion2 mm. The centre opening is Ø8.2 clearance and is not a locating pilot. The stock motor shaft is retained without cutting.

Use **LF D14L22 Clamp Other hole Ø3.175×4 mm** couplings, specified with the appropriate shaft fit. The previous3 mm bore is too small. No shaft adapters are added. Coupling centres move1.8 mm toward the screws to X=-32.4 mm; both7 mm hub bases are fully engaged. The two shaft tips enter the open spider bore by0.4 and0.6 mm, leaving7 mm between the tips. Coupling end-to-screw-shoulder clearance is0.4 mm; verify the actual spider bore and end clearances. The screw still finishes at50 mm, with26 mm of working thread. Verify the ordered custom coupling bores and end float before assembly.

## Four-drive layout

Motor and screw axes share a radius20.5 mm circle. Adjacent nominal motor bodies have0.9914 mm clearance. The10 mm linkage lever remains; the output-axis origin radius is√(20.5²−10²)=17.8955 mm. The four output directions remain45/135/225/315 degrees and the output tails face outward. Nut travel remains7.2794 mm total for ±20°. Motor fronts remain at X=-51 mm, so nominal axial extent is119 mm, excluding free cables.

The complete channel assemblies move outward together. All guide walls and their inner bearings, outer bearing cheeks, disc sockets, screw bearing bores and couplings follow the new datums. Nut/crank/shaft geometry remains the approved design. Standard30 mm columns move to radius30.5 mm at18+90n degrees. Standard M3×8 frame screws remain; no countersinks are required. The three discs retain their central Ø5 passage.

The lightened motor disc now uses four **Ø13.5 mm** windows on radius12.5 mm, replacing Ø8 mm on radius10 mm. Each bearing disc uses four **Ø10 mm** windows on radius21.8 mm, replacing Ø7 mm on radius23 mm. Bearing-disc windows clock0.6° back from the former pattern to balance clearance to the column holes and guide sockets. The larger windows retain at least3 mm nominal ligament to the other cutouts, adjacent windows and outer edge. Motor mounting holes, bearing seats, guide/cheek sockets, the central passage and disc thickness remain unchanged. The solid-web option remains available.

The three3 mm steel discs lose approximately16.3 g relative to the previous lightened pattern, using7.85 g/cm³ density. This is a geometric mass estimate. Retaining the mounting lands and minimum ligaments is not a strength or stiffness qualification; application loads still require review.

The fabrication export includes six1:1 DXF/SVG profiles for15 physical blanks, native blanks/turned details, current machining instructions, procurement CSV and motion table. Eleven blanks use3 mm steel; four guide walls use2 mm steel. Finish bearing pilots and tab fits after cutting. The Prom SMB bearing set, thrust sleeves and two external screw retaining rings per drive are retained.

## Screw and nut selection

The **Trapezoidal screw and matching nut** control applies to all four channels. Choose **TR8×8(P2) RH**, four starts and 8 mm/revolution, or **TR8×2(P2) RH**, one start and 2 mm/revolution. Both retain a 2 mm axial pitch and the 30 degree trapezoidal profile. These are trapezoidal lead screws, not recirculating ball screws. The default remains TR8×8. Both disc patterns have presets for each lead.

The selected lead changes the actual external screw helix, matching internal nut helix, their phase relationship, component names, manufacturing instructions, native FreeCAD thread callouts and motion table. Simple mode shows nominal thread envelopes; Full mode and Full FreeCAD export contain the selected physical helices. The custom one-piece brass nut must be cut for the selected screw; TR8×8 and TR8×2 nuts are not interchangeable. The finished screw stays50 mm long with26 mm of working thread. Frame, bearings, shaft journals, cranks, guide slots, nut exterior and ±20° limits retain their dimensions.

For each output at angle theta: nut displacement x=10*tan(theta) mm; motor phase phi=-360*x/L degrees, where L is lead in mm/revolution. The complete −20° to +20° sweep requires327.573° for TR8×8 or1310.293° for TR8×2 (approximately0.910 or3.640 revolutions). The unsigned instantaneous ratio is i(theta)=2*pi*10/(L*cos(theta)^2), so the ideal torque ratios at neutral / ±20° are7.854 /8.894 for TR8×8 and31.416 /35.578 for TR8×2. Output torque is M_out=eta*i(theta)*M_motor, with actual total efficiency eta; the fourfold geometric ratio does not assume equal screw efficiencies. Do not reuse controller travel limits after changing lead.

Fabrication filenames include the selected TR8 lead. The selected nut and screw macros, machining JSON, BOM and motion CSV agree with the assembly export. Laser contours and output-shaft geometry remain common to both leads.

## Drive scope

These are **sensorless direct drives**. Use reversible controllers and confirm controllable low-speed travel and reversal with the actual load.3100KV is a speed constant, not an output torque rating. Do not reuse the FAULHABER Hall-controller configuration or the GMP gearbox performance. External electronics, end-stop/control hardware and free wiring are outside this mechanical installation model. Qualify loads, thermal duty, back-driving, braking, bearing end float, laser sheet stiffness and pin/slot wear before manufacture.
