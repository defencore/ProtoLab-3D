# Clamp-band separation mechanisms

These two reference-inspired mechanisms use editable study dimensions. They are not dimensionally reproduced commercial products or qualified release devices. The existing Rocket Release Mechanism entry remains independent.

## Reference scope

The [REXUS figure](https://www.researchgate.net/figure/Separation-mechanism-clamp-band_fig1_335946613) accompanies Pepermans et al., _Flight testing of parachute recovery systems aboard REXUS_ (2019). It shows a tension band, distributed blocks, a tensioner and a cutter-actuated release. The catalogue adaptation uses hinged clamp halves and a withdrawing pin. It does not reproduce the cutter, the original tensioner or its performance.

The additional supplied illustrations inform the alternative with captive jaws and an inner split ring. Their dimensions are not verified. The supplied airbrake article, DOI 10.3390/jcs5060147, is not a dimensional source for either mechanism.

## Constraint and release sequence

**V-clamp band:** fork and tongue fittings share bored hinge and latch axes. The hinge remains captive. The removable latch pin withdraws 20 mm at the 90 mm reference size during 0–15%, clearing both the fork and the upper spring arms before either clamp half rotates. Its withdrawal distance scales with interface diameter. The fork bores guide the engaged pin; there is no tall guide sleeve in the spring-arm sweep. During 15–55%, both halves open 20 degrees about the rear hinge. The V profiles are relieved around the interface lips. Rivets have clearance holes in both strips and clamp blocks. The withdrawn pin is displayed above its former latch position; a powered withdrawal actuator is not modeled.

**Captive jaws:** each jaw has a bored circular pivot boss, a fork on the lower carrier and a heel stop below the interface. Radial windows clear the heel's swept path. The split locking ring is held in three C-shaped guides between jaw stations. Its neutral-axis arc length remains constant as its gap closes; paired links of constant length connect the ends to a guided screw trunnion. During 0–25%, the ring contracts clear of the heels. Only then do the jaws rotate outward, reaching 42 degrees at 55%. The actuator connection is nominal mechanical geometry; elastic-ring forces and jaw-opening torque are not simulated.

Both layouts lift the upper interface during 55–100%. Percentages are positional stages, not a time law. The Released view selects the final position. Interface inspection lifts the upper interface separately for visibility and is not an operating position.

## Spring cartridges and support

Six spring stations lie outside the clamp movement envelope. Their arms are integral with the upper and lower interfaces. Each station includes:

- An open-top guide sleeve with a lower shoulder and a retaining collar at the carrier.
- A spring around a central plunger, with room for its full wire section between seat faces.
- A plunger head contacting the upper arm and a lower stop that cannot pass through the sleeve's guide bore.
- An 8 mm stroke at the 90 mm reference size, scaled with interface diameter. After this stroke the plunger stops and the upper interface continues separating.

The spring radius, guide bore and full stroke are checked together. Cartridges are outside the entire clamp opening envelope, increasing the external size. The nominal 90/86 or 160/150 values describe only the mating interface, not the full assembly. The pivot frame extends farther below the interface to accommodate heel stops, ring guides and the trunnion without crossing the flange.

## Export and verification

The preview and FreeCAD recipe use the same component descriptions and placements. Intended integral supports are fused into their parent interface; pins and sleeves remain independent solids. Native CAD interference checks compare component common volumes at sampled operating positions. The optional regression test runs when `FREECAD_PYTHON` points to a Python executable with `FreeCAD` and `Part` available; `PYTHONPATH` may be needed for the installation.

These checks establish sampled geometric clearance, not structural or release reliability. Spring rate, preload, ring fatigue, actuation force, friction, fits, lubrication, retention strength and loaded release still require specification and physical testing. Threaded fittings are nominal envelopes without helical thread detail. Material labels are provisional. The export is not a finished machining drawing; no TechDraw sheets are generated.
