# Two-piece tube arm clamp

Five authored starting configurations cover 10, 12, 16, 20 and 25 mm round tubes. They are fabrication designs rather than supplier models. X follows the tube; Z follows the four clamping bolts. The two bored blocks have flat outer bearing faces and an explicit unloaded split gap.

Measure the actual tube OD and ovality. The bore is the tube diameter plus the diametral allowance. A zero allowance is a nominal line fit; tightening, deformation and contact pressure are not simulated. Qualify fit on a coupon and check a residual split gap after tightening. Excess torque can crush a thin carbon tube even when the clamp itself is intact.

The editable X/Y bolt pitches control all eight half bores and four hardware axes together. Validation checks the bore-to-hole wall, washer bearing faces and separation of the screw rows. Stock screw length is selected from existing DIN 912 library records to cover both clamp halves, two DIN 125 washers, a DIN 934 nut and at least two thread pitches beyond the nut. Catalog grade and locking method still require project selection. The four screws clamp the halves only; adding a vehicle mounting plate requires a new fastener stack and longer screws.

Assembly composition contains two reusable `manufactured-detail` configurations, four `bolt-screw` configurations, eight `washer` configurations and four `hex-nut` configurations. Exploded and flat fabrication poses retain the canonical bill of materials. The flat pose places the outer faces on Z = 0 and leaves both bores open upward. Choose milling or qualify a printing route, material, shrinkage and creep; a flat pose does not establish print strength.

The interface JSON exports measured-fit inputs and all library hardware identities. Native FreeCAD export preserves each physical component. Resolve tube crushing, frictional slip, load path into the vehicle, fatigue and vibration before use. No clamp load rating or flight approval is assigned.
