# Selecting mechanisms and assemblies

The screw-driven rotary mechanism catalog selects an existing construction and a matching configuration. It groups the physical definitions for browsing while retaining their separate identities, components and exports.

Browse by mechanism type, then choose an implementation inside it. For example, the tree path is `Library > Motors & actuators > Motor assemblies > Worm-sector actuator`; its configurations and component summary identify `TR8×8(P2)`, bearings and travel. Likewise, `Servo toggle actuator` is the navigation title, while `ST3215` and `ASW-07D` identify the installed components. Navigation labels do not rename the physical assembly, presets or exported product.

| Filter                | Meaning                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Screw type            | Ball screw or trapezoidal lead screw.                                                                                                           |
| Screw model           | Exact configured designation, including the lead and pitch notation where known.                                                                |
| Motor model           | A documented motor used by the construction. Preset names identify its configured reduction, voltage or winding where available.                |
| Outputs               | Number of independent mechanical outputs.                                                                                                       |
| Component material    | A documented material of structural or transmission components, including sourced nuts; mixed assemblies can match more than one material.      |
| Manufacturing process | A documented process for custom details, such as laser cutting or machining.                                                                    |
| Screw lead            | Inclusive minimum and maximum axial travel per revolution, in millimetres. Either bound can be left open; decimal commas and dots are accepted. |
| Search                | Component models, construction and other documented characteristics.                                                                            |

Facet counts respect the other active constraints. A combination must exist within one preset: selecting one screw alternative cannot borrow characteristics from another. Selecting a filtered result applies its matching configuration. The current configuration remains visible separately when it falls outside the filters, and individual filter chips or **Clear filters** remove constraints.

Names and summaries retain the important physical distinctions. Examples include `SFU1605-4 · 2× MGN12H · 300 mm axis`, `Motor-and-screw actuator · 100 mm stroke · Ø12 mm rod`, and `TR8×8(P2) worm sector · F6802ZZ/F688ZZ · ±20°`. Axis length is not usable travel, screw lead is not thread pitch, and motor winding KV is not an output torque rating.

Other assembly preset browsers expose their static characteristics, such as guide size, screw diameter and lead, stroke, mounting dimensions and bearing choice. Inspection position, input revolutions, rod extension, switch stage and output angle are excluded from selection filters where they describe the same product in a different pose. They remain available as configuration or inspection controls.

Unknown motor models, material grades and performance ratings are not inferred. Prototype examples remain examples, and original supplier designations and evidence remain available independently of the curated names.
