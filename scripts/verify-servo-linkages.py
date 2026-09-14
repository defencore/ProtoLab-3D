"""Execute prepared servo macros in an isolated FreeCAD Python process."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.environ.get("FREECAD_LIB", "/Applications/FreeCAD.app/Contents/Resources/lib"))
import FreeCAD as App
import Part
import Import

cases = json.load(open(sys.argv[1], encoding="utf-8"))
results = []
with tempfile.TemporaryDirectory(prefix="protolab-servo-") as directory:
    for case in cases:
        doc = App.newDocument("ServoLinkageAudit")
        try:
            sentinel = doc.addObject("App::FeaturePython", "ExistingObject")
            exec(case["script"], {})
            roots = [obj for obj in doc.RootObjects if obj != sentinel]
            assert len(roots) == 1, "Expected one newly created root."
            root = roots[0]
            assert root.PartId == case["id"]
            assert json.loads(root.Configuration) == case["parameters"]
            children = list(root.Group) if root.TypeId == "App::Part" else [root]
            for child in children:
                assert child.Shape.isValid() and child.Shape.Volume > 0
                assert len(child.Shape.Solids) == 1, "Each manufactured component must be one solid."
                assert child.Shape.Solids[0].isClosed()
            if len(children) > 1:
                assert all(not child.Label.startswith("Component ") for child in children)
                sibling_before = App.Vector(children[1].Shape.Solids[0].CenterOfMass)
                before = App.Vector(children[0].Shape.Solids[0].CenterOfMass)
                original = App.Placement(children[0].Placement)
                shift = App.Vector(5, -3, 7)
                children[0].Placement.Base += shift
                doc.recompute()
                assert (children[0].Shape.Solids[0].CenterOfMass - before - shift).Length < 1e-6
                assert (children[1].Shape.Solids[0].CenterOfMass - sibling_before).Length < 1e-6
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
                reloaded = list(root.Group) if root.TypeId == "App::Part" else [root]
                assert [child.Label for child in reloaded] == labels
            results.append({"name": case["name"], "passed": True, "components": len(children), "roundTrip": case["roundTrip"]})
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
