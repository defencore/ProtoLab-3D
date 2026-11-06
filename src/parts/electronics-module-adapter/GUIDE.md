# Electronic module adapters

Find this family under **Electronics → Electronics mounts → Electronic module adapters**. Each selection is one small manufactured insulating detail; PCB, straps, nuts, screws and the universal base are separate items.

The **Universal horizontal** and **Universal upright** presets expose PCB width, length, thickness, side allowance and support height. Both templates use four feet on the **20 mm M3 grid**. X spans use 20 mm increments; Y row spacings are **20, 60 or 100 mm**, keeping the central horizontal strap lane between the base-node rows. The upright length parameter is the PCB's vertical dimension. Changing a PCB fit does not scale the grid holes or the purchased PCB.

The seven **case adapter** presets reuse the exact authored shapes from the INTERTOOL case: Bus Servo Driver HAT (A), Heltec V4 / LoRa32, ADS1220 / CJMCU-1220, the two BEC converters and the two LC filters. Their fitted lands and offsets remain fixed. Use a universal preset to develop a different board rather than scaling a fitted adapter. Export the selected adapter directly through the normal STL or FreeCAD controls; building the complete case is unnecessary.

## Mounting interface

- M3 clearance bores: **Ø3.4 mm**.
- Feet: **2 mm** bearing web, with **Ø9.6 mm** exterior pads.
- Nut pockets: **AF5.8 mm** for ordinary nominal AF5.5 × 2.4 mm M3 nuts.
- Pocket opening is above the foot. It resists nut rotation; it does not retain an unfastened nut axially. Keep the adapter upright and hold the nuts during underside screw installation.
- On the matching case base, M3×8 socket screws enter from below through its recessed heads and 2.9 mm load web. A 2 mm adapter foot gives 4.9 mm grip, full nut engagement and nominal 0.7 mm thread beyond the nut.

The universal horizontal cradle has an open centre and bare-edge support rails. The upright stand has a windowed wall, PCB lower ledge and direct triangular gussets at its outer edges. Its horizontal wrap ports sit outside the PCB edges, with the rear bands passing between the gussets. Boards shorter than 12 mm use one central wrap; longer boards use two separated wraps. Both have ports for at most 2.5 × 1 mm nylon ties. A universal cradle assumes usable bare PCB edges; it does not infer clear pads, component positions or thermal suitability. Supply a pressure-spreading keeper where required by the delivered module. The fitted case variants have their own separate retainers. The HAT variant also takes four PCB-mounting M2.5 nuts through its side slots before adding the board; these are separate from the top-loaded M3 base nuts.

Print the mounting-foot plane on the bed. The selected shape has no base plate belonging to the entire case. Inspect the fit and remove any local support from nut entries and strap ports before adding hardware. Wide upright templates may also need support under the horizontal roof of their window. Material, layer strength, fastener torque and module temperature require qualification on the actual assembly.

Square mounting coordinates support 90-degree orientation changes, subject to available neighbouring structure, connector and wiring space. Keep switching power and PWM away from sensitive analogue inputs. The grid alone does not establish electromagnetic compatibility, handling load or ingress protection.

The shared-grid and disassembly concept follows established modular practice, including [OpenStructures](https://openstructures.net/sites/default/files/2019-08/os_manual_4.3.pdf). This is a case-specific M3 interface, not a claim of certified compatibility with that system.
