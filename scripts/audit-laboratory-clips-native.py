"""Audit actual generated clip CAD, preview agreement, bores and CAD round trips.

Run with the FreeCAD Python interpreter, fixture JSON and output JSON arguments.
The fixture embeds the actual part generator and wrapper. This script contains
no replacement geometry; bores are checked against the supplied hole dimensions.
"""
import json
import math
from pathlib import Path
import re
import sys

sys.path.append('/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part

fixture_path, report_path = map(Path, sys.argv[1:3])
fixtures = json.loads(fixture_path.read_text())
report_path.parent.mkdir(parents=True, exist_ok=True)
results = []
for fixture in fixtures:
    namespace = {'App': App, 'Part': Part, 'math': math}
    exec(fixture['python'], namespace)
    shape, components = namespace['shape'], namespace['components']
    assert len(components) == len(fixture['components']), fixture['id'] + ': component count'
    assert namespace['component_labels'] == fixture['componentLabels']
    assert shape.isValid() and shape.isClosed(), fixture['id'] + ': valid closed assembly'
    component_results = []
    for index, (component, preview) in enumerate(zip(components, fixture['components'])):
        identity = (fixture['id'], index, preview['label'])
        assert component.isValid() and component.isClosed(), identity
        assert len(component.Solids) == 1 and component.Volume > 0, identity
        bounds = component.BoundBox
        native_bounds = [[bounds.XMin, bounds.YMin, bounds.ZMin],
                         [bounds.XMax, bounds.YMax, bounds.ZMax]]
        bounds_error = max(abs(a-b) for native, mesh in zip(native_bounds, preview['bounds'])
                           for a, b in zip(native, mesh))
        assert bounds_error < .015, (identity, 'preview/native component bounds', bounds_error)
        volume_error = abs(component.Volume-preview['volume'])/component.Volume
        assert volume_error < .005, (identity, 'preview/native component volume', volume_error)
        component_results.append(dict(label=preview['label'], valid=True, closed=True,
                                      solids=1, volume=component.Volume,
                                      previewVolumeRelativeError=volume_error,
                                      previewBoundsMaximumError=bounds_error))
    bounds = shape.BoundBox
    dimensions = [bounds.XLength, bounds.YLength, bounds.ZLength]
    assert max(abs(a-b) for a, b in zip(dimensions, fixture['dimensions'])) < .015
    volume = sum(component.Volume for component in components)
    interferences = []
    spring_seats = []
    if fixture['state'] == 'assembled':
        for index in range(fixture['poles']):
            prefix = 'Clip '+str(index+1)+' · '
            x = (index-(fixture['poles']-1)/2)*18
            z = fixture['clipOffsetZ']
            housing = components[fixture['componentLabels'].index(prefix+'molded housing')]
            lever = components[fixture['componentLabels'].index(prefix+'ridged pivot lever')]
            spring = components[fixture['componentLabels'].index(prefix+'compression spring')]
            housing_distance = spring.distToShape(housing)[0]
            lever_distance = spring.distToShape(lever)[0]
            assert housing_distance <= .3, (fixture['id'], 'spring not seated on housing', housing_distance)
            assert lever_distance <= .3, (fixture['id'], 'spring not seated below lever', lever_distance)
            spring_seats.append(dict(clip=index+1, housingDistance=housing_distance,
                                     leverDistance=lever_distance))
            if fixture['clipSize'] == 'compact':
                for point in [(x+8.2, 3, 20+z), (x+8.2, .5, 30+z), (x, -3, 9.5+z),
                              (x+5, -14, 8.5+z)]:
                    assert housing.isInside(App.Vector(*point), 1e-6, False), (
                        fixture['id'], 'missing L profile or top deck', point)
                for point in [(x+8.2, -3, 20+z), (x, -3, 10.5+z), (x+5, -14, 3+z)]:
                    assert not housing.isInside(App.Vector(*point), 1e-6, False), (
                        fixture['id'], 'L profile or underside pocket filled', point)
                pocket = Part.makeBox(.2, .2, 7.4, App.Vector(x+4.9, -14.1, z))
                assert housing.common(pocket).Volume < 1e-7, (fixture['id'], 'underside pocket closed')
                for y, height in [(-23, 5), (13.5, 6), (13, 30)]:
                    assert housing.isInside(App.Vector(x+9.2, y, height+z), 1e-6, False)
                    assert not housing.isInside(App.Vector(x-8.6, y, height+z), 1e-6, False)
                    assert housing.isInside(App.Vector(x-8.6, y+1.3, height+z), 1e-6, False)
                jaw_y, jaw_z = 19.5, 30.8+z
            else:
                for point in [(9.5, -30, 12), (9.5, -20, 20), (0, -25, 4.5), (0, 0, 4.5),
                              (6, -13, 2)]:
                    assert housing.isInside(App.Vector(*point), 1e-6, False), (
                        fixture['id'], 'missing long ramp, top deck or core rib', point)
                for point in [(9.5, -30, 20), (9.5, -20, 30), (0, -25, 2), (0, 0, 2)]:
                    assert not housing.isInside(App.Vector(*point), 1e-6, False), (
                        fixture['id'], 'ramp or underside core cell filled', point)
                jaw_y, jaw_z = 27.5, 47.7
            jaw_gap = Part.makeCylinder(.05, 11, App.Vector(x-5.5, jaw_y, jaw_z), App.Vector(1, 0, 0))
            assert shape.common(jaw_gap).Volume < 1e-7, (fixture['id'], 'gap between jaws blocked')
        for component, label in zip(components, fixture['componentLabels']):
            if not label.endswith('moving brass jaw'):
                continue
            jaw_bounds = component.BoundBox
            x = (jaw_bounds.XMin+jaw_bounds.XMax)/2
            y = (jaw_bounds.YMin+jaw_bounds.YMax)/2
            start = jaw_bounds.ZMax+.03
            view = Part.makeCylinder(.1, bounds.ZMax-start+1, App.Vector(x, y, start))
            assert shape.common(view).Volume < 1e-7, (fixture['id'], 'plastic hides wire-entry jaw')
        for index, component in enumerate(components):
            bounds = component.BoundBox
            for other_index in range(index+1, len(components)):
                other = components[other_index]
                other_bounds = other.BoundBox
                if (bounds.XMax < other_bounds.XMin or other_bounds.XMax < bounds.XMin or
                        bounds.YMax < other_bounds.YMin or other_bounds.YMax < bounds.YMin or
                        bounds.ZMax < other_bounds.ZMin or other_bounds.ZMax < bounds.ZMin):
                    continue
                overlap = component.common(other).Volume
                if overlap <= 1e-5:
                    continue
                fraction = overlap/min(component.Volume, other.Volume)
                interferences.append(dict(components=[fixture['componentLabels'][index],
                                                      fixture['componentLabels'][other_index]],
                                          volume=overlap, fractionOfSmallerComponent=fraction,
                                          significant=overlap > .1 and fraction > .01))
        for x, y, diameter in fixture['mountingHoles']:
            opening = Part.makeCylinder(diameter/2-.08, 17, App.Vector(x, y, -1))
            assert shape.common(opening).Volume < 1e-7, (fixture['id'], 'blocked mounting hole')
        if fixture.get('bottomTab'):
            expected_bottom = -14+fixture['clipOffsetZ']
            hole_z = -9+fixture['clipOffsetZ']
            contacts = [(component, label) for component, label in
                        zip(components, fixture['componentLabels'])
                        if label.endswith('fixed contact and downward solder tab')]
            assert len(contacts) == fixture['poles']
            for index, (contact, label) in enumerate(contacts):
                x = (index-(fixture['poles']-1)/2)*18
                assert abs(contact.BoundBox.ZMin-expected_bottom) < 1e-6
                assert contact.BoundBox.YMax <= 27.501, (fixture['id'], 'rear contact substituted')
                hole = Part.makeCylinder(1.92, 10, App.Vector(x, 16, hole_z), App.Vector(0, 1, 0))
                assert shape.common(hole).Volume < 1e-7, (fixture['id'], 'blocked contact hole')
                rim = Part.makeCylinder(.1, 10, App.Vector(x+2.5, 16, hole_z), App.Vector(0, 1, 0))
                assert contact.common(rim).Volume > .01, (fixture['id'], 'contact hole has no brass rim')
                clearance = Part.makeBox(7.4, 2.2, 16, App.Vector(x-3.7, 19.7, -1))
                for component, label in zip(components, fixture['componentLabels']):
                    if ('molded housing' in label or 'common insulating mounting base' in label):
                        assert component.common(clearance).Volume < 1e-7, (
                            fixture['id'], 'plastic blocks downward contact clearance', label)
        if fixture.get('poles', 1) == 6:
            groups = {}
            for component, label in zip(components, fixture['componentLabels']):
                match = re.match(r'Clip (\d+) .*?(?:fixed contact|moving brass jaw)', label)
                if match:
                    groups.setdefault(int(match.group(1)), []).append(component)
            assert set(groups) == set(range(1, 7))
            assert all(len(group) == 2 for group in groups.values())
            conductors = [Part.makeCompound(groups[index]) for index in range(1, 7)]
            for index, conductor in enumerate(conductors):
                for other in conductors[index+1:]:
                    assert conductor.distToShape(other)[0] > 1, fixture['id'] + ': isolated contacts'
    result = dict(id=fixture['id'], components=component_results,
                  dimensions=dimensions, volume=volume, mountingHolesOpen=True,
                  independentContacts=True,
                  housingProfileChecked=fixture['state'] == 'assembled',
                  undersidePocketsChecked=fixture['state'] == 'assembled',
                  springSeatClearances=spring_seats,
                  downwardContactChecked=fixture.get('bottomTab', False) and fixture['state'] == 'assembled',
                  wireEntryJawVisible=fixture['state'] == 'assembled',
                  componentInterferences=interferences,
                  sourceUrl=fixture['sourceUrl'], geometryEvidence=fixture['evidence'])
    if fixture['state'] == 'assembled':
        step_path = report_path.parent/(fixture['model']+'.step')
        shape.exportStep(str(step_path))
        restored = Part.read(str(step_path))
        assert restored.isValid() and restored.isClosed()
        assert len(restored.Solids) == len(components)
        assert abs(restored.Volume-volume) < max(1e-5, volume*1e-8)
        document = App.newDocument('LaboratoryClips')
        exec(fixture['wrapper'], {})
        roots = [obj for obj in document.Objects if hasattr(obj, 'PartId')]
        assert len(roots) == 1
        root = roots[0]
        assert root.PartId == fixture['partId']
        assert json.loads(root.Configuration) == fixture['parameters']
        assert root.SupplyPolicy == 'purchased' and root.ModelState == 'assembled'
        assert len(root.Group) == len(components)
        assert [obj.Label for obj in root.Group] == fixture['componentLabels']
        assert all(obj.Shape.isValid() and obj.Shape.isClosed() for obj in root.Group)
        assert all(len(obj.Shape.Solids) == 1 for obj in root.Group)
        assert json.loads(root.GeometryEvidence) == fixture['wrapperEvidence']
        fcstd_path = report_path.parent/(fixture['model']+'.FCStd')
        document.saveAs(str(fcstd_path))
        App.closeDocument(document.Name)
        reopened = App.openDocument(str(fcstd_path))
        restored_root = next(obj for obj in reopened.Objects if hasattr(obj, 'PartId'))
        assert restored_root.PartId == fixture['partId']
        assert json.loads(restored_root.Configuration) == fixture['parameters']
        restored_components = [obj.Shape for obj in restored_root.Group]
        assert len(restored_components) == len(components)
        assert all(item.isValid() and item.isClosed() and len(item.Solids) == 1
                   for item in restored_components)
        assert abs(sum(item.Volume for item in restored_components)-volume) < 1e-5
        App.closeDocument(reopened.Name)
        result.update(stepRoundTrip=True, freecadRoundTrip=True, actualWrapper=True,
                      rootPartIdCorrect=True, configurationCorrect=True,
                      evidencePreserved=True)
    results.append(result)
    print(json.dumps(dict(case=fixture['id'], components=len(components),
                          interferences=len(interferences))), flush=True)
significant_interferences = sum(
    sum(item['significant'] for item in result['componentInterferences']) for result in results)
all_passed = significant_interferences == 0
report_path.write_text(json.dumps(dict(cases=results, allPassed=all_passed), indent=2)+'\n')
print(json.dumps(dict(cases=len(results),
                      closedComponents=sum(len(result['components']) for result in results),
                      significantInterferences=significant_interferences,
                      allPassed=all_passed)))
assert all_passed, 'Inspect significant component interferences in the audit report'
