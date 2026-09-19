# Rocket AirBrakes

Eleven selectable drive variants share editable tube OD/ID, module height, insert clearance and servo installation sizes. The default is an OD80 / ID76 mm tube with a micro servo, 8 mm radial travel and a 60° servo sweep. The library includes 20 starting configurations, including OD90 / ID86, OD100 / ID96 and a larger OD150 / ID146 spiral design.

| Mechanism           | Motion                                                                      | Source / adaptation                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Waterloo spiral cam | Three radial leaves; displacement proportional to shaft angle               | [Armaan Sengupta](https://www.armaansengupta.ca/rocketry); reconstructed Archimedean slots                                                                 |
| Sculpted cam        | Three radial leaves; smoothstep displacement and tangential slot ends       | [Schnupp et al. 2025](https://doi.org/10.2514/6.2025-98650), Figure 2, inspired by WPI; our normalized lift law replaces the source dimensional polynomial |
| Curved links        | Three slider-cranks; nonlinear displacement                                 | Schnupp Figure 1; exact fixed-length joint closure and curved link bodies                                                                                  |
| MIT sliding leaves  | Four leaves in two opposed pairs; two levels of resin trays and crank links | [MIT Rocket Team](https://wikis.mit.edu/confluence/display/RocketTeam/Air+Brakes); reconstructed dimensions and mounting                                   |
| Rack and pinion     | Four translating leaves; two 20-tooth pinions and four racks                | [Sprague et al. 2024](https://doi.org/10.2514/6.2024-85628), Figure 2; rack geometry reconstructed                                                         |
| Geared petals       | Three fixed pivots; central 18-tooth pinion drives 42-tooth petal sectors   | User-supplied geared-petal image; reconstructed involute gearing and blade shape                                                                           |

## Ben Jaynes adaptations

The five additional presets reference [Ben Jaynes, 3D Printed Airbrakes for a Model Rocket](https://www.benjaynes.com/projects/airbrakes/). V1 and V2 are early hinged-flap studies; V3 uses a spiral drive, V4 uses geared rotating leaves, and V5 returns to hinged flaps. These are reconstructed topology studies, not the author's original CAD or measured reproductions.

| Preset        | Library implementation                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ben Jaynes V1 | Two curved hinged flaps, transverse micro-servo envelope and opposed 24-tooth gears. Flaps occupy an offset plane to clear the servo body.                         |
| Ben Jaynes V2 | Vertical servo, rotary crank and two fixed-length spatial links; flap angles follow the solved joint closure. Spherical ends and sockets are simplified envelopes. |
| Ben Jaynes V3 | Three translating leaves with an Archimedean spiral disc; servo mounted above the mechanism.                                                                       |
| Ben Jaynes V4 | Three geared rotating petals; servo above the mechanism, with the library's 18:42 transmission.                                                                    |
| Ben Jaynes V5 | Opposed hinged flaps with a centered transverse servo; an additional 20:20 gear pair transfers the input to the 24:24 flap gears.                                  |

All five start at OD90 / ID86 mm. Existing presets and the default remain unchanged. Hinged variants expose flap length and width; their radial-travel control is hidden. The deployment control moves actual flaps, gears and links. V1/V5 use a reconstructed 1:1 input-to-flap ratio; V2 uses nonlinear motion. Source dimensions, tooth counts, electronics, bearing construction and attachment details are not reproduced. Installation envelopes, plain shaft seats and simplified joints require detailed design before manufacture; this is not a fabrication-ready release.

The deployment parameter actuates the selected mechanism, including its drive parts and hardware. A linkage is not presented as linear travel. Pivoting petals do not use the radial travel or tangential blade-width controls. Two-level drives include an extended shaft, upper tray supports and windows at different axial heights. Tube, bulkheads, support collars, servo installation body, bearings/bushings, guides and fasteners are individually named export components; rod seats are integral bosses in the guide deck.

Assembly, quarter cutaway, tube removed and mechanism-only states are available. The preview and FreeCAD output use the same shape recipes. `tests/airbrakes.test.ts` checks geometry effects and kinematic constraints. `scripts/verify-airbrakes.ts` generates representative cases for `scripts/verify-electronics.py`, which checks valid independent solids, component intersections, preview dimensions/volumes and STEP/FCStd roundtrips.

These are parametric adaptations, not original author CAD or validated aerodynamic designs. The default 80/76 dimensions come from the user's request. Servo bodies use Tower Pro nominal MG996R/MG90S size references; mounting, sleeves, gear tooth fillets and threads are simplified. Servo torque suitability, structural strength, loads and flight performance are not established. PDFs and source models remain outside the repository; the preview links to external sources.
