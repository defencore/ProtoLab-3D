# Internal threads in nuts

All eleven nut families use smooth nominal-diameter bores in the browser, STL and FreeCAD: hex, thin, coupling, high, square, flange, nylon insert lock, all-metal lock, domed cap, wing and lifting eye nuts. The FreeCAD part label includes the metric thread designation. Manufacturing properties retain diameter, pitch, handedness and nominal thread span without helical faces.

The displayed bore is a **thread envelope**, not a tap-drill size or a clearance-hole instruction. Specify thread fit class and machining depth on the drawing. The nylon insert retains its undeformed smooth bore and is exported separately from the metal body. Changing metric diameter selects its coarse pitch; an explicit source pitch takes precedence.

`tests/nut-threads.test.ts` verifies source presets, size-specific pitches, constant bore radius, handedness callouts and closed mesh boundaries. The thread-representation tests check native solids, saved callouts and projection of simplified metal parts. Historical detailed-thread validation reports do not describe the current symbolic representation.
