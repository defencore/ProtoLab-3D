# SOURCE ONE upstream CAD attribution

Source: [tbs-trappy/source_one](https://github.com/tbs-trappy/source_one), a collaborative FPV frame project initiated by Team BlackSheep.

Native file: `SO_V5.iges`, revision `07a8690c6bd73e1300197845eda2ebe547c3a158`.

Corresponding source: https://raw.githubusercontent.com/tbs-trappy/source_one/07a8690c6bd73e1300197845eda2ebe547c3a158/SO_V5.iges

The upstream project states that frame files are released under **GPL version 3** in its [project README at be104eeb](https://github.com/tbs-trappy/source_one/blob/be104eeb708c2ae610ffe7d28d363f2d273cf8a7/README.md#project-license). Source geometry data and derivatives in `source.json` retain GPL-3.0-only terms and the upstream authors' attribution; see [the GPL v3 license](https://www.gnu.org/licenses/gpl-3.0.html). The software loader does not grant a proprietary license to this CAD data.

Changes: split the upstream compound into 57 physical solids, rigidly changed origin/axes, stored lossless compressed native BRep and a 0.025 mm chord preview mesh. No source plate, arm or mounting interface was redesigned. Source geometry is not rescaled. The extraction script and original source URL provide the corresponding editable CAD.

This is an upstream reference model. It does not assert that ProtoLab is the manufacturer, that a reproduction uses the original laminate or hardware, or that any user-selected flight mass has been qualified. The old generic 21-frame designs are not used as a fallback.


## Additional original frame projects

The following source CAD and its derivatives in `additional.json`, `fabrication.json` and the frame cutting layouts are GPL-3.0-only. Original project authors and Team BlackSheep retain their attribution. [COPYING.txt](COPYING.txt) contains the GPL v3 terms.

- SOURCE TWO V0.1: [ps915/source_two](https://github.com/ps915/source_two), revision `010ade994a150b2971123d6e0a141ed6f69c57fe`; corresponding source [Source Two v0.1.step](https://raw.githubusercontent.com/ps915/source_two/010ade994a150b2971123d6e0a141ed6f69c57fe/Source%20Two%20v0.1.step). Retains 30 frame occurrences; omits overlapping accessory alternatives 30–33. Rigid origin/axis change only.
- SOURCE V V1 upgraded arms: [ps915/source_v](https://github.com/ps915/source_v), revision `ce54d3bae424068fa7f870cb010af86248fa489b`; corresponding source [source_v_V1_upgraded_arms.step](https://raw.githubusercontent.com/ps915/source_v/ce54d3bae424068fa7f870cb010af86248fa489b/source_v_V1_upgraded_arms.step). Wraps 18 closed shells as solids; does not sew, repair or scale geometry. Assembly hardware absent from source is not invented.
- SOURCE PODRACER V1: [ps915/source_podracer](https://github.com/ps915/source_podracer), revision `9b2d56d92c26a42d8d5cbb88507788389db0317c`; corresponding source [Source_PodRacer_v1.0_assembled.step](https://raw.githubusercontent.com/ps915/source_podracer/9b2d56d92c26a42d8d5cbb88507788389db0317c/Source_PodRacer_v1.0_assembled.step). Retains the seven native components of the four-arm 5 inch assembly, including the nylon pod and countersinks.

All source-native BReps are losslessly compressed. Previews are tessellated at 0.025 mm; sheet cutting layouts are flattened from native planar faces, retaining circles/arcs and approximating other curves to 0.005 mm. SOURCE ONE assembly-only translations fix twelve underside bearing planes by -0.5 mm and two front deck screws by -2 mm. The local drawing labels the CAD lower plate 2.5 mm rather than the upstream DXF filename's 2 mm. These modifications are recorded in the frame guide and load-case export; they are not claimed to be an upstream update.

The PODRACER OCC preview omits four analytic countersink cone faces and a small canopy seam patch. `repair-preview.py` bridges each cone's existing native circular rim samples without closing its bore, and closes the seven-edge seam omission (under 0.31 x 0.31 x 0.007 mm). This affects the display/mesh only. Source BRep, countersink dimensions and native STEP export remain unchanged. Closed oriented mesh checks include these components; native geometry is verified separately.

Project naming requirements apply to manufactured derivatives; use a manufacturer prefix and the exact source version, and a different project name for a design fork. Inclusion in ProtoLab does not assert affiliation or product certification. The linked editable original CAD and extraction scripts provide the corresponding source.

SOURCE V retains 20 measured nominal tab interferences (0.165–0.560 mm3); pairs and volumes are recorded in `source-v-fit-checks.json`. This is an open fabrication-fit issue, not a claim that those slots are clearance fits. Native export remains available with that issue explicitly reported.

## Six- and eight-motor designs

**SOURCE ONE V4 X8 LIFTER**, by shnllsfpv, based on SOURCE ONE V4. [Pinned repository](https://github.com/shnllsfpv/source_one_X8_lifter/tree/96382c5c8646e8c706dee6a28d13e33177b05b36); corresponding source [SO_v4_X8_LIFTER.stp](https://raw.githubusercontent.com/shnllsfpv/source_one_X8_lifter/96382c5c8646e8c706dee6a28d13e33177b05b36/SO_v4_X8_LIFTER.stp). GPL-3.0-only. Retains all 23 native occurrences; origin changed rigidly to the mean of the four shaft axes. No contours or individual poses changed. Source lower-deck/camera-cheek tab interferences are retained and reported. CAD and author bill quantities differ; see the frame guide.

**COMET Y6**, by Christoph Boehm, Roman Beneder and the COMET contributors at UAS Technikum Wien. [Pinned repository and editable FreeCAD sources](https://github.com/uastw-embsys/comet/tree/9837b8dc6f6ddd623634a82f7f9fa2ca6588c662). Hardware is CERN-OHL-W-2.0, with the full terms in [CERN-OHL-W-2.0.txt](CERN-OHL-W-2.0.txt). Corresponding CAD files are under [mechanical/source/parts](https://github.com/uastw-embsys/comet/tree/9837b8dc6f6ddd623634a82f7f9fa2ca6588c662/mechanical/source/parts); imported STEP files are `rotor_arm.step`, `motor_mount.step`, `mounting_plate.step`, `landing_gear_mount.step` under `mechanical/exports/step`. Their individual URLs and SHA256 hashes are stored with each component. Assembly source SHA256 is a manifest digest: SHA256 of those four ordered SHA256 hex strings, not a hash of a single STEP file.

Local modifications to COMET are rigid assembly placements only: 17 occurrences of the four unchanged source parts. Poses follow native mounting holes and the author build manual, including unequal front/rear root geometry, paired outward-facing motor blocks and three landing legs. There is no upstream assembly file at this revision. Native source printing poses are restored for print inspection. No source solid is scaled or redrawn. `extract-multirotors.py` is the local assembly/extraction source and records every placement. Native BRep, previews and associated metadata in `multirotors.json` retain their respective project licenses; the two projects are distinct entries and are not a merged design.

The original source repositories provide the preferred editable CAD. Copies of the covered source, local extraction/assembly scripts, attribution and license terms must accompany redistribution as required by the applicable license. Manufacturing and source geometry checks do not establish flight qualification.
