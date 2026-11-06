# JCG108 conformal tube fairing concept

This independent engineering reference preserves the elongated antenna fairing for future work. It is **not included in the Grandado mounting kit** and has no purchased or manufactured production status. Its native geometry is retained for inspection, not as evidence of aerodynamic or structural readiness.

## Function and retained layout

The intended function is to cover and press a Jinchang JCG108 antenna adhered directly to an OD 90 mm tube, with axial flow and two existing anchor axes at X±70 mm. No raised antenna platform or printed backing is present. The default flat back plane is Z−45.3 mm, using an assumed 0.3 mm adhesive layer; the default 8.6 mm mounting contact depth gives a contact plane at Z−53.9 mm. The source antenna remains unchanged at its nominal 8.6 mm depth.

The authored outer envelope is 314.8 mm long: central half-length 67.4 mm, 55 mm nose and 125 mm tail. For positive-X flow it extends from X−122.4 to X192.4; negative-X flow mirrors only X. Maximum nominal centre projection is 12.5 mm, including 0.6 mm crown camber. Broad shoulders blend toward the tube instead of retaining the previous flat side cable bay. The host reference extends 20 mm beyond each end.

The two flush DIN 7991 anchor interfaces use the existing `bolt-screw` definition. Head planes are derived conservatively from the authored rim surface, and nominal M3 ×25 screws reach the assumed nut interface at radius 34–36.4 mm. This standalone package does not supply or qualify the underlying captive-nut structure. Its anchor hardware is inspection geometry, not an extra procurement list. The positive-flow tail ends at X192.4, 122.4 mm beyond the last anchor at X70. Tube contact supports inward compression only; outward suction and peel require a separate stiffness, bond and fastener qualification. No unsupported-tail load capacity is established.

## Design decision record

The required function is a low covering surface with direct antenna adhesion and an axial streamlined shape. The contradiction is that a low cover around a long rectangular housing leaves little axial distance for smooth approach and departure surfaces. The ideal result reuses the tube as the closing back and support rather than adding a raised platform. Available resources are the adhesive mounting face, the existing two axes, the extended host surface and longitudinal space.

The retained concept separates the clamping load path from the aerodynamic envelope in space: internal contact and closed screw lands carry the nominal clamp, while a longer freeform nose/tail covers them. A short flat cap had less length but abrupt ends; the earlier raised two-part pod was bulkier. This record preserves the selected elongated one-cap alternative; it does not restart the design study or claim a verified drag reduction.

`lib/profile-data.json` contains the 67 authored freeform stations, each with 53 trace points, recovered from the original design recipe. They are design control traces, not antenna manufacturer CAD or a triangle mesh. The SDK constructs genuine B-spline edges and a smooth native loft; preview tessellation remains separate. Mounting-depth and bondline changes affect the cap's fit surface, never the reused antenna geometry.

The original zero-gauge tube-tangent perimeter caused an empty native tube subtraction despite a valid uncut loft. The preserved version applies a 1 mm radial floor to the authored termination traces, with a smooth transition to the unchanged profile by 2 mm radial stock. Native B-spline interpolation between those traces must be checked independently; the authored trace floor is not a certified minimum of the entire surface. The central 12.5 mm crown is unchanged. This controlled edge requires continuous tube support, edge bonding/finishing and a slicer/sample check; its final seam is not claimed to be mathematically tangent to the bare tube. It is not a free fin or a primary load member.

## Source identity and installation assumptions

The family reuses exactly `adhesive-antenna:jcg108-3m` or `adhesive-antenna:jcg108-5m`. The manufacturer drawing specifies a nominal 126 mm housing, 16.2 mm overall span and 8.6 mm maximum depth with stated tolerances; the existing library reference records the incomplete contour, cable, boot and connector evidence. This package does not invent a new JCG108 execution or resize that source model.

The cap cavity is 128.8 ×18.0 mm with R0.8 corners. The editable depth is a measured mounting fit within the published depth tolerance; it is not a supplier geometry selector. Choosing a depth smaller than the nominal source reference can visibly intersect that nominal reference and must be judged against the delivered article.

The pipe cable opening defaults to X0/Y−17.5/Ø12 mm, outside the maximum antenna footprint. The cap needs only an assumed connected Ø4.2 mm flexible-coax corridor from the negative-Y housing edge to the pipe opening. It does not provide a plug-sized bay or establish an actual cable bend radius. Prethread the real connector through the pipe before approaching the cap radially from below. Resolve the actual outlet boot, lead, strain relief and complete cable path before use.

## States, identity and verification limits

- `assembled`: extended host pipe, cap, nominal anchor interfaces and optional unchanged antenna reference.
- `fairing-only`: standalone cap in installed coordinates.
- `print-only`: exterior upward, yawed 45° and placed on Z0; underside supports and edge finishing remain necessary.

The product is `reference` / `reference`, so adding it to a project does not create a procurement or fabrication item. Its source dependencies are explicit, and inspection states do not create physical executions. No Grandado package files or controls are imported.

Geometry checks address native validity, one-solid topology, dimensions, source identity, reference-only procurement and print footprint. They do not establish strength, clamp preload, thermal performance, RF performance or aerodynamic drag. The 300 m/s target remains an unqualified design case; a defined environment, material evidence, compressible-flow analysis and physical verification are still required. No flow test, drag coefficient, impact rating or production-release claim is made.
