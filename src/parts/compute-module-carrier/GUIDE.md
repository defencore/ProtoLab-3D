# Compute module carrier boards

Bare purchased carrier boards for **Raspberry Pi Compute Module 5**. Find this family under **Electronics → Single-board computers**, or search for `CM5`, `CM5IO`, `carrier` or `CM5-IO-BASE-A`.

| Model | PCB X × Y | Mechanical source |
| --- | --- | --- |
| [Raspberry Pi Compute Module 5 IO Board, revision 2](https://www.raspberrypi.com/products/compute-module-5-io-board/) | 160 × 90 mm | [Official revision 2 KiCad design archive](https://pip.raspberrypi.com/categories/1098-design-files), including footprint coordinates and connector reference models. |
| [Waveshare CM5-IO-BASE-A](https://www.waveshare.com/product/cm5-io-base-a.htm) | 85 × 56 mm | [Manufacturer STEP archive](https://files.waveshare.com/wiki/CM5-IO-BASE-A/CM5-IO-BASE-A-3D.zip), file `CM5-IO-BASE-A-20250225.stp`, and dimensioned product drawing. |

Select the board model rather than resizing it. Choose the compute module separately from the **Raspberry Pi single-board computer** family, which includes the 32 CM5 RAM, storage and radio variants. The carrier presets contain neither a CM5 nor a cooler, inserted microSD card, M.2 drive, case or loose cables.

## Mounting datum

The PCB centre is XY(0, 0), with X right and Y up when viewed from above. Z=0 is the PCB underside. Mounting bores pass through the PCB; connector solder tails and GPIO tails below the PCB are omitted.

- **Official IO Board:** eight carrier mounting bores and four separate CM5 bores, all diameter 2.7 mm. The CM5 outline is rotated 90 degrees and centred at (20, 17.5) mm. Its four mounting bores are (3.5, −6.5), (36.5, −6.5), (3.5, 41.5), (36.5, 41.5) mm.
- **BASE-A:** four carrier bores on a 58 × 49 mm pattern and four separate CM5 bores on a 48 × 33 mm pattern, all diameter 3 mm. The CM5 outline is centred at (−6.95, 0.65) mm. The underside CR1220 holder, microSD socket and FFC connectors require clearance below the board.

The two board-to-board sockets are shown at their source positions. For a CM5 mounted with the nominal 1.5 mm connector stack, its PCB underside is 1.5 mm above the carrier PCB top. Actual connector execution and module/cooler height must agree with the selected hardware.

## Geometry scope

These are lightweight **source-dimension reconstructions**, not original manufacturer CAD. The repository contains authored geometry recipes and measured numeric references. Downloaded STEP files, inspection exports and reports stay under ignored `test-results/`.

PCB outlines, bores and major connector envelopes follow the selected source revision. Connector cavities, individual GPIO contacts, colours and undimensioned details are illustrative. Small components, traces, solder fillets and pin tails are omitted. The official IO Board includes ten measured STEP envelopes and five KiCad footprint XY envelopes with approximate component heights; its nominal 1.6 mm PCB follows the general KiCad field, while the source stackup export is 1.51 mm. Source connector bodies are seated on the nominal PCB face. BASE-A corner radius 3.5 mm follows CAD tangent geometry rather than a dimensioned radius callout. Native CAD evidence and limits are recorded per preset.

The official design archive retains its original component model licensing and notes that some reference models are approximate. No third-party STEP or BREP payload is redistributed in this package.

**Board** shows the installation reference. **Exploded** separates the PCB and connector envelopes for inspection; it does not imply that the purchased connectors are separate procurement units.
