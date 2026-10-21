# Rebuild the real frame assets

Sources, pinned revisions, corresponding CAD URLs and source licenses and attribution are listed in `src/parts/multicopter-frame-component/lib/NOTICE.md`. Original archives remain external; generated native BRep and mesh derivatives live in the package.

1. Download the three pinned additional STEP files to `/tmp/real-frames/source-two.step`, `source-v.step` (the upgraded-arms file) and `podracer.step` (the assembled five-inch file).
2. In FreeCAD, execute `extract-frames.py` with `__file__` set to its absolute path. It uses the existing SOURCE ONE `source.json`; to rebuild that file first, run `extract.py` with `SOURCE_ONE_IGES` pointing at the pinned original IGES.
3. Run `python3 scripts/source-one/repair-preview.py`. It repairs the documented OCC preview omissions and compresses the mesh buffers. It never edits native BRep.
4. Download the pinned X8 `SO_v4_X8_LIFTER.stp` as `/tmp/multi-rotor-frames/source-x8.step`, and the four COMET STEP files as `comet-arm.step`, `comet-mount.step`, `comet-plate.step`, `comet-gear.step` in that directory. Exact URLs, revisions and file hashes are in `extract-multirotors.py` and `lib/multirotors.json`. Execute `extract-multirotors.py` with FreeCAD Python. It verifies all hashes, retains source BReps, reconstructs COMET poses from mounting datums and updates flat sheet contours for all six projects.
5. With `ezdxf` available, run `python3 scripts/source-one/cutting-frames.py` to create CAD-matched DXF layouts from the extracted planar-face contours. Countersinks are a separate finishing operation.
6. Run `node --import tsx scripts/verify-multicopter-manufacturing.ts`, then execute `verify-multicopter-manufacturing.py` inside FreeCAD. Reports, native exports and macros are written under ignored `test-results/real-frame-audit/`. The report explicitly leaves flight qualification open.

The older `cutting.py` reproduces the original SOURCE ONE drawing reference with its upstream two-millimetre filename; it does not produce the CAD-matched manufacturing layout.
