# Precision feed drives: selection, ordering and commissioning

The DIY milling design retains 800 x 1500 x 200 mm travel. Its provisional machining envelope is nonferrous material including D16T, cutting force up to 100 N, feed up to 4 m/min and acceleration up to 0.3 m/s2. A 300 N calculation is a sensitivity case, not an accepted cutting mode. The required finished-part tolerance field is 0.05 mm, or +/-0.025 mm. No delivered accuracy, preload, machine capability or safety qualification follows from the CAD or these calculations.

This document describes the compact central Z drive interfaces and release requirements. The recorded mass snapshot includes that design and its final mounting hardware; regenerate its geometry-dependent inputs after any mechanical change. Structural screening and the unresolved complete tool-to-workpiece error budget are covered in [mechanical qualification](mechanical-qualification.md).

## Buyable source components and separate fabricated parts

| Function                  | Selected execution                             | Quantity / interface                                                                                   |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| X/Y servo                 | Delta ECM-A3H-C20807RS1                        | Two; 750 W, 2.39 Nm continuous, 80 mm flange, 19 mm keyed shaft                                        |
| Z servo                   | Delta ECM-A3H-C20807SS1                        | One factory-braked execution; same shaft/flange                                                        |
| Servo amplifier           | Delta ASD-A3-0721-M                            | Three; 200-230 V AC, pulse-command execution with CN5 full-loop input and STO                          |
| X/Y matched screw and nut | HIWIN R25-10T3-FDI                             | One per axis; 25 mm diameter, 10 mm lead; ground C3 and 3% dynamic-load preload are order requirements |
| Z matched screw and nut   | HIWIN R20-5T3-FDI                              | One; 20 mm diameter, 5 mm lead; same order requirements                                                |
| X/Y end supports          | HIWIN BK20-C3 / BF20-C3                        | Requested C3/P5 execution compatible with the C3 matched screw                                         |
| Z end supports            | HIWIN BK15-C3 / BF15-C3                        | Same precision and factory end-drawing acceptance requirement                                          |
| Motor coupling            | R+W BK2/15/59                                  | 19/20 mm bores on X/Y; 19/15 mm on Z; ordered keyed motor hub                                          |
| Guides                    | Factory-matched HIWIN HGR20 / HGH20CA, ZA / SP | Two rails and four blocks per axis; preserve maker set identity                                        |

