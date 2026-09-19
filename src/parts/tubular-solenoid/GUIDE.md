# Tubular solenoid

Self-contained prototype package for a tubular linear electromagnetic actuator.

The steel housing is centered at `(0, 0, 0)` with its length along Z. The rear pole is at negative Z. Pull action places the output rod through the front plate at positive Z; push action places it through the rear pole at negative Z. In both constructions magnetic attraction would move the armature toward the rear pole. No force or electrical performance is calculated.

`retracted` and `extended` describe the output rod. In the extended state its protrusion is `extension + stroke`; only the single moving armature/rod solid translates, by exactly `stroke`. In the exploded state the retracted components are separated along X for inspection, and the housing origin stays fixed.

The package creates independent housing, rear pole, front plate, guide sleeve, coil envelope and one-piece armature/rod solids. Enabling terminals adds two insulated feedthrough sleeves and two copper pins. Pin ends meet the coil envelope; no electrical circuit or individual windings are represented. Native FreeCAD component labels and colors match the preview order.

All supplied presets are complete fictional prototype dimensions, not sourced commercial products. They span pull/push actions, two connection styles and several body sizes. There are no claims about voltage, current, force, duty cycle or performance. The design does not include a return spring.

Validation checks positive housing/coil space, full-stroke axial room, armature guide engagement, output shaft clearance and terminal positions inside the coil annulus. `clearance` sets radial running clearance and the minimum axial end gaps. All hidden terminal values remain required finite parameters. Reported dimensions include every protrusion in each state.

Use `npm run parts:check -- tubular-solenoid` to check the package contract and presets. Native geometry should also be verified with the application's FreeCAD export checks after editing the solids.
