# FinsROV mechanical assembly

This package contains a source-positioned mechanical assembly with real **make or buy** definitions. It replaces the earlier project-reference grids and generic list of source solids. Other ROV research sources are documented separately; they are not offered here as complete assembly builds.

Green parts are printed pressure-sensor mounts. Silver parts are the source aluminium machining details. Purchased units retain their individual library appearance: complete thrusters, servos, sensors, brackets, horns and pressure-enclosure components. Internal solids of a servo or thruster remain inside that opaque purchased unit. They are never separate making tasks.

## Assembly and manufacturing views

**Mechanical assembly** installs reusable library products at their physical placements. The original mirrored commercial servo is replaced by the ordinary canonical servo in its mounting frame; this source discrepancy remains in the review issues. **Made parts**, **Printed parts**, **Machined parts** and **Purchased equipment** filter those same physical occurrences. **Inspection separation** applies display offsets without changing the physical BOM or source assembly positions.

For printing, choose **Printed parts**. Only the explicitly printed source mounts are exported. Every STL printing export contains only those four printed mounts, placed on the print bed in their original making-file orientation. The 22 metal occurrences require machining and use FreeCAD/STEP. Purchased and machined-only views refuse STL printing export; no purchased equipment or metal machining blanks are included in a print file.

FreeCAD export retains separate physical units with the appropriate manufacturing or procurement identities. A purchased servo or thruster remains a bought unit even when the upstream CAD supplies its internal solids.

## BOM and source review

The mechanical occurrence list is not the complete required vehicle BOM. Purchase quantities use the upstream purchase unit: an enclosure kit can contain two CAD units, and a thruster pair contains two thrusters. The **BUY** CSV preserves these units and the audited BOM quantities. The **MAKE** CSV contains only source details to fabricate and their process requirements.

Read **Source assembly, placements and unresolved BOM items** before manufacturing. The source external assembly omits some BOM geometry, including two required servo horns and the internal support assembly. Fasteners, seals, electrical hardware and cabling require the upstream BOM and build instructions. These gaps remain assembly review issues and prevent release; no placeholder components or invented assembly positions are added to hide them.

The source provides the geometry and working concept. Manufacturing tolerances, sealing fits, thread engagement and the completed vehicle's leak, buoyancy and electrical tests still require the actual build.

## Reusing a component

Select a physical unit in the 3D view or component tree. The tree can hide individual occurrences and open their real library configuration. Servos are ordinary servo products, thrusters are motor products, and sensors, enclosures and brackets belong to their respective library sections. Add any of them independently to another project; repeated occurrences share one product definition. The vehicle has no separate purchased-equipment library category.
