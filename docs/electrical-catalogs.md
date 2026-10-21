# Switches, terminals and connectors

The library includes 78 fixed catalog configurations in three families. Use the model catalog filters to choose an article; mounting dimensions and contact pitch belong to the selected model and cannot be stretched.

| Location                                       | Family                                                           | Configurations | Coverage                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electronics → Switches & buttons               | [Toggle switches & buttons](../src/parts/panel-switch/GUIDE.md)  | 24             | Maintained and momentary toggles, illuminated DAIER ASW-07D with optional SAC-01 cover, guarded APEM toggle, rockers, rotary selectors and buttons  |
| Connectors & interfaces → Laboratory terminals | [Laboratory terminal](../src/parts/laboratory-terminal/GUIDE.md) | 19             | 2/4 mm banana interfaces, stacking plugs, dual binding posts, recessed jacks, speaker clips, spring posts, WAGO 221 and Phoenix Contact screw plugs |
| Connectors & interfaces → PCB connectors       | [PCB connector](../src/parts/signal-connector/GUIDE.md)          | 35             | USB A/C/Micro-B/Mini-B, JST XH/PH, DC barrel, TRS audio, SMA/MMCX/U.FL, pin/socket strips, IDC and DE-9                                             |

The existing AMASS power-connector catalog remains under **Power & industrial**. Editable prototype panel buttons, knobs and beacons share **Electronics → Switches & buttons** with the identified switch catalog, while retaining their independent product identity and prototype scope.

Open **Electronics → Switches & buttons → Toggle switches & buttons** for the fixed switch catalog. It is the first category in Electronics; the switch and editable panel-control families are listed directly inside it.

The separate [Servo toggle actuator example](../src/parts/servo-toggle-actuator/GUIDE.md) combines an ST3215 12 V servo and bare ASW-07D with a three-part printed mounting and rotary rocker that returns to neutral after switching. A guided fork with shafts and soft pads remains available as an alternative. Its editable mounting settings describe a custom prototype assembly, outside the fixed purchased catalog counts above.

## Choosing a model

Filter switches by circuit, maintained/momentary action, actuator, terminal count, mounting interface and protective cover. Inspection positions do not turn a two-position switch into a three-position execution. The guarded APEM and DAIER configurations combine a matching switch and separately ordered cover; opening the cover and moving the actuator are supported inspection poses. DAIER ASW-07D has two switch blades and a third lamp-ground blade. Its red, green, yellow and blue options change the indicator and transparent SAC-01 cap.

The bare DAIER installation control moves its upper locking nut for a 0.3–4 mm panel. The panel rear plane is at local Z=3 mm above the case datum; manufacturer-owned switch dimensions stay fixed.

Text searches inside fixed catalogs match the selected articles' own characteristics and references. Family navigation keywords locate the catalog without making every model match; for example, `guard` returns the two guarded toggles and `USB` excludes JST headers. Ukrainian switch, toggle, button and protective-cover queries also locate and filter the catalog.

Filter laboratory terminals by connection type, contact diameter, number of entries, mounting and fitting dimensions. Banana diameter differs from panel-hole diameter. WAGO 221 entries share one electrical potential; they are not independent circuits. The CLIFF spring-clip terminals include wire entries, release tabs and mounting holes. Contact count and terminal pitch are kept separate from package quantities.

PCB connectors retain their source PCB origin and solder-tail positions. JST XH uses 2.50 mm pitch, PH uses 2.00 mm, and generic headers use 2.54 mm. A TRS audio connector has three signal poles even when its switched execution has four or five solder terminals. Barrel mating-plug class and actual center-pin diameter are documented separately. A mating plug and cable-bend clearance are not included in the source connector body.

## Geometry evidence

Switches and laboratory terminals are reconstructed from linked manufacturer drawings and dimension tables. Their guides identify verified dimensions and illustrative details. The two APEM switch/cover configurations explicitly use envelope/image-based details where a complete dimensioned source is unavailable.

DAIER mounting interfaces follow the [ASW-07D-1](https://www.chinadaier.com/wp-content/uploads/2018/05/ASW-07D-1.pdf) and [SAC-01](https://www.chinadaier.com/wp-content/uploads/2018/05/SAC-01.pdf) drawings. Undimensioned cover curves, wall thickness, hinge details and installed guard adjustment remain illustrative; the guide records these limits. Preview transparency is illustrative, while native export retains the same surfaces and RGB colours.

PCB connectors retain the native surfaces and original coordinates of pinned KiCad 9.0.1 community STEP models, including 119 valid source solids. File URLs, SHA-256 hashes, native BRep hashes, upstream credits and license information are stored with the package. Community CAD is identified as a reference source, not original manufacturer CAD. Model records link supplier drawings where available. Generic pin strips, IDC and DE-9 references do not establish a supplier order code.

The **Community CAD** badge distinguishes retained reference geometry from reconstructions. Complete uniform STEP surface colors are preserved for 87 solids; the other 32 use explicitly recorded illustrative colors. Color evidence accompanies the source reference download; unchanged geometry fingerprints are stored with the package.

The KiCad SMA 132291 references omit the female center-contact bore. This limitation is visible in the model assessment, source download and evidence record. They are not RP-SMA variants or tolerance-controlled mating tools. No unspecified current, voltage, USB speed or RF impedance is inferred from the shape.

Each family's guide describes its panel/PCB datum, mounting features, omitted internals and native export scope. The model/source download includes the chosen identity and references for designing an enclosure or carrier.

## Verification

```sh
npm run parts:check
node --import tsx --test tests/panel-switch-catalog.test.ts tests/laboratory-terminal-catalog.test.ts tests/signal-connector-catalog.test.ts tests/electrical-catalog-search.test.ts tests/library-categories.test.ts tests/model-evidence.test.ts
node --import tsx scripts/verify-electrical-catalogs.ts
# Use an isolated Python runtime with FreeCAD and Part available:
python scripts/verify-electrical-catalogs.py /tmp/protolab-electrical-catalogs-cases.json test-results/electrical-catalogs-validation.json
```

The native audit checks preview/native bounds and volume, closed positive solids, independently movable components, and STEP/FCStd round trips. Authored components must not intersect. Any inherited overlap in retained community geometry is reported without altering the source. These checks establish geometric consistency; they do not certify electrical ratings or interchangeability with another supplier execution.

The stored native report (local output: `test-results/electrical-catalogs-validation.json`) contains 179 passing cases and 1,410 component occurrences, including the ASW-07D installation-thickness bounds. Maximum preview/native envelope difference is below 0.010 mm and relative volume difference below 0.682%. The report retains 46 inherited housing/contact overlap pairs in the community connector sources; no such overlaps remain in the authored switch and terminal cases.
