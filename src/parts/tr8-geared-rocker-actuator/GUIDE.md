# TR8x4 geared fork rotary actuator

A selectable Surpass Hobby BLDC motor drives a two-start TR8x4(P2) screw through equal 24-tooth module-1 gears. Both gears have **outboard diameter 12 x 4 mm hubs**, with transverse pins wholly outside the teeth. A diameter 2 x 10 spring pin couples the driven gear to the round diameter 6 screw section; a diameter 1 x 10 pin couples the motor pinion to its secondarily drilled shaft.

The 16 mm long bronze nut has two integral follower pins. They move two identical 3 mm laser-cut fork plates, cross-pinned to a round output shaft. Four SMB MF106 2Z bearings seat directly in one open aluminium carrier. Three DIN6799 size 3.2 E-clips on local diameter 5 necks meet bearing inner-race faces directly. The only screws are **two M3x5 low-head motor screws and four M3x3 output-head screws**.

## Motor selection and sources

Choose **2845 3100KV**, or **2838 3200, 3500, 3700, 4400, 4700, 5100 or 5700KV**. The 2845 body is diameter 28 x 47; the 2838 is diameter 28 x 40. Both retain diameter 3.175 shafts projecting 15. The selected motor changes its purchased identity, envelope and source metadata. Component CSV, machining JSON and assembly headers follow the selection; common fabrication filenames do not hard-code a motor family.

