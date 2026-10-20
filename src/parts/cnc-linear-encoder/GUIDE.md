# HEIDENHAIN LS 477 and MSL 41

This purchased family identifies three real LS 477 TTL executions and the matching, separately ordered MSL 41 spars. It is an installation model with dimensioned interfaces, not factory internal CAD or a fabricated substitute for a glass scale.

| Intended axis | LS 477 ID | Measuring length | Housing length | Accuracy grade | Evaluated step | Separate spar ID |
| ------------- | --------- | ---------------- | -------------- | -------------- | -------------- | ---------------- |
| X             | 605365-86 | 920 mm           | 1058 mm        | +/-3 um        | 1 um           | 770902-17        |
| Y             | 605363-30 | 1640 mm          | 1745 mm        | +/-3 um        | 1 um           | 770902-24        |
| Z             | 605363-27 | 270 mm           | 375 mm         | +/-3 um        | 0.5 um         | 770902-05        |

Exact factory product pages establish the selected accuracy/interpolation executions. The [manufacturer catalogue, printed pages 38-39](https://www.heidenhain.us/wp-content/uploads/2022/07/PR_Linear_Encoders_for_Numerically_Controlled_Machine_Tools_ID571470_en.pdf#page=20) establishes the mounting dimensions. The spar must be ordered separately; it is mandatory above 1240 mm and recommended above 620 mm with high dynamic requirements. Match the delivered order, reference marks, cable/connector and certificate before release.

## Geometry and public layout

`encoderSpec(model)` provides identified execution data and `scaleMounts`, `readheadMounts`, and `sparMounts`. `encoderParameters(model, component, headPosition)` returns complete parameters. Roles `assembly`, `scale`, and `readhead` are physical inspection subdivisions of one purchased LS 477 kit. A separate spar model uses `assembly`. Do not order the scale and readhead again as independent procurement units.

The measurement axis is X. The housing midpoint is X0, rear plane Y0, and bottom Z0; its section is 18 by 32.2 mm. At mid stroke, the readhead left datum is X-52.5. The two M4 clearance-hole centers are X-40.5 and X+15.5, Z-4, with 56 mm pitch. They are not symmetric about X0. `headPosition` moves only the head/socket, and is constrained to +/-half the selected measuring length.

The family uses source mounting option III with the MSL 41. The spar host plane is Y-10.25 and the head mounting plane is Y-0.25: it is 10 mm from the host plane. Source direct mounting option I instead uses a head rear plane Y+0.25; `readheadDirectMountRearY` retains that alternative without silently combining the two installations. Use the shipping brace/mounting gauge and the delivered instructions for the specified head gap and alignment.

Spar end mounting centers are X+/-(ML/2+15), Z17; long spars also have the central D11/6.5 mounting point. The nominal 8.5 mm source slot-width opening is rendered as circular. A 17 mm counterbore and 6 mm recessed installation seat are **unverified contour envelopes**, exposed as `seatVerified:false`; these are not factory manufacturing dimensions. Source slot contour, clamping hardware, and head seating must be checked before committing host holes/bolt lengths. The displayed clamp bridges, head flanges, and socket openings are reconstructed external contours. Clamp proxies remain at Z0..3, entirely above the published moving-head envelope; their contours are illustrative and do not certify the supplied wedge/clip geometry. Their existence does not release a supplier fit or a manufacturing drawing.

The CNC assembly mounts the Y readhead adapter to the actual gantry foot and the Z adapter beneath the head, with separate moving readheads and fixed scale housings. The X spar has a separate 1105 by 12 by 60 mm steel backing plate; the complete modeled 1025 mm spar bears on it. Four M8 anchors lie outside the spar outline. Only the plate's lower 32.5 mm bears on the beam's flat rear wall; its upper 27.5 mm projection needs joint and alignment qualification. This authored support preserves the supplier envelope and does not release the reconstructed spar seats.

The authored adapters have integral 1.8 mm stepped front ears, retaining the complete 6 mm M4 taps. Their nominal spar gap is 0.5 mm, or 0.1 mm after a disclosed +/-0.2 mm mating-plane and +/-0.2 mm spar-depth stack. The front upper ligament is 1.65 mm with the configured radial allowance; the recessed rear portion retains 0.45 mm. These are depth-dependent dimensions, not a uniform ring or strength approval. Release the actual supplier contours, steel grade, corner radii and preload/cable-load assessment before machining. See [the portal mounting review](../../../docs/cnc/portal-assembly.md) for the finite native contact and clearance evidence.

## Feedback and acceptance

LS 477 provides complementary TTL A,/A,B,/B,Z,/Z at 5 V +/-0.25 V, below 140 mA without load. It is not the 1 Vpp LS 487. The selected 5x/10x interpolation produces 1/0.5 um evaluated steps after quadrature evaluation. Resolution is not accuracy.

The [Delta ASDA-A3 manual, CN5 section 3.8](https://filecenter.deltaww.com/Products/download/06/060201/Manual/DELTA_IA-ASD_ASDA-A3_UM_EN_20230323.pdf) specifies differential ABZ, 5 V supply up to 300 mA, and a maximum single-phase input frequency of 4 MHz. A signal-mapped shielded adapter is necessary: the HEIDENHAIN 14-pin socket and Delta 15-pin CN5 are not pin-compatible. Check delivered pinouts, load, cable length, shield termination and fault handling. Do not connect 24 V or 1 Vpp to these inputs.

The full closed loop belongs in the correctly configured A3-M servo drive. DDCS sends step/direction commands; it does not acquire the linear scale or independently display actual tool position. Verify feedback direction, electronic gearing referenced to scale counts, following-error shutdown, reference capture and all travel limits before cutting. A sensor alarm or broken scale cable must inhibit motion safely through a reviewed electrical architecture.

The specified +/-3 um scale grade does not certify the machine's +/-0.025 mm finished-part tolerance. Installed alignment, Abbe/yaw errors, structure deflection, thermal gradients, tool runout, and cutting conditions require a combined error budget and full-travel laser/coupon acceptance. The source generic mounting tolerances are not the machine acceptance criterion.

## Protection and mode behavior

The source installed rating is IP53; IP64 requires the specified DA 400 sealing air. Mount sealing lips down or away from coolant, provide chip/splash shielding, continuous machined support, and strain-relieved moving cables. No protective cover or cable route is implied by this component alone.

Simple and Full preserve the same supplier installation envelopes. No unpublished thread pitches, spans, glass internals or clamping profiles are invented. Export metadata preserves identity, source links, drawing SHA and these limitations. Supplied hardware and actual mounting instructions remain required for assembly.
