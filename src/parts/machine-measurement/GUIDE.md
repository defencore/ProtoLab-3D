# Machine measurement sensors

The Kuebler MWE21 reference uses a polyurethane wheel with 200 mm circumference and a Sendix KIS40 encoder configured for 1000 pulses/revolution. With quadrature decoding the nominal increment is 0.05 mm. Calibrate effective circumference on actual material; wheel slip, coolant and contact preload affect accuracy. The arm contour and mounting pattern are planning geometry, not a substitute for the ordered assembly drawing.

OMRON E3Z-T81 is a PNP through-beam pair. Use an emitter and receiver on rigid, adjustable brackets. The model shows the published 10.8 x 20 x 31 mm case and 25.4 mm mounting pitch. Ordinary optical sensors confirm part presence and transfer, not precision cut length or personnel protection.

OMRON E2B-M12KS04-WP-B1 2M is a short M12 inductive sensor with a nominal 4 mm sensing distance and 47 mm body. The displayed mounting nuts and smooth M12 body support assembly planning. Confirm target material, gap, wiring and output behavior from the supplier manual.

## Separate supplier identities

Existing IDs `machine-measurement:mwe21-200`, `:e3z-t81` and `:e2b-m12` remain stable. Added `:e3z-t81-l` and `:e3z-t81-d` distinguish the separately identified OMRON E3Z-T81-L 2M emitter and E3Z-T81-D 2M receiver; the official dimension page explicitly states that the unsuffixed E3Z-T81 designation is the pair. Saw paired beam occurrences link the corresponding L/D source entry rather than identifying each half as a complete pair. The legacy pair selection still shows one reference body and states its scope. Existing single-body chute/scrap references are identified as receivers; a complete sensing installation still requires a verified paired emitter and optical path.

Measurement constructors attach qualified supplier source references before assembly placement. The family retains its reference product profile, so installed geometry remains a purchased recipe with a SourceLibraryEntry note, rather than an unsupported physical occurrence targeting a reference definition. E2B remains one sensor with its display nuts and cable tail, MWE21 remains one configured measuring assembly, and each E3Z half is one supplier product. Source geometry limitations remain explicit and no safety function is inferred.

The added exact E3Z halves and existing exact E2B selection pass generated FreeCAD 1.1.4 solid validity, preview/native bounds and baseline STEP/FCStd identity round trips. Their three cases are included in ignored `test-results/assembly-supplier-models/native-report.json`. These checks verify retained installation geometry and identities, not the unmodeled cables or optical construction.

## `machine-measurement:e3z-ll81`

The band saw’s side optical sensor is independently searchable as OMRON E3Z-LL81. The [manufacturer specification](https://www.ia.omron.com/products/family/1747/specification.html) distinguishes its PNP distance-settable BGS laser principle from the E3Z-T81 through-beam pair. The [dimension page](https://www.ia.omron.com/products/family/1747/dimension.html) is retained as the mechanical source. The existing band-saw plain 10.8 × 20 × 31 mm occupied body remains unchanged; mounting holes, optics, controls, cable exit and pre-wired cable are omitted. The standard manufacturer cable length is 2 m, but no actual assembly cable execution or route is verified. The Prom catalogue link does not prove a confirmed seller or stock.

The standalone model remains an engineering reference. The installed plain body is now explicitly purchased rather than inheriting the generic box helper’s manufactured classification; its procurement record and SourceLibraryEntry identify the actual sensor without pretending the incomplete body is a full source-qualified library occurrence.
