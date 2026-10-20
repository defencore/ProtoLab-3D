# Vehicle payload and electronics plates

Five authored starting configurations provide 50 and 65 mm electronics plates, a 100 mm battery tray, a 140 mm payload tray and a 180 mm rover battery tray. They are custom flat details for a project-selected laminate, aluminium alloy or qualified polymer, not exact supplier CAD.

The centre pattern can be absent, a 20 mm or 30.5 mm square, both squares, or a custom rectangle. These are geometric mounting options; compare the actual controller or payload drawing, fastener heads and connector access. Optional perimeter holes provide four attachment points. Validation checks at least two hole diameters of perimeter centre offset and at least 2 mm of material between cut edges, including chamfered corners. These geometric checks do not establish plate strength.

Four rounded strap slots form two stations along the length. Slot overall length follows X and their width follows Y; a strap passes between opposite side slots across the plate width. Check real strap width, thickness, edge finish and clearance below the tray. The battery and strap are outside the part scope. Positive retention against sliding and ejection is a project requirement.

The finished bottom face is Z = 0. Native CAD cuts true cylinders and rounded capsule slots. The millimetre DXF uses `OUTLINE`, `HOLES` and `STRAP_SLOTS` layers with exact hole circles, straight slot walls and semicircular ends. It contains one finished part, with no tool compensation, drilling-depth instruction or countersink operation. Select cutter or laser allowances in CAM. Deburr and round strap-contact edges.

Stock thickness remains configurable, while stock material, tolerances, restraint loads, mounting stack, bending, fatigue and vehicle vibration must be resolved in the project drawing and acceptance checks.
