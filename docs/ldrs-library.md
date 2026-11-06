# LDRS component library

Find these component families in **Vehicles > Vehicle structures > Model rockets**, or search `LDRS` or `Large Dangerous Rocket Ships`. The event name follows [Tripoli's LDRS page](https://www.tripoli.org/content.aspx?club_id=795696&module_id=504665&page_id=22), reviewed 2026-10-25. The components support hobby rocket layout, assembly planning and ground preparation. The [OpenRocket extension](openrocket-components.md) adds further external and recovery components and maps the existing details to OpenRocket roles.

| Package                 | Physical component         | Configurable features                                          |
| ----------------------- | -------------------------- | -------------------------------------------------------------- |
| `rocket-body-tube`      | Open airframe tube         | Outside diameter, wall and length                              |
| `rocket-coupler`        | Open joining sleeve        | Outside diameter, wall and engagement length                   |
| `rocket-centering-ring` | Annular tube support       | Outside diameter, bore and thickness                           |
| `rocket-bulkhead`       | Circular bay plate         | Outside diameter, optional central hole and thickness          |
| `rocket-avionics-sled`  | Electronics mounting plate | Plate envelope and four-hole rectangular mounting pattern      |
| `rocket-rail-button`    | Two-flange guide button    | Flanges, groove root/width, through bore and screw-head recess |
| `rocket-prep-cradle`    | One flat-bottom V support  | Width, depth, height, V opening and retained floor             |

The original seven packages introduced **21 prototype presets**, editable dimensions, preview, STL and a native FreeCAD recipe. The later OpenRocket extension adds two tube-role examples and one engine-block ring example to these packages. Every configuration describes one physical detail. Add separate project occurrences for multiple cradles or buttons; fasteners and electronic boards remain separate library items. The existing airframe and recovery mechanisms remain available alongside these details.

## Dimensions and evidence

Tube, sleeve, ring, bulkhead, sled and cradle dimensions are authored metric examples. The tube presets have 51, 71 and 95 mm bores; the example couplers use 50.5, 70.5 and 94.5 mm outside diameters, respectively, leaving 0.5 mm diametral layout clearance. That allowance is a design input rather than a verified manufacturing fit. Check the separate joint engagement, tolerances and attachment in the actual project.

The rail button's small and large presets borrow only the rounded metric outside envelopes in [Apogee's rail-button comparison](https://apogeerockets.com/building_supplies/rail_buttons/1in_1010_rail_button_standard), reviewed 2026-10-25. Groove geometry, screw bore and head recess are authored dimensions. The source also prints rounded inch dimensions, which are not exact equivalents. The examples do not establish compatibility with 1010 or 1515 rails and intentionally have no verified catalog identity. Measure the actual rail channel and selected hardware before defining a fitting part.

No added preset claims a supplier SKU, material grade or operating load rating. Package `GUIDE.md` files document local geometry, origins, interfaces and manufacturing requirements. Release requires actual material, tolerances, attachment and load verification appropriate to the component.

## Verification

The focused tests in `tests/ldrs-library.test.ts` check registration, search by event name, preset validity, analytic material volumes, clear axial bores, rail flange/groove/recess geometry, all four sled holes, cradle contact geometry and invalid dimension combinations. The existing per-part contracts additionally check preview bounds, finite mesh data, binary STL and generated FreeCAD macro structure.

On 2026-10-25 all 21 complete preset macros were executed in FreeCAD 1.1.4. Every result had one valid, closed, positive-volume solid and matched its declared envelope within 0.01 mm. All 21 STEP exports reopened with one valid closed solid and conserved volume within the audit tolerance. This verifies the nominal geometry, not component strength or measured fits.

```sh
node --import tsx --test tests/ldrs-library.test.ts
PROTOLAB_TEST_PARTS='["rocket-body-tube","rocket-coupler","rocket-centering-ring","rocket-bulkhead","rocket-avionics-sled","rocket-rail-button","rocket-prep-cradle"]' node --import tsx --test tests/parts-catalog-*.test.ts
npm run typecheck
npm run build
```

These checks establish geometric and application behavior. They do not qualify a component for flight or establish measured supplier compatibility.
