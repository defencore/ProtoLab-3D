"""Run generated macros in a separate FreeCAD Python process, never a GUI document."""
import json
import os
import sys
import tempfile

if os.environ.get("FREECAD_LIB"):
    sys.path.append(os.environ["FREECAD_LIB"])
import FreeCAD as App
import Part
import Import

payload = json.load(open(sys.argv[1], encoding="utf-8"))
results = []
with tempfile.TemporaryDirectory(prefix="protolab-assembly-") as directory:
    for case in payload["cases"]:
        doc = App.newDocument("AssemblyExportAudit")
        sentinel = doc.addObject("App::FeaturePython", "ExistingObject")
        namespace = {}
        try:
            exec(case["script"], namespace)
            assert App.ActiveDocument is doc, "The active document changed."
            roots = [obj for obj in doc.RootObjects if obj != sentinel]
            assert len(roots) == 1, "The macro must create exactly one root object."
            root = roots[0]
            assert root.PartId == case["id"] and root.ModelState == case["state"]
            assert json.loads(root.Configuration) == case["parameters"]
            children = list(root.Group) if root.TypeId == "App::Part" else [root]
            if case["id"] in ["bolt-screw", "hex-nut", "flange-nut"] or case["state"] in ["spider", "screw", "pinion", "wheel", "shaft", "rail"]:
                assert root.TypeId == "Part::Feature", "A physical single part was split."
            else:
                assert root.TypeId == "App::Part", "The assembly is still a single feature."
            assert all(obj.Shape.isValid() and obj.Shape.Volume > 0 for obj in children)
            assert all(solid.isClosed() for obj in children for solid in obj.Shape.Solids)
            assert all(not obj.Label.startswith("Component ") for obj in children), "Semantic names are missing."
            if root.TypeId == "App::Part":
                first, second = children[:2]
                original_placement = App.Placement(first.Placement)
                first_center = first.Shape.optimalBoundingBox(False, False).Center
                second_center = second.Shape.optimalBoundingBox(False, False).Center
                shift = App.Vector(4.5, -2.25, 7.75)
                placement = App.Placement(first.Placement)
                placement.Base += shift
                first.Placement = placement
                doc.recompute()
                assert (first.Shape.optimalBoundingBox(False, False).Center - first_center - shift).Length < 1e-6, "Component movement failed."
                assert (second.Shape.optimalBoundingBox(False, False).Center - second_center).Length < 1e-6, "Moving one component moved a sibling."
                first.Placement = original_placement
                previous_global = first.getGlobalPlacement().Base
                root.Placement.Base = shift
                doc.recompute()
                assert (first.getGlobalPlacement().Base - previous_global - shift).Length < 1e-6, "Parent placement was lost."
                root.Placement = App.Placement()
                doc.recompute()
                assert len(set(obj.Name for obj in children)) == len(children)
                assert all(obj.ComponentIndex == index + 1 for index, obj in enumerate(children))
            if case["name"].endswith("catalog-metadata"):
                assert root.CatalogDesignation and root.CatalogSource and root.CatalogDimensions
            volume = sum(obj.Shape.Volume for obj in children)
            solids = sum(len(obj.Shape.Solids) for obj in children)
            step_path = os.path.join(directory, "assembly.step")
            Import.export([root], step_path)
            restored_shape = Part.Shape()
            restored_shape.read(step_path)
            assert restored_shape.isValid() and len(restored_shape.Solids) == solids, "STEP lost assembly solids."
            assert abs(restored_shape.Volume - volume) / volume < 0.001, "STEP changed assembly volume."
            save_path = os.path.join(directory, "assembly.FCStd")
            doc.saveAs(save_path)
            original_names = [(obj.Name, obj.Label) for obj in children]
            root_name = root.Name
            App.closeDocument(doc.Name)
            doc = App.openDocument(save_path)
            restored = doc.getObject(root_name)
            saved_children = list(restored.Group) if restored.TypeId == "App::Part" else [restored]
            assert [(obj.Name, obj.Label) for obj in saved_children] == original_names, "FCStd lost component identities."
            results.append({"name": case["name"], "type": restored.TypeId, "components": len(children), "solids": solids, "independentPlacement": len(children) > 1, "stepRoundTrip": True, "fcstdRoundTrip": True})
            with open(sys.argv[2], "w", encoding="utf-8") as progress:
                json.dump({"cases": len(results), "rollback": False, "results": results}, progress, indent=2)
            print(case["name"], "PASS", len(children), "components", flush=True)
        finally:
            if doc and doc.Name in App.listDocuments():
                App.closeDocument(doc.Name)
    doc = App.newDocument("AssemblyRollbackAudit")
    sentinel = doc.addObject("App::FeaturePython", "ExistingObject")
    before = [obj.Name for obj in doc.Objects]
    try:
        exec(payload["rollbackScript"], {})
        raise AssertionError("An invalid component was accepted.")
    except ValueError as error:
        assert "assembly component" in str(error), str(error)
    assert [obj.Name for obj in doc.Objects] == before, "Rollback left partial assembly objects."
    assert App.ActiveDocument is doc
    App.closeDocument(doc.Name)
report = {"cases": len(results), "rollback": True, "results": results}
with open(sys.argv[2], "w", encoding="utf-8") as output:
    json.dump(report, output, indent=2)
print("PASSED", len(results), "complete macros and transaction rollback", flush=True)
