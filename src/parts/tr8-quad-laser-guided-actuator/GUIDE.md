# TR8x8 laser-frame four-drive mechanism, diameter 64 mm

This new version separates the previous integral CNC frame into manufacturable parts. All previous library versions remain available and unchanged. Search for **TR8 laser frame**. Choose a motor and either the laminated or one-piece crank construction; all four output angles remain independent within -20 to +20 degrees.

## Frame parts and process routes

| Part | Quantity | Stock and process |
|---|---:|---|
| Main round discs | 3 | Diameter 64 x 3 mm steel, laser cut; finish bearing pilots |
| Centred bearing cheeks | 8 | 3 mm steel, one common laser profile; finish bearing pilots |
| Female/female standoffs | 4 | Purchased DREMEC 115x30, M3, 30 mm body |
| Male/female standoffs | 4 | Purchased DREMEC 215x30, M3, 30 mm body and 8 mm stud |
| Frame end bolts | 8 | M3x8 |
| Central nut guide | 1 | Separate milled pinwheel guide with two square tenons |

The disc starts are X=-51, -18 and +15 mm. Clear spans are exactly 30 and 30 mm. Four first-stage female/female bodies span -48 to -18 mm. The second-stage male/female bodies span -15 to +15 mm, with the male studs crossing the 3 mm middle disc and entering the first columns by 5 mm. End bolts also engage 5 mm beyond their 3 mm discs. The chosen catalogue articles have source-qualified 10 mm female depths; M3x0.5 pitch is a standard interpretation, not a published supplier fit class. No custom spacer shim or frame tapping is required.

The fixed F695 screw bearing still sits at X=-17 mm: its 3 mm body enters the middle sheet and its flange stops against the rear face. The former 5 mm CNC base and rear counterbore are unnecessary. Output-bearing centres remain local Y=12 and17 mm. Two 3 mm cheeks per shaft occupy Y=11.1..14.1 and14.9..17.9 mm, keeping the original opposed SMF106ZZ flange arrangement, sleeves and shaft retention. Their horizontal arms and tabs are centred on shaft height. Each 2.7 mm tab fits a 3.1 mm receiver slot in the middle or end disc; all tabbed parts are captured by the bolted three-disc stack.

## Separate central guide

Only the central guide requires milling for the structural frame. Its unchanged four sliding faces retain 0.05 mm nominal carrier clearance. The body shoulders bear against X=-15 and +15 mm. Two 8 x 8 mm square tenons extend 2.7 mm into 8.1 mm square laser sockets, clocked 45 degrees. The fins end before the end disc; only the small central tenons pass into the discs, preserving the screw-bearing seats. Nominal guide blank: diameter 32 x 35.4 mm plus machining allowance. Finish and lubricate the guide faces and fit the keys for alignment and torque transfer.

## Laminated crank

The default crank consists of four independent laser parts: two 0.5 mm covers, one 2 mm upper web and one 2 mm lower bridge. The assembled thickness remains 3 mm, preserving the carrier, follower, bearings, output shaft and original 2 x 10 mm pin. Both covers and the upper web contain the closed 4.1 mm follower slot. The two middle pieces leave a 2.02 mm high open transverse pin window. The pin passes through this window into the existing shaft bore; the covers retain it axially and the webs transmit torque.

The four plates must be joined with flush spot or laser welds in a fixture before use. Inspect flatness, slot alignment, pin-window fit, weld strength and distortion. The plates are not a loose stack. The 2.02 mm window introduces nominal 0.01 mm edge clearance around the 2 mm pin and finite torsional take-up. Do not infer a zero-backlash joint or a load rating. This construction removes crank cross-drilling; shaft drilling, screw turning, carrier machining and sleeve production remain as in the previous mechanism.

The selectable **one-piece crank** is a single 3 mm laser blank with a 5.8 mm shaft pilot, finished to 6.05 mm, followed by matched transverse drilling/reaming with the shaft. It avoids crank welding and uses the previous crank geometry. Both constructions require application-specific joint qualification.

## Cutting files and assembly

Files use construction-specific prefixes **TR8-laser-guided-64-laminated** or **TR8-laser-guided-64-solid**. Do not mix their manifests or component lists. DXF/SVG drawings are millimetres at 1:1 scale with separate physical quantities. The laminated set has seven unique profiles and 27 physical laser blanks, grouped into 0.5, 2 and 3 mm stock. The solid set has five unique profiles and 15 blanks in 3 mm stock. The guide macro contains only the separate milled guide. Machining JSON includes the retained screw/shaft stations and all new frame interfaces; the assembly text records the selected crank route.

Deburr all laser edges and finish the eight 12.8 mm main bearing pilots and eight 9.8 mm cheek pilots to their assigned fits (model diameters13.02 and10.02 mm). Resolve sheet-thickness, kerf, tab/key fits, root/corner reliefs, frame stiffness, weld properties, wear and actual loads before manufacture. The 361:1 assembly retains a 131 x 64 x 64 mm bounding box, screw axes at D/4, a 50 mm four-start TR8x8(P2) screw and 7.2794 mm total nut travel. The structural process split does not eliminate the existing turned shafts, screws or machined nut carriers.
