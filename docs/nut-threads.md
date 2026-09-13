# Internal threads in nuts

All eleven nut modules use modeled internal threads by default: hex, thin, coupling, high, square, flange, nylon insert lock, all-metal lock, domed cap, wing, and lifting eye nuts. The configurator also provides a smooth nominal envelope for lightweight layouts, editable pitch, and right- or left-hand threads.

The internal bore follows the basic 60° metric profile. Its minor diameter is `D1 = D − 5√3 P / 8`, with a truncated root and crest. Both the sampled browser surface and the FreeCAD helical cut use this profile. It is a geometric reference without manufacturing tolerances, thread runout, lock-nut deformation, or material-dependent allowances. The nylon insert retains its undeformed smooth bore; the surrounding metal body carries the thread.

Changing a nut's metric diameter selects its coarse pitch. Supplier presets receive a pitch based on their own diameter, including M2 × 0.4, M3 × 0.5, M4 × 0.7, M8 × 1.25, M36 × 4, and M42 × 4.5. An explicit source pitch takes precedence. Inferred coarse pitches are not marked as supplier-verified dimensions. Normalizing complete configurations before deduplication prevents the added thread fields from duplicating existing presets.

Reference: [Bossard metric ISO thread dimensions and coarse pitches](https://www.bossard.com/-/media/bossard-group/website/documents/technical-resources/en/f-079-en.pdf).

The exported metal nut is one solid, including the flange or cap. A nylon insert lock nut exports a separate metal body and nylon insert, labeled for the FreeCAD assembly exporter. The browser's wing and eye meshes conform Boolean junctions within 0.2 micrometre to preserve closed STL shells.

`tests/nut-threads.test.ts` verifies size-specific defaults, source configurations, helical bore occupancy, the minor diameter, handedness, smooth envelopes, and closed wing/eye boundaries at stock size extremes and a custom fine left-hand pitch. Existing hardware, configuration, and catalog tests cover the remaining nut meshes and preset round-trips.

Native verification in [the recorded validation results](../data/nut-thread-validation.json) passed 21 cases and 632 thread-occupancy probes. Every CAD and STEP solid was valid and closed with the expected physical component count. Standard nut preview/CAD volumes differed by less than 0.04%; wing nut differences were below 0.1%. The existing tessellated lifting-eye envelope differs from its analytical CAD torus by at most 1.2%, while all thread probes agree.
