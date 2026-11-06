# Waveshare UPS Module 3S

One purchased module and fitted empty three-cell holder. Select cells, cables, charger, acrylic insulation panels and loose fasteners as separate project items. The supplier supports three 18650 cells in series with cell length below 67 mm; battery polarity and electrical compatibility are not modeled.

## Coordinates and interfaces

X is the 93 mm long board direction and follows the cell axes. Y spans 60 mm. The PCB occupies Z=0..1.6; its electronics face points +Z. The four two-pin sockets are on the opposite, battery-holder face at -Z along the +X edge. The 2x4 auxiliary header and BOOT button are on that same -Z face along the -X edge, outside the holder walls. The holder reaches Z=-21.5 and the conservative component envelope reaches Z=6.6. Four mounting bores are at X=+/-43, Y=+/-23. The nominal wiki hole size is D3.0, whereas the manufacturer's STEP contains D3.1 cylinders. This reconstruction retains the STEP bore size and records the conflict.

`upsInterface` exported from `part.ts` records board, bounds, holes, cell centers and reference P28A placements. Cell seats are centered at X=0, Y=-19.5/0/+19.5, Z=-11.4 with axes along X. For the library P28A model, which starts at its negative terminal plane, placements are X=-32.6 and a 90-degree rotation about Y. The nominal 19.2 mm wide, 67 mm long channels provide clearance around the separate 18.6 x 65.2 mm cell references. Channels open toward -Z and retain a back wall below the PCB. Contact springs, clips and cell retention are not modeled.

## Evidence and limits

Reviewed 2026-10-25: [official wiki](https://www.waveshare.com/wiki/UPS_Module_3S), [dimension drawing](https://www.waveshare.com/img/devkit/accBoard/UPS-Module-3S/UPS-Module-3S-details-size.jpg) and [manufacturer STEP](https://files.waveshare.com/upload/3/38/UPS_Module_3Sstep.zip), whose archive contains a 2022-12-12 model. The STEP establishes PCB 93 x 60 x 1.6, corner radius 4.32, mounting pitch 86 x 46 and holder 77.8 x 60 extending 21.5 below the PCB. It is a simplified filled holder envelope, not detailed battery wells.

The reconstruction uses open channels for separately modeled cells. Channels, upper components, pins, connector positions/heights and cell seats are reference geometry. In particular the 5 mm allowance above the PCB is an authored conservative envelope, not a manufacturer height rating. Measure the supplied revision and account for the required insulating panels, plugs, wires, cooling and battery restraint before releasing a cassette design.

Connector-face correction reviewed 2026-10-31 against the manufacturer's [battery-face photo](https://www.waveshare.net/photo/accBoard/UPS-Module-3S/UPS-Module-3S-3.jpg), [header and BOOT view](https://www.waveshare.net/photo/accBoard/UPS-Module-3S/UPS-Module-3S-1.jpg), and [empty holder view](https://www.waveshare.net/photo/accBoard/UPS-Module-3S/UPS-Module-3S-5.jpg). These establish the face and edge arrangement; socket, header and BOOT dimensions remain reconstructed envelopes. The on-board BOOT button is included; the loose wired output switch remains a separate accessory.
