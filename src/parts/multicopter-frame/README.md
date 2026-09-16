# Multicopter frame

Find under **VEHICLE STRUCTURES → MULTICOPTERS**. Choose **Frame configuration** to select Quad +/X/H/V/Y, Hexa +/X/Y6/LY or Octa +/X/X8.

Frame configurations follow Figure 4 in Takva & İlerisoy (2023), DOI 10.2478/acee-2023-0004. +X is the nose, +Y is left, +Z is up. Motor circle diameter is twice the distance from the origin to a motor axis, including Y layouts without opposite motors. Quad V has separate front/rear angles. Quad Y has a rear coaxial pair; Y6 and inverted-Y LY have three pairs; X8 has four pairs. Coaxial gap is the clear distance between mounting plates, not rotor spacing. H beams form one structural component. Arm numbers are geometry labels, not flight-controller motor numbers. Dimensions and joints are editable design examples; the source diagram provides topology only. Product presets verify only their listed dimensions. No motors, propellers, tilt mechanisms, hardware or electronics are included. These are layout references, not interchangeable replacement frame parts.

## Presets

- Custom Quad + · 500 mm
- Custom Quad X · 500 mm
- Custom Quad H · 500 mm
- Custom Quad V · 500 mm
- Custom Quad Y · 500 mm
- Custom Hexa + · 500 mm
- Custom Hexa X · 500 mm
- Custom Hexa Y6 · 500 mm
- Custom Hexa LY · 500 mm
- Custom Octa + · 500 mm
- Custom Octa X · 500 mm
- Custom Octa X8 · 500 mm
- Custom Quad X · 100 mm
- Custom Hexa X · 650 mm
- Custom Octa X · 900 mm
- GEPRC MARK5
- Holybro X500 V2
- Holybro X650 V2

## Geometry and export

Flat and tubular construction share the same source geometry for browser preview and native FreeCAD export. Separate named solids, assembly, bottom-plate and exploded states are supported. Source-backed product presets list exactly which dimensions were verified. Dimensions from generic examples remain design assumptions.

See [configuration definitions and verification](../../../docs/vehicle-frames.md).
