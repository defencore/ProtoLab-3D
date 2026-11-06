# FAULHABER four-drive TR8 block

New execution of the approved compact twin-pin mechanism. Earlier GMP16T versions remain separate. Exactly three Ø56×3 mm laser discs, the central Ø5 passage, four independent X-arranged outputs and ±20° motion remain. The existing screw/nut/crank/guide datums, 30 mm columns and Prom SMB bearing stacks are reused.

## Purchased motor and installation geometry

Four **2250S024BX4 6855**, part number **2250.00430**, 24 V brushless motors, without gearheads. The exact [product page](https://eshop.faulhaber.com/en/2250S024BX4-6855/2250S024BX4-6855) links the [official STEP archive](https://eshop.faulhaber.com/media/e2/g0/85/1755618901/2250_BX4_3D-CAD.zip) and [dimensional datasheet](https://eshop.faulhaber.com/media/cd/65/80/1775629746/EN_2250_BX4_DFF.pdf). Its `2250S_BX4.stp` SHA-256 is `6b45e62b98198243e0b174761c382a56ced7a54dc219587f902a8f222071f6a8`, identical to the library's existing manufacturer BREP. The exact 6855 ordering execution is now a separate motor preset.

The supplier external installation solid is retained in FreeCAD. Body Ø22±0.1×51.8±0.3 mm, shaft Ø3 with12.2±0.3 mm projection; locating pilot Ø10×1 mm; six M2 blind holes3 mm deep on a Ø17 circle. Two opposed holes per motor are used here with M2×5 screws through the3 mm plate, giving2 mm nominal thread engagement. The supplier represents M2 threads as Ø1.6 tap-drill cylinders; overlap with the external screw thread in that engagement region is intentional in the simplified installation CAD. Internal motor details are not fabricated.

Front mounting planes remain at X=-51 mm, axes at radius16 mm. Cable roots point tangentially in a pinwheel. Motor shafts engage6.4 mm nominally in the first7 mm coupling hub (6.1–6.7 mm across the quoted projection tolerance). Motor housings remain fixed during motion. The axial installation extent is126.8 mm; the nominal Ø56 frame excludes projecting output tails and free175 mm ribbon cable runs. Route cables and provide four external Hall-compatible controllers separately.

## Frame and fabrication

Two disc patterns are available: lightened and solid web, both with the central passage. Revised motor pilots finish from Ø9.8 laser blanks to Ø10.1 mm. The motor disc has four Ø6.4 lightening holes on a10 mm pitch radius to protect the larger pilots and new fastener pattern. Its four column screws are changed to **M3×8 DIN7991 countersunk** because the larger motor bodies overlap the former protruding socket heads. Finish the column holes from the motor side: Ø6.2 mouth with0.25 mm cylindrical rim,90° cone to Ø3.4 at1.65 mm depth. Fit the heads flush at X=-51 mm before installing motors. These finishing features are in the installed native disc; laser blanks/DXF contain only through holes. Other bearing pilots, guide/cheek slots and column locations retain the approved geometry. The package exports six unique1:1 DXF/SVG profiles for15 physical laser blanks, native blanks, retained turned details, machining instructions, a motion table and a procurement CSV with the exact motor URL.

Eight SMB MF105 2Z5×10×4 bearings support the screws; four MF106 2Z6×10×3 bearings support the outer output journals; four MF63 2Z3×6×2.5 bearings support their inner ends in the guide walls. No adapters are added. Each screw retains only its two outer retaining rings; inner sleeves bear against the thread-root shoulders.

## Drive and qualification

This is direct drive: the previous361:1/107:1 gearbox performance and controller settings do not apply. Screw lead is8 mm/revolution and the required nut stroke remains7.2794 mm for ±20°. The motor's24 V nominal torque is26.2 mNm and its no-load speed is6200 rpm; these are motor data, not an actuator output rating. Set low screw speeds, limits and acceleration appropriate to the short stroke. Verify low-speed commutation, friction, thermal duty and brake/back-drive behaviour with the selected controllers and load.

Assign production fits, bearing end float, minimum cable clearances, mounting joint loads, sheet stiffness, journal fatigue and pin/slot wear before manufacture. Screw thrust must close through the bearings/sleeves rather than the motor. Geometric collision checks do not establish a load rating.
