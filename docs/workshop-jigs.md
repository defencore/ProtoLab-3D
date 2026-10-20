# Workshop jigs and templates

The library includes twelve workshop fixture families with 74 starting configurations, alongside the adjustable tube drilling jig and its 66 configurations. Find them under **WORKSHOP TOOLS**. These are editable design examples with physical 3D components, FreeCAD recipes, validation and individual STEP/STL output. They are intended to help make useful parts with a drill press, hand drill, hand tools and a suitable hand-held router.

## Choose by operation

| Operation                                  | Library family                                                                | Simple equipment                            | Example work                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| Bolt circles, hole rows and grids          | [Flange and grid drilling jig](../src/parts/drill-pattern-jig/GUIDE.md)       | Drill press or clamped hand drill           | Motor adapter plates, flanges, mounting brackets                         |
| Cross holes in round stock                 | [V-block cross-drilling jig](../src/parts/v-block-drill-jig/GUIDE.md)         | Drill press and vise                        | Retaining-pin holes, tube cross holes, shaft linkages                    |
| Centered axial holes                       | [Shaft end-centering guide](../src/parts/shaft-end-drill-jig/GUIDE.md)        | Clamped hand drill or aligned drill press   | Handle ends, shaft pilot holes, coupler blanks                           |
| Dowel joints                               | [Board edge dowel jig](../src/parts/edge-dowel-jig/GUIDE.md)                  | Hand drill, vise, depth collar              | Cabinet frames, repeatable board joints                                  |
| Angled drill entry                         | [Fixed-angle drilling shoe](../src/parts/angle-drill-jig/GUIDE.md)            | Hand drill, or tilted drill-press setup     | Angled screw/pin passages and fixture prototypes                         |
| Slots, mortises, pockets and round cutouts | [Router template](../src/parts/router-template/GUIDE.md)                      | Suitable plunge router and guide bush       | Wood/plastic slide slots, mortises, recesses and openings                |
| Slots without a milling machine            | [Chain-drill and slot layout kit](../src/parts/chain-drill-slot-jig/GUIDE.md) | Drill, small saw, files                     | Adjustment slots in brackets and linkage plates                          |
| External corner radii                      | [Corner radius template](../src/parts/corner-radius-template/GUIDE.md)        | Scriber, saw, file or sander                | Rounded plate corners and consistent bracket profiles                    |
| Wire loops and U bends                     | [Pin and mandrel bending jig](../src/parts/wire-bending-jig/GUIDE.md)         | Drilled metal base, metal pins, bench clamp | Soft-wire hooks, loops and linkage prototypes                            |
| Repeated angular positions                 | [Manual indexing fixture](../src/parts/indexing-disc-jig/GUIDE.md)            | Drill press, bolt pivot, pin and carrier    | Discrete bolt-circle / carrier operations without a powered rotary table |
| Saddle-shaped tube joints                  | [Tube fishmouth scribing sleeve](../src/parts/tube-coping-template/GUIDE.md)  | Scriber, hand saw and files                 | Hand-fitted round-tube frame joints                                      |
| Repeated angled cuts                       | [Manual miter box](../src/parts/manual-miter-guide/GUIDE.md)                  | Fine manual saw and clamps                  | Small strip and tube crosscuts at repeatable lengths                     |
| Hole belts on tube ends                    | [Adjustable tube drilling jig](../src/parts/tube-drill-jig/GUIDE.md)          | Hand drill / drill press and clamps         | 4/8/12 holes at a spacer-set distance from the tube end                  |

## A practical workflow

1. Choose a fixture for the operation and measure the actual blank, tool and mating components.
2. Select a starting configuration, set its dimensions, and read **Design assessment** for the datum, spacing, required guides/pins and clamping method. Invalid layouts disable export.
3. Print the locating/template parts or use the model to mark and drill a metal plate. Order or make only the small wear elements needed for the operation: steel bushings, mandrels, dowels and ordinary fasteners.
4. Clamp the fixture and workpiece, qualify the first operation on scrap, measure the result, and then repeat using the same reference faces.
5. Remove marking masks before free filing or sawing. Use the finished-profile mask to inspect, rather than wearing away a polymer edge while finishing the workpiece.

