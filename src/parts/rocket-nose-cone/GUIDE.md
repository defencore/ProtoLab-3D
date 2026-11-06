# Rocket nose cone

An independent nose-cone detail corresponding to the component family described in the [OpenRocket design guide](https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html) and [body-component overview](https://wiki.openrocket.info/Body_Components_Basics), reviewed 2026-10-25. Three profile choices are provided: conical, elliptical and tangent ogive. The four presets are authored metric examples, not manufacturer parts or OpenRocket database records.

## Geometry and origin

All dimensions are millimetres. The nose base is at Z=0, tip at Z=`length`, and an integral cylindrical shoulder extends to Z=`-shoulderLength`. Set shoulder length to zero to omit it. The maximum XY envelope is the base diameter, and the reported Z envelope includes the shoulder.

For radius R, length L and base-relative coordinate z, the outer radius is `R * (1 - z/L)` for a cone, `R * sqrt(1 - (z/L)^2)` for an ellipse, or `sqrt(rho^2 - z^2) + R - rho` for a tangent ogive where `rho = (L^2 + R^2) / (2R)`. The endpoint is fixed exactly on the axis. Length must be at least R. Curved profiles are sampled into 64 straight meridional segments in both the preview and FreeCAD recipe; native surfaces are corresponding conical bands rather than an exact analytic ellipse or ogive.

## Hollow construction

Filled construction creates one solid nose and shoulder. Hollow construction uses a shorter, radially reduced copy of the selected profile with a closed tip. When there is a shoulder, the cavity starts one wall allowance above the nose base, leaving an axial connecting web; the shoulder bore opens at the rear. The wall input controls radial and axial construction allowances, not a constant normal surface offset. This distinction affects material volume and should be considered before manufacturing.

Shoulder diameter and length are independent measured-fit inputs. The model has no shoulder end cap, eye, fastening or retention feature. Assign material, actual tube clearance, wall requirements, attachment and process qualification in the project. These shapes do not provide OpenRocket import/export or aerodynamic simulation results.
