# OMRON E2B CNC motion limit

One purchased `E2B-M12KS04-WP-B1 2M` is a shielded short-body M12 inductive sensor with PNP normally open output, nominal sensing distance 4 mm and pre-wired 2 m cable. Use the [OMRON manufacturer catalogue](https://www.ia.omron.com/data_pdf/cat/e2b_d116-e1_1_6_csm1012652.pdf), printed pages 2, 6, 15 and 20, for the ordered execution, sensing target, mounting and surrounding-metal clearances.

The source specifies M12 x P1, a 47 mm short-body length and two clamping nuts plus a toothed washer. Native installation axis is Z. This model reuses the existing instrument geometry: nominal body 0..47 mm, illustrative sensing-face layer 47..47.5 mm, mounting nuts 18..22 mm and 27..31 mm, cable tail -10..0 mm. The nut contour and placement are inspection choices; they are not source fit or manufacturing dimensions. The washer, internal electronics and real cable route are not reconstructed. Measure the supplied unit before fixing the bracket and nut datums.

Simple and Full intentionally keep this opaque purchased body and its mounting interfaces nominal. A known M12/P1 designation does not establish the complete threaded span or delivered profile/fit; no unverified helix is invented. Export metadata preserves the supplied thread designation and limitations separately from fabricated thread features.

The CNC assembly uses a 5 mm plate between the illustrated nuts, a 12.5 mm clearance hole and authored steel targets at 2 mm passing distance. Commission the switching point and stopping allowance. Provide independent mechanical stops and a validated emergency circuit. These six ordinary motion sensors do not implement a safety function.
