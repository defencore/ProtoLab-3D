# Boat hull frame kit

This is an authored model-boat skeleton of a longitudinal plywood keel and transverse sheet frames. It is a separate design from the approximate commercial models in **Boat hull**. Choose a 650 mm shallow-V skiff, 900 mm launch, 750 mm deep-V skeleton or 1200 mm utility hull example; dimensions and sheet stock remain editable.

X runs from bow to stern, Y across the hull and Z upward. The maximum-beam station is always included. The depth input is the unraised deck datum; bow sheer raises the forward deck and rocker raises the keel. The stern beam is a percentage of maximum beam. The sides and bottom are hard-chine ruled geometry, not a faired moulded surface.

Every frame has a bottom-open slot. The keel has complementary top-open slots at the same X/height datums. The total slot width is measured stock thickness plus the entered clearance; a 0.15 mm value adds 0.075 mm on each side. The lap floors share their height. No automatic tool kerf or internal-corner compensation is applied. Cut a fit coupon, then add router relief/dogbones or finish corners to suit the tool and adhesive process.

Lightening openings retain a normal perimeter inset and an uninterrupted central web above the keel notch. Narrow forward openings are omitted. These geometry constraints do not establish plywood strength or a working load.

**Flat cutting layout** and the DXF use exactly the same closed polygonal panel contours and labels. All panels lie on Z=0 in that inspection view. **Frame assembly** and FreeCAD assembly export place each panel independently at its half-lap datum. Exploded view changes inspection positions only; it does not create new production components. The CSV lists each station, design beam, deck and mating height. These are nominal contours, so set cutting compensation in CAM after measuring stock.

The kit intentionally contains no hull skin, gunwales, transverse transom, longitudinal sheathing/stringers, watertight bulkhead seals or equipment hardpoints. Complete those parts for the intended model, specify ply grain/grade, waterproof adhesive and finishing, and verify stiffness, loading and flotation of the completed hull. It is not a rated structure or a ready-to-float product.
