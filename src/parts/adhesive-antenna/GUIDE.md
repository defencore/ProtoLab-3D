# Adhesive antenna

Find **Electronics → Electronics & vision → Radio modules → Adhesive antenna**.
The family ID is `adhesive-antenna`. The fixed model selector distinguishes the
manufacturer's documented cable-length executions; dimensions are read-only
source data rather than editable design dimensions.

| Qualified model ID           | Manufacturer model | Cable execution |
| ---------------------------- | ------------------ | --------------- |
| `adhesive-antenna:jcg108-3m` | Jinchang JCG108    | 3 m             |
| `adhesive-antenna:jcg108-5m` | Jinchang JCG108    | 5 m             |

These internal model IDs distinguish library configurations. They are not
manufacturer order codes. The source does not establish execution suffixes or
the selected connector's gender and polarity.

## Product and source

The [manufacturer JCG108 datasheet](https://rnrorwxhqioplk5p.ldycdn.com/JCG108-aidqkBpmKjiRliSkjorpnllj.pdf)
identifies **Jiaxing Jinchang Electronic Technology Co., Ltd.**, model
**JCG108**, as a GSM antenna. Its dimension drawing is on page 1; mechanical
and RF specifications are on page 2. The document was reviewed on
**2026-11-01** and has no stated drawing revision. The original CAD was not
available.

The [current manufacturer product page](https://www.jinchanggps.com/JCG108-4G-Antenna-pd46421675.html)
uses **Zhejiang JC Antenna Co., Ltd.** and the title **JCG108 4G Antenna**.
The catalog records that current company name while retaining the original PDF
footer identity. The website's 4G title does not establish bands beyond the
two stated ranges or interchangeability with another JCG108 variant.

The SHA-256 checksums identify the manufacturer files reviewed for this model.

- Manufacturer PDF SHA-256
  `71e07e7e341c0bd8baa98326bab27011891bca7b70d7c0f7dd1bdfd1d31f0cff`.
- [Manufacturer dimension drawing](https://iororwxhqioplk5p.ldycdn.com/cloud/qmBpmKjiRliSkjormnlmj/JCG108.png),
  SHA-256 `95294ea110af143ee015e42f81d1a6b11137d8eb866ba58ebd2f185bdc5ec7b9`.

The complete antenna, attached RG174 cable and fitted connector form **one
supplier procurement unit**. The nominal housing shown in the library is not a
separately purchased radome. No separate quantities or manufacturing records
are inferred for internal antenna elements, cable or connector.

The source specifies two frequency bands, 824-960 MHz and 1710-2170 MHz,
linear polarization, 2.5 dBi zenith gain and 50 ohm impedance. It describes
a PVC radome, adhesive mounting and an **SMA or other** connector. This evidence
does not establish a particular SMA gender, polarity, connector option or
manufacturer order code for either cable length.

## Represented geometry

The dimension drawing establishes the following millimetre dimensions:

| Feature                   | Published dimension |
| ------------------------- | ------------------- |
| Housing length            | 126 ±2              |
| Housing depth             | 8.6 ±1              |
| Main housing span         | 15.5 ±1             |
| Overall central-area span | 16.2 ±1             |

The preview and native CAD are a **nominal housing dimensional reference**.
They use the stated nominal dimensions; they do not reproduce manufacturing
tolerances as editable geometry. The overall reference is
**X126 ×Y16.2 ×Z8.6 mm**, centred in X/Y with a mounting reference at Z=0. The
main housing occupies Y=-7.4 to +8.1 mm; the approximate central boss extends
the nominal envelope to Y=-8.1 mm. These are model datums, not newly established
manufacturer dimensions. The source also gives an internal PCB of
115 ×9 ×0.8 mm; it is catalog metadata and is not displayed as an internal part.

The tapered ends, shallow curved outline and central cylindrical boss are
approximate interpretations of the drawing. Native analytic lines, arcs and
cylindrical surfaces retain those reference shapes without turning preview
triangles into CAD faces. The actual contour, radii and boss diameter are
undimensioned and unverified. Grooves, mould parting lines, lettering, cable
outlet, strain relief, adhesive thickness, flexible cable and connector geometry
are omitted. The displayed shape must not be treated as exact supplier
surfaces, a mating model or evidence of installation clearance.

The drawing labels cable length **L=3M/5M** with a dimension to the connector
end. Cable length tolerances and complete end datums are not specified. The
length selection identifies the documented execution; it does not resize the
housing. Neither the flexible cable nor connector is represented by an invented
solid.

The family uses only the `default` state. No undocumented internal structure,
exploded pose, RF simulation or redesign is included.

## Evidence limits and release status

This entry remains an **engineering reference** (`kind: reference`,
`supply: reference`). Its source identity and nominal housing dimensions are
documented, but the complete mechanical execution is unresolved. It cannot
enter a production specification as a verified purchased model in this state.

Before a fitted mount or enclosure is released, obtain exact-execution CAD,
a complete drawing or measurements of delivered hardware. Confirm the housing
profile and all interface tolerances, adhesive footprint and thickness, cable
exit, strain relief, bend allowance, connector body and mating/removal space.
Select the actual connector execution and obtain its complete order designation.

Supplier environmental and RF values are source claims. This geometry does not
verify installed gain, detuning, radiation pattern, adhesive retention,
environmental compliance or electrical compatibility.

## Verification

Package, catalog, identity, preview and native-CAD checks apply to the represented
nominal housing reference. They do not resolve missing interface dimensions or
qualify the complete antenna. Generated reports and exports belong under ignored
`test-results/`; keep the checked configuration and geometry scope with each
result.

Native verification passed **4/4 configurations**: both 3 m and 5 m selections
in the global Simple and Full geometry modes. Each produced one valid solid,
an overall nominal envelope of **126 ×16.2 ×8.6 mm**, and **11 faces: 4 cylindrical
and 7 planar**. STEP and FCStd round trips passed. These checks establish the
validity and analytic topology of the nominal housing reference; they do not
verify the undimensioned contour or the omitted antenna interfaces.
