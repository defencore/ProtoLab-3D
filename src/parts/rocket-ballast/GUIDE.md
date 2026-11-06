# Rocket ballast mass

One physical cylindrical ballast detail representing a possible OpenRocket [Mass Component](https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html#mass-components). This family supplies geometry and a mass estimate; the OpenRocket mass object is more general and can represent arbitrary measured equipment.

Dimensions are in millimetres, Z is axial and the origin is at the midpoint. A zero bore produces a solid slug; a positive bore produces a through annulus. Mass in grams is `pi / 4 * (diameter^2 - bore^2) * length * density / 1000`, with density in g/cm3. The density is an assumption. It does not change the CAD geometry, assign material properties to FreeCAD or update project mass/CG calculations. Weigh the finished item and use the actual assembly for balance checks.

All three presets are authored prototype examples, without a supplier identity or certified alloy. Define dimensions, actual material and secure retention on the project drawing. The library does not determine how much ballast a rocket needs.
