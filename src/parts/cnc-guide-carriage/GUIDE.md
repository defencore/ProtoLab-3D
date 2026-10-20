# HGH20CA purchased CNC carriage

[HIWIN G99TE22-2011](https://www.hiwin.com/wp-content/uploads/Linear_Guideway-E.pdf), printed page 37 / PDF page 40, supplies HGH20CA installation dimensions. Source SHA-256: `6d76f03606e15d0a53c167f19c3390c6f1befa4373e21d5fa04d8eecd2bfb6da`.

Native X is rail direction. Y0 is the rail centre; Z0 is the rail mounting plane, including when the carriage is exported independently. The steel/body bottom is 4.6 mm and top is 30 mm: the independent carriage bounding height is 25.4 mm, while the catalog assembly height is 30 mm. Source overall length 77.5, steel-body length 50.5, width 44, and 36×32 mm top mounting pattern are retained. Four M5×6 blind holes use the ISO metric coarse pitch 0.8 interpretation.

`carriageParameters()` and `carriageMountingHoles()` provide the configuration and top mounting centres `[±18,±16,30]`. Rail-channel clearance 0.15, cover contours and small radii are reconstruction assumptions. Return circuits, grease nipple and internal balls are not furnished as manufacturing geometry. The entire bought carriage is one procurement identity; end-cover visual solids do not create separate BOM parts. Specify the complete ordered accuracy/preload execution.

`carriageParameters(threadFitAllowance)` accepts a modeled female-thread radial allowance of 0–0.2 mm. The default is zero. CNC assemblies use 0.05 mm to keep ideal coincident CAD flanks apart; preview and native Simple/Full geometry apply the same allowance. Source M5×6 nominal dimensions and drawing callouts remain unchanged. `ThreadFitAllowance` records the modeled cutter diameter and states that supplier thread tolerance/fit class is unverified. This numerical allowance is not a machining specification for the purchased carriage.
