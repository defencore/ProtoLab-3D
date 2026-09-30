# Prom.ua component selection — 2026-09-26

The following product identities were found on Prom.ua. Supplier pages are commercial evidence for bore/stroke and interfaces, not certified CAD drawings. Listing stock and delivery status can change; prices are not used as a firm whole-machine quote. The reflective sensor is referenced in Prom catalogue results; confirm the exact E3Z-LL81 listing and supply before ordering. Cylinder mounting contours in the model are envelopes until the exact ordered drawing is checked.

|   Qty | Component                                                 | Role                                                            | Product reference                                                                         |
| ----: | --------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
|     1 | Festo DSBC-63-500-PPSA-N3, G3/8                           | Pivot lift, approximately 414 mm working stroke; extend to lift | [63 x 500](https://prom.ua/ua/Pnevmotsilindr-63.html)                                     |
|     4 | MA32 x 50-SCA, magnetic, Rc1/8, M10 x 1.25                | Shuttle side/top, station side/top                              | [MA32 x 50](https://prom.ua/ua/p1969399405-pnevmotsilindr-kruglyj-magnitom.html)          |
|     1 | MA32 x 100-SCA, magnetic, Rc1/8, M10 x 1.25               | Support shelf, two pinned adapters                              | [MA32 x 100](https://prom.ua/p1969890636-pnevmotsilindr-kruglyj-magnitom.html)            |
|     5 | 4V210-08, 5/2, DC24V                                      | Process branches; shuttle side/top share a valve                | [24 V valve](https://prom.ua/ua/p2098352716-pnevmoklapan-elektromagnitnyj-4v210.html)     |
|     1 | AFR2000 G1/4                                              | Filter and supply regulator                                     | [AFR2000](https://prom.ua/ua/p2791833418-filtr-vlagootdelitel-reduktorom.html)            |
|     2 | AR2000 G1/4                                               | Independent clamping/downstroke pressure adjustment             | [AR2000](https://prom.ua/p2081866525-regulyator-davleniya-ar2000.html)                    |
|     2 | 2VD0102 G1/4                                              | One-way lift/lower flow control, verify metering direction      | [Flow control](https://prom.ua/p1913297936-drossel-obratnym-klapanom.html)                |
| 1 set | SFU1605 reference kit; order 425 mm custom shaft/journals | 155 mm indexing stroke; listed kit is not a drop-in assembly    | [Ballscrew set](https://prom.ua/p2333669726-shvp-sfu1605-400.html)                        |
|     1 | OMRON E3Z-LL81 BGS reflective laser sensor                | Side optical nose scan on the open carriage                     | [Prom catalogue reference](https://prom.ua/Fotoelektricheskij-datchik-omron-e3z-l81.html) |

The MA cylinders have no end cushioning; use controlled speed and mechanical stops. Position switches require the correct magnetic cylinder variant and compatible clamp-on mounting. M10 x 1.25 rods require matching clevis/adaptor threads; do not assume M10 x 1.5. The head cylinder is Festo part 1383643. Its [manufacturer datasheet](https://ftp.festo.com/public/PNEUMATIC/SOFTWARE_SERVICE/DataSheet/EN_US/1383643.pdf) gives 1,682 N theoretical return force at 6 bar, G3/8 ports and M16 x 1.5 rod thread. Body, flange and coupling mounting envelopes still require the ordered dimensional drawing; G3/8-to-G1/4 adapters are required for the selected branch components. The earlier G&L alternative was excluded because its live category showed unavailable, despite older search results saying in stock.

The shelf model uses a 270 mm minimum pin-to-pin allowance (listed MA32 x 100 envelope length 246 mm plus provisional adapters). The actual 0–70 degree linkage needs approximately 9.5–86 mm of extension inside its 100 mm stroke. Check the delivered rod/end-cap geometry before drilling the brackets. Mechanical stop and hinge shaft carry the supported load, not cylinder compliance.

At 6 bar and 80% assumed effective force: the D32 clamp develops about 386 N; the extending D63 head cylinder develops about 1,496 N. With a 40 kg bow and the stated centre-of-gravity assumption, the minimum torque margin across 0–35 degrees is approximately 7.63. These calculations need measured weight, guide friction and cutting/grip loads. A regulator setting is not a crush-resistance validation for thin tube.

Still to select by exact supplier drawing: compatible closed-loop drive, motor-to-screw coupling, pivot bearing fits/preload, band reducer and blade, blade tensioner, complete head retention assembly, inlet safety/isolation components, pressure and position sensors, contactor/overload and standstill monitor, process PLC with encoder feedback and a hardware capture input, tubing, fittings, cable carrier, lubrication and containment. These are visible or reserved envelopes; no fake vendor SKU or stock claim is made for them.

The SFU kit lists a 6.35 x 10 mm coupling; many closed-loop NEMA23 motors have a different shaft. Specify the actual shaft before ordering the coupling. Keep separate pneumatic clamp and head branches. Do not use a generic 5/2 valve as the only device preventing a suspended head from falling.

Band-wheel bearing envelope: 6206, 30 x 62 x 16 mm, checked against [SKF](https://www.emarketplace.in.skf.com/deep-groove-ball-bearing/6206). The visible ball/cage geometry illustrates construction; it is not a manufacturer internal drawing. The 12 x 28 x 8 screw-support bearing envelope needs an actual fixed-end angular-contact pair and floating-end selection/preload before manufacture.

## Library selections used in the preview

- Feed: [STEPPERONLINE 23HS30-2804-ME1K](https://www.omc-stepperonline.com/de/nema-23-schrittmotor-mit-geschlossener-regelkreis-1-85nm-256-9oz-in-mit-magnetischem-geber-1000ppr-4000cpr-23hs30-2804-me1k), 57 mm frame, 80 mm motor body, D6.35 x 21 shaft. Encoder-cover contours and mounting pilot remain drawing-dependent. The rendered feed coupling has stepped 6.35/10 bores for the modeled motor and screw journal, matched to the modeled D10 drive journal.
- Feed rails: two 400 mm MGN15 rails, four MGN15C blocks from `linear-guide`. The bow uses two 6010 pivot bearings and an independent D30 driven shaft inside the fixed trunnion.
- Band drive: library BEVI 4A3 90L-2; the intervening reduction unit is still a layout envelope. Do not run the band directly at motor shaft speed. The motor and reducer stay on the frame; exclude them from moving bow mass.

## Pivot hardware and simple clamps

The fixed trunnion is a custom machined part with a D50 bow journal and D30 internal driven shaft. Nominal bearing envelopes are 6010 (50 x 80 x 16) for the bow and 6806/61806 (30 x 42 x 7) for the shaft. See the [SKF rolling-bearing catalogue](https://www.skf.com/binaries/pub12/Images/0901d196807026e8-100-700_SKF_bearings_and_mounted_products_2018_tcm_12-314117.pdf). Internal ball/race details are visual approximations. Bearing life under band tension, fits, axial retention and wheel/reducer torque interfaces require drawings and calculation.

The clamp brackets are fabricated slotted angles with M16 cylinder mounting collars, large washers and M6 base screws. Slot ranges allow manual height and transverse adjustment. The L datum stays fixed across section sizes; triangular tube uses a replaceable sloped shoe. Confirm the MA cylinder rear mounting interface with the selected vendor; the rear collar is an installation envelope.

The lift-cylinder eye adapters, pin centres and rod-lock envelope are installation allowances, not a claimed Festo catalogue assembly. The Festo rod interface is M16 x 1.5, with G3/8 air ports. Select and verify an exact monitored rod lock before releasing the machine.

## Side optical sensor qualification

The [OMRON specification](https://www.ia.omron.com/products/family/1747/specification.html) identifies E3Z-LL81 as a distance-settable BGS model, not a through-beam pair. Its housing is 10.8 × 20 × 31 mm; the model uses this installation envelope with an adjustable bracket. The listed 1 ms response and reference spot size do not establish ±0.03 mm edge accuracy on a polished tube. Qualify low scan speed, switching threshold, surface angle, cable routing and background rejection on all actual profiles. Prom catalogue search shows this identity, but current stock and the exact seller page were not confirmed.
