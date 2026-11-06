# TR8 regression verification

Review date: 2026-11-03. This correction changes tests, fixtures and this record;
it does not change the mechanisms, native constructors, materials or load paths.

## Preserved sources and explicit revisions

The original checkpoints remain in
`tests/fixtures/tr8-geared-rocker-before-c4-sha256.json`. The preservation test
still verifies the single actuator and both Surpass motor families against those
checkpoints, applying the existing narrowly defined naming/catalog projections.
Two nongeometric files have separately reviewed revisions in
`tests/fixtures/tr8-reviewed-source-revisions.json`:

- `surpass-2845/configurator.ts`: historical SHA-256
  `dc7ac904ba9aadc7959225f397ff28cd3f5dc712d0825567110b61f50b896b5f`;
  reviewed current SHA-256
  `4462ef5896fcada7ac165d3856d626eaf4db19d1b6764ebffcc5f32c8c9841e8`.
  The historical source text was not available, so this is an explicit reviewed
  revision, not a claim of unchanged bytes or a reconstructed textual diff.
  The current file exports a fixed `surpass-2845-3100kv` default, the actual
  preset model choices, an optional `shaftAngle` pose control and catalog filter
  metadata. Its pose is available only for an explicitly supplied angle in the
  custom cross-drilled state, uses degrees and retains the existing ±1,000,000°
  finite range. Physical identity excludes this pose. The motor `part.ts`,
  `lib/model.ts`, `presets.json`, `product.json` and component guide retain their
  historical checks. The source-qualified stock dimensions and separate shaft
  machining execution are also covered by
  `tests/surpass-2845-shaft-machining.test.ts`.
- `tr8-geared-rocker-actuator/README.md`: historical SHA-256
  `ad5f7ac8f16374c3edb846c2ebd90d223335b3295ce679775f6b05f0d730da2c`;
  previously reviewed universal README SHA-256
  `970063ecc8dbdbddc08d73620c31ab1396c475f345eec521888b7c5cba06b714`;
  current SHA-256
  `2db077f5904fbc67c3605ec784a28c6746afd231e670512ef5e6c7120edb7a11`.
  Repository cleanup restored the mandatory universal package README. Its
  handoff instructions now retain external source links. The test
  compares it directly with `PACKAGE_README`; the component-specific `GUIDE.md`
  remains checked against its historical source hash.

The compact quad's execution metadata was already relocated from `part.ts` to
its `index.ts` module wrapper, as recorded by
`tests/fixtures/mechanism-component-name-deltas.json`. Its test now reads the
registered module's four-output metadata and confirms that the wrapper retains
the same geometry builder. The existing eight-motor, component, placement,
travel, pin, bearing and thread checks remain.

## Gear preview sampling

The old curve preview sampler selected existing stations nearest to equal
polyline distances. The current shared sampler interpolates along traces and
uses the defined circular arcs. Replaying the archived station-selection method
reproduced both old regression constants; the changed mesh volume is a preview
sampling effect. The 5 mm tooth face has sampled profile areas of
439.4327416912197 mm² before and 439.3932956522875 mm² now. Their area difference
predicts −0.1972301947 mm³ before mesh Boolean/Float32 processing.

| Gear         | Reproduced historical preview, mm³ | Current preview, mm³ |   Change, mm³ |
| ------------ | ---------------------------------: | -------------------: | ------------: |
| Driven gear  |                    2373.1906916901 |      2372.9941216632 | −0.1965700269 |
| Motor pinion |                    2567.3341598390 |      2567.1364364709 | −0.1977233680 |

`tests/fixtures/tr8-geared-rocker-preview-sampling.json` retains both values.
The placed-gear test keeps its **0.01 mm³** regression tolerance at −20°, 0°
and +20°, together with the diameter, axial envelope, positive volume,
nondegenerate triangles and closed oriented edge checks. It also verifies the
unchanged native constructor hashes:

- Driven gear:
  `52dd110be0b5aec9355b9463928e4923255d4e44b28b201fe19c496edc087919`.
- Motor pinion:
  `e2cdabc0697f01dd9db66cd893b949ca7544ee6d53b1dc9bdf06ab1e7955ac99`.

The existing independent sampling tests additionally retain over 60% triangle
reduction, less than 0.5% volume difference from the dense preview and less than
0.05 mm profile deviation. Measured maximum deviations are 0.03689 mm for the
driven gear and 0.03696 mm for the pinion. Those dense-preview criteria do not
assert the same volume threshold against native CAD.

## Native geometry check and limits

The current constructors were executed in FreeCAD 1.1.4. Both gears are valid,
closed single solids; their surfaces include native cylinders and planes plus
the intended spline tooth surfaces. The driven gear has 154 faces and the
pinion 151. Both STEP reloads are valid closed single solids and meet the
existing TR8 verifier's volume agreement criterion:
`max(0.0001 mm³, native volume × 0.000001)`.

| Gear         | Native volume, mm³ | STEP volume change, mm³ | Preview/native volume difference |
| ------------ | -----------------: | ----------------------: | -------------------------------: |
| Driven gear  |    2383.2090452358 |           +0.0011247777 |                        0.428621% |
| Motor pinion |    2580.0850758704 |           −0.0000495519 |                        0.501869% |

The preview/native differences are recorded limitations of the coarse display;
this correction assigns no new native-volume acceptance threshold and does not
replace source curves with preview facets.

An independent transverse-drill check integrates the intersection of a drill
with an annular Ø12 hub. With drill radius `r`, bore radius `b`, outer radius
`R = 6 mm` and `y = r sin(θ)`, the removed volume is the integral from −π/2 to
+π/2 of `4 r² cos²(θ) [sqrt(R² − r² sin²(θ)) − sqrt(b² − r² sin²(θ))]`.
Simpson integration with 10,000 intervals gives 18.9200260107 mm³ for the Ø2
driven-gear drill and 6.9542674855 mm³ for the Ø1 pinion drill. Native Boolean
volume differences are 18.9177002788 and 6.9542228032 mm³, respectively, within
the check's 0.1% numerical agreement criterion. The numerical residuals are
recorded rather than claimed to be exact analytic equality.

These checks concern source preservation, geometry and finite inspection poses.
They establish no new strength, life, drive, continuous-motion or manufacturing
qualification. Raw reproduction inputs, executed scripts, native reports and
STEP files are local outputs under ignored `test-results/refactor-tr8/`.

## External source references

The GMP16T-TEC1636 source URL now points to the exact TT Motor data sheet. The
supplied KAIYADE SFK and LF D14 L22 evidence retains its attribution without a
verified public URL. TR8 H-flange nut occurrences record the supplied drawing by
name. These changes affect catalog and procurement metadata.

Historical source checks reverse only the exact reviewed reference text in
`tests/fixtures/mechanism-external-reference-deltas.json` and the shared handoff
sentence. The earlier SFK neutral assembly and the TR8 CNC occurrence checks
also verify the current source fields before restoring their historical values
for hashing. The original historical checksums, physical parameters, geometry
and installed occurrence data remain covered.
