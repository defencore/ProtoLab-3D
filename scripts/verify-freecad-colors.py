# The generator copies this runner beside its cases as verify.FCMacro.
# Run that generated macro with the FreeCAD GUI.
# --user-cfg and --system-cfg can point to temporary files for an isolated process.
# Set PROTOLAB_COLOR_AUDIT_QUIT=1 only for that dedicated verification process.
import json
import os
import traceback
from pathlib import Path

import FreeCAD as App
import FreeCADGui as Gui
import Part
from PySide import QtCore, QtWidgets

output = Path(__file__).resolve().parent
output.mkdir(parents=True, exist_ok=True)


def appearance(view):
    return {
        'displayMode': view.DisplayMode,
        'shapeColor': list(view.ShapeColor),
        'diffuseColors': [list(color) for color in view.DiffuseColor],
        'materials': [
            {
                'diffuse': list(material.DiffuseColor),
                'ambient': list(material.AmbientColor),
                'transparency': material.Transparency,
            }
            for material in view.ShapeAppearance
        ],
    }


def check_colors(objects, expected):
    assert len(objects) == len(expected), 'Physical component count changed'
    rows = []
    for obj, rgb in zip(objects, expected):
        view = obj.ViewObject
        assert obj.Shape.isValid() and obj.Shape.isClosed(), obj.Label
        assert view.DisplayMode == 'Shaded', 'Dense face edges can obscure component colors: ' + obj.Label
        assert len(view.ShapeAppearance) == 1, 'Inherited face materials remain: ' + obj.Label
        for material in view.ShapeAppearance:
            assert max(abs(a - b) for a, b in zip(material.DiffuseColor[:3], rgb)) < 1e-6, obj.Label
            assert abs(material.Transparency) < 1e-8, 'Unexpected transparency: ' + obj.Label
        for color in view.DiffuseColor:
            assert max(abs(a - b) for a, b in zip(color[:3], rgb)) < 1e-6, obj.Label
            assert abs(color[3] - 1.0) < 1e-8, 'Unexpected face alpha: ' + obj.Label
        rows.append({'label': obj.Label, 'expected': rgb, 'appearance': appearance(view)})
    return rows


def audit():
    original_documents = set(App.listDocuments())
    original_active = App.ActiveDocument.Name if App.ActiveDocument else None
    report = {'version': App.Version(), 'gui': App.GuiUp, 'cases': [], 'passed': False}
    doc = None
    try:
        assert App.GuiUp, 'This audit needs the FreeCAD GUI'
        namespace = {'App': App}
        exec((output / 'appearance.py').read_text(), namespace)
        apply_color = namespace['_protolab_apply_color']
        doc = App.newDocument('ProtoLabFaceAppearanceProbe')
        box = doc.addObject('Part::Feature', 'ColorProbe')
        box.Shape = Part.makeBox(5, 5, 5)
        doc.recompute()
        black = App.Material()
        black.DiffuseColor = (0.0, 0.0, 0.0, 1.0)
        black.AmbientColor = (0.0, 0.0, 0.0, 1.0)
        black.Transparency = 0.65
        box.ViewObject.ShapeAppearance = [black] * len(box.Shape.Faces)
        before = appearance(box.ViewObject)
        silver = (174 / 255, 181 / 255, 190 / 255)
        box.ViewObject.ShapeColor = silver
        old_color_only = appearance(box.ViewObject)
        apply_color(box.ViewObject, silver)
        reset = check_colors([box], [silver])[0]
        report['inheritedMaterialProbe'] = {
            'before': before,
            'afterShapeColorOnly': old_color_only,
            'afterExplicitMaterial': reset,
            'oldSetterRetainsBlackAmbient': all(max(m['ambient'][:3]) == 0 for m in old_color_only['materials']),
            'oldSetterRetainsTransparency': any(m['transparency'] > 0 for m in old_color_only['materials']),
        }
        App.closeDocument(doc.Name)
        doc = None
        cases = json.loads((output / 'cases.json').read_text())
        for index, case in enumerate(cases):
            row = {'name': case['name'], 'passed': False}
            try:
                doc = App.newDocument('ProtoLabCouplingColorAudit')
                exec(case['script'], {})
                doc.recompute()
                features = [obj for obj in doc.Objects if obj.TypeId == 'Part::Feature']
                row['components'] = check_colors(features, case['colors'])
                if case['name'] in ['lf-d14-l22-thimble-3-4/assembly', 'lf-d14-l22-thimble-3-4/exploded']:
                    view = Gui.activeDocument().activeView()
                    view.viewAxonometric()
                    view.fitAll()
                    def save_frame(filename):
                        # A native event-loop turn lets Coin update the new document and camera.
                        loop = QtCore.QEventLoop()
                        QtCore.QTimer.singleShot(1000, loop.quit)
                        loop.exec_()
                        view.redraw()
                        QtWidgets.QApplication.processEvents()
                        view.saveImage(str(output / filename), 1000, 800, 'White')
                    if case['name'].endswith('/assembly'):
                        for obj in features:
                            obj.ViewObject.DisplayMode = 'Flat Lines'
                        save_frame('lf-thimble-flat-lines-before.png')
                        for obj in features:
                            obj.ViewObject.DisplayMode = 'Shaded'
                        row['beforeScreenshot'] = 'lf-thimble-flat-lines-before.png'
                    filename = 'lf-thimble-' + case['name'].split('/')[-1] + '.png'
                    save_frame(filename)
                    row['screenshot'] = filename
                filename = output / ('colors-' + str(index) + '.FCStd')
                doc.saveAs(str(filename))
                App.closeDocument(doc.Name)
                doc = App.openDocument(str(filename))
                features = [obj for obj in doc.Objects if obj.TypeId == 'Part::Feature']
                row['reopenedComponents'] = check_colors(features, case['colors'])
                row['passed'] = True
            except Exception:
                row['error'] = traceback.format_exc()
            finally:
                if doc:
                    App.closeDocument(doc.Name)
                    doc = None
                report['cases'].append(row)
                report['passedCases'] = sum(item['passed'] for item in report['cases'])
                report['failedCases'] = sum(not item['passed'] for item in report['cases'])
                (output / 'native-gui-report.json').write_text(json.dumps(report, indent=2, default=str))
        report['passed'] = report['failedCases'] == 0
    except Exception:
        report['error'] = traceback.format_exc()
    finally:
        if doc:
            App.closeDocument(doc.Name)
        if original_active and original_active in App.listDocuments():
            App.setActiveDocument(original_active)
        report['preservedDocuments'] = set(App.listDocuments()) == original_documents
        (output / 'native-gui-report.json').write_text(json.dumps(report, indent=2, default=str))
        print(json.dumps({'passed': report['passed'], 'passedCases': report.get('passedCases', 0), 'failedCases': report.get('failedCases', 0), 'output': str(output)}, default=str), flush=True)
        if os.environ.get('PROTOLAB_COLOR_AUDIT_QUIT') == '1':
            QtCore.QTimer.singleShot(250, QtWidgets.QApplication.quit)


QtCore.QTimer.singleShot(1200, audit)
