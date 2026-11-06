"""Compare production NANO macros with the pinned manufacturer STEP executions.

Usage (FreeCAD Python): verify-cm5-nano-cad.py a|b SOURCE.step CASE.json REPORT.json
Cases contain production-generated script, parameters and state. Source exclusions
describe accessories absent from the purchased execution, not discarded defects.
"""
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time

sys.path.insert(0, os.environ.get("FREECAD_LIB", "/Applications/FreeCAD.app/Contents/Resources/lib"))
import FreeCAD as App
import Part


ROOT = Path(__file__).resolve().parents[1]
BOUND_KEYS = ("XMin", "YMin", "ZMin", "XMax", "YMax", "ZMax")


def bounds_error(left, right):
    a = left.optimalBoundingBox(False, False)
    b = right.optimalBoundingBox(False, False)
    return max(abs(getattr(a, key) - getattr(b, key)) for key in BOUND_KEYS)


def signature(shape):
    def record(item, measure):
        centre = item.CenterOfMass
        return tuple(round(value, 5) for value in (getattr(item, measure), centre.x, centre.y, centre.z))
    return (
        sorted(tuple(round(value, 5) for value in vertex.Point) for vertex in shape.Vertexes),
        sorted(record(edge, "Length") for edge in shape.Edges),
        sorted((type(face.Surface).__name__,) + record(face, "Area") for face in shape.Faces),
    )


def sampled_boundaries_match(left, right, tolerance=1e-6):
    """Resolve rounding boundaries using corresponding native vertices and surfaces."""
    if (len(left.Vertexes), len(left.Edges), len(left.Faces)) != (len(right.Vertexes), len(right.Edges), len(right.Faces)):
        return False
    if any((a.Point - b.Point).Length > tolerance for a, b in zip(left.Vertexes, right.Vertexes)):
        return False
    if any(abs(a.Length - b.Length) > tolerance or (a.CenterOfMass - b.CenterOfMass).Length > tolerance for a, b in zip(left.Edges, right.Edges)):
        return False
    for a, b in zip(left.Faces, right.Faces):
        if type(a.Surface) != type(b.Surface) or abs(a.Area - b.Area) > tolerance or (a.CenterOfMass - b.CenterOfMass).Length > tolerance:
            return False
        u0, u1, v0, v1 = a.ParameterRange
        r0, r1, s0, s1 = b.ParameterRange
        for u, v in ((0, 0), (1, 0), (0, 1), (1, 1), (.25, .25), (.5, .5), (.75, .75)):
            if (a.valueAt(u0 + u * (u1 - u0), v0 + v * (v1 - v0)) - b.valueAt(r0 + u * (r1 - r0), s0 + v * (s1 - s0))).Length > tolerance:
                return False
    return True


def surface_types(shape):
    return dict(sorted(Counter(type(face.Surface).__name__ for face in shape.Faces).items()))


