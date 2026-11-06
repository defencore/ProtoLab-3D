# GPS tracker ZX908

`gps-tracker:zx908` is the same fixed 35 × 20 × 4.5 mm bare-board installation reference used by the current PEM search-platform source. The selected latest installed source is `new_project_v2/revisions/2026-10-11_M5/assembly_current/current_world/world_233.brep`, component 233, procurement position 303, document revision 03. Current scripts retain that board while changing its surrounding platform and retainers. No duplicate project-specific product ID is created. Immutable file hashes and the current source frame are recorded in `lib/source-provenance.json`. The source directory is read only.

## Source comparison and native geometry

The source and current library both contain 26 visual solids with local bounds X=-17.5..17.5, Y=-10..10, Z=0..4.5 mm. The source has 224 faces: its two rounded PCB profiles use eight straight facets per quarter circle. The library retains native radius-2 mm and radius-1 mm corner arcs and has 168 faces. This intentional analytic reconstruction adds 0.074545755 mm³; source-minus-library Boolean volume is zero. The difference is independently explained by `(π·4 − 64·sin(π/16))·0.8 + (π − 16·sin(π/16))·0.5`. The maximum corner chord-to-arc distance is `2·(1 − cos(π/32)) = 0.009630547 mm`. Native curves are preserved rather than importing the source corner facets into CAD.

The detailed board appearance remains a user-project reconstruction: antenna, SIM holder, RF shield, button, LED, contacts and packages are installation references without supplier drawings or fabrication tolerances. The 26 display solids belong to one purchased module and do not become separate procurement items. No electrical pinout, radio capability, supply/current rating or qualified mounting interface is established by this geometry. Loose leads are excluded.

## Coordinates and installation scope

`gpsTrackerInterface` exports the fixed local bounds and both source frames. `sourceFrame` retains the historical platform_access_current translation [-8.419035512031975, 20.325349715248308, 149.45] mm with 22.5° rotation about +Z. `latestAssemblyFrame` uses the same X/Y/angle at Z=158 mm. An exact native Boolean comparison proves that the latest source body is unchanged after a rigid +8.55 mm Z translation. The mounting layout contract owns installed placements. It records no mounting holes. The source platform uses 35.4 × 20.4 mm seats and four separate compliant retainers; the actual support lands, material, compression and retention loads remain unresolved. Retainers and platform details belong to their own physical components.

The canonical state remains Assembled; Exploded separates visual layers for inspection and retains module identity. Preview, reported dimensions and native recipes use the same analytic definitions. The current source comparison was executed with FreeCAD 1.1.4; its report is under ignored `test-results/search-platform-components/gps-source-comparison.json`. This verifies the stated reconstruction difference, not completeness or supplier fidelity of the ZX908 reference.

Latest assembly rigid equivalence was verified for GPS and JHE42B in FreeCAD 1.1.4: both source bodies have zero symmetric Boolean difference after +8.55 mm Z translation from platform_access_current. The latest GPS retains 26 solids and 224 source faces. Report: ignored `test-results/search-platform-components/latest-assembly-rigid-comparison.json`.

Native export checks executed the assembled and exploded GPS macros in FreeCAD 1.1.4. Both retain 26 valid solids and 168 faces, preview bounds and identity through STEP/FCStd round trips. Reports and exports are under ignored `test-results/search-platform-components/native-library-report.json`.
