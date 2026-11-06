# RF bulkhead pigtail

Find **Connectors & interfaces → Cable entry → RF bulkhead pigtail**. The fixed purchased article is Amphenol **095-902-545-100**: standard-polarity SMA female front-mount bulkhead to right-angle AMC, 100 ± 3.81 mm long with 1.13 mm micro-coax. The complete cable assembly is one procurement unit; the six visual solids are not separate purchase requests.

The [manufacturer cable drawing](https://www.amphenolrf.com/en-us/assets/file/4068032676/) specifies an 11 mm wrench flange, front-to-seat distance 8.49 mm REF and seat-to-rear distance 10.01 mm REF. The flange and O-ring seat outside the panel; the washer and retaining nut fit inside. Local +Z faces outward and the flange rear seat is Z=0. The single D-flat faces +Y. With a −90° rotation about X, the connector faces global +Y and the flat faces downward.

Use the specified Ø6.60 mm opening with one flat and 6.10 mm total height. The flat lies 2.80 mm from the opening centre; it is not a pair of opposing flats. The connector's own D-flat total height is 5.85 mm. Apply the delivered hardware and process tolerances before cutting a final panel.

This is an analytical packaging model, not original supplier CAD. The flange thickness, nut, washer, seal groove, compressed seal and female socket interior are approximate. Its inner hardware envelopes are an 8 mm AF × 1.6 mm nut and Ø10.5 × 0.5 mm washer. The recessed compressed O-ring occupies Z=0..0.4 mm in a matching flange groove; the rigid geometry does not overlap the host panel. It does not predict real seal compression or sealing performance.

The assembly drawing's nut-wrench label is inconsistent with its thread. A [similar 132397 connector drawing](https://www.amphenolrf.com/en-us/assets/file/4065786566/) specifies an 8 mm nut and maximum panel thickness of 6.35 mm, but the [current product page](https://www.amphenolrf.com/en-us/part/132397/829/) lists 2.30 mm. The assembly drawing does not identify that connector in its BOM. The 0.8–2.3 mm panel control therefore positions approximate installation hardware conservatively; it does not establish the purchased kit's permitted panel range. Measure the actual nut, washer, seat and usable thread.

Only the bulkhead end and its hardware are exported. Flexible coax, the 12.70 ± 1.27 mm heatshrink and the remote AMC plug are omitted; route these separately without loading the board socket. [Amphenol documents AMC compatibility with Hirose U.FL and I-PEX MHF I](https://www.amphenolrf.com/en-us/products/rf-cable-assemblies/amc-cable-assemblies/). Do not substitute MHF4 or RP-SMA by appearance.

The supplier specifies 50 ohm and DC–6 GHz for this assembly. Select the antenna for the actual radio band, regional configuration and standard SMA female interface. No RF mating, retention, torque or sealing qualification is derived from this geometry; an IP67 component does not establish an enclosure rating.
