"""Validate generated addressable-LED CAD against preview fixtures.

Run with the FreeCAD Python interpreter and two arguments: fixture JSON and
output JSON. Fixtures contain the actual part.python output, expected dimensions,
preview volume and model hole coordinates, not a second geometry implementation.
"""
import json
import math
from pathlib import Path
import sys

sys.path.append('/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part

fixture_path, report_path = map(Path, sys.argv[1:3])
fixtures = json.loads(fixture_path.read_text())
results = []
for fixture in fixtures:
    namespace = {'App': App, 'Part': Part, 'math': math}
    exec(fixture['python'], namespace)
    shape, components = namespace['shape'], namespace['components']
    assert len(components) == fixture['components'], fixture['id'] + ': component count'
    assert shape.isValid() and shape.isClosed(), fixture['id'] + ': valid closed assembly'
    for index, component in enumerate(components):
        assert component.isValid() and component.isClosed(), (fixture['id'], index)
        assert len(component.Solids) == 1 and component.Volume > 0, (fixture['id'], index)
    bounds = shape.BoundBox
    dimensions = [bounds.XLength, bounds.YLength, bounds.ZLength]
    assert max(abs(a-b) for a,b in zip(dimensions,fixture['dimensions'])) < 1e-6
    volume = sum(component.Volume for component in components)
    preview_error = abs(volume-fixture['previewVolume'])/volume
    assert preview_error < .005, (fixture['id'], 'preview/native volume error', preview_error)
    for x,y,diameter in fixture['holes']:
        opening = Part.makeCylinder(diameter/2-.05,20,App.Vector(x,y,-1))
        assert shape.common(opening).Volume < 1e-7, (fixture['id'], 'blocked mounting opening')
    if fixture['innerDiameter'] > 0:
        opening = Part.makeCylinder(fixture['innerDiameter']/2-.1,20,App.Vector(0,0,-1))
        assert shape.common(opening).Volume < 1e-7, (fixture['id'], 'blocked central aperture')
    result = dict(id=fixture['id'],components=len(components),valid=True,closed=True,
                  dimensions=dimensions,volume=volume,
                  previewVolumeRelativeError=preview_error,mountingHolesOpen=True,
                  centralApertureOpen=True,sourceUrl=fixture['sourceUrl'],
                  sourceSha256=fixture['sourceSha256'])
    if fixture['state'] == 'assembled':
        step_path=report_path.parent/(fixture['model']+'.step')
        shape.exportStep(str(step_path))
        restored=Part.read(str(step_path))
        assert restored.isValid() and restored.isClosed()
        assert len(restored.Solids)==len(components)
        assert abs(restored.Volume-volume)<max(1e-5,volume*1e-8)
        document=App.newDocument('AddressableLED')
        exec(fixture['wrapper'], {})
        roots=[obj for obj in document.Objects if hasattr(obj,'PartId')]
        assert len(roots)==1
        root=roots[0]
        assert root.PartId==fixture['partId']
        assert json.loads(root.Configuration)==fixture['parameters']
        assert root.SupplyPolicy=='purchased' and root.ModelState=='assembled'
        assert len(root.Group)==len(components)
        assert all(obj.Shape.isValid() and obj.Shape.isClosed() for obj in root.Group)
        assert all(len(obj.Shape.Solids)==1 for obj in root.Group)
        evidence=json.loads(root.GeometryEvidence)
        assert evidence['kind']=='source-dimensions'
        if fixture['sourceSha256']:
            assert evidence['sourceSha256']==fixture['sourceSha256']
        fcstd_path=report_path.parent/(fixture['model']+'.FCStd')
        document.saveAs(str(fcstd_path))
        App.closeDocument(document.Name)
        reopened=App.openDocument(str(fcstd_path))
        restored_root=next(obj for obj in reopened.Objects if hasattr(obj,'PartId'))
        assert restored_root.PartId==fixture['partId']
        assert json.loads(restored_root.Configuration)==fixture['parameters']
        restored_components=[obj.Shape for obj in restored_root.Group]
        assert len(restored_components)==len(components)
        assert all(item.isValid() and item.isClosed() for item in restored_components)
        assert abs(sum(item.Volume for item in restored_components)-volume)<1e-5
        App.closeDocument(reopened.Name)
        result.update(stepRoundTrip=True,freecadRoundTrip=True,actualWrapper=True,rootPartIdCorrect=True,configurationCorrect=True)
    results.append(result)
report_path.write_text(json.dumps(dict(cases=results,allPassed=True),indent=2)+'\n')
print(json.dumps(dict(cases=len(results),closedComponents=sum(r['components'] for r in results),allPassed=True)))
