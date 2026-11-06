# GMP16T-TEC1636 planetary gearmotor

Purchased brushless coreless motor and Ø16 planetary gearbox. The supplied dimensional table provides 17 reduction ratios and 12/24 V motor versions, giving 34 selectable references. The requested `107-11.6D7` and `361-11.6D7` codes remain searchable. Filter reduction ratio, voltage, stage count, gearbox/body length and the published performance values in the model catalog. Selecting a model changes the gearbox envelope; shaft rotation and cable visibility are independent inspection controls.

## Dimensions and datums

The gearbox front mounting face is Z=0. The output tip is Z=11.6 mm, with Ø3 shaft and a 7 mm D-flat. The front-view 2.8 mm flat-to-round height gives a 0.2 mm flat depth. The Ø6 locating pilot projects 2.3 mm. Two nominal M2 pilots lie at X=±5.25 mm. Their modeled 2.45 mm depth is illustrative because no thread depth is specified. Threads are not helically modeled.

The motor body is 36 mm long. Gearbox lengths are 12.5, 16, 19.5, 23 and 26.5 mm for one through five stages, each with ±0.5 mm source tolerance. Preview and FreeCAD export use the same nominal component recipe. Internal gear geometry and winding construction are omitted; shell thicknesses, cap splits, rear cable opening and optional 12 mm lead segments are illustrative. Separated housings is an inspection pose, not a different purchased unit.

## Evidence and conflicting ratings

The bundled [dimension and rating attachment](../../../public/references/gmp16-gearmotor/tec1636-dimensions.png) is the dimensional source. The original [seller listing](https://www.aliexpress.com/item/1005011804448445.html) could not be inspected. Ratios 107 and 361 are requested seller options; availability of other datasheet variants, voltage/connector combinations and seller interchangeability needs confirmation. The screenshot says GMP16T-TEC1636, while some supplier names use GMP16-TBC1636; the catalog records the supplied drawing designation and preserves the alternate search codes.

The output table publishes speed and torque for only 4, 16, 22.6, 64, 107, 256, 361 and 1024. Other ratios have unknown output performance and do not enter a performance filter by interpolated values. The 24 V / 4:1 row has 2200 rpm rated speed; the 12 V row has 2000 rpm.

The table's 5 kgf·cm output torque for 256/361/1024 conflicts with its general gearbox maximum rated torque of 3 kgf·cm and momentary maximum of 5 kgf·cm. All figures are transcribed as reference specifications with the conflict visible. They do not establish a continuous safe operating point. The 53 g mass is approximate without a per-ratio condition. Motor-only power/current/torque figures are labeled separately from gearbox output values.
