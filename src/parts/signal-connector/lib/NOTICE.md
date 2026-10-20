# Connector geometry attribution

Native geometry and preview derivatives in `native/*.json` are derived from the KiCad community 3D library, pinned to the 9.0.1 release. The individual original STEP paths and SHA-256 hashes are recorded in `catalog.json` and in each native asset. Original PCB coordinates and source surfaces are retained; preview triangulation was added by ProtoLab-3D. Complete uniform-solid STEP surface colors are retained where available; mixed or incomplete source styles use explicitly illustrative fallback colors, as recorded in `color-evidence.json`. No source solid was omitted or geometrically repaired.

These assets are redistributed under **Creative Commons Attribution-ShareAlike 4.0 with the KiCad library exception**, as supplied by the upstream library. This applies to the geometry collection and its derivatives; it does not change the license of unrelated application code. See [KiCad-LICENSE.md](attribution/KiCad-LICENSE.md), [CC BY-SA 4.0 legal text](https://creativecommons.org/licenses/by-sa/4.0/legalcode), and the upstream credits copied verbatim alongside the license.

Attribution: KiCad library contributors. The supplied USB credits identify Joan Obijuan, Rene Poeschl and Frank Shackmeister; coaxial credits identify Frank Severinsen/Shackmeister. Remaining per-library credits and generator links are retained verbatim where present in the pinned source. Libraries without a credits file at that release retain their KiCad community attribution and per-file STEP source links.

Upstream collection: https://gitlab.com/kicad/libraries/kicad-packages3D/-/tree/9.0.1

The model references do not imply endorsement by KiCad or by a named connector manufacturer. Several source models deliberately simplify contacts; see the guide and model-specific catalog limitations.
