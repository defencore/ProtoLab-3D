"""Render and save a complete actuator using an explicit orthographic camera.

Run inside a proper FreeCAD GUI event loop. Loading this file creates no document.
Call run([fcstd_paths], report_path, quit_on_complete=False) from a FreeCAD macro.
The job runs asynchronously, allowing the view to initialize between camera changes.
"""
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import traceback

import FreeCAD as App
import FreeCADGui as Gui
from PySide import QtCore, QtGui, QtWidgets
from pivy import coin  # Register Coin's SWIG camera-node wrappers before getCameraNode.

_render_jobs = []


def physical_features(root):
    result = []
    for child in root.Group:
        if child.TypeId == 'App::Part':
            result.extend(physical_features(child))
        elif hasattr(child, 'Shape') and hasattr(child, 'AssemblyOccurrenceId'):
            result.append(child)
    return result


def show_groups(root):
    root.ViewObject.Visibility = True
    for child in root.Group:
        if child.TypeId == 'App::Part':
            show_groups(child)


def verify_visible_groups(root):
    assert root.ViewObject.Visibility, ('FCStd changes assembly/group visibility', root.Label)
    for child in root.Group:
        if child.TypeId == 'App::Part':
            verify_visible_groups(child)


def rgb8(color):
    return tuple(int(math.floor(float(value) * 255 + 0.5)) for value in list(color)[:3])


def source_rgb(item):
    values = list(item.SourceRGB)
    assert len(values) == 3 and all(math.isfinite(value) and 0 <= value <= 1 for value in values), ('Invalid SourceRGB', item.Label, values)
    return values


def apply_source_rgb(item):
    """Replace inherited face materials before the first frame is rendered."""
    color = source_rgb(item)
    view = item.ViewObject
    material = App.Material()
    material.DiffuseColor = tuple(color) + (1.0,)
    material.AmbientColor = tuple(color) + (1.0,)
    material.Transparency = 0.0
    view.ShapeColor = tuple(color)
    view.DiffuseColor = [tuple(color) + (1.0,)]
    view.ShapeAppearance = [material]
    view.Transparency = 0
    view.DisplayMode = 'Shaded'
    view.Visibility = True


def feature_key(item):
    return (0, int(item.ComponentIndex)) if hasattr(item, 'ComponentIndex') else (1, item.Name)


def feature_record(item):
    return {'name': item.Name, 'label': item.Label,
            'occurrenceId': item.AssemblyOccurrenceId,
            'componentIndex': int(item.ComponentIndex) if hasattr(item, 'ComponentIndex') else None,
            'sourceRGB': source_rgb(item)}


def verify_source_rgb(item, expected, check_shape=True):
    assert item.Name == expected['name'] and item.Label == expected['label'], ('FCStd changes component labels', expected, item.Label)
    assert item.AssemblyOccurrenceId == expected['occurrenceId'], ('FCStd changes occurrence identity', item.Label)
    if expected['componentIndex'] is not None:
        assert int(item.ComponentIndex) == expected['componentIndex'], ('FCStd changes component order', item.Label)
    actual_source = source_rgb(item)
    assert max(abs(a-b) for a, b in zip(actual_source, expected['sourceRGB'])) < 1e-12, ('FCStd changes SourceRGB', item.Label)
    target = rgb8(expected['sourceRGB'])
    view = item.ViewObject
    assert view.Visibility and view.DisplayMode == 'Shaded' and view.Transparency == 0, ('Display must stay visible, opaque and Shaded', item.Label)
    materials = list(view.ShapeAppearance)
    assert len(materials) == 1, ('Inherited per-face materials remain', item.Label)
    colors = [view.ShapeColor]
    for material in materials:
        assert abs(material.Transparency) < 1e-8, ('Material transparency changed', item.Label)
        colors.append(material.DiffuseColor)
    diffuse = list(view.DiffuseColor)
    assert diffuse, ('Missing diffuse face colors', item.Label)
    for color in diffuse:
        assert len(color) < 4 or abs(color[3] - 1.0) < 1e-8, ('Face alpha is not opaque', item.Label)
        colors.append(color)
    error = max(abs(actual-expected) for color in colors for actual, expected in zip(rgb8(color), target))
    assert error == 0, ('FCStd changes 8-bit RGB', item.Label, target, [rgb8(color) for color in colors])
    if check_shape:
        shape = item.Shape
        assert not shape.isNull() and shape.isValid() and shape.isClosed() and shape.Volume > 0, ('Reopened shape is invalid or open', item.Label)
    return error


