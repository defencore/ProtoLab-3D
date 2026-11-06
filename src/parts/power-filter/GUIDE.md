# Power supply filter

Library entry: `power-filter:iflight-lc-filter-16x6`.

Selected seller version with an adopted 16 × 6 × 3 mm external envelope. The 1 mm PCB thickness, 0.35 mm corners and central 10 × 4 × 2 mm component volume are unverified. Native Z0 is the assumed board underside. No mounting holes, terminal coordinates or wire geometry are invented. Do not substitute the larger current iFlight revision without checking its fit. Confirm the delivered revision, copper-free retaining lands, solder joints, insulation and component height. The model does not qualify filter behavior, electrical ratings or the completed circuit.

Source: [selected supplier listing](https://prom.ua/p2956989595-filtr-pitaniya-iflight.html). Reviewed 2026-11-02. The same library definition is used by the SAC-01 case-panel configuration of `servo-toggle-actuator`; repeated occurrences remain one supplier product definition. The model selector is fixed and there are no editable source dimensions or invented numeric catalog ratings. Only Assembled is implemented because no source-qualified internal decomposition is available. Native CAD uses analytic extrusions and straight boxes, with circular corner arcs retained independently of preview tessellation.

Native CAD verification (2026-11-02): the assembled `power-filter:iflight-lc-filter-16x6` shape is valid and closed, with 1 solid(s), 15 faces and only planar/cylindrical surfaces. Its 16 × 6 × 3 mm bounds match the adopted model. STEP round-trip retained all six solids across the five reviewed devices. Reports and exported CAD are under ignored `test-results/standalone-device-verification/`. This verifies the model topology and adopted dimensions; it does not resolve the documented missing supplier interfaces.
