# cnc-precision-support

This is a source-specific reusable purchased component. Its public helpers in `part.ts` define installation datums; the assembled machine must derive mounting holes from them.

## Source and limitations

Read the source links, geometry evidence and full specifications in `presets.json`, together with `part.notes`. Published interfaces are distinct from illustrative housing or internal contours. A valid closed CAD shape confirms model topology, not supplier certification or machine accuracy.

## Acceptance

Obtain the factory-approved ordered drawing, confirm current availability and the exact execution, inspect interfaces and preserve supplier documents. Ground screw C3/preload, support bearing class and custom coupling keyway are explicit order requirements; never infer a certificate from a preset label.

Order C3 support precision to match the requested C3 ground screw, as recommended by the HIWIN support catalogue. The C3/P5 selection identifies a requested execution; measured runout, bearing preload and the delivered certificate remain acceptance requirements.

## Model datum

See the exported layout and mounting-hole helpers in `part.ts`; axes and origins are intentional and must be retained in any assembly. Full mode adds thread/groove appearance where supported without adding physical procurement identities.
