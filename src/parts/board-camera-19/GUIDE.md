# 19x19 CSI board camera

One purchased-camera reference based on the user's 19 x 19 mm body cross-section, 12 mm body depth and 15 mm objective projection. The generic objective diameter remains an editable 12 mm assumption. The selected IMX577 execution uses the user's measured stepped objective: front diameter 14.8 mm and body-adjacent collar diameter 16 mm over 5 mm height. RunCam indicates a size class, not a manufacturer identity. The user confirms IMX577 for the exact `imx577-19x19-rear-mipi-m25` reference only; the generic reference assigns no sensor. No camera-module supplier or order code is inferred.

## Prototype measurements and objective profile

The user supplied the stepped objective dimensions on 2026-11-05 after a physical fit check. The total 15 mm projection is unchanged. In the local camera coordinates the collar occupies Z12…17, and the front diameter continues to Z27. Both surfaces are native analytic cylinders. Measurement uncertainty, detailed fillets and optical clear aperture were not supplied. The 19 mm body already fits the existing guides, so its dimensions and mounting datums are retained.

`lensProfile` selects `cylindrical` or `stepped`. `lensCollarDiameter` and `lensCollarHeight` apply only to `stepped`; the height is included within `lensLength`. The generic `user-csi-19-12-27` execution stays cylindrical Ø12 and retains its original geometry. The measured IMX577 execution retains its package/model identity and selects Ø14.8 / Ø16 ×5. These are user measurements, not newly asserted supplier dimensions.

The avionics cartridge uses a nominal Ø14.9 front TPU opening and Ø16.2 lower-collar relief. The resulting 0.1 / 0.2 mm total diametral clearances are explicit fitting choices for TPU95A, not a verified printer tolerance or clamping-force specification. Prototype fit remains necessary.

The requested clockwise installation is defined while looking directly into the objective from its front toward the body: local +Y moves toward local +X. This is −90° about the local +Z optical axis. The camera's rear latch and corresponding cartridge/cage passage must use that same clock; rotating the image label alone is insufficient.

The version-1 import upgrade recognizes only the exact old explicit IMX577 preset and its complete previous 14-field signature. That obsolete Ø12 assumption is corrected to the measured stepped profile on import. The configuration key consequently changes; old executed snapshots retain their original dimensions and hashes. Generic and edited custom records preserve their earlier objective diameter and gain cylindrical-profile fields. No historical duplicate camera preset is introduced.

## Two selectable references

The original `user-csi-19-12-27` preset and the part defaults preserve the generic geometry: no side holes, no separately protruding rear connector and 27 mm overall optical-axis depth. Existing envelope-clamp assemblies retain that shape.

The `imx577-19x19-rear-mipi-m25` preset is the existing user camera now identified by its user-confirmed IMX577 sensor. Its physical identity, parameters and geometry are unchanged; the sensor annotation does not establish a camera-module manufacturer, interface pinout or driver. This preset adds the requested rear MIPI latch envelope and two M2.5 side reference bores. Its rear connector adds 0.5 mm, making the complete outside optical-axis depth 27.5 mm. The parent assembly must explicitly select these interface parameters when using screws and rear-latch clearance.

Its canonical Library ID is `board-camera-19:imx577-19x19-rear-mipi-m25`.
Configuration and project imports migrate the former
`board-camera-19:19-rear-mipi-m25` reference to this ID without changing its
physical parameters or geometry. There is one active entry for the same user
module. The generic family and `user-csi-19-12-27` preset remain sensor-unspecified.

## Coordinates and supplied interface

The body is centered in XY. Its rear face is Z=0, front face Z=`bodyDepth`, and the centered objective points along +Z to Z=`bodyDepth + lensLength`. Top is +Y; the modeled left and right mounting faces are -X and +X.

| Feature                     | Interface preset geometry                                        | Evidence                                         |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| Body                        | 19 x 19 x 12 mm                                                  | User dimensions                                  |
| Objective projection        | 15 mm from body front                                            | User dimensions                                  |
| Objective diameter          | 12 mm                                                            | Authored assumption                              |
| Side screw designation      | M2.5 on both X faces                                             | User specification                               |
| Side-hole axial center      | Z=7.5 mm from the body rear                                      | User-confirmed position                          |
| Side-hole transverse center | Y=0                                                              | Authored centering assumption                    |
| Blind-hole depth            | 2.5 mm                                                           | Authored assumption; unmeasured                  |
| Rear MIPI latch envelope    | Approximately 17 mm wide, 2 mm high, projecting 0.5 mm toward -Z | User dimensions                                  |
| Latch upper edge            | 3 mm below body top                                              | User position                                    |
| Latch horizontal inset      | Right edge flush with body, inset 0                              | Authored assumption; horizontal inset unmeasured |

At the interface preset dimensions, the latch occupies X=-7.5..9.5, Y=4.5..6.5 and Z=-0.5..0 mm. The modeled envelope includes 0.02 mm overlap into the body to make one connected native solid without enlarging those external bounds. It represents the protruding latch only; it does not model a connector's internal pins, actuated opening travel or inserted flex cable.

The two side bores start on X=-9.5 and X=9.5 and extend inward along their opposing X directions. Both use Y=0, Z=7.5. Smooth D2.5 bores are Simple major-diameter thread references, not a tap-drill specification or a measured internal thread. A parent screw can use an authored 2 mm engagement and 0.5 mm bottom allowance only after the actual 2.5 mm depth and internal clearance have been checked. Do not infer the camera-body material or thread strength from this envelope.

## Adjustable interface parameters

`rearInterface` selects `none` or `rear-mipi`. The latch uses `rearConnectorWidth`, `rearConnectorHeight`, `rearConnectorProjection`, `rearConnectorTopInset` and `rearConnectorRightInset`.

`sideMount` selects `none` or `m2.5`. `sideMountOffset` is the hole-center distance from the body rear, and `sideHoleDepth` is the assumed blind depth. Validation keeps the entire hole cross-section within the body depth, the two blind holes separated, and the latch envelope within the body width and height. The generic preset stores the same numeric allowances with both interfaces disabled.

## Electrical and mounting scope

CSI is the requested interface. IMX577 is user-confirmed only for `imx577-19x19-rear-mipi-m25`; a specific module supplier SKU, pin count, connector pinout, flex type and Pi 5 electrical compatibility remain unidentified. The original generic preset remains sensor-unspecified. A rear MIPI connector location does not establish electrical compatibility. Select the actual camera and cable before release. No claim is made that an analog RunCam camera connects directly to CSI.

The body, objective and optional latch form one solid for preview and native export. This is an opaque purchased-unit envelope, not a model of the internal PCB, sensor, optical elements, source manufacturing surfaces or focusing mechanism. Parent mounts must leave the rear latch reachable, provide cable bending and strain-relief space, and use a measured removable locking method for the actual side screws. CAD does not establish thread strength, retention under vibration or optical performance.
