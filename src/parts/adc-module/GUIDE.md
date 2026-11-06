# Analog input module

Library entry: `adc-module:cjmcu-1220`.

Selected purple CJMCU-1220 board. The seller identifies ADS1220 / code 102300-2 but supplies no dimensioned drawing. The adopted 22 × 21 mm PCB, 1.6 mm thickness, 0.6 mm corner radius and 5 × 5 × 1.2 mm illustrative chip are provisional; no mounting holes or pad locations are invented. Native Z0 is the assumed board underside. Loose headers and wires are excluded. Measure the delivered board, component height and soldered harness before fabrication. This is an installation reference, not verified supplier CAD, a pinout or a complete electrical design.

Source: [selected supplier listing](https://prom.ua/p2527653228-bitnyj-analogo-tsifrovoj.html). Reviewed 2026-11-02. The same library definition is used by the SAC-01 case-panel configuration of `servo-toggle-actuator`; repeated occurrences remain one supplier product definition. The model selector is fixed and there are no editable source dimensions or invented numeric catalog ratings. Only Assembled is implemented because no source-qualified internal decomposition is available. Native CAD uses analytic extrusions and straight boxes, with circular corner arcs retained independently of preview tessellation.

Native CAD verification (2026-11-02): the assembled `adc-module:cjmcu-1220` shape is valid and closed, with 1 solid(s), 15 faces and only planar/cylindrical surfaces. Its 22 × 21 × 2.8 mm bounds match the adopted model. STEP round-trip retained all six solids across the five reviewed devices. Reports and exported CAD are under ignored `test-results/standalone-device-verification/`. This verifies the model topology and adopted dimensions; it does not resolve the documented missing supplier interfaces.
