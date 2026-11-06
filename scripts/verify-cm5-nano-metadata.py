"""Execute final production macros after metadata-only changes.

Usage: FreeCAD-Python verify-cm5-nano-metadata.py a|b FINAL_CASE.json
       SOURCE_CASE.json SOURCE_REPORT.json OUTPUT_REPORT.json

The exact geometry recipe must occur unchanged in both production macros. The
earlier source/STEP comparison remains applicable; current macro geometry,
incomplete-source disclosure, supplier identity and FCStd metadata are checked.
"""
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, os.environ.get("FREECAD_LIB", "/Applications/FreeCAD.app/Contents/Resources/lib"))
import FreeCAD as App

ROOT = Path(__file__).resolve().parents[1]


def sha(value):
    return hashlib.sha256(value).hexdigest()


def main():
    variant, case_path, previous_case_path, previous_report_path, report_path = sys.argv[1:6]
    assert variant in ("a", "b")
    case = json.loads(Path(case_path).read_text())
    previous_case = json.loads(Path(previous_case_path).read_text())
    previous = json.loads(Path(previous_report_path).read_text())
    native_path = ROOT / "src/parts/compute-module-carrier/lib" / ("nano-" + variant) / "native.json"
    native = json.loads(native_path.read_text())
    assert previous["passed"] and previous["sourceGeometryMatch"]
    assert previous["stepRoundtrip"] and previous["fcstdRoundtrip"] and previous["identityRoundtrip"]
    assert previous["codeSha256"] == sha(previous_case["script"].encode())
    assert previous["sourceSha256"] == native["sourceSha256"]
    assert previous["retainedSolids"] == len(native["components"])
    assert previous["excludedSourceSolids"] == native["excludedSourceSolids"]
    assert case["parameters"] == previous_case["parameters"]
    assert case["state"] == previous_case["state"] == previous["state"]
    recipe = case["geometryRecipe"]
    indented_recipe = "\n".join("        " + line for line in recipe.split("\n"))
    assert indented_recipe in case["script"] and indented_recipe in previous_case["script"], "Source-tested geometry recipe changed; repeat full source comparison"
    document = App.newDocument("NANOMetadataComparison")
    exec(case["script"], {})
    parent = document.RootObjects[0]
    objects = list(parent.Group)
    preset_id = "waveshare-cm5-nano-" + variant
    assert parent.LibraryId == "compute-module-carrier"
    assert parent.PresetId == preset_id
    assert parent.LibraryEntryId == "compute-module-carrier:" + preset_id
    assert parent.CatalogDesignation == "CM5-NANO-" + variant.upper()
    assert parent.ModelState == case["state"]
    assert json.loads(parent.Configuration) == case["parameters"]
    evidence = json.loads(parent.GeometryEvidence)
    assert evidence["sourceSha256"] == native["sourceSha256"]
    assert "Incomplete manufacturer CAD engineering reference" in evidence["summary"]
    assert "not the complete installed product envelope" in evidence["limitations"]
    assert "MIPI" in evidence["limitations"] and "CM5 board-to-board" in evidence["limitations"]
    if variant == "b":
        assert all(name in evidence["limitations"] for name in ("RJ45", "mini HDMI", "microSD"))
    assert len(objects) == len(native["components"]) == len(previous["components"])
    max_bounds = max_volume = 0
    for obj, component, checked in zip(objects, native["components"], previous["components"]):
        shape = obj.Shape
        assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1 and shape.Volume > 0
        assert component["sourceSolid"] == checked["sourceSolid"]
        assert len(shape.Faces) == checked["faces"]
        assert dict(sorted(Counter(type(face.Surface).__name__ for face in shape.Faces).items())) == checked["surfaceTypes"]
        bound = shape.optimalBoundingBox(False, False)
        actual = [bound.XMin, bound.YMin, bound.ZMin, bound.XMax, bound.YMax, bound.ZMax]
        expected = list(component["bounds"])
        if case["state"] == "exploded":
            expected[2] += component["layer"] * 10
            expected[5] += component["layer"] * 10
        error = max(abs(a - b) for a, b in zip(actual, expected))
        assert error < 1e-5
        max_bounds = max(max_bounds, error)
        volume_error = abs(shape.Volume - component["volume"])
        assert volume_error < max(1e-7, component["volume"] * 1e-7)
        max_volume = max(max_volume, volume_error)
    keys = ("LibraryId", "PresetId", "LibraryEntryId", "ConfigurationKey", "Configuration", "ModelState", "CatalogDesignation", "GeometryEvidence", "CatalogDefinition")
    identity = {key: getattr(parent, key) for key in keys}
    labels = [obj.Label for obj in objects]
    with tempfile.TemporaryDirectory(prefix="protolab-nano-metadata-", dir=ROOT / "test-results") as temporary:
        path = str(Path(temporary) / "roundtrip.FCStd")
        document.saveAs(path)
        App.closeDocument(document.Name)
        document = App.openDocument(path)
        restored = document.RootObjects[0]
        assert {key: getattr(restored, key) for key in keys} == identity
        assert [obj.Label for obj in restored.Group] == labels
        assert all(obj.Shape.isValid() and obj.Shape.isClosed() and len(obj.Shape.Solids) == 1 for obj in restored.Group)
        App.closeDocument(document.Name)
    report = dict(
        passed=True, model=preset_id, state=case["state"], codeSha256=sha(case["script"].encode()),
        sourceSha256=native["sourceSha256"], nativeSha256=sha(native_path.read_bytes()),
        geometryRecipeSha256=sha(recipe.encode()), unchangedSourceTestedRecipe=True,
        geometryEvidenceReusedFrom=str(previous_report_path), geometryEvidenceReportSha256=sha(Path(previous_report_path).read_bytes()),
        sourceComparisonRepeated=False, stepRoundtripRepeated=False,
        retainedSolids=len(objects), nativeFaces=previous["nativeFaces"],
        maxCurrentBoundsDifference=max_bounds, maxCurrentVolumeDifference=max_volume,
        currentMacroExecuted=True, currentFcstdRoundtrip=True, currentMetadataRoundtrip=True,
        physicalProductComplete=False,
        scope="Source-tested retained geometry and current metadata only; supplier CAD omits fitted connectors, so complete installed envelope and enclosure fit remain unresolved.",
    )
    Path(report_path).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
