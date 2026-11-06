# Lehao AD16-16C panel indicator

SWITCHES & BUTTONS → PANEL CONTROLS. This is one fixed model with five lens appearance choices: red, green, yellow, blue and white. The user confirmed the AD16-16C designation. The colours do not create invented Lehao order codes or imply interchangeable voltage executions.

## Evidence and limits

The [JD search-indexed retailer listing](https://www.jd.com/jiage/670d59f660d70a08559.html), checked on 2026-10-24, names a Lehao-branded AD16-16C panel lamp. The short indexed evidence, translated into English, reads: “Lehao LED working / power signal indicator AD16-16C … red.” An [additional JD indexed listing](https://www.jd.com/jiage/98558181401b33059af3.html?catID=38255&electedExtAttrSet=&extAttrValue=expand_name%2C&sort_type=sort_default) shows red and green choices for the same named product. These are dated search-index observations: the rendered directory may already show different products. They establish a retailer model listing only, not a Lehao manufacturer drawing, an exact order code or current availability.

No Lehao CAD or dimension drawing was found. [Siemens APT's AD16-16C page](https://www.si-apt.com/products/indicator/24) establishes its own nominal 16 mm mounting family and five-colour offering; it does not establish Lehao dimensions, ratings or interchangeability. No Siemens dimensions or electrical claims are attributed to Lehao.

The following dimensions are **assumptions**, not supplier facts:

| Modeled feature                             | Assumed value    |
| ------------------------------------------- | ---------------- |
| Maximum head diameter                       | 19 mm            |
| Overall axial envelope, including terminals | 45 mm            |
| Nominal mounting diameter                   | 16 mm            |
| Front projection from the panel plane       | 5 mm             |
| Plain shank diameter                        | 15.6 mm          |
| Nut outside diameter / bore / thickness     | 18.8 / 16 / 3 mm |
| Two illustrative blade terminals            | 2.8 × 0.5 × 5 mm |

Yellow, blue and white are illustrative appearance choices; their Lehao availability is unverified. They are not separate sourced catalogue records. The single catalogue record verifies only the model identifier, so changing lens appearance or inspection state does not produce a false supplier SKU. No dimension, voltage, current, protection class or colour filter is advertised as a published Lehao characteristic.

## Coordinates and export

Millimetres, Z-up. The origin is the assumed front surface of the panel. The lens faces +Z and the rear terminals extend to Z = −40 mm. The nut sits behind an illustrative 2 mm panel, which is excluded from preview and export. Its position and the underlying thread engagement are not verified installation instructions. The preview and native FreeCAD recipe share the same shape records and independently coloured component order: housing, lens, nut, terminal 1 and terminal 2. The housing is one revolved solid. Exploded view moves the same five physical components for inspection.

Threads, wires, panel, optical internals and electrical circuitry are omitted. No polarity or pin numbering is assigned. Native CAD validity confirms the modeled topology only. Confirm dimensions on the ordered Lehao execution before machining a panel or judging electrical clearance.

## Verification

Run `npm run parts:check -- panel-indicator` and the focused `tests/panel-indicator.test.ts`. The tests verify all five colour configurations, invalid selections, fixed geometry, assembly states, closed preview surfaces, bounds and native component labels. Execute the generated FreeCAD recipe to verify kernel solids independently.