The drilling families offer either custom steel-bushing envelopes or printed pilot guides. Bushing bores include 0.05 mm nominal running clearance; seat allowance is independent. Specify a retention method appropriate to the actual material: a loose printed pocket is not a qualified press fit. Choose the final metal-seat fit using the selected bushing supplier's requirements, keep the guide close to the stock and provide chip clearance. [Carr Lane application guidance](https://www.carrlane.com/engineering-resources/technical-information/manual-workholding/drill-bushings) describes these design considerations.

The router template uses radial compensation **(guide bush OD − cutter diameter) / 2**. Its opening is enlarged accordingly; the exact-size radius scribing template has a different purpose and no router compensation. Confirm actual cutter, guide-bush centering, projection and template thickness on a test cut. [Trend guide-bush application](https://www.trend-uk.com/gb18-guide-bush-18mm-diameter) identifies the template-following role of the bush.

## Combine fixtures to make more complex parts

- **Slotted motor adapter plate:** register a square blank in the flange/grid jig for mounting holes; use the chain-drill kit for adjustment slots; saw/file their webs and inspect with its second mask; finish external corners with the radius template; tap the required holes after removing all guides.
- **Hand-fitted tube frame:** cut stock to its centerline length in the manual miter guide; position the fishmouth sleeve from a length datum, scribe and hand-fit the saddle; drill attachment belts with the tube jig and its measured spacer stack. Check the complete joint fit before final assembly.
- **Small linkage mechanism:** center-drill shaft ends with the axial sleeve, add cross-pin holes in the V-block fixture, make slotted linkage plates with the drill/file masks and form soft-wire links around the metal mandrels. Choose clearances and test movement in the assembled mechanism.
- **Wood frame or adjustable furniture component:** establish matching dowel datums with the board-edge jig, use a compensated router template for mortises or adjustment slots, and check the finished edge profiles with the radius template. Keep the same reference face throughout the sequence.

## Manufacture, orientation and limits

Exported FreeCAD assemblies separate each physical custom detail and bought envelope. Exploded views are inspection poses and preserve the bill of materials. The library's browser STL is the whole selected view; select individual FreeCAD components, or use the separate sample-body files, for manufacture.

- Print guide plates with their broad top face on the bed when underside registration fences would otherwise create a large bridge: flange/grid, shaft-end, dowel, router, chain-drill masks and radius templates. Fit steel guides afterward.
- V-block bridge interiors and strongly inclined drilling sleeves may require removable print supports. Clean and measure all contact and guide faces afterward.
- The fishmouth sleeve has a flat clamping rim and prints rim-down. Its upper edge is a 96-station sampled scribing profile; final fitting remains necessary.
- Bending and indexing fixtures are specified with metal bases/pins. Printed copies are layout or light-duty prototypes. Springback, hand force, carrier design and pin retention require an actual build decision.
- The miter box is for a manual fine saw. It is not a polymer guide for a powered saw or grinder.
- These fixtures locate and guide tools; they do not supply drilling-depth control, machine stiffness, cutting-force ratings or a substitute for workpiece clamping.

## Verification and sample CAD

Prepare the package checks, all 74 example cases, printed-guide variants and inspection states:

```sh
node --import tsx scripts/verify-workshop-jigs.ts
node --import tsx --test tests/workshop-jigs.test.ts
```

Run the prepared native geometry audit in FreeCAD:

```python
WORKSHOP_JIG_OUTPUT = '/absolute/path/to/ProtoLab-3D/data/workshop-jigs'
WORKSHOP_JIG_PREVIOUS = []
WORKSHOP_JIG_ONLY = None
exec(open('/absolute/path/to/ProtoLab-3D/scripts/verify-workshop-jigs.py').read())
```

The native audit checks valid single-solid components, component interference, unobstructed declared drill paths, actual stock insertion/end stops for the shaft/V-block/dowel guides, flat support of the inclined shoe, standalone STEP and closed STL bodies, STEP assembly volume and FCStd reopening. It writes a per-case report and one sample assembly per family under `data/workshop-jigs/`. Generated CAD remains outside version control under the repository's existing `data/` policy. Automated geometry checks do not establish manufactured accuracy, tool life or load capacity.
