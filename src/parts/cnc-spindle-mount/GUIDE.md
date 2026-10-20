# Two-piece spindle mount

Each configuration is one manufactured detail: rear mounting block or front cap. The spindle axis is +Z, the clamp is centred at Z=0, and the rear mounting face points toward -Y. The rear plate lies in XZ; mounting and clamp screws run along Y.

`spindleMountLayout(parameters)` is the authoritative hole and footprint contract. `spindleMountDefaults` supplies a complete configuration for assembly callers. Rear mounting holes are four blind metric threads, clamp fastening uses two blind threads in the rear block and clearance holes in the cap. Mounting screws and clamp screws are separate library parts.

The design supports nominal spindle bodies 65, 80 and 100 mm and other supported diameters. The block and cap are milled from aluminium; they are not replicas of an undocumented commercial clamp. Assemble at the specified split gap before finishing the bore. The nominal allowance is a design input, not a supplier-certified fit. Material grade, tolerances, bolt torque, spindle clamp limits and cutting-load verification remain release requirements.

Simple shows smooth thread bores and retains the drawing callouts. Full uses actual authored helical metric flanks. Both configurations remain one closed connected solid each.

Hidden `threadFitAllowance` defaults to 0. Assembly callers may select an explicit radial inspection clearance to avoid coincident bolt and tap faces. It does not change the nominal metric designation and is recorded separately in CAD metadata. This authored allowance is not a manufacturing fit or tolerance class; release the actual tap, bolt fit, engagement and tolerances on the detail drawing.