def physical_bounds(doc, part_id='sfk-rotary-actuator'):
    root = next(item for item in doc.RootObjects if hasattr(item, 'PartId') and item.PartId == part_id)
    box = App.BoundBox()
    for item in physical_features(root):
        shape = item.Shape.copy()
        shape.Placement = item.getGlobalPlacement()
        box.add(shape.optimalBoundingBox(False, False))
    assert box.XLength > 100 and box.YLength > 20 and box.ZLength > 10, 'Incomplete physical assembly bounds.'
    return box


def frame_camera(view, box, width, height, kind='axonometric'):
    """Keep the entire assembly between explicit clipping planes, independent of fitAll."""
    camera = view.getCameraNode()
    orientation = {
        'axonometric': App.Rotation(App.Vector(1,1,0), App.Vector(-1,1,2), App.Vector(1,-1,1), 'ZXY'),
        'top': App.Rotation(),
        'front': App.Rotation(App.Vector(1,0,0), 90),
    }[kind]
    quaternion = orientation.Q
    camera.orientation.setValue(*quaternion)
    normal = orientation.multVec(App.Vector(0, 0, 1))
    centre = box.Center
    position = centre + normal * 500
    inverse = orientation.inverted()
    projected = [inverse.multVec(App.Vector(x,y,z) - centre)
                 for x in [box.XMin, box.XMax]
                 for y in [box.YMin, box.YMax]
                 for z in [box.ZMin, box.ZMax]]
    projected_width = max(point.x for point in projected) - min(point.x for point in projected)
    projected_height = max(point.y for point in projected) - min(point.y for point in projected)
    aspect = width / height
    framing_height = max(170, projected_height * 1.2, projected_width / aspect * 1.2)
    camera.position.setValue(position.x, position.y, position.z)
    camera.focalDistance.setValue(500)
    camera.nearDistance.setValue(1)
    camera.farDistance.setValue(2000)
    camera.height.setValue(framing_height)
    camera.aspectRatio.setValue(aspect)
    view.redraw()
    return {'position': list(position), 'centre': list(centre), 'height': framing_height,
            'nearDistance': 1, 'farDistance': 2000, 'focalDistance': 500,
            'orientation': list(quaternion), 'aspectRatio': aspect}


def inspect_image(path):
    image = QtGui.QImage(str(path))
    assert not image.isNull(), 'FreeCAD did not produce an image.'
    width, height = image.width(), image.height()
    count = total = 0
    left, top, right, bottom = width, height, 0, 0
    for y in range(0, height, 4):
        for x in range(0, width, 4):
            total += 1
            pixel = image.pixel(x, y)
            if min((pixel >> 16) & 255, (pixel >> 8) & 255, pixel & 255) < 245:
                count += 1
                left, top, right, bottom = min(left,x), min(top,y), max(right,x), max(bottom,y)
    coverage = count / total
    assert coverage > 0.015, ('The image is almost empty or clipped.', coverage)
    assert right-left > width * 0.35 and bottom-top > height * 0.08, ('The complete assembly is not framed.', [left,top,right,bottom])
    assert left > 4 and top > 4 and right < width-5 and bottom < height-5, ('The model touches the image boundary.', [left,top,right,bottom])
    return {'width': width, 'height': height, 'nonWhiteCoverage': coverage,
            'pixelBounds': [left,top,right,bottom]}


