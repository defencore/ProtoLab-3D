#!/usr/bin/env python3
"""Render the actual catalog Three.js triangles in a fresh, isolated Blender process."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import zlib


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "test-results" / "grandado-model"
MESH_FILE = OUTPUT / "grandado-world-meshes.json"
BLENDER = Path("/Applications/Blender.app/Contents/MacOS/Blender")

EXPORT_JAVASCRIPT = r"""
import { Mesh, Vector3 } from 'three';
import { grandadoGeometry } from './src/parts/catalog-enclosure/lib/grandado.ts';
const model = grandadoGeometry('assembled');
model.updateMatrixWorld(true);
const meshes = [];
for (const [componentIndex, component] of model.children.entries()) {
  component.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const attr = object.geometry.getAttribute('position');
    const vertices = [];
    const point = new Vector3();
    for (let i = 0; i < attr.count; i++) {
      point.fromBufferAttribute(attr, i).applyMatrix4(object.matrixWorld);
      vertices.push(point.toArray());
    }
    const index = object.geometry.getIndex();
    const faces = [];
    for (let i = 0; i < (index?.count ?? attr.count); i += 3)
      faces.push([0, 1, 2].map((offset) => index ? index.getX(i + offset) : i + offset));
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    meshes.push({
      componentIndex,
      label: component.name || object.name,
      vertices,
      faces,
      color: material.color.toArray(),
      metalness: material.metalness,
      roughness: material.roughness,
      opacity: material.opacity,
    });
  });
}
console.log(JSON.stringify({
  generator: 'src/parts/catalog-enclosure/lib/grandado.ts:grandadoGeometry(assembled)',
  unit: 'mm',
  components: model.children.length,
  meshes,
}));
"""


def compose_renders() -> Path:
    """Join the two renderer PNGs without changing a single model pixel."""

    def read_rgba(path):
        data = path.read_bytes()
        assert data[:8] == b"\x89PNG\r\n\x1a\n"
        compressed = bytearray()
        cursor = 8
        while cursor < len(data):
            length = struct.unpack(">I", data[cursor : cursor + 4])[0]
            kind = data[cursor + 4 : cursor + 8]
            payload = data[cursor + 8 : cursor + 8 + length]
            if kind == b"IHDR":
                width, height, depth, color, _, _, interlace = struct.unpack(">IIBBBBB", payload)
                assert (depth, color, interlace) == (8, 6, 0), "Expected Blender RGBA8 PNG."
            elif kind == b"IDAT":
                compressed.extend(payload)
            cursor += length + 12
        decoded = zlib.decompress(compressed)
        stride = width * 4
        previous = bytearray(stride)
        rows = []
        for y in range(height):
            start = y * (stride + 1)
            method = decoded[start]
            row = bytearray(decoded[start + 1 : start + 1 + stride])
            if method:
                for i, value in enumerate(row):
                    a = row[i - 4] if i >= 4 else 0
                    b = previous[i]
                    c = previous[i - 4] if i >= 4 else 0
                    if method == 1:
                        predictor = a
                    elif method == 2:
                        predictor = b
                    elif method == 3:
                        predictor = (a + b) // 2
                    elif method == 4:
                        p = a + b - c
                        distances = [abs(p - candidate) for candidate in (a, b, c)]
                        predictor = (a, b, c)[distances.index(min(distances))]
                    else:
                        raise ValueError(f"Unsupported PNG filter {method}.")
                    row[i] = (value + predictor) & 255
            rows.append(bytes(row))
            previous = row
        return width, height, rows

    width, height, left = read_rgba(OUTPUT / "grandado-closed-render.png")
    right_width, right_height, right = read_rgba(OUTPUT / "grandado-inside-render.png")
    assert (right_width, right_height) == (width, height)
    gap = 24
    divider = left[0][:4] * gap
    pixels = b"".join(b"\x00" + a + divider + b for a, b in zip(left, right))

    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))

    path = OUTPUT / "grandado-model-preview.png"
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width * 2 + gap, height, 8, 6, 0, 0, 0))
        + chunk(b"sRGB", b"\x00")
        + chunk(b"IDAT", zlib.compress(pixels, 6))
        + chunk(b"IEND", b"")
    )
    report_path = OUTPUT / "grandado-render-report.json"
    if report_path.exists():
        report = json.loads(report_path.read_text())
        if path.name not in report["outputs"]:
            report["outputs"].append(path.name)
        report_path.write_text(json.dumps(report, indent=2) + "\n")
    print(f"GRANDADO_COMPOSITE_READY={path}", flush=True)
    return path


def render_in_blender() -> None:
    import bpy
    from mathutils import Vector

    source = json.loads(MESH_FILE.read_text())
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8 if "--quick" in sys.argv else 24
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 4
    scene.render.resolution_x = 300 if "--quick" in sys.argv else 1200
    scene.render.resolution_y = 250 if "--quick" in sys.argv else 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "MILLIMETERS"
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except (TypeError, ValueError):
        pass

    world = bpy.data.worlds.new("Neutral studio world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.78, 0.81, 0.86, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.3
    scene.world = world

    components = []
    for index, record in enumerate(source["meshes"]):
        mesh = bpy.data.meshes.new(f"Actual Three mesh {index}")
        mesh.from_pydata(
            [tuple(coordinate * 0.001 for coordinate in vertex) for vertex in record["vertices"]],
            [],
            record["faces"],
        )
        mesh.update()
        obj = bpy.data.objects.new(record["label"] or f"Component {record['componentIndex']}", mesh)
        scene.collection.objects.link(obj)
        obj["library_component_index"] = record["componentIndex"]
        obj["geometry_source"] = source["generator"]
        material = bpy.data.materials.new(f"Source material {index}")
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*record["color"], 1)
        bsdf.inputs["Metallic"].default_value = record["metalness"]
        bsdf.inputs["Roughness"].default_value = record["roughness"]
        bsdf.inputs["Alpha"].default_value = record["opacity"]
        obj.data.materials.append(material)
        components.append(obj)

    bpy.ops.mesh.primitive_plane_add(size=0.8, location=(0, 0, -0.01765))
    floor = bpy.context.object
    floor.name = "Render background plane"
    floor_material = bpy.data.materials.new("Neutral matte background")
    floor_material.diffuse_color = (0.38, 0.4, 0.43, 1)
    floor_material.use_nodes = True
    floor_bsdf = floor_material.node_tree.nodes.get("Principled BSDF")
    floor_bsdf.inputs["Base Color"].default_value = (0.38, 0.4, 0.43, 1)
    floor_bsdf.inputs["Roughness"].default_value = 0.85
    floor.data.materials.append(floor_material)

    def area_light(name, location, power, radius):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = power
        data.shape = "DISK"
        data.size = radius
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (Vector((0, 0, 0)) - obj.location).to_track_quat("-Z", "Y").to_euler()

    area_light("Large soft key", (-0.06, -0.15, 0.22), 0.35, 0.15)
    area_light("Soft fill", (0.13, 0.03, 0.16), 0.12, 0.12)
    area_light("Rear rim", (-0.08, 0.13, 0.16), 0.22, 0.12)

    camera_data = bpy.data.cameras.new("Catalog review camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 0.142
    camera_data.clip_start = 0.001
    camera_data.clip_end = 10
    camera = bpy.data.objects.new("Catalog review camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    views = [
        ("grandado-closed-render.png", (0, -0.18, 0.16), (0, 0, 0), False),
        ("grandado-inside-render.png", (0.055, -0.09, 0.31), (0, 0, -0.006), True),
    ]
    for filename, location, target, inside in views:
        selected_view = sys.argv[sys.argv.index("--view") + 1] if "--view" in sys.argv else "all"
        if selected_view != "all" and selected_view != ("inside" if inside else "closed"):
            continue
        if "--quick" in sys.argv:
            filename = filename.replace("-render.png", "-preview.png")
        for obj in components:
            component = obj["library_component_index"]
            obj.hide_render = inside and (component == 1 or component >= 6)
        camera.location = location
        camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(OUTPUT / filename)
        bpy.ops.render.render(write_still=True)
        print(f"GRANDADO_RENDER_READY={OUTPUT / filename}", flush=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    node = shutil.which("node")
    if node is None or not BLENDER.is_file():
        raise SystemExit("The installed Node and Blender runtimes are required.")
    if "--reuse-mesh" in sys.argv and MESH_FILE.is_file():
        source = json.loads(MESH_FILE.read_text())
    else:
        completed = subprocess.run(
            [node, "--import", "tsx", "--input-type=module", "-e", EXPORT_JAVASCRIPT],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        source = json.loads(completed.stdout)
        MESH_FILE.write_text(json.dumps(source, separators=(",", ":")) + "\n")
    print(f"Exported {len(source['meshes'])} exact Three meshes to {MESH_FILE}", flush=True)
    render_options = []
    if "--view" in sys.argv:
        render_options.extend(["--view", sys.argv[sys.argv.index("--view") + 1]])
    if "--quick" in sys.argv:
        render_options.append("--quick")
    subprocess.run(
        [str(BLENDER), "--background", "--factory-startup", "--python", str(Path(__file__).resolve()), "--", "--render", *render_options],
        cwd=ROOT,
        check=True,
    )
    report = {
        "source": source["generator"],
        "sourceSha256": hashlib.sha256((ROOT / "src/parts/catalog-enclosure/lib/grandado.ts").read_bytes()).hexdigest(),
        "meshFile": str(MESH_FILE.relative_to(ROOT)),
        "components": source["components"],
        "meshes": len(source["meshes"]),
        "triangles": sum(len(mesh["faces"]) for mesh in source["meshes"]),
        "renderer": "Blender CPU Cycles, 24 samples, 1200 x 1000",
        "insideView": "Lid and four supplied screws hidden for inspection; body and brass inserts unchanged.",
        "outputs": ["grandado-closed-render.png", "grandado-inside-render.png"],
    }
    (OUTPUT / "grandado-render-report.json").write_text(json.dumps(report, indent=2) + "\n")
    if "--view" not in sys.argv and "--quick" not in sys.argv:
        compose_renders()
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    if "--compose-only" in sys.argv:
        compose_renders()
    elif "--render" in sys.argv:
        render_in_blender()
    else:
        main()
