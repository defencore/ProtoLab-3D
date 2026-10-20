# Internal threads in nuts

All eleven nut families support the library's Simple/Full modes: hex, thin, coupling, high, square, flange, nylon insert lock, all-metal lock, domed cap, wing and lifting eye nuts. Simple uses smooth nominal-diameter bores for lighter previews and TechDraw. Full displays thread relief and creates actual internal helical faces in FreeCAD. STL downloads always use Simple geometry. The FreeCAD part label includes the metric thread designation; manufacturing properties retain diameter, pitch, handedness and thread span in both modes.

The Simple bore is a **thread envelope**, not a tap-drill size or a clearance-hole instruction. Specify thread fit class and machining depth on the drawing. Full uses an authored 60° reference profile; it does not establish a tolerance class. The nylon insert retains its undeformed smooth bore and is exported separately from the metal body. Changing metric diameter selects its coarse pitch; an explicit source pitch takes precedence.

`tests/nut-threads.test.ts` verifies source presets, size-specific pitches, Simple bore radii, handedness callouts and closed mesh boundaries. The thread-representation and geometry-mode tests check native solids, saved callouts and projection of simplified metal parts. The library-script audit executes complete macros in both modes, including valid diameter boundary cases.