The motor packages preserve the evidence for each execution. The [branded 2845 drawing](https://images-na.ssl-images-amazon.com/images/I/51uWegAEAqL.jpg) and [manufacturer catalog](https://www.ytk-group.co.jp/products/wp-content/uploads/2021/02/Catalog-from-Suprass-Hobby_compressed-1-1.pdf) support the original selection. The 2838 package also records the [brand body/shaft reference](https://surpasshobbyusa.net/2838-3700kv-2-3s-mini-motor-3-175mm-shaft-3-5mm-connector-1-16-1-18/2838-3700/). Confirm its installation reference against the delivered execution; these external reconstructions are not manufacturer CAD.

The selected motor mounts directly to the flat plate at X=-3...0 with the 16 mm opposed M3 pair. M3x5 screw under-head planes are X=-3 and tips X=2, giving 2 mm nominal insertion. Verify the permitted depth and selected head envelope. Fit the motor before the pinion for tool access. The body passes through the rear diameter 28.6 opening.

## Screw, nut and real travel stops

TR8x4(P2) is a trapezoidal lead screw, with nominal diameter 8, axial pitch 2, lead 4 and two right-hand starts. It is not a recirculating ball screw. See the [screw specification](https://ooznest.co.uk/product/tr8x4-2p-lead-screw-cut-to-size/).

The screw is **52 mm overall**, X=-16...36. Working thread spans **X=0...31, between the bearing inner faces**. Round diameter 6 stock forms the front drive and journals. Reduce the local E-clip necks to diameter 5 at X=-4.64...-3 and X=34...36; the bearing journals remain diameter 6 at X=-3...0 and X=31...34. Cut the thread from unthreaded diameter 8 steel, preserving clean journals; the nominal thread root is only diameter 5.5.

The nut measures **16 x 12 x 14 mm in X/Y/Z**. Both end faces have **diameter 10.4 x 0.4 mm counterbores**, leaving 15.2 mm effective internal thread length. Match the female helix phase to the screw at neutral centre X=15.5. These end reliefs clear the bearing faces while the remaining end lands contact the carrier walls.

The output lever is L=7.5/tan(20 degrees)=20.606080646 mm, with output axis X=15.5,Y=-L. For output angle theta:

- Nut centre X=15.5-L tan(theta).
- Follower-pin radius is L/cos(theta).
- Screw turns about +X are L tan(theta)/4; motor turns have the opposite sign.

At **+20 degrees**, nut centre X=8 puts its left end against the **front wall X=0**. At **-20 degrees**, centre X=23 puts its right end against the **rear wall X=31**. Full stroke is 15 mm and motor sweep 3.75 revolutions. End-stop contact is on the frame lands rather than the bearing faces.

The existing25.5 mm fork tip remains. Maximum follower extent, including the 2 mm pin radius, is 23.928533 mm, leaving 1.571467 mm before the tip at either limit. Maintain the ±20-degree limits so the pins remain within the fingers.

## Outboard hubs and secondary shaft drilling

Both gear tooth faces occupy **X=-11...-6** and have 24 mm pitch diameter at 24 mm axis spacing. Their **diameter 12 hubs occupy X=-15...-11**. Pin centres are at **X=-13**. Thus the diameter 2 hole spans X=-14...-12, with 1 mm axial wall at each hub end, and never enters the tooth region. The diameter 1 pinion hole spans X=-13.5...-12.5.

Match-drill the driven-gear hub and round screw diameter 2 along global Z at neutral. Install **DIN1481 diameter 2 x 10**, with ends at radius 5, recessed 1 mm inside the hub. The driven bore is diameter 6.02. The pin provides torque transfer and axial gear retention.

Match-drill the pinion hub and motor shaft diameter 1 at **motor-local Z=13, along local X**, clocked to the tooth mesh. Install **DIN1481 diameter 1 x 10**, likewise recessed 1 mm. The motor shaft's15 mm projection leaves2 mm from the pin centre to its tip. The hole and pin rotate with the rotor.

This is a **secondary machining execution of the purchased motor shaft**. Its factory installation model/source geometry remains unchanged; the drilled hole is not represented as a manufacturer feature. Fixture the exposed shaft and gear, control debris and keep drilling/insertion force out of motor bearings.

The three diameter 2 x 10 pins, including the two fork pins, use [Gvyntok DIN1481](https://gvyntok.com/shop/shplinty-i-strubtsiny/shtifty-pruzhinnye-trubchatye-din-1481-bez-pokrytiya/shtift-pruzhinnyj-din-1481-bez-pokrytiya-m2h10/), library preset gvyntok-2b5602414d16. The diameter 1 x 10 pin is **REYHER article 001481960000010010, EAN 4043952375983, material 1.4310**, listed by the [supplier](https://www.stuermer-werkzeuge.de/product/view/2319285/2971748) and [manufacturer catalog](https://www.reyher.de/fileadmin/user_upload/Downloadbereich/REYHER_Catalogue_2020_04_EN_Web_ks.pdf). Diameter, length and identity are sourced; displayed slit, wall and chamfers remain illustrative unless confirmed by its ordered drawing.

## Bearings and direct retaining rings

All four **SMB MF106 2Z / MF106ZZ** bearings have 6 bore,10 body diameter,3 overall width and 11.2 x 0.6 flange. The flange is included within the 3 mm width. Sources: [manufacturer drawing](https://www.smbbearings.com/firebrick/ckeditor/plugins/upload/Uploads/Documents/bearingpdfs/MF106ZZ-flanged-miniature-bearing-6x10x3mm.pdf), [supplier product](https://prom.ua/p969387376-podshipnik-smb-106.html).

Screw bearings occupy X=-3...0 and 31...34. Output bearings occupy Z=10.3...13.3 and -13.3...-10.3. All flanges face outward in the carrier counterbores.

Three **DIN6799 size 3.2 x 0.6 E-clips** directly retain inner-race faces, without intermediate pieces. The [Gvyntok 3.2 clip](https://gvyntok.com/shop/shajby-koltsa/shajba-stopornaya-dlya-vala-din-6799/shajba-stopornaya-dlya-vala-din-6799-m3-2/) is an existing library product. [Rotor Clip DE-3.2](https://www.rotorclip.com/product/de-3-2/) specifies a diameter 4–5 shaft range, so each clip sits on a **local diameter 5 neck immediately outside a diameter 6 bearing journal**. The maximum installed outside diameter 7.3 stays inside the modeled inner-race end diameter 7.42 and below the shield/outer-ring regions.

| Ring         | Ring centre | Nominal flat faces | Flat groove      | Groove centre |
| ------------ | ----------- | ------------------ | ---------------- | ------------- |
| Front screw  | X=-3.3      | X=-3.6...-3        | X=-3.64...-3     | X=-3.32       |
| Rear screw   | X=34.3      | X=34...34.6        | X=34...34.64     | X=34.32       |
| Lower output | Z=-13.6     | Z=-13.9...-13.3    | Z=-13.94...-13.3 | Z=-13.62      |

All three grooves have nominal diameter 3.2 roots and width 0.64. The source permits root diameter 3.13–3.2 and width 0.64–0.69; limit the load-side corner radius to 0.06 and keep at least 1 mm outside edge margin. Clip thickness is 0.58–0.60. Their nominal bearing-side faces coincide with the bearing edges X=-3, X=34 and Z=-13.3.

Check actual bearing chamfers, clip seating and selected end float. The installed three-lug contour and bearing internal profiles are illustrative; dimensional references establish their envelopes. Qualify the diameter 3.2 groove sections for the application load. The output's integral diameter 6.8 upper neck meets its upper inner race at Z=13.3.

## Laser-cut fork and output head

The two plates share one **3 mm steel cutting contour**, diameter 6.05 shaft openings and 4.1 mm outward-open follower slots. Plate faces are Z=7.1...10.1 and -10.1...-7.1, with 0.1 mm nominal clearance to the adjacent nut face and 0.2 mm to each bearing.

Match-drill diameter 2 transverse holes through the plate **edges** and shaft along local X at Z=±8.6 after alignment. Each hole is centred 1.5 mm from either broad face. It is a guided secondary operation, rather than a through-face laser hole. Nominal material above/below is 0.5 mm. Press the two diameter 2 x 10 pins with the plate centres supported.

The output shaft has a diameter 5 tail from Z=-16.2 to -13.3, diameter 6 journals/body to 13.3, an upper neck diameter 6.8 to 14.2 and head diameter 20 to 19.2. Insert the reduced tail first through both bearings and both aligned plate openings.

Four blind M3x0.5 head holes begin at Z=15.7 on **ST3215 output-disc PCD14**, at (±7,0),(0,±7). The M3x3 screws attach an external part, which is not included. [Waveshare CAD/drawings](https://docs.waveshare.com/ST3215_Servo/Resources-And-Documents) show original diameter 2.5 disc holes; this custom M3 execution matches locations without claiming original M3 threads.

## Assembly and exports

1. Machine the carrier, screw/nut, gears with outboard hubs and output shaft. Cut and finish the two fork plates.
2. Mount the selected motor before its pinion. Keep screw bearings/output shaft absent.
3. Preplace the nut at X=15.5,Y=Z=0 through the open carrier side. Load both plates laterally over its integral pins through the open mouths; fixture their bores at X=15.5,Y=-20.606080646.
4. Feed the screw rear end through the empty front seat and nut pilot. Hand-turn its thread through the stationary nut while advancing along +X.
5. Fit the screw bearings from the accessible ends, then radially install their direct E-clips on the local diameter 5 necks.
6. Fit and clock the gears. Match-drill only their outboard hubs at X=-13; install both gear pins while supporting the joints.
7. Fit output bearings and insert the shaft through them and both plates. Match-drill/install the fork pins, then fit the lower direct ring.
8. Remove fixtures. Verify real frame-wall stop contact at both limits, without penetration or bearing-face loading, then inspect pins, ring seating, end float, backlash and full thread travel.

Eleven downloads include component CSV, motion table, machining JSON, selected-motor assembly instructions, quantity 2 laser manifest, fork SVG/DXF and gear SVG/DXF. Planar profiles use1:1 millimetres. Transverse hub holes and plate-edge holes are secondary drilling operations.

The assembly has **26 physical occurrences**, including four cross-pins and three E-clips. Preview/native geometry share the same construction. Simple mode uses nominal thread envelopes; Full mode contains matching helices. Inspection states alter visibility without changing manufacturing identity.

Assign fits, material grades, finish, tolerances and joint capacity to production drawings. Qualify cross-hole fatigue, secondary motor-shaft machining, thin plate integrity, pin retention, bearing end float, wear, sensorless reversal, thermal duty and actual loads.
