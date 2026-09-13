# Gear shaft connections

Spur, helical / herringbone, bevel layout gears, both sides of a bevel pair, and the worm-drive wheel support seven through-hole profiles. The selected hole is modeled in the 3D preview, STL boundary and native FreeCAD geometry.

| Shape             | Bore size                 | Additional controls                      |
| ----------------- | ------------------------- | ---------------------------------------- |
| Round             | Shaft diameter            | None                                     |
| Hexagon           | Across flats              | Rotation                                 |
| D-shaft           | Original shaft diameter   | Flat depth, rotation                     |
| Double D          | Original shaft diameter   | Equal flat depth on both sides, rotation |
| Square            | Across flats              | Rotation                                 |
| Custom polygon    | Inscribed-circle diameter | 3–12 whole sides, rotation               |
| Round with keyway | Shaft diameter            | Keyway width, radial depth, rotation     |

At zero rotation, D flats and keyways face the local +X direction. Flat depth is measured from the circular edge toward the center. Keyway radial depth extends outward from the nominal circular edge. These dimensions describe the modeled opening; users supply the required clearance and manufacturing fit.

Single gears and the worm wheel accept a zero bore for a solid blank. Bevel-pair bores remain within the reference's displayed size interval; their shape can be customized independently. All sourced presets start with circular bores. Changing a profile clears the active sourced-preset selection, because the supplied listings do not establish noncircular shaft variants.

Validation checks the farthest polygon or keyway corner against both the tooth roots and any hub. It also rejects impossible D flats, noninteger polygon side counts and keyways wider than the shaft. The worm wheel's profile follows its transmission rotation. Bevel-pair profiles and radial screw holes rotate with their respective gears.

The shared shaft helper generates identical cap and wall outlines for the preview. Native FreeCAD retains analytic circular portions and planar flats. A bevel hub is extruded as an annulus before its radial holes are cut, preserving the shaft contour at small corners. Its mesher retains small, nonzero intersection facets; unrelated mesher callers keep their existing tolerance.

`tests/gear-bores.test.ts` verifies all seven profiles on each supported gear family, independently mixed pair bores, radial holes, closed outward meshes, representative visible cross sections and wall-breakout rejection. Native validation results are recorded separately in `data/gear-shaft-connections-native-validation.json`.
