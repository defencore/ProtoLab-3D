# Rocket parachute canopy

One purchased canopy item represented by an open dome reference envelope. The family corresponds to OpenRocket's Parachute component in the [official component overview](https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html#mass-components), reviewed 2026-10-25. This source establishes the component type, not the example dimensions.

## Geometry

The outer meridian follows `r = R cos(theta)`, `z = H sin(theta)`, from the rim to the edge of the optional central vent. The meridian uses 64 straight segments; the inner meridian is translated downward by the axial reference thickness. Preview and FreeCAD share that profile. This is a closed finite-thickness envelope solid with an open bottom, rather than a textile cutting pattern or constant-normal-thickness fabric model.

The outer rim is at Z=0; the lower edge is at Z=-thickness. A central vent removes the nominal apex, so actual overall height is `rise * sqrt(1 - (ventDiameter / diameter)^2) + thickness`. Zero vent closes the crown. The vent must stay below 80% of the canopy diameter, and thickness below one quarter of the nominal apex rise.

## Evidence and procurement

All three presets are authored examples. They have no catalog identity, measured fabric specification or aerodynamic rating. Select an actual product and verify dimensions, packed volume, seams, suspension lines, harness and attachment separately. The library item contains only the canopy reference body; lines and other recovery components are separate project items.

No drag coefficient, descent speed, inflation sequence, opening force or flight qualification is implied by the geometry.
