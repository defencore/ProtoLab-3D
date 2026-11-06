# Rocket conical transition and boattail

One open conical shell for the transition family described in [OpenRocket's body-component overview](https://wiki.openrocket.info/Body_Components_Basics) and [design guide](https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html), reviewed 2026-10-25. The three presets are authored metric prototypes. They are not manufacturer parts or imported OpenRocket database entries.

## Interfaces and geometry

Z points forward. The origin is the axial midpoint, with the aft interface at `-length / 2` and forward interface at `+length / 2`. A forward diameter smaller than the aft diameter makes an expanding body transition; swapping them makes a reducing boattail. Both ends stay open. Equal diameters belong to the existing body-tube family and are rejected here.

The revolved four-point annular section has straight inner and outer conical walls. Wall thickness is measured radially at any axial position; the surface-normal thickness is smaller by the cosine of the cone half-angle. Preview, STL and native FreeCAD geometry use the same section. The nominal envelope is the larger outside diameter in X/Y and the transition length in Z.

No shoulder, end cap, motor retention, fastening or tube attachment is supplied. Define measured tube interfaces, joining geometry, material, tolerances and process requirements separately. Geometric feasibility does not establish strength or flight performance. No OpenRocket file interchange or aerodynamic simulation is implemented.
