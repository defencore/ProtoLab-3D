# Waveshare OV9281-110 — 21653

The origin is the optical axis at the PCB rear. Positive Z points forward. The supplier drawing gives the PCB, six D2.2 bores, optical offset, D14 lens and adjustable front stack. The 14 mm square lens holder, front FFC body and 1 mm rear population are conservative reference envelopes. Measure them on the delivered module.

## Rear support interface and source fidelity

The four outer mounting centers and all six D2.2 PCB bores remain those of the supplier drawing. The [official rear photograph](https://www.waveshare.com/media/catalog/product/o/v/ov9281-110-camera-4.jpg) shows bare annuli at those four outer bores, rear SMD components and two factory lens-screw heads at the auxiliary holes. The auxiliary holes are not rear contact-pad references. Exact passive and screw-head profiles are not reconstructed from this photograph.

The public `rearContactInterface` exposes the four sourced centers, PCB rear plane Z=0, an **authored D3 contact-button diameter** and **authored D3.4 population-envelope reliefs**. Only the 1 mm rear population reference is relieved at those four zones. The physical PCB retains its D2.2 holes and unchanged published geometry; the relief diameter is not a larger PCB bore or a published pad diameter. The 0.02 mm internal fuse overlap remains a construction aid.

The photo establishes clear mounting zones, but neither an exact pad outside diameter nor rear component heights. Those supplier values remain `null` in the public interface. The 1 mm population depth and D3/D3.4 contact allowances are fitting assumptions that require measurement on the delivered camera. A 3 mm contact face around a D2.2 hole has nominal annular area about 3.27 mm², or 13.07 mm² for four contacts; this is geometric bearing area, not a force or PCB-stress rating.

Use source-hole location, component clearance and controlled compression when supporting the board. Confirm the real annuli, solder mask/copper condition, rear components, permitted preload and electrical isolation before using those four regions as load-bearing contacts. Retaining supplier dimensions and a zero-overlap CAD result does not establish component-safe clamping.

The published view is 110 degrees diagonal, 93 horizontal and 70 vertical. Mechanical aperture checks do not simulate the protective glass's refraction.

The project uses 100 mm leads. Select the correct 22-to-15-pin Pi 5 camera FFC and contact orientation. The included stock cable is not modeled or substituted for that length. Two Pi 5 ports permit a mechanical two-camera layout; compatibility with the unidentified existing camera remains a separate electrical/driver check.

Sources: [product](https://www.waveshare.com/ov9281-110-camera.htm), [drawing](https://www.waveshare.com/img/devkit/accBoard/OV9281-110-Camera/OV9281-110-Camera-details-size.jpg), [connection guide](https://www.waveshare.com/wiki/OV9281-110_Camera).
