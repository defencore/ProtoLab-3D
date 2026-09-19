# Release transmission and motion conventions

The configurator's assessment and each exported gear component's Manufacturing properties include the current transmission data. `TransmissionJSON` contains tooth counts, module, pitch diameters, ratio, axis radius, unlock angles, and current positional state. These values are recalculated when dimensions change.

## Central servo nose, diameter 90/86 mm

With 0.25 mm radial fit clearance and a 14 degree unlock setting:

| Quantity                                    | Value                                         |
| ------------------------------------------- | --------------------------------------------- |
| Input sun pinion                            | 20 teeth                                      |
| Intermediate idlers                         | Four, 40 teeth each                           |
| Internal ring                               | 100 teeth                                     |
| Module                                      | 0.50445 mm                                    |
| Pressure angle                              | 20 degrees                                    |
| Gear face width                             | 3 mm                                          |
| Input / idler / ring pitch diameter         | 10.089 / 20.178 / 50.445 mm                   |
| Idler axis radius                           | 15.1335 mm                                    |
| Input to relative ring/carrier travel       | 5:1                                           |
| Ring/carrier relative unlock turn           | 14 degrees                                    |
| Servo output travel relative to its case    | 70 degrees, opposite the ring's relative turn |
| Each idler's travel relative to the carrier | 35 degrees                                    |

The idlers change direction and distribute the drive; they do not introduce another independent reduction. In the nose arrangement the ring stays on the body and the carrier/servo case turns with the nose. Angles above are relative to that carrier, before the final model inversion. Calibrate the electrical servo direction and endpoints against the actual assembled mechanism.

Changing **Ring rotation to unlock** changes the required servo travel: 12 degrees requires 60 degrees, 14 requires 70, and 20 requires 100. It also changes the bayonet slot geometry. Do not change only the servo command on an already manufactured ring.

## Four-motor arrangement

Each 20-tooth pinion drives an 80-tooth internal ring. The ratio is 4:1 and the rotation directions match in the carrier frame. A 14 degree ring turn requires 56 degrees at each drive pinion. Module depends on the selected tube dimensions.

## Positional sequence

The **Release** control is an animation coordinate, not elapsed time:

1. 0–60%: rotate to the specified unlock angle with no commanded axial translation.
2. 60–100%: hold the unlock angle and translate to the configured separation distance.

The internal ring keeps its full tooth pattern; no tooth-free sectors are cut at the bayonet entry positions. The retaining-head openings and gear mesh are separate interfaces. Continuous teeth preserve drive throughout the unlocking turn, after which the idlers withdraw axially. This is the modeled sequence, not a guarantee against binding: actual axial clearance, tooth edges, alignment, spring force and release under load still require verification.
