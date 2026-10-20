"""Isolated syntax/native macro verification; one native document per process."""
import json
import math
import sys
import traceback


def validate(payload):
    source = payload["source"]
    code = compile(source, payload["key"], "exec")
    if payload["phase"] == "syntax":
        return {"status": "passed", "stage": "syntax"}
    import FreeCAD as App
    import Part

    doc = App.newDocument("LibraryScriptAudit")
    sentinel = doc.addObject("App::FeaturePython", "AuditSentinel")
    try:
        exec(code, {})
        assert App.ActiveDocument is doc, "The macro changed the active document."
        roots = [obj for obj in doc.RootObjects if obj != sentinel]
        assert len(roots) == 1, "The macro must create exactly one product root."
        root = roots[0]
        assert root.PartId == payload["partId"], "Product identity was lost."
        assert root.ModelState == payload["state"], "Inspection/physical state was lost."
        assert json.loads(root.Configuration) == payload["parameters"], "Parameters were lost."
        if hasattr(root, "GeometryMode"):
            assert root.GeometryMode == payload["mode"], "Geometry mode was lost."

        def leaves(obj):
            if obj.TypeId == "App::Part":
                for child in obj.Group:
                    yield from leaves(child)
            else:
                yield obj

        components = list(leaves(root))
        assert components, "No physical components were created."
        volumes = []
        solid_counts = []
        for component in components:
            shape = component.Shape
            assert not shape.isNull() and shape.isValid(), component.Label + ": invalid shape"
            solids = shape.Solids
            volume = shape.Volume
            assert solids and volume > 0, component.Label + ": no solid volume"
            assert shape.isClosed(), component.Label + ": open component shell"
            assert all(s.isValid() and s.isClosed() for s in solids), component.Label + ": invalid solid"
            volumes.append(volume)
            solid_counts.append(len(solids))
            bounds = shape.optimalBoundingBox(False, False)
            values = [bounds.XMin, bounds.XMax, bounds.YMin, bounds.YMax, bounds.ZMin, bounds.ZMax]
            assert all(math.isfinite(value) for value in values), component.Label + ": non-finite bounds"
        compound = Part.makeCompound([obj.Shape for obj in components])
        bounds = compound.optimalBoundingBox(False, False)
        return {
            "status": "passed",
            "stage": "native",
            "components": len(components),
            "solids": sum(solid_counts),
            "volume": sum(volumes),
            "dimensions": [bounds.XLength, bounds.YLength, bounds.ZLength],
        }
    finally:
        if doc.Name in App.listDocuments():
            App.closeDocument(doc.Name)


def result(payload):
    try:
        return validate(payload)
    except Exception:
        return {
            "status": "failed",
            "stage": "syntax" if payload["phase"] == "syntax" else "native",
            "error": traceback.format_exc(limit=12),
        }


if "--syntax-stream" in sys.argv:
    for line in sys.stdin:
        if line.strip():
            payload = json.loads(line)
            print(json.dumps(result(payload)), flush=True)
else:
    payload = json.load(sys.stdin)
    print("PROTOLAB_AUDIT:" + json.dumps(result(payload)), flush=True)
