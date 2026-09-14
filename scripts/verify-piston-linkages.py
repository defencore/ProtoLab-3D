"""Check piston and rod macros against preview components in an isolated FreeCAD process."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.environ.get("FREECAD_LIB", "/Applications/FreeCAD.app/Contents/Resources/lib"))
import FreeCAD as App
import Part
import Import

with open(sys.argv[1], encoding="utf-8") as source:
    cases = json.load(source)
results = []
with tempfile.TemporaryDirectory(prefix="protolab-piston-") as directory:
    for case in cases:
        doc = App.newDocument("PistonLinkageAudit")
        try:
            sentinel = doc.addObject("App::FeaturePython", "ExistingObject")
            exec(case["script"], {})
            roots = [obj for obj in doc.RootObjects if obj != sentinel]
            assert len(roots) == 1, "Expected one new root and the preserved existing object."
            root = roots[0]
            assert root.PartId == case["id"]
            assert json.loads(root.Configuration) == case["parameters"]
            children = list(root.Group) if root.TypeId == "App::Part" else [root]
            assert len(children) == len(case["components"]), "Preview and CAD component counts differ."
            for child, preview in zip(children, case["components"]):
                shape = child.Shape
                assert shape.isValid() and shape.Volume > 0, child.Label
                assert len(shape.Solids) == 1 and shape.Solids[0].isClosed(), child.Label
                bounds = shape.optimalBoundingBox(False, False)
                low = [bounds.XMin, bounds.YMin, bounds.ZMin]
                high = [bounds.XMax, bounds.YMax, bounds.ZMax]
                for axis in range(3):
                    tolerance = max(0.06, (high[axis] - low[axis]) * 0.004)
                    assert abs(low[axis] - preview["min"][axis]) < tolerance, (child.Label, "min", axis, low, preview)
                    assert abs(high[axis] - preview["max"][axis]) < tolerance, (child.Label, "max", axis, high, preview)
            overlaps = []
            if case["state"] == "assembled":
                for i, first in enumerate(children):
                    for second in children[i + 1:]:
                        common = first.Shape.common(second.Shape)
                        if common.Volume > max(0.00001, min(first.Shape.Volume, second.Shape.Volume) * 0.00001):
                            overlaps.append({"first": first.Label, "second": second.Label, "volume": common.Volume})
                assert not overlaps, f"Assembly components overlap: {overlaps}"
            if len(children) > 1:
                sibling = App.Vector(children[1].Shape.Solids[0].CenterOfMass)
                before = App.Vector(children[0].Shape.Solids[0].CenterOfMass)
                original = App.Placement(children[0].Placement)
                shift = App.Vector(5, -3, 7)
                children[0].Placement.Base += shift
                doc.recompute()
                assert (children[0].Shape.Solids[0].CenterOfMass - before - shift).Length < 1e-6
                assert (children[1].Shape.Solids[0].CenterOfMass - sibling).Length < 1e-6
                children[0].Placement = original
                doc.recompute()
            if case["roundTrip"]:
                path = os.path.join(directory, "linkage.step")
                Import.export([root], path)
                restored = Part.Shape()
                restored.read(path)
                assert restored.isValid() and len(restored.Solids) == len(children)
                volume = sum(child.Shape.Volume for child in children)
                assert abs(restored.Volume - volume) < volume * 0.001
                path = os.path.join(directory, "linkage.FCStd")
                name = root.Name
                labels = [child.Label for child in children]
                doc.saveAs(path)
                App.closeDocument(doc.Name)
                doc = App.openDocument(path)
                root = doc.getObject(name)
                reopened = list(root.Group) if root.TypeId == "App::Part" else [root]
                assert [child.Label for child in reopened] == labels
            results.append({"name": case["name"], "passed": True, "components": len(children), "roundTrip": case["roundTrip"], "previewBounds": True, "overlaps": overlaps})
            print(case["name"], "PASS", len(children), "components", flush=True)
        except Exception as error:
            results.append({"name": case["name"], "passed": False, "error": str(error)})
            print(case["name"], "FAIL", str(error), flush=True)
        finally:
            if doc and doc.Name in App.listDocuments():
                App.closeDocument(doc.Name)
        if len(sys.argv) > 2:
            with open(sys.argv[2], "w", encoding="utf-8") as output:
                json.dump({"freecad": ".".join(App.Version()[:3]), "cases": results}, output, indent=2)
failed = sum(not case["passed"] for case in results)
print(f"{len(results) - failed}/{len(results)} native cases passed", flush=True)
sys.exit(1 if failed else 0)