Delta publishes the motor drawings, rating, inertia and factory brake data in its [A3 catalogue](https://landing.deltaww.com/IA/downloadcenter/catalogue/2.Motion/ASDA-A3/DELTA_IA-ASDA_ASDA-A3_C_EN_20210104_Web.pdf) and the manufacturer-authored [current C2 motor catalogue hosted by its regional dealer](https://deltaww.com.ua/deltaww/ECMA-C3.pdf). The 8.36 Nm peak is intermittent and is not credited as continuous cutting torque. Shaft-end M6, flange holes, pilot and key are represented explicitly. Housing corners and connector contours remain illustrative. The maker's rated cooling condition includes a 250 x 250 x 6 mm aluminium plate at 0-40 C; the design has this thermal plate plus a separate structural carrier. Actual heat flow through the mounted assembly must be tested.

Each precision axis is one purchased matched-set parent in the product hierarchy. Its real shaft and nut are separately installed physical children. They must not create two complete-set procurement orders or be mixed between delivered sets. The [current HIWIN ballscrew catalogue, table 6.7](https://www.hiwin.de/medias/sys_master/hiwinDocumentMedia/hc3/h19/14757156519966/HIWIN%20CATALOGUE%20BALLSCREWS/HIWIN-CATALOGUE-BALLSCREWS.PDF?attachment=true) supplies the FDI interfaces. Specify C3, requested 3% preload, active raceway, handedness, lubricant, nut flange orientation, factory-approved machined ends and serial pairing in the quotation. Obtain measured lead, backlash/preload torque and accuracy documents before release. A preset is not a certificate.

The visible nut matches the published envelope, fit land and six-hole flange. Unpublished ball tracks, returns and spacer are opaque. Full-mode shaft grooves are representative rather than factory grinding geometry; no OEM rolling-contact clearance or achieved preload is established by their CAD intersection.

The [HIWIN support catalogue](https://www.hiwin.com/wp-content/uploads/HIWIN-Ballscrew-Supports-Catalog.pdf) recommends C3 supports with C3 screws. Its suggested end machining gives actual 20 mm BK20/BF20 and 15 mm BK15/BF15 bearing interfaces. Do not substitute a BF journal from a generic support model. The BF drawing has an unresolved drilling callout/visible-hole ambiguity; obtain the ordered drawing before drilling its host. Internal support stack location, seal and bearing contact geometry remain illustrative. Preserve the maker's assembled bearing adjustment; do not disassemble it to match an illustration.

The [R+W BK2 source](https://www.rw-couplings.com/product/bk2/) specifies the 15 Nm execution with 59 mm assembled length and 20,000 Nm/rad torsional stiffness. The ordered motor hub must accept the actual 19 mm shaft and key; the opposite hub is 20 or 15 mm. Confirm keyed-hub drawing, engagement, tightening torque, balance and allowed misalignment with the manufacturer. The CAD keyway, slit and bellows contours are illustrative source-interface envelopes.

Fabricate the frame mounts, nut brackets, support platforms, shims and servo carriers as individual machined parts with drawings. Release real fits, flatness, bolt preload, thread depth and positive blind-hole tip reserve. These parts are separate from all purchased OEM units. The X motor flange stays outside the portal cheek; only its shaft/coupling passes through the cheek window. Its support platforms use four M8 x 140 rear anchors with actual DIN 125 washers, engaging the beam's 12.5 mm rear wall by 10.4 mm. They no longer put bolt heads or crush sleeves in the X carriage sweep; joint preload and wall strength remain release requirements.

## Shaft and flange datums

All reusable precision screw/nut/support packages use native screw axis X. The nut flange/body mating plane is X=0, with its flange on the negative side. Source body fit land is 24 mm long. R25 has flange diameter 74 mm and body diameter 51 mm; R20 has flange diameter 57 mm and body diameter 34 mm. Six mounting bores are on PCD 60/45 mm at 30, 90, 150, 210, 270 and 330 degrees. Fabricated mounting bores in the current model are inspection/installation clearances; their final locating fit needs a released drawing.

| Axis | Active raceway | Fixed/free journal | Fixed retention |     Additional drive-side extension |
| ---- | -------------: | ------------------ | --------------- | ----------------------------------: |
| Y    |        1800 mm | 20 mm / 20 mm      | M20 x 1         |                                0 mm |
| X    |        1100 mm | 20 mm / 20 mm      | M20 x 1         | 95 mm in the recorded portal layout |
| Z    |         460 mm | 15 mm / 15 mm      | M15 x 1         |                               20 mm |

The extension is an authored smooth end feature to reach the X motor outside the widened cheek and lift the central Z motor/coupling above its real top bridge. It is not an added raceway or an inferred OEM standard end. Approve the entire shaft-end drawing with the matched-set manufacturer before ordering or machining. The compact Z axis is X0/Y178 in the machine frame. Its BK/BF bases mount on 5 mm steel shims directly against the fixed wall, and the actual nut attaches to a central integral boss. Release the pocket, boss and support datums together with the ordered source interfaces.

## Guides and guide accuracy

Order non-interchangeable, factory-matched HG20 rails/blocks in ZA medium preload and SP accuracy; the catalogue's milling recommendations include X SP/UP and Y/Z P/SP. The [HIWIN linear guideway catalogue](https://www.hiwin.com/wp-content/uploads/Linear_Guideway-E.pdf), tables 2-1-12/13, gives ZA as 0.05-0.07 of basic dynamic rating and HG20C radial stiffness as 460 N/um. This is radial catalogue stiffness, not a certified lateral or complete mounted-machine stiffness.

The SP running-parallelism table permits 10 um for a 2020 mm rail, 7 um for 1200 mm and 3 um for 500 mm. These are component specifications, not tool-to-table geometry. Rail pairs need prepared datums, installation alignment and machine metrology. Require delivered accuracy/preload documents; current CAD geometry does not certify current physical guides. Do not apply the catalogue stiffness of a different preload or infer assembly accuracy from nominal rail straightness.

## Reproducible moving-mass and torque screening

Evidence and generators are under [the engineering evidence directory](../../test-results/cnc-milling/engineering/). `precision-installed-mass.json` combines the moving subset of 381 measured fabricated frame/mount leaves with 341 moving supplier/hardware leaves. Their 72/46 unique native macros passed valid, closed, finite positive-solid checks. The final supplier refresh reused 42 exact macro identities from the archived passed run and measured four changed identities afresh; matching native runtime and root configuration are required for reuse. Exact native input hashes, runtime, occurrence configurations and per-leaf values are retained. OEM published masses override illustrative housing volumes. Steel 7850 and aluminium 2700 kg/m3 are explicit density assumptions, not material certificates. Kit containers add no extra mass.

`precision-mass-source-guard.json` verifies every recorded frame and moving supplier occurrence against the current configuration, placement, motion group and exact Simple geometry source, plus the executed supplier script checksum. Regenerate with `precision-moving-supplier-generator.mts`, run its native script, and retain the generated script, result and manifest from `/tmp` in this evidence directory. Then run `precision-installed-mass-calculation.mjs`, `precision-drive-sizing-calculation.mjs` and `precision-mass-source-guard.mts`. Preserve the prior inputs referenced by the reuse manifest.

The recorded Y/X/Z moving-axis estimates are 354.297 / 65.567 / 16.952 kg. Unpublished encoder head/housing mass splits are not treated as measured facts. The [HEIDENHAIN catalogue, printed page 39](https://www.heidenhain.us/wp-content/uploads/2022/07/PR_Linear_Encoders_for_Numerically_Controlled_Machine_Tools_ID571470_en.pdf#page=20) gives complete LS400 mass as 0.4 + 0.5 times measuring length in metres: X 0.86 kg, Y 1.22 kg and Z 0.535 kg. Replacing only a moving head by its whole kit gives a conservative axis bound. Spars retain explicitly assumed envelope masses. Source-adjusted axis bounds are 354.495 / 66.253 / 17.424 kg; added cable/hose/tool allowances and rounding give sizing masses 360 / 70 / 20 kg. Physically weigh the final assembly.

The compact Z removes the eccentric load path and uses the final 226 mm moving web. Its moving-axis estimate is 0.187 kg, or 1.09%, below the previous 17.138 kg estimate archived in `attempts/pre-central-mass/installed-mass.json`. This is a comparison of geometry and source-mass estimates, not a measured weight reduction. The 20 kg sizing allowance remains unchanged.

The calculation uses 0.9 screw efficiency, a 50 N guide/friction allowance, 0.04 Nm support drag, and maximum HIWIN preload torque factor 0.3 applied to the requested 3% preload. Actual friction and factory preload torque remain measurement requirements. Shaft rotational inertia uses a full nominal-diameter steel cylinder, deliberately bounding the turned/grooved shaft. Rated running torque, not holding or intermittent peak torque, supplies the reserve.

`T = (m*a + Fcut + Fguide + Fgravity)*lead/(2*pi*efficiency) + (Jshaft + Jcoupling + Jrotor)*2*pi*a/lead + Tpreload + Tbearing`

| Axis | Planned speed | Required torque at 100 N | Continuous reserve | Torque at 300 N |
| ---- | ------------: | -----------------------: | -----------------: | --------------: |
| Y    |       400 rpm |                 0.879 Nm |               2.72 |        1.233 Nm |
| X    |       400 rpm |                 0.691 Nm |               3.46 |        1.044 Nm |
| Z    |       800 rpm |                 0.524 Nm |               4.57 |        0.700 Nm |

Y has less than twice required continuous torque in the 300 N sensitivity case. It is not approved by the 100 N screening result. The conservative external/motor inertia ratios are approximately 10.21 / 4.14 / 0.85. They are commissioning inputs, not a manufacturer's guaranteed universal inertia limit. Measure inertia and tune the dual-feedback loop under actual payload; verify following error, resonance, settling and contour response throughout travel.

The [HIWIN design equations M29-M32](https://www.hiwin.com/wp-content/uploads/Ballscrew-Catalog.pdf) with fixed-supported factor 0.689, root diameter 21.13 mm and bearing span 1823.5 mm give Y allowable critical speed about 949 rpm after the 0.8 factor, or 9.49 m/min. Planned 400 rpm is below this screening limit. The corresponding buckling screen and compliance terms are recorded in `precision-drive-sizing.json`; actual bearing restraints, end machining, nut preload and installed alignment must match the calculation. The catalogue's FDI stiffness at 10% preload is not used as stiffness at the requested 3% preload.

## Commissioning and finished-part acceptance

1. Inspect supplier identities and approved drawings against the purchased matched sets, supports, motors, keyed couplings and feedback execution. Measure journals, shoulders, lead, preload torque and actual backlash. Preserve set serials and certificates in the project.
2. Measure rail mounting datums, pair parallelism, screw/nut alignment and real bolt engagement. Turn each assembled axis by hand before energizing; confirm no binding across its entire travel. Verify lubrication, guards, coolant/chip protection and cable routing.
3. Verify electrical protection and the approved STO, alarm, limit and brake sequence. The 2.5 Nm brake rating is static holding; stop the Z servo before applying it. Prove power-loss retention and restart behavior by the released safety procedure rather than assuming the brake can arrest a falling axis.
4. Configure CN5 differential linear feedback using the actual scale execution and signal mapping. Check encoder direction, scale factor, motor commutation, pulse gearing, limits and reference procedure at low energy first. Confirm following-error alarms stop every feed axis and spindle as required. Scale feedback corrects measured carriage position; it does not measure cutter bending or tool-to-workpiece displacement.
5. Tune the servo with the final masses and friction. Log following error, current, speed, settling, temperature and oscillation during 4 m/min travel and 0.3 m/s2 acceleration. Repeat at travel ends, representative loads and operating temperature; limit the accepted settings to measured stable performance.
6. Establish a measured worst-case finished-part error budget within +/-25 um, including encoder/calibration residuals, following/contouring error, straightness/squareness/Abbe effects, tool-to-stock deflection, spindle/tool runout, thermal drift, fixturing and measurement uncertainty. Keep the provisional loaded structural target at or below 5-8 um at 100 N. An encoder's +/-3 um specification or its count resolution cannot establish the complete budget.
7. Measure bidirectional positioning, reversal, geometry and warmed-up tool-to-table drift, then cut and inspect representative D16T test features across the useful work area and intended tool overhang. Accept the requested tolerance only when the finished parts and measurement uncertainty support it. Light-steel operation requires its own bounded process trial; no general steel-milling claim follows from the nonferrous envelope.

Current source/native tests establish published interfaces, valid closed geometry and specific assembly clearances. They do not certify supplier internal contact, machine stiffness, servo stability, thermal behavior or the requested finished-part tolerance.
