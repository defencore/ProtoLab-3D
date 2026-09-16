# Vehicle frames and hulls

Find these modules under **VEHICLE STRUCTURES**. Choose **Browse presets** for a popular-model reference or custom starting point; all dimensions remain editable.

| Family        | References                                                                     | Custom designs                                                           |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Aircraft      | Flite Test Simple Cub / Versa / Viggen V2 / Bronco, ATOMRC Dolphin, FMS ASW-17 | High/mid/low wing, glider, flying wing, delta, canard, twin boom, tandem |
| Model rockets | Estes Alpha III, Big Bertha                                                    | Ø40 × 500 mm, Ø66 × 900 mm                                               |
| Boats         | Pro Boat Recoil 2 18/26 in, Joysway DragonForce 65 V8                          | Six bottom sections; mono/catamaran/trimaran/central-pod hulls           |
| Multicopters  | GEPRC MARK5, Holybro X500 V2, X650 V2                                          | 12 frame topologies, micro quad, large hexa/octo                         |

## Accuracy

These are lightweight **approximate references**, not imported manufacturer CAD or interchangeable replacement parts. Each sourced preset declares exactly which dimensions were checked and links to the manufacturer/supplier. All remaining dimensions are design assumptions. Source dimensions checked on 2026-09-16:

- [Flite Test Simple Cub](https://www.flitetest.com/simplecub): wingspan only; fuselage length and contours are assumed.
- [ATOMRC Dolphin](https://atomrc.com/products/atomrc-dolphin-overseas-fpv-rc-plane-fixed-wing): length and wingspan; V-tail and forward-swept wing are simplified.
- Additional aircraft: [FMS ASW-17](https://www.fmshobby.com/products/fms-2500mm-asw-17-ep-glider-pnp) (2500 mm span, 1390 mm overall length), [Flite Test Versa Wing plans](https://s3.amazonaws.com/plans.flitetest.com/stonekap/FT-Versa-plans.pdf) (965 mm span), [Viggen V2 supplement](https://www.flitetest.com/articles/ft-viggen-v2-build-supplemental) (25.25 in span, 39 in overall length), and [Bronco](https://www.flitetest.com/articles/ft-bronco-build) (1086 mm span). Contours and other dimensions are approximate.
- [Estes Alpha III](https://estesrockets.com/products/alpha-iii) and [Big Bertha](https://estesrockets.com/products/big-bertha): overall length and rounded body diameter; tube wall, nose and fin geometry are assumed.
- [Pro Boat Recoil 2 18 in manual](https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/PRB08053_Recoil_2_Brushless_RTR_Manual_EN.pdf) and [26 in manual](https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dwbc2beabf/Manuals/PRB08041_Recoil_26_V2_BL_RTR_Manual%20Update_MULTI.pdf): length and beam. Published total height is not equated to modeled bare-hull depth.
- [Joysway DF65 V8](https://www.joysway-hobby.com/products/df65v7-rc-racing-class-sailboat): hull length and beam; keel, rig and rudder are excluded.
- [GEPRC MARK5](https://geprc.com/product/geprc-gep-mk5-frame/): motor diagonal, plate/arm thickness, selected controller/motor pitch. Plate outlines, squashed-X angle and mounting-hole diameters are assumed.
- [Holybro X500 V2](https://holybro.com/products/x500-v2-kits): motor diagonal, central plate size/thickness/gap, tube outside diameter and selected motor pitch.
- [Holybro X650 V2](https://holybro.com/products/x650-kits): motor diagonal, central plate size/thickness and tube outside diameter. Tube walls, mount locations and plate spacing are assumed.

## Construction

Aircraft support seven body configurations, three wing positions and separate neutral control surfaces. Conventional, T and V-tail arrangements are available; flying wings have a centre equipment bay and twin-boom aircraft have a short pod. See the [aircraft guide](../src/parts/aircraft-airframe/README.md) for all 15 presets, control principles and source dimensions. Boats include 17 presets and six bottom sections, with configurable bow/transom setbacks, rocker, sheer, beam station and stern breadth. Catamarans support mirrored asymmetry and straight/curved crossbeams; trimarans have adjustable outriggers, and pod catamarans have a short centre hull. Boat shells have a section inset, not constant normal wall thickness. See the [boat guide](../src/parts/boat-hull/README.md) for all controls and limitations. Model rockets include tube, hollow nose and fins only. Multicopter arms use flat plates or hollow tubes with motor plates; controller and motor holes are actual cuts. Fasteners and tiny cosmetic features are omitted.

All components are named independent FreeCAD solids, using the same dimensions in preview and export. Body-only isolates the primary shell(s) or lower frame plate. Exploded views separate major components. The model-rocket module contains no propulsion or deployment system. Flight, structural and hydrodynamic performance are outside these geometric models.

## Verification

```sh
node --import tsx --test tests/vehicle-frames.test.ts
node --import tsx scripts/verify-vehicle-frames.ts
# Run with a Python runtime that can import FreeCAD and Part:
python scripts/verify-electronics.py /tmp/protolab-vehicle-cases.json data/vehicle-frames-validation.json
```

The native validator covers all 54 presets in three states, plus both arm constructions for the twelve multicopter topologies (198 cases): closed positive solids, independent components, no volumetric intersections, preview/CAD bounds and volume agreement, and STEP/FCStd round trips. Mesh tests also check closed, outward-oriented triangle boundaries. Passing these checks establishes geometric consistency, not physical fit with a purchased product.

## Multicopter configurations

The configuration selector implements all twelve layouts in [Figure 4 of Takva & İlerisoy (2023)](https://reference-global.com/article/10.2478/acee-2023-0004), matching the [ResearchGate figure](https://www.researchgate.net/figure/Possible-solutions-of-multicopter-drone-frame-constructions-by-the-authors-based-on_fig1_370057469). The drawing supplies topology, not dimensions; example dimensions remain editable and are not manufacturer-certified.

| Configuration  | Motor axes | Motors | Construction                                               |
| -------------- | ---------: | -----: | ---------------------------------------------------------- |
| Quad + / X / V |          4 |      4 | Plus, symmetric X, or independently angled front/rear arms |
| Quad H         |          4 |      4 | Two longitudinal beams and a transverse crossmember        |
| Quad Y         |          3 |      4 | Two front mounts and a rear coaxial pair                   |
| Hexa + / X     |          6 |      6 | Radial arms, nose aligned with a motor or between motors   |
| Hexa Y6 / LY   |          3 |      6 | Three coaxial pairs; LY reverses the Y orientation         |
| Octa + / X     |          8 |      8 | Eight radial arms, two orientations                        |
| Octa X8        |          4 |      8 | Four coaxial pairs                                         |

+X is forward, +Y is left, +Z is up. Motor circle diameter is twice the motor-axis radius, including Y frames without opposite motors. Quad X/X8 and H proportions use the front-arm angle; V also has a separate rear angle. A regular X uses 45°. Coaxial gap measures the clear distance between upper/lower motor mounting plates, not the propeller spacing. Lower mounts and their spacers are named separately. H beams, their junctions and motor pads form one structural solid. All layouts support flat arms and hollow round tubes. Arm labels are geometric references, not motor mixer numbering.

The twelve 500 mm design presets complement the existing micro, large-frame and branded references. No motors, propellers, tilt mechanisms, fasteners or controller electronics are included. Native validation covers every preset/state and both arm constructions for the twelve configurations.
