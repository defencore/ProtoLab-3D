# PCB spacers and standoffs

This package selects fixed supplier-qualified catalog items. A round plain spacer and a threaded female/female, male/female or male/male standoff remain distinct products. Equal dimensions never merge identities: `catalogItem` is the source-qualified preset ID and must occur in `catalog.verifiedParameters`.

## Definition

`profile` is `round` or `hex`. `bodyWidth` is outside diameter for round bodies and across flats for hex bodies. A nonzero `cornerDiameter` clips the regular hex to the published across-corner envelope when it is smaller than the regular-hex diagonal. Its corner rounds/chamfers and manufacturing profile remain unspecified. `bodyLength` excludes projecting studs. Confirmed overall length is body length plus both actual `maleLength` values. A visible unverified stud envelope contributes to displayed model bounds, never to a source-verified overall product length.

`endA` is the lower Z end; `endB` is the upper Z end. End forms are `plain`, `female`, `male` and `self-tapping`. Confirmed female/pilot depths use `femaleDepthA/B`. A source-confirmed continuous female thread uses `threadedThrough` and zero separate depths. A plain continuous bore uses `throughBore` and the explicit `boreDiameter`. Pilot diameter is never inferred from nominal screw diameter.

`meetingFemaleBores` is a separate source flag for two confirmed female thread spans that sum to body length. Both spans and callouts are retained independently; they are not relabeled as a confirmed continuous through thread. Mutual thread phase, drill-tip geometry and the junction remain unspecified. Unknown blind-opening envelopes always retain a positive web and cannot use this flag.

When a drawing declares blind holes but omits their depths, `femaleDepthA/B` stay zero. Separate `femaleEnvelopeDepthA/B` provide visible nominal blind-opening extents while retaining a positive web. Those extents are unverified visualization inputs, excluded from verified dimensions and recorded as `NominalBoreEnvelopeJSON`; they are not thread depths or drilling instructions. Do not replace known blind holes with a through hole.

`threadDiameterA/B`, `threadPitchA/B` and `threadDesignationA/B` describe each interface separately. They support mixed metric/UNC ends without changing either source label. UNC pitch is represented in millimetres. A zero pitch means unpublished profile/pitch and keeps that interface smooth in either mode. Supplier designations and explanatory notes survive export even when no helical feature can be authored.

An external ST self-tapping stud is `male`, not a pilot hole. Use the source major envelope diameter for that end (`d1` in the DREMEC drawing), the published projection, its ST label and pitch zero when unspecified. Optional `threadRootDiameterA/B` retains a published root diameter (`d2`) in metadata; without a defined pitch/profile it does not fabricate thread flanks. `self-tapping` end form describes only an explicitly defined smooth receiving pilot.

When a stud projection is unpublished, `maleLengthA/B` stays zero and a separate `maleEnvelopeLengthA/B` gives an explicitly unverified visible projection. `NominalStudEnvelopeJSON` records it; no actual helical feature or manufacturing span is assigned, even if the nominal pitch is known.

## Geometry modes and limits

Simple uses nominal bores and stud envelopes. Full previews declared thread flanks efficiently and exports real helical features only for confirmed pitch and actual spans. The shared authored profile does not certify a thread fit/tolerance class. No helical feature or manufacturing depth is assigned to an unverified blind-opening envelope. Self-tapping interfaces remain smooth pilot holes where their forming profile is unspecified. STL remains nominal.

Appearance is illustrative (`neutral`, `brass`, `nickel`, `aluminium`, `steel`, `nylon-black` or `nylon-white`); it does not certify material or coating. Actual published manufacturer, supplier, end form, material/coating, dimensions and thread label belong in catalog attributes and provenance records.

Before release, verify the exact article and source drawing, engagement, installation envelope, material, coating and applicable tolerances. Empty development catalogs expose only a clearly identified prototype geometry; they do not identify an orderable SKU.

The existing custom `spacer` package remains a separate unthreaded manufacturing design. The dependent `pcb-standoff-insert` package owns bought polymer/metal composite units.
