"""Export the matching TS-prepared field DAQ source to native CAD and print meshes.

Usage: FreeCAD Python scripts/export-field-daq-enclosure.py [output-directory]
Run the TypeScript preparer first. All exported coordinates use millimetres.
"""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import zipfile

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
import Mesh
import MeshPart


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'test-results/field-daq-enclosure').resolve()
INPUT = OUTPUT / 'native-input.json'
source = json.loads(INPUT.read_text())
assert source['partId'] == 'field-daq-enclosure' and source['unit'] == 'mm'
assert source.get('revision') == 'R3', 'Regenerate Revision 3 input; earlier enclosure files are withdrawn.'
assert source['codeSha256'] == hashlib.sha256(source['code'].encode()).hexdigest()
for relative, expected in source['sourceHashes'].items():
    assert hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() == expected, 'Stale prepared input: ' + relative


def evaluate(code):
    scope = {'App': App, 'Part': Part, 'math': math}
    exec(code, scope)
    return scope


def check_shape(shape, label):
    assert not shape.isNull(), label + ': null solid'
    assert shape.isValid(), label + ': invalid BRep'
    assert shape.isClosed(), label + ': open BRep'
    assert len(shape.Solids) == 1, label + ': disconnected component'
    assert shape.Volume > 0, label + ': zero volume'
    box = shape.BoundBox
    return {'valid': True, 'closed': True, 'solids': len(shape.Solids),
            'volumeMm3': shape.Volume, 'dimensionsMm': [box.XLength, box.YLength, box.ZLength]}


def mesh_export(shape, path, normalize=False):
    specimen = shape.copy()
    if normalize:
        box = specimen.BoundBox
        specimen.translate(App.Vector(-box.XMin, -box.YMin, -box.ZMin))
    mesh = MeshPart.meshFromShape(Shape=specimen, LinearDeflection=.06,
                                  AngularDeflection=.15, Relative=False)
    assert mesh.isSolid() and mesh.CountFacets > 0, path.name + ': open tessellation'
    mesh.write(str(path))
    reloaded = Mesh.Mesh(str(path))
    assert reloaded.isSolid() and reloaded.CountFacets == mesh.CountFacets, path.name + ': invalid STL round trip'
    box = specimen.BoundBox
    return {'name': path.name, 'facets': mesh.CountFacets, 'closedStl': True,
            'bedZMm': box.ZMin, 'dimensionsMm': [box.XLength, box.YLength, box.ZLength],
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}

library_checks=[]
for entry in source.get('connectorLibraryAudit',[]):
    instance=evaluate(entry['code'])
    checked=[check_shape(shape,entry['id']+'/'+str(i+1)) for i,shape in enumerate(instance['components'])]
    library_checks.append({'id':entry['id'],'state':entry['state'],'components':len(checked),'valid':True,'volumeMm3':sum(row['volumeMm3'] for row in checked)})


