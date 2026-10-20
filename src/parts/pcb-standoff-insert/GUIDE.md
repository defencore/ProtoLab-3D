# PCB standoffs with metal inserts

This is one complete bought supplier assembly. Its explicit package dependency on `pcb-standoff` shares the geometry schema and mode-aware feature implementation; it does not create a procurement bill of materials for the supplier's internals.

Use the fixed-item identity, geometry, source-thread and blind-envelope rules in the dependency's `GUIDE.md`. Exact supplier identity, material/coating and drawing limitations remain attached to each preset.

`insertOuterDiameter` describes a confirmed cylindrical installation envelope. Either `insertLengthA/B` describe non-overlapping end inserts or `insertThrough` declares a continuous insert. All threaded ends need confirmed insert extents before individual internal solids can be rendered. Confirmed thread depths must fit in the confirmed insert. These cylindrical envelopes do not reproduce an unspecified knurl, flange, press fit or retention mechanism.

When the insert outside dimensions/spans are unpublished, all insert dimensions remain zero and `insertThrough` is false. The body is an explicitly limited installation envelope. Any source-defined exposed male studs are independent brass-colored display/native components with their actual lengths; this does not fabricate hidden insert geometry. Unpublished projections use a separate unverified stud envelope and no invented manufacturing thread span. Female/pilot interfaces remain on the body envelope, with source/designation/limitation metadata. All display components still represent one complete purchased supplier unit.

Simple and Full affect only defined helical features, preserving actual body/stud lengths and source identity. The complete supplier unit remains one procurement configuration even when inspection geometry contains separate body/insert solids.
