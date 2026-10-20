# HGR20 customer-cut CNC rail

The reusable rail uses the source cross section and mounting interfaces from [HIWIN G99TE22-2011](https://www.hiwin.com/wp-content/uploads/Linear_Guideway-E.pdf), printed pages 36–37 (PDF pages 39–40). Source SHA-256: `6d76f03606e15d0a53c167f19c3390c6f1befa4373e21d5fa04d8eecd2bfb6da`.

Native rail direction is X, the transverse centre is Y0, and the mounting bottom is Z0. Width 20, height 17.5, mounting pitch 60, through bore 6, counterbore 9.5 and counterbore depth 8.5 mm are sourced. The source maximum rail length is 4000 mm. The requested cut length is a customer dimension; it is not a claim that a 1900 mm rail is stocked or installed on a particular OEM machine.

`railParameters(length)` supplies the complete parameters. `railLayout` and `railMountingHoles` expose matching-hole geometry. Symmetric end distances derive from `L=(n−1)×60+2×E`; the model requires 5–30 mm edge distances, so a counterbore cannot be clipped and the source half-pitch recommendation is retained. Examples: 1900 mm gives E20, 2000 gives E10, and 4000 gives E20. Confirm nonstandard cuts and accuracy execution with the supplier.

Raceways, small edge radii and internal contact profiles are undimensioned in the installation drawing and remain illustrative. This model is for mounting and layout; it is not a rail fabrication drawing or a verified load/life rating.
