# Waveshare PCIe TO M.2 Board (D)

One purchased adapter, Waveshare SKU 27709. NVMe SSD, PCIe ribbon, power lead, cooler, loose standoffs and screws are separate project items. The supplier supports 2230, 2242, 2260 and 2280 NVMe M-key drives on Raspberry Pi 5.

## Coordinates and interfaces

The local XY frame follows the [manufacturer's dimension photograph](https://www.waveshare.com/img/devkit/accBoard/PCIe-TO-M.2-Board-D/PCIe-TO-M.2-Board-D-details-size.jpg): the 85 mm long PCB axis is X, the SSD socket is at +X and maximum PCB width is 56.5 along Y. PCB bottom is Z=0, top is Z=1.6; the 8 mm populated height is an authored packaging allowance. The outer 2280 fixing boss projects 3 mm past the negative-X edge, giving a nominal overall envelope of 88 x 56.5 x 8 mm.

The source establishes mounting pitch 58 x 49 mm. The model places board mounting bores at X=-19/+39 and Y=-24.25/+24.75. Those datum offsets and D2.7 bores are photo-derived assumptions. To align with the existing Pi 5 source holes at X=-39/+19 and Y=+/-24.5, rotate 180 degrees about Z and translate Y=+0.25 before applying the stack height. Verify this alignment against the actual supplied revisions; it does not establish cooler, GPIO, USB/Ethernet or ribbon clearance.

`adapterInterface` exported from `part.ts` provides bounds, holes, Pi alignment and SSD reference positions. The SSD long axis is X and its centerline is Y=9.95, corresponding to the source's 18.3 mm top-edge offset. The assumed socket engagement plane is X=37.5 and card bottom Z=4. The 2280/2260/2242/2230 fixing positions are X=-42.5/-22.5/-4.5/+7.5, respectively. Socket slot dimensions, fixing heights and card seating are reference geometry.

## Evidence and limits

Reviewed 2026-10-25: [official product page](https://www.waveshare.com/product/modules/pcie-to-m.2-board-d.htm), [wiki](<https://www.waveshare.com/wiki/PCIe_TO_M.2_Board_(D)>) and the dimension photograph. These establish the model identity, interface family, supported nominal card sizes, 85 x 56.5 PCB envelope, 58 x 49 mounting pitch, 18.3 SSD axis offset and 3 mm outboard projection.

The model reconstructs a simple board outline, fan opening, slot, connectors and fixing bosses. It does not reproduce the exact irregular lower edge, copper, contacts, solder tails or every component. Thickness, bore diameters, datum offsets and populated height are not published in the inspected dimension image. Select and measure actual hardware before releasing a mounting design.

The [official board photograph](https://www.waveshare.com/img/devkit/accBoard/PCIe-TO-M.2-Board-D/PCIe-TO-M.2-Board-D-2.jpg) shows the small PCIe ribbon socket partially beneath the supported SSD footprint. Its shell is therefore represented by a low-profile **authored 1.6 mm height above the PCB**, reaching Z=3.2 below the assumed card seat Z=4. The photograph establishes the layout and the vendor's supported SSD installation establishes the ordering of these envelopes; neither establishes that numerical connector height. Measure the supplied connector and card seat together before using their gap as a mechanical clearance.

## Public ribbon routing references

`adapterInterface.ribbonConnector` now includes a provisional mouth `[19,-3,2.4]`, exit vector `[1,0,0]` and width axis `[0,1,0]` in the unchanged adapter coordinates. The [official connected photograph](https://www.waveshare.com/img/devkit/accBoard/PCIe-TO-M.2-Board-D/PCIe-TO-M.2-Board-D-details-2.jpg) shows cable insertion from +X, parallel to the PCB toward the M.2 socket. The numerical mouth center is inferred from the existing authored connector envelope; it is not a supplier mating dimension. Follow the photograph's matching-triangle orientation rule. The seated photo does not expose the contact copper face sufficiently to identify it independently.

`adapterInterface.ribbonPassage` records the already-modeled through-PCB opening from `[26,-12,0]` to `[30,2,1.6]`. Its exact contour and tolerances remain photo-derived. These public datums support host layout without private-package imports; no adapter shape, dimension or selectable parameter changed.

The separate `adapterCableReference` records the manufacturer's nominal **16P-Cable-40mm** package accessory from the [official product listing](https://www.waveshare.com/PCIe-TO-M.2-Board-D.htm). It does not add a cable solid or change the board envelope. A user's measured protrusion, connector insertion lengths and resulting free lead belong in the host assembly's cable data and must not be substituted for fixed supplier board dimensions. Measure that user's cable and include bends and both ribbon edges before accepting a route.
