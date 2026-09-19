# Open-frame solenoid

An editable prototype solenoid with a connected steel C-frame, two or four real rear mounting holes, bobbin, copper winding envelope, guide sleeve, fixed pole and sliding plunger. The optional push rod belongs to the moving plunger as one solid. The copper is an envelope rather than a modeled wire winding.

The frame uses a stationary datum at `z=0`, with its axis along Z and rear web at negative Y. Frame length extends to positive Z; the fixed-pole shoulder extends below the datum by one frame-wall thickness. Extended and retracted states move only the plunger. Retraction leaves the chosen positive pole gap; extension adds exactly `stroke` and must retain at least one plunger diameter (minimum 2 mm) of guide engagement. Dimensions include all visible geometry in the selected state.

`body` exports the frame alone. `exploded` separates the six physical components without cutting them. Every component exports as one valid independent FreeCAD solid with matching preview and native positions, labels and colors. All geometry uses package-local helpers and the generic SDK.

Five complete prototype presets show small, standard, long-stroke, push-rod and four-hole mounting variants. No preset claims a supplier match or electrical, force or thermal ratings. Manufacturing tolerances, winding specification, electrical connections, return spring and fastening details are outside this envelope model.

Edit numeric controls and defaults in `configurator.ts`, geometry and relational validation in `part.ts`, primitive conversion in `lib/shapes.ts`, and examples in `presets.json`. Run `npm run parts:check -- open-frame-solenoid`, appropriate geometry tests, and native FreeCAD verification before handing off geometry changes.