class RenderJob:
    def __init__(self, paths, report_path, save_camera=True, quit_on_complete=False, part_id='sfk-rotary-actuator', root_properties=None):
        self.part_id = part_id
        self.root_properties = dict(root_properties or {})
        self.paths = [Path(path).resolve() for path in paths]
        self.report_path = Path(report_path).resolve()
        self.save_camera = save_camera
        self.quit_on_complete = quit_on_complete
        self.index = 0
        self.doc = None
        self.view_index = 0
        self.width, self.height = 1800, 1100
        self.views = ['axonometric', 'top', 'front']
        self.report = {'freecad': '.'.join(App.Version()[:3]), 'gui': bool(App.GuiUp), 'files': [], 'passed': False}
        self.batch_size = 6

    def write_report(self):
        self.report_path.parent.mkdir(parents=True, exist_ok=True)
        self.report_path.write_text(json.dumps(self.report, indent=2))

    def next_file(self):
        try:
            if self.doc and self.doc.Name in App.listDocuments():
                App.closeDocument(self.doc.Name)
            self.doc = None
            if self.index >= len(self.paths):
                self.report['passed'] = all(row['passed'] for row in self.report['files'])
                if any(row.get('sourceRGBEnabled') for row in self.report['files']):
                    self.report['colorsCertified'] = all(row.get('colorsCertified', False) for row in self.report['files'])
                    self.report['maxRGBQuantizationError'] = max(
                        (row['maxRGBQuantizationError'] for row in self.report['files'] if row.get('colorsCertified')),
                        default=None)
                self.write_report()
                App.Console.PrintMessage('ACTUATOR_RENDER_COMPLETE ' + json.dumps(self.report) + '\n')
                if self.quit_on_complete:
                    QtCore.QTimer.singleShot(100, QtWidgets.QApplication.instance().quit)
                return
            path = self.paths[self.index]
            self.row = {'file': str(path), 'passed': False, 'images': [], 'stage': 'opening'}
            self.report['files'].append(self.row)
            self.write_report()
            self.doc = App.openDocument(str(path))
            self.root = next(item for item in self.doc.RootObjects if getattr(item, 'PartId', None) == self.part_id)
            for name, value in self.root_properties.items():
                assert name in self.root.PropertiesList, 'Unknown root metadata property: ' + name
                setattr(self.root, name, value)
            self.items = sorted(physical_features(self.root), key=feature_key)
            self.source_rgb_mode = any(hasattr(item, 'SourceRGB') for item in self.items)
            self.view_index = 0
            if self.source_rgb_mode:
                assert self.items and all(hasattr(item, 'SourceRGB') for item in self.items), 'SourceRGB must cover every physical component.'
                self.row['sourceRGBEnabled'] = True
                self.row['geometryRebuilt'] = False
                self.row['stage'] = 'styling'
                self.row['initialVisibility'] = {
                    'root': bool(self.root.ViewObject.Visibility),
                    'hiddenPhysicalComponents': sum(not item.ViewObject.Visibility for item in self.items),
                }
                self.write_report()
                App.setActiveDocument(self.doc.Name)
                show_groups(self.root)
                self.baseline = [feature_record(item) for item in self.items]
                self.item_index = 0
                self.box = App.BoundBox()
                QtCore.QTimer.singleShot(100, self.style_batch)
                return
            # Preserve the original behavior for callers/files without source colors.
            self.doc.recompute()
            self.box = physical_bounds(self.doc, self.part_id)
            QtCore.QTimer.singleShot(900, self.configure_view)
        except Exception:
            self.fail_file()

    def style_batch(self):
        try:
            stop = min(self.item_index + self.batch_size, len(self.items))
            for index in range(self.item_index, stop):
                item = self.items[index]
                apply_source_rgb(item)
                verify_source_rgb(item, self.baseline[index], check_shape=False)
                shape = item.Shape.copy()
                shape.Placement = item.getGlobalPlacement()
                self.box.add(shape.BoundBox)
            self.item_index = stop
            if stop < len(self.items):
                QtCore.QTimer.singleShot(10, self.style_batch)
                return
            assert self.box.XLength > 100 and self.box.YLength > 20 and self.box.ZLength > 10, 'Incomplete physical assembly bounds.'
            self.row['physicalComponents'] = len(self.items)
            self.row['visiblePhysicalComponents'] = sum(bool(item.ViewObject.Visibility) for item in self.items)
            self.row['stage'] = 'initializing-view'
            self.write_report()
            view = Gui.activeDocument().activeView()
            view.viewAxonometric()
            view.fitAll()
            view.redraw()
            Gui.updateGui()
            QtCore.QTimer.singleShot(900, self.configure_view)
        except Exception:
            self.fail_file()

    def configure_view(self):
        try:
            view = Gui.activeDocument().activeView()
            view.setCameraType('Orthographic')
            kind = self.views[self.view_index]
            self.row['stage'] = 'rendering-' + kind
            self.write_report()
            self.camera = frame_camera(view, self.box, self.width, self.height, kind)
            Gui.updateGui()
            QtCore.QTimer.singleShot(350, self.capture_view)
        except Exception:
            self.fail_file()

    def capture_view(self):
        try:
            view = Gui.activeDocument().activeView()
            # Reapply after Coin's first event-loop pass to avoid stale clipping planes.
            kind = self.views[self.view_index]
            self.camera = frame_camera(view, self.box, self.width, self.height, kind)
            suffix = '.png' if kind == 'axonometric' else '.' + kind + '.png'
            image_path = self.paths[self.index].with_suffix(suffix)
            view.saveImage(str(image_path), self.width, self.height, 'White')
            pixels = inspect_image(image_path)
            self.row['images'].append({'view': kind, 'file': str(image_path), 'camera': self.camera, **pixels})
            self.view_index += 1
            if self.view_index < len(self.views):
                QtCore.QTimer.singleShot(150, self.configure_view)
                return
            frame_camera(view, self.box, self.width, self.height, 'axonometric')
            Gui.updateGui()
            if self.save_camera or self.source_rgb_mode:
                self.row['stage'] = 'saving'
                self.write_report()
                self.doc.save()
                self.row['cameraSaved'] = bool(self.save_camera)
            if self.source_rgb_mode:
                self.row['appearanceSaved'] = True
                App.closeDocument(self.doc.Name)
                self.doc = None
                self.items = []
                self.row['stage'] = 'reopening'
                self.write_report()
                QtCore.QTimer.singleShot(350, self.reopen_for_certificate)
                return
            self.row['passed'] = True
            self.row['stage'] = 'complete'
            self.write_report()
            self.index += 1
            QtCore.QTimer.singleShot(150, self.next_file)
        except Exception:
            self.fail_file()

    def reopen_for_certificate(self):
        try:
            self.doc = App.openDocument(str(self.paths[self.index]))
            self.root = next(item for item in self.doc.RootObjects if getattr(item, 'PartId', None) == self.part_id)
            for name, value in self.root_properties.items():
                assert getattr(self.root, name) == value, 'Root metadata did not persist: ' + name
            verify_visible_groups(self.root)
            self.items = sorted(physical_features(self.root), key=feature_key)
            assert len(self.items) == len(self.baseline), 'FCStd changes physical component count.'
            self.item_index = 0
            self.maximum_rgb_error = 0
            self.row['stage'] = 'certifying'
            self.write_report()
            QtCore.QTimer.singleShot(100, self.verify_batch)
        except Exception:
            self.fail_file()

    def verify_batch(self):
        try:
            stop = min(self.item_index + self.batch_size, len(self.items))
            for index in range(self.item_index, stop):
                # Deliberately do not restyle after reopening: persistence is the proof.
                error = verify_source_rgb(self.items[index], self.baseline[index])
                self.maximum_rgb_error = max(self.maximum_rgb_error, error)
            self.item_index = stop
            if stop < len(self.items):
                QtCore.QTimer.singleShot(10, self.verify_batch)
                return
            path = self.paths[self.index]
            certificate = {
                'checkedAt': datetime.now(timezone.utc).isoformat(),
                'file': str(path), 'fileSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'freecad': '.'.join(App.Version()[:3]), 'gui': True,
                'savedAndReopened': True, 'geometryRebuilt': False,
                'physicalComponents': len(self.items), 'labelsVerified': True,
                'sourceRGBPreserved': True, 'visibilityPreserved': True, 'validClosedShapes': True,
                'colorStorage': '8-bit RGB', 'colorsCertified': True,
                'maxRGBQuantizationError': self.maximum_rgb_error,
                'maxColorDifference': self.maximum_rgb_error / 255,
            }
            if self.root_properties:
                certificate['rootMetadataPreserved'] = self.root_properties
            self.row['colorsCertified'] = True
            self.row['maxRGBQuantizationError'] = self.maximum_rgb_error
            self.row['GUIstyleCertificate'] = certificate
            self.certify_motion_report(certificate)
            self.row['passed'] = True
            self.row['stage'] = 'complete'
            self.write_report()
            self.index += 1
            QtCore.QTimer.singleShot(150, self.next_file)
        except Exception:
            self.fail_file()

    def certify_motion_report(self, certificate):
        if not hasattr(self.root, 'MotionControl'):
            return
        name = 'full-motion-report.json' if getattr(self.root, 'GeometryMode', 'simple') == 'full' else 'motion-report.json'
        path = self.paths[self.index].with_name(name)
        report = json.loads(path.read_text())
        assert Path(report['file']).resolve() == self.paths[self.index], 'Motion certificate refers to a different file.'
        assert report.get('passed') and report.get('poseChecks') and report.get('reopenedPoseChecks'), 'Certify styles only after native motion geometry passed.'
        assert report['physicalComponents'] == len(self.items), 'Motion report component count differs.'
        if 'geometryVerification' not in report:
            report['geometryVerification'] = {
                'gui': report.get('gui'), 'passed': report['passed'],
                'colorsPreserved': report.get('colorsPreserved'),
                'maxColorDifference': report.get('maxColorDifference'),
                'poseChecksPreserved': True,
            }
        report['gui'] = True
        report['colorsPreserved'] = True
        report['maxColorDifference'] = certificate['maxColorDifference']
        report['GUIstyleCertificate'] = certificate
        path.write_text(json.dumps(report, indent=2))

    def fail_file(self):
        if hasattr(self, 'row'):
            self.row['error'] = traceback.format_exc()
            self.row['stage'] = 'failed'
        else:
            self.report['error'] = traceback.format_exc()
        self.write_report()
        App.Console.PrintError(traceback.format_exc() + '\n')
        self.index += 1
        QtCore.QTimer.singleShot(150, self.next_file)


def run(paths, report_path=None, save_camera=True, quit_on_complete=False, part_id='sfk-rotary-actuator', root_properties=None):
    paths = list(paths)
    assert paths, 'Choose at least one actuator FCStd file.'
    report_path = report_path or Path(paths[0]).with_name('render-report.json')
    job = RenderJob(paths, report_path, save_camera, quit_on_complete, part_id, root_properties)
    _render_jobs.append(job)
    QtCore.QTimer.singleShot(100, job.next_file)
    return job


def run_standard(directory, report_path=None, quit_on_complete=True, part_id='sfk-disc-actuator'):
    """GUI styling/rendering only; the six native files must already have passed geometry checks."""
    directory = Path(directory).resolve()
    names = ['sfk0825-0deg', 'sfk0825-minus-20deg', 'sfk0825-plus-20deg',
             'sfk0825-motion', 'sfk0825-full-neutral', 'sfk0825-full-motion']
    paths = [directory / (name + '.FCStd') for name in names]
    assert all(path.is_file() for path in paths), 'Create all six verified native files before GUI styling.'
    return run(paths, report_path or directory / 'render-report.json',
               quit_on_complete=quit_on_complete, part_id=part_id)
