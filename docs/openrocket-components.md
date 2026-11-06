# OpenRocket component coverage

Find these components under **Vehicles > Vehicle structures > Model rockets**, or search `OpenRocket`. This extension follows the physical component roles in the official [Basic Rocket Design guide](https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html#available-design-elements), reviewed 2026-10-25. The existing [LDRS details](ldrs-library.md) remain reusable within the same group.

## Component mapping

| OpenRocket role | ProtoLab family                                    | Geometry and controls                                                                     |
| --------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Nose cone       | `rocket-nose-cone`                                 | Conical, elliptical or tangent-ogive profile; solid or hollow, with an insertion shoulder |
| Body tube       | `rocket-body-tube`                                 | Open cylindrical shell; diameter, wall and length                                         |
| Transition      | `rocket-transition`                                | Hollow conical reducer or boattail between two diameters                                  |
| Trapezoidal fin | `rocket-fin`, trapezoidal shape                    | Root/tip chords, span, sweep and thickness                                                |
| Elliptical fin  | `rocket-fin`, elliptical shape                     | Half-ellipse planform with root chord, span and thickness                                 |
| Freeform fin    | `rocket-fin`, freeform shape                       | Validated closed polygon entered as JSON XY points and extruded to thickness              |
| Tube fins       | `rocket-body-tube`, `tube-fin-40` example          | One tube per project occurrence; position and repeat the physical tube in the project     |
| Rail button     | `rocket-rail-button`                               | Two flanges, groove root, screw bore and head recess                                      |
| Launch lug      | `rocket-launch-lug`                                | Open guide-rod sleeve with configurable clearance                                         |
| Inner tube      | `rocket-body-tube`, `inner-tube-29` example        | Same physical open tube, placed inside an airframe                                        |
| Coupler         | `rocket-coupler`                                   | Open joining sleeve                                                                       |
| Centering ring  | `rocket-centering-ring`                            | Annular support with editable bore                                                        |
| Bulkhead        | `rocket-bulkhead`                                  | Circular plate with optional central hole                                                 |
| Engine block    | `rocket-centering-ring`, `engine-block-28` example | Annular stop geometry; material, attachment and load capacity remain project inputs       |
| Parachute       | `rocket-parachute`                                 | One open dome canopy envelope with diameter, rise, reference thickness and optional vent  |
| Streamer        | `rocket-streamer`                                  | One straight, flat sheet envelope                                                         |
| Shock cord      | `rocket-shock-cord`                                | One straight round strand envelope                                                        |
| Mass component  | `rocket-ballast`                                   | One solid or bored cylindrical weight, with a density-based mass estimate                 |

The extension adds **eight physical families with 25 prototype presets**. Existing tube and ring families receive **three further examples** for internal tubes, individual tube fins and engine blocks, for 28 added examples in this extension. Combined with the original LDRS details, the fifteen families provide 49 presets. The table maps component roles without assigning a separate product identity to the same physical tube or annular blank.

## Shape and product scope

All dimensions are in millimetres. Each fin is one physical item; add individual project occurrences for fin sets. Freeform points describe the outline rather than a curve-fitting or aerodynamic model. Sampled nose and canopy profiles use the same boundary for preview and native export. Shoulder fits, tube clearances, attachments and load paths must be chosen using measured project hardware.

The canopy, streamer and cord are purchased-item layout references with authored dimensions. A canopy envelope does not include shroud lines, seams, packing, reinforcement or a load-rated attachment. Flat fabric and straight cord references do not simulate flexible materials. They require actual procurement identities and measurements before release. The ballast mass estimate uses an editable assumed density; it does not set a rocket CG or calculate stability.

OpenRocket also has Stage, Boosters and Pods as design-tree containers. Its official guide identifies those as nonphysical grouping elements. In ProtoLab, organize the actual product occurrences in the design project. This change adds component geometry and vocabulary; it does not add OpenRocket flight simulation, motor data, deployment control, an automatic fin-set placement tool or `.ork`/`.orc` import/export. The documentation's component list establishes type names rather than supplier dimensions or exact equivalence to every OpenRocket setting.

## Preset evidence and verification

All added presets are authored examples, with no supplier SKU, dimensional-standard claim or measured material certificate. Package `GUIDE.md` files describe coordinates, profile definitions and modeling limits. Prototype validation establishes finite dimensions, positive material and valid geometric relationships.

```sh
node --import tsx --test tests/openrocket-library.test.ts
npm run parts:check
npm run typecheck
npm run typecheck:tests
npm run build
```

The focused tests exercise search and role mappings, geometric interfaces and invalid shape inputs. The existing per-part contracts check finite meshes, declared envelopes, STL and complete FreeCAD macro generation. Native CAD verification is separate from aerodynamic, strength, flexible-material or supplier qualification.

On 2026-10-25 all **49 presets across the fifteen LDRS/OpenRocket families** were executed as complete macros in FreeCAD 1.1.4. Each produced one valid closed solid with positive volume, matched its declared envelope within 0.01 mm, and passed a STEP export/reload with conserved volume. The local audit report is `test-results/openrocket-native/report.json`.