scope = evaluate(source['code'])
solids = scope['components']
assert len(solids) == len(source['components']), 'Assembly metadata/geometry mismatch'
assert len(solids) == 28, 'R3 requires 16 prints, four screws, four nuts and four steel washers.'
document = App.newDocument('FieldDAQ')
document.Label = 'Field DAQ R3 / fit-check prototype'
features = []
native_rows = []
for index, (record, solid) in enumerate(zip(source['components'], solids)):
    native_rows.append({'id': record['id'], 'label': record['label'], **check_shape(solid, record['id'])})
    feature = document.addObject('Part::Feature', 'DAQ_%02d' % (index + 1))
    feature.Label = record['id'] + ' | ' + record['label']
    feature.Shape = solid
    for prop, value in [('Material', record['material']), ('ComponentId', record['id']), ('Supply', record['supply'])]:
        feature.addProperty('App::PropertyString', prop, 'DAQ')
        setattr(feature, prop, value)
    if App.GuiUp:
        color = record['color']
        feature.ViewObject.ShapeColor = ((color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255)
    features.append(feature)
document.recompute()
native_path = OUTPUT / 'FieldDAQ-assembly.FCStd'
step_path = OUTPUT / 'FieldDAQ-assembly.step'
document.saveAs(str(native_path))
Part.export(features, str(step_path))
assert step_path.stat().st_size > 1000
reimported = Part.read(str(step_path))
assert reimported.isValid() and len(reimported.Solids) == len(solids), 'STEP solid-count round trip mismatch'
assert abs(reimported.Volume - sum(solid.Volume for solid in solids)) < 1e-3, 'STEP volume round trip mismatch'

# Exact native-kernel assembly checks supplement the independently tested mesh witnesses.
inspection = evaluate(source['audit']['code'])['components']
by_id = dict(zip(source['audit']['ids'], inspection))
hard_ids = ['base', 'wall', 'lid', 'panel', 'board-retainer']
fit_checks = []
for i, first in enumerate(hard_ids):
    for second in hard_ids[i+1:]:
        overlap = by_id[first].common(by_id[second]).Volume
        assert overlap < 1e-5, first + '/' + second + ': hard CAD interference'
        fit_checks.append({'first': first, 'second': second, 'overlapMm3': overlap})
for reference in [key for key in by_id if key.startswith('reference-')]:
    if reference not in by_id:
        continue
    for hard in hard_ids:
        overlap = by_id[hard].common(by_id[reference]).Volume
        assert overlap < 1e-5, reference + '/' + hard + ': installation interference'
        fit_checks.append({'first': reference, 'second': hard, 'overlapMm3': overlap})

# R3 closure proof: tightening must bear against the base-owned nut roof and
# the metal washer must seat against PETG independently of the soft seal.
closure_checks = []
design = source['layout']
for index, (x, y) in enumerate(design['screwAxes'], 1):
    nut = by_id['nut-' + str(index)]
    washer = by_id['head-washer-' + str(index)]
    screw = by_id['screw-' + str(index)]
    nut_overlap = nut.common(by_id['base']).Volume
    assert nut_overlap < 1e-5, 'R3 nut/base nominal interference'
    lifted_nut = nut.copy()
    lifted_nut.translate(App.Vector(0, 0, .1))
    upward_stop = lifted_nut.common(by_id['base']).Volume
    assert upward_stop > .01, 'R3 nut lacks a base-owned axial roof'
    lowered_base = by_id['base'].copy()
    lowered_base.translate(App.Vector(0, 0, -.1))
    base_stop = lowered_base.common(nut).Volume
    assert base_stop > .01, 'R3 base can separate past the loaded nut'
    roof_z = design['nutInstalledZ'] + design['nutHeight']
    roof_probe = Part.makeCylinder(2.4, .05, App.Vector(x, y, roof_z)).cut(
        Part.makeCylinder(1.9, .07, App.Vector(x, y, roof_z-.01)))
    roof_escape = roof_probe.cut(by_id['base']).Volume
    assert roof_escape < 1e-6, 'R3 nut bearing roof is incomplete'
    nominal_washer_overlap = washer.common(by_id['lid']).Volume
    assert nominal_washer_overlap < 1e-5, 'R3 washer/lid nominal interference'
    lowered_washer = washer.copy()
    lowered_washer.translate(App.Vector(0, 0, -.01))
    hard_seat_stop = lowered_washer.common(by_id['lid']).Volume
    assert hard_seat_stop > .01, 'R3 steel washer has no positive PETG bearing seat'
    seat_probe = Part.makeCylinder(3.45, .05, App.Vector(x, y, 44.75)).cut(
        Part.makeCylinder(2.95, .07, App.Vector(x, y, 44.74)))
    seat_escape = seat_probe.cut(by_id['lid']).Volume
    assert seat_escape < 1e-6, 'R3 PETG hard annulus is incomplete'
    assert abs(washer.BoundBox.ZMin-44.8) < 1e-6 and abs(washer.BoundBox.ZMax-45.3) < 1e-6
    assert abs((screw.BoundBox.ZMax-3)-45.3) < 1e-6, 'R3 screw head does not seat on the steel washer'
    closure_checks.append({'axis': index, 'nutBaseNominalOverlapMm3': nut_overlap,
                           'liftedNutRoofStopMm3': upward_stop, 'loweredBaseNutStopMm3': base_stop,
                           'roofProbeEscapeMm3': roof_escape,
                           'washerLidNominalOverlapMm3': nominal_washer_overlap,
                           'loweredWasherHardSeatStopMm3': hard_seat_stop,
                           'hardSeatProbeEscapeMm3': seat_escape,
                           'washerZMm': [washer.BoundBox.ZMin, washer.BoundBox.ZMax],
                           'screwUnderHeadZMm': screw.BoundBox.ZMax-3})

retention_spec = importlib.util.spec_from_file_location(
    'field_daq_retention_checks', ROOT / 'scripts/field-daq-retention-checks.py')
retention_module = importlib.util.module_from_spec(retention_spec)
retention_spec.loader.exec_module(retention_module)
retention_checks = retention_module.verify_retention(source, by_id, evaluate)

installation = App.newDocument('FieldDAQInstallation')
installation.Label = 'Field DAQ R3 / installation inspection'
installation_rows = []
def installation_feature(record, solid, label=None, color=None, suffix=''):
    feature = installation.addObject('Part::Feature', 'Installation_%03d' % (len(installation_rows)+1))
    feature.Label = record['id'] + suffix + ' | ' + (label or record['label'])
    feature.Shape = solid
    rgb = color or [((record['color'] >> shift) & 255)/255 for shift in (16,8,0)]
    feature.addProperty('App::PropertyString','ComponentId','DAQ')
    feature.ComponentId = record['id'] + suffix
    feature.addProperty('App::PropertyString','Material','DAQ')
    feature.Material = record.get('material','Reference')
    feature.addProperty('App::PropertyString','LibraryId','DAQ')
    feature.LibraryId = record.get('libraryId','manufactured-detail')
    feature.addProperty('App::PropertyString','SourceColorRGB','DAQ')
    feature.SourceColorRGB = json.dumps(rgb)
    if App.GuiUp: feature.ViewObject.ShapeColor = tuple(rgb)
    installation_rows.append({'id':feature.ComponentId,'label':feature.Label,'material':feature.Material,'libraryId':feature.LibraryId,'color':rgb,'supply':record.get('supply','reference')})
for record, solid in zip(source['audit']['records'], inspection):
    if record['libraryId'] != 'waterproof-connector':
        installation_feature(record,solid)
for record in source['audit']['connectors']:
    appearance = evaluate(record['appearanceCode'])
    for i, local in enumerate(appearance['components']):
        placed = local.copy()
        for axis,angle in zip((App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)),record['placement']['rotation']):
            if angle: placed.rotate(App.Vector(),axis,angle)
        placed.translate(App.Vector(*record['placement']['translation']))
        installation_feature(dict(record,color=0x303b42,libraryId='waterproof-connector',material='Library connector',supply='reference'), placed,
            record['label']+' / '+appearance['component_labels'][i],list(appearance['component_colors'][i]),'-%02d' % (i+1))