def main():
    variant, source_path, case_path, report_path = sys.argv[1:5]
    assert variant in ("a", "b")
    native_path = ROOT / "src/parts/compute-module-carrier/lib" / ("nano-" + variant) / "native.json"
    native = json.loads(native_path.read_text())
    source_sha = hashlib.sha256(Path(source_path).read_bytes()).hexdigest()
    assert source_sha == native["sourceSha256"], "Manufacturer STEP revision changed"
    source = Part.Shape()
    source.read(source_path)
    source_solids = source.Solids
    source_faces = len(source.Faces)
    assert source_faces == sum(len(solid.Faces) for solid in source_solids), "Source has non-solid surfaces that must be preserved explicitly"
    components = native["components"]
    exclusions = native["excludedSourceSolids"]
    assert len(source_solids) == native["sourceSolids"]
    assert len(components) == native["selectedSolids"]
    assert sorted([component["sourceSolid"] for component in components] + exclusions) == list(range(len(source_solids)))
    assert exclusions == (list(range(252, 312)) if variant == "a" else list(range(270, 390))), "Standard board excludes the complete pre-soldered GPIO header"
    retained = [source_solids[component["sourceSolid"]] for component in components]
    case = json.loads(Path(case_path).read_text())
    preset_id = "waveshare-cm5-nano-" + variant
    assert case["parameters"] == {"model": preset_id}
    assert case["state"] in ("assembled", "exploded")
    document = App.newDocument("NANOSourceComparison")
    started = time.perf_counter()
    exec(case["script"], {})
    parent = document.RootObjects[0]
    objects = list(parent.Group)
    assert len(objects) == len(retained)
    expected_entry = "compute-module-carrier:" + preset_id
    assert parent.LibraryId == "compute-module-carrier"
    assert parent.PresetId == preset_id and parent.LibraryEntryId == expected_entry
    assert parent.CatalogDesignation == "CM5-NANO-" + variant.upper()
    assert parent.ModelState == case["state"]
    assert json.loads(parent.Configuration) == case["parameters"]
    assert json.loads(parent.GeometryEvidence)["sourceSha256"] == source_sha
    identity_keys = ("LibraryId", "PresetId", "LibraryEntryId", "ConfigurationKey", "Configuration", "ModelState", "CatalogDesignation", "GeometryEvidence")
    identities = {key: getattr(parent, key) for key in identity_keys}
    max_bounds = max_volume = max_difference = 0
    comparisons = Counter()
    records = []
    for original, component, obj in zip(retained, components, objects):
        assert original.isValid() and original.isClosed() and original.Volume > 0, (component["sourceSolid"], "invalid retained source")
        expected = original.copy()
        expected.rotate(App.Vector(), App.Vector(0, 0, 1), native["transform"]["rotate"])
        expected.translate(App.Vector(*native["transform"]["shift"]))
        if case["state"] == "exploded":
            expected.translate(App.Vector(0, 0, component["layer"] * 10))
        actual = obj.Shape
        assert actual.isValid() and actual.isClosed() and len(actual.Solids) == 1 and actual.Volume > 0, (component["sourceSolid"], "invalid macro geometry")
        error = bounds_error(actual, expected)
        max_bounds = max(max_bounds, error)
        assert error < 1e-5, (component["sourceSolid"], "source bounds", error)
        volume_error = abs(actual.Volume - expected.Volume)
        max_volume = max(max_volume, volume_error)
        assert volume_error < max(1e-7, expected.Volume * 1e-7), (component["sourceSolid"], "source volume", volume_error)
        assert len(actual.Faces) == len(expected.Faces), (component["sourceSolid"], "native topology changed")
        assert surface_types(actual) == surface_types(expected)
        if signature(actual) == signature(expected):
            method = "boundary-fingerprint"
        elif sampled_boundaries_match(actual, expected):
            method = "native-surface-samples"
        else:
            left, right = actual.cut(expected), expected.cut(actual)
            assert left.isValid() and right.isValid()
            difference = abs(left.Volume) + abs(right.Volume)
            max_difference = max(max_difference, difference)
            assert difference < 1e-7, (component["sourceSolid"], "source symmetric difference", difference)
            method = "bidirectional-subtraction"
        comparisons[method] += 1
        records.append(dict(sourceSolid=component["sourceSolid"], faces=len(actual.Faces), surfaceTypes=surface_types(actual), method=method, boundsError=error, volumeError=volume_error))
    pcb = objects[next(i for i, component in enumerate(components) if component["sourceSolid"] == 0)].Shape
    assert set(surface_types(pcb)) == {"Cylinder", "Plane"}, "PCB bores and outline remain analytic"
    with tempfile.TemporaryDirectory(prefix="protolab-cm5-nano-", dir=ROOT / "test-results") as temporary:
        step_path = str(Path(temporary) / "roundtrip.step")
        Part.export(objects, step_path)
        restored = Part.Shape()
        restored.read(step_path)
        assert restored.isValid() and len(restored.Solids) == len(objects)
        step_bounds = step_volume = step_budget = 0
        for obj, solid in zip(objects, restored.Solids):
            assert solid.isValid() and solid.isClosed() and solid.Volume > 0
            error = bounds_error(obj.Shape, solid)
            step_bounds = max(step_bounds, error)
            assert error < 1e-5, (obj.Label, "STEP bounds", error)
            drift = abs(obj.Shape.Volume - solid.Volume)
            allowance = max(1e-7, max(obj.Shape.Area, solid.Area) * max(1e-7, obj.Shape.getTolerance(1), solid.getTolerance(1)))
            assert drift < allowance, (obj.Label, "STEP volume", drift, allowance)
            step_volume = max(step_volume, drift)
            step_budget += allowance
        aggregate_drift = abs(sum(solid.Volume for solid in restored.Solids) - sum(obj.Shape.Volume for obj in objects))
        assert aggregate_drift < step_budget
        labels = [obj.Label for obj in objects]
        fcstd_path = str(Path(temporary) / "roundtrip.FCStd")
        document.saveAs(fcstd_path)
        step_bytes, fcstd_bytes = Path(step_path).stat().st_size, Path(fcstd_path).stat().st_size
        App.closeDocument(document.Name)
        document = App.openDocument(fcstd_path)
        restored_parent = document.RootObjects[0]
        assert {key: getattr(restored_parent, key) for key in identity_keys} == identities
        assert [obj.Label for obj in restored_parent.Group] == labels
        assert all(obj.Shape.isValid() and obj.Shape.isClosed() and len(obj.Shape.Solids) == 1 for obj in restored_parent.Group)
    report = dict(
        passed=True, model=preset_id, state=case["state"], sourceSha256=source_sha,
        nativeSha256=hashlib.sha256(native_path.read_bytes()).hexdigest(),
        codeSha256=hashlib.sha256(case["script"].encode()).hexdigest(),
        sourceSolids=len(source_solids), retainedSolids=len(retained), excludedSourceSolids=exclusions,
        excludedInvalidSourceSolids=[i for i in exclusions if not source_solids[i].isValid()],
        sourceGeometryMatch=True, physicalProductComplete=False,
        coverageScope="Retained manufacturer STEP geometry after documented optional GPIO-header exclusion; supplied source omits actual fitted connector bodies.",
        sourceSurfaceCoverage=dict(totalSourceFaces=source_faces, sourceFacesInSolids=sum(len(solid.Faces) for solid in source_solids), excludedHeaderFaces=sum(len(source_solids[i].Faces) for i in exclusions), retainedFaces=sum(record["faces"] for record in records)),
        comparisons=dict(comparisons), maxBoundsDifference=max_bounds,
        maxVolumeDifference=max_volume, maxSymmetricDifference=max_difference,
        nativeFaces=sum(record["faces"] for record in records), pcbFaces=len(pcb.Faces), pcbSurfaceTypes=surface_types(pcb),
        stepRoundtrip=True, fcstdRoundtrip=True, identityRoundtrip=True,
        stepRoundtripMetrics=dict(maxBoundsDifference=step_bounds, maxSolidVolumeDifference=step_volume, aggregateVolumeDifference=aggregate_drift, aggregateVolumeBudget=step_budget),
        fileBytes=dict(native=native_path.stat().st_size, step=step_bytes, fcstd=fcstd_bytes),
        elapsedSeconds=time.perf_counter()-started, components=records,
    )
    Path(report_path).write_text(json.dumps(report, indent=2) + "\n")
    App.closeDocument(document.Name)
    print(json.dumps({key: value for key, value in report.items() if key != "components"}), flush=True)


if __name__ == "__main__":
    main()