installation.recompute()
installation_path=OUTPUT/'FieldDAQ-installation.FCStd'
installation.saveAs(str(installation_path))
(OUTPUT/'installation-components.json').write_text(json.dumps(installation_rows,indent=2)+'\n')

stl_rows = []
for record in source['print']:
    print_scope = evaluate(record['code'])
    print_solids = print_scope['components']
    assert len(print_solids) == 1, record['id'] + ': expected one printable'
    shape = print_solids[0]
    native = check_shape(shape, record['id'])
    mesh = mesh_export(shape, OUTPUT / record['name'], normalize=True)
    stl_rows.append({'id': record['id'], 'label': record['label'], 'material': record['material'], **native, **mesh})
    print('EXPORTED=' + record['name'], flush=True)

# This compound is an installation preview only: soft seals intentionally overlap
# their compression lands. The separate normalized meshes are the print inputs.
preview_mesh = MeshPart.meshFromShape(Shape=Part.makeCompound(solids), LinearDeflection=.1,
                                      AngularDeflection=.2, Relative=False)
preview_mesh.write(str(OUTPUT / 'FieldDAQ-assembly-preview-DO-NOT-PRINT.stl'))

report = {
    'partId': source['partId'], 'passed': True, 'unit': 'mm',
    'revision': source['revision'], 'releaseStatus': source['releaseStatus'],
    'inputSha256': hashlib.sha256(INPUT.read_bytes()).hexdigest(),
    'assemblyCodeSha256': source['codeSha256'], 'sourceHashes': source['sourceHashes'],
    'parameters': source['parameters'], 'nativeComponents': native_rows,
    'printableCount': len(stl_rows), 'printables': stl_rows,
    'stepRoundtrip': {'valid': True, 'solids': len(reimported.Solids), 'volumeMm3': reimported.Volume},
    'nativeFitChecks': fit_checks,
    'nativeClosureLoadPathChecks': closure_checks,
    'nativeBoardRetentionChecks': retention_checks,
    'nominalSealDesign': {
        'perimeterFreeCrossSectionMm': [1.35, 1.2], 'perimeterGlandMm': [2.0, .96],
        'perimeterVolumeFillFraction': 1.35*1.2/(2*.96),
        'underWasherSealOuterRadiusMm': 2.42, 'underWasherSealInnerRadiusMm': 1.4,
        'underWasherInstalledShaftRadiusMm': 1.5, 'underWasherSealRadialInterferenceMm': .1,
        'underWasherSealFreeThicknessMm': .8, 'underWasherSealInstalledThicknessMm': .6,
        'underWasherNominalVolumeFillFraction': (2.42**2-1.4**2)*.8/((2.9**2-1.5**2)*.6),
        'cassetteMaximumInwardTravelMm': design['cassetteInwardTravel'],
        'cassetteBottomChannelHeightMm': 2.6, 'cassetteInstalledGapMm': [1.1, 1.2],
        'cassetteNominalVolumeFillFraction': [1.5*1.6/(2.6*1.2), 1.5*1.6/(2.6*1.1)],
        'cassetteCompressionRestraint': 'Zero outward float; continuous bottom rib, top back rail and lid brace limit inward travel',
        'scope': 'Nominal CAD targets; physical compression, sealing and ageing remain unqualified',
    },
    'installationObjects': len(installation_rows),
    'connectorLibraryNativeChecks': library_checks,
    'hardwareBOM': {'M3ClosureScrews': 4, 'M3HexNuts': 4, 'M3SteelFlatWashers3_2x7x0_5': 4,
                    'printedOccurrences': 16, 'physicalOccurrences': 28},
    'limitations': [
        'Native validity and closed STL tessellation do not qualify printability, fit or environmental sealing.',
        'Assembly preview contains free-state TPU compression interference; use the separate normalized print files.',
        'Connector mounting dimensions and PCB contact lands require physical measurement.',
        'PCB assembly motion is qualified for bare reference substrates; actual protruding solder and leads require trimming or a physical path test.',
        'R3 targets rain, wet ground, dirt, snow and meltwater; physical ingress, cold handling and impact qualification remains required.',
    ],
}
(OUTPUT / 'native-export-report.json').write_text(json.dumps(report, indent=2) + '\n')
readme = f'''Field DAQ enclosure — REVISION 3 / fit-check prototype print bundle

Read REVISION.txt. R3 replaces the earlier enclosure files; do not mix revisions.

Units: millimetres. This bundle: {source['parameters']['sensorCount']} SP20 apertures,
220 x {source['parameters']['bodyWidth']} x 46 mm core, with a
222.4 x {source['parameters']['bodyWidth'] + 2.4:.1f} mm overhanging lid, M3 × {source['parameters']['screwLength']} closure screws,
1.6 mm PCB thickness, 0.25 mm per-side fit clearance.

Open FieldDAQ-installation.FCStd to inspect the boards and actual SP16/SP20
library connector models on the opposite narrow ends. Contact and wire
details retain the library source limitations; these are not printed parts.

Open FieldDAQ-assembly.FCStd for separate enclosure BRep component objects,
or FieldDAQ-assembly.step for exchange. FieldDAQ-source.FCMacro recreates
the matching assembly. These are source-generated solids, not a feature-history model.

Print the individually named PETG and TPU STL files. Each is independently
placed at Z0, with its intended bed face down. Print the fit coupon first.
R3 contains 16 printed occurrences: five PETG and eleven TPU details.
The PETG board-retainer is separate from the lid; print it groove-roof down.
Print the 34 x 104 mm retention coupon before the full base; use the production
bridge and bare PCB strips to check the central grooves, bayonet, release and
broad open triangular inner-corner pockets. These pockets constrain local lateral
motion while preserving the inward slide and vertical PCB service path.
Both coupons are test fixtures and are excluded from the 28-part assembly BOM.
Install boards in their outer pockets first, then insert the central bridge
with its leaf held 0.9 mm up; keep it raised while sliding +Y3 mm, then release
the leaf into its catch. Do not force the unramped nose through the catch. Its roofs and the base
ledges form positive central grooves; pads and lid friction are not the retention.
The lid rear post blocks unlocking even if the leaf fails.
For service remove the lid, lift the leaf 0.9 mm with a nail or 2.5 mm Allen key,
slide the bridge -Y3 mm and lift it, then slide one PCB inward 9.5 mm and lift.
Bare PCB motion is checked; protruding solder/leads need trimming or a physical
path test. Do not assume a universal lead-clearance allowance.
The fit coupon side-loaded nut trap checks insertion, roof capture and thread start only;
the blind tip well is not a full-tightening fixture for an M3 x 30 screw.
Alternative compatible sensor cassettes are included; choose one cassette.
Compact width 116 supports two, three or blank. Width 164 supports up to four.
Cassettes must match the enclosure width. All connectors are on narrow X ends.
Repeated pad/seal files represent separate occurrences.
Do not print FieldDAQ-assembly-preview-DO-NOT-PRINT.stl as one object.

Hardware: four M3 × {source['parameters']['screwLength']} socket cap screws, four M3 hex nuts (nominal
5.5 mm across flats × 2.4 mm high), and four steel M3 flat washers
3.2 x 7 x 0.5 mm (ISO 7089 / DIN 125). The washers are required in R3.
Slide each nut sideways below its base-owned bearing roof before fitting the wall.
The steel washer seats on a PETG hard annulus; its small TPU seal is underneath.
Seal free dimensions are OD4.84 / ID2.8 x 0.8 mm, with 0.1 mm radial interference
on the 3 mm shaft and approximately 84.3% nominal installed-volume fill.
Actual thread roughness and wet sealing require physical tests.
Check the delivered stock. M3 × 25
requires regenerating the matching base; M3 × 50 is not supported.

Read GUIDE.md for board insertion, connector checks, print starting points,
TPU handling, wiring clearance and sealing tests. Target exposure is wet ground,
dirt, rain, snow and meltwater. Physical ingress, cold handling and impact tests
remain required. No IP or impact rating is assigned.
native-export-report.json records CAD topology and the implemented geometry checks.
'''
(OUTPUT / 'PRINT-README.txt').write_text(readme)

bundle = OUTPUT / 'FieldDAQ-print-and-CAD-bundle.zip'
bundle_files = [native_path, step_path, OUTPUT / 'FieldDAQ-source.FCMacro', OUTPUT / 'BOM.csv',
                installation_path, OUTPUT/'installation-components.json',
                OUTPUT / 'GUIDE.md', OUTPUT / 'REVISION.txt', OUTPUT / 'PRINT-README.txt', OUTPUT / 'native-export-report.json',
                OUTPUT / 'FieldDAQ-assembly-preview-DO-NOT-PRINT.stl']
bundle_files += [OUTPUT / record['name'] for record in source['print']]
with zipfile.ZipFile(bundle, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
    for path in bundle_files:
        archive.write(path, path.name)
print(json.dumps({'passed': True, 'nativeComponents': len(native_rows), 'printables': len(stl_rows), 'bundle': str(bundle)}), flush=True)
