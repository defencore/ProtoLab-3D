import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { unzlibSync } from 'three/addons/libs/fflate.module.js';
import type { Parameters } from '../../../core/types';
import catalog from './catalog.json';
import native from './native/components.json';

export interface RovSourceComponent {
  id: string;
  projectId: string;
  projectName: string;
  label: string;
  format: 'stl' | 'step';
  sourcePath: string;
  sourceUrl: string;
  sourceSha256: string;
  revision: string;
  license: string;
  licenseUrl: string;
  route: 'printing' | 'milling' | 'turning' | 'cutting' | 'drilling';
  material: string;
  requirements: string[];
  dimensions: [number, number, number];
  bounds: [number, number, number, number, number, number];
  volume: number;
  solidCount: number;
}

export interface RovNativeComponent {
  id: string;
  vertices: string;
  triangles: string;
  brep?: string;
}

export const models = catalog as RovSourceComponent[];
export const sourceColorOverrides: Readonly<Record<string, number>> = {
  'finsrov-cable-passing-screw': 0x111111,
};
const nativeModels = new Map(
  (native.components as RovNativeComponent[]).map((component) => [component.id, component]),
);
const geometryCache = new Map<string, BufferGeometry>();

export function selected(p: Parameters): RovSourceComponent {
  const model = models.find((item) => item.id === p.component);
  if (!model) throw new Error('Choose an original ROV fabrication part.');
  return model;
}

export function nativeComponent(id: string): RovNativeComponent {
  const component = nativeModels.get(id);
  if (!component) throw new Error(`Missing source geometry for ROV component ${id}.`);
  return component;
}

function unpack(value: string): Uint8Array {
  return unzlibSync(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)));
}

export function geometry(p: Parameters, state = 'default'): Group {
  const errors = validate(p, state);
  if (errors.length) throw new Error(errors.join(' '));
  const model = selected(p);
  let shape = geometryCache.get(model.id);
  if (!shape) {
    const source = nativeComponent(model.id),
      vertexBytes = unpack(source.vertices),
      triangleBytes = unpack(source.triangles);
    if (vertexBytes.byteLength % 12 || triangleBytes.byteLength % 12)
      throw new Error(`Invalid packed source topology for ${model.id}.`);
    // Copy bytes into aligned arrays. Source coordinates and triangle indices are unchanged.
    const vertices = new Float32Array(vertexBytes.slice().buffer),
      triangles = new Uint32Array(triangleBytes.slice().buffer);
    if (!vertices.length || !triangles.length)
      throw new Error(`Empty source topology for ${model.id}.`);
    if (vertices.some((value) => !Number.isFinite(value)))
      throw new Error(`Non-finite source coordinate for ${model.id}.`);
    if (triangles.some((index) => index >= vertices.length / 3))
      throw new Error(`Out-of-range source triangle for ${model.id}.`);
    shape = new BufferGeometry();
    shape.setAttribute('position', new BufferAttribute(vertices, 3));
    shape.setIndex(new BufferAttribute(triangles, 1));
    shape.computeVertexNormals();
    shape.userData.nativeTopology = true;
    shape.userData.sourceSha256 = model.sourceSha256;
    geometryCache.set(model.id, shape);
  }
  const object = new Mesh(
    shape.clone(),
    new MeshStandardMaterial({
      color: sourceColorOverrides[model.id] ?? (model.route === 'printing' ? 0x319b9b : 0xa5b0bd),
      roughness: model.route === 'printing' ? 0.65 : 0.4,
      metalness: model.route === 'printing' ? 0.05 : 0.35,
      flatShading: true,
    }),
  );
  object.name = `${model.projectName} · ${model.label}`;
  object.userData.sourceComponent = model.id;
  return new Group().add(object);
}

export function dimensions(p: Parameters, state = 'default'): [number, number, number] {
  const errors = validate(p, state);
  if (errors.length) throw new Error(errors.join(' '));
  return [...selected(p).dimensions];
}

/** STL is a making file only for a source-defined printed physical detail. */
export function printingGeometry(p: Parameters, state = 'default'): Group {
  const errors = validate(p, state);
  if (errors.length) throw new Error(errors.join(' '));
  if (selected(p).route !== 'printing')
    throw new Error(
      'This is a machined metal detail, not a printed part. Use its FreeCAD macro or original STEP file for turning, milling and drilling.',
    );
  return geometry(p, state);
}

export function validate(p: Parameters, state = 'default'): string[] {
  const errors: string[] = [];
  const model = models.find((item) => item.id === p.component);
  if (!model) errors.push('Choose an original ROV fabrication part.');
  if (Object.keys(p).some((key) => key !== 'component'))
    errors.push('Source geometry is fixed; choose a component without dimension overrides.');
  if (state !== 'default') errors.push('Choose the Original source part view.');
  if (model) {
    const source = nativeModels.get(model.id);
    if (!source?.vertices || !source.triangles)
      errors.push('The selected source geometry is unavailable.');
    if (model.format === 'step' && !source?.brep)
      errors.push('The selected STEP component has no retained native BREP.');
    if (
      model.dimensions.length !== 3 ||
      model.dimensions.some((value) => !Number.isFinite(value) || value <= 0) ||
      model.bounds.length !== 6 ||
      model.bounds.some((value) => !Number.isFinite(value)) ||
      !Number.isFinite(model.volume) ||
      model.volume <= 0 ||
      !Number.isInteger(model.solidCount) ||
      model.solidCount !== 1
    )
      errors.push(
        'A fabricated ROV detail must have valid measured geometry and exactly one connected solid.',
      );
  }
  return errors;
}

export function python(p: Parameters, state = 'default'): string {
  const errors = validate(p, state);
  if (errors.length) throw new Error(errors.join(' '));
  const model = selected(p),
    source = nativeComponent(model.id),
    lines = [
      'import base64, zlib',
      `# Original ROV source: ${model.sourceUrl}`,
      `# Source SHA-256: ${model.sourceSha256}`,
      `# Revision: ${model.revision}; license: ${model.license}`,
    ];
  if (model.format === 'step') {
    lines.push(
      'shape = Part.Shape()',
      `shape.importBrepFromString(zlib.decompress(base64.b64decode(${JSON.stringify(source.brep)})).decode('utf-8'))`,
    );
  } else {
    lines.push(
      'import Mesh, struct',
      `vertices_data = zlib.decompress(base64.b64decode(${JSON.stringify(source.vertices)}))`,
      `triangles_data = zlib.decompress(base64.b64decode(${JSON.stringify(source.triangles)}))`,
      "source_points = [App.Vector(*point) for point in struct.iter_unpack('<fff', vertices_data)]",
      "source_triangles = list(struct.iter_unpack('<III', triangles_data))",
      'source_mesh = Mesh.Mesh([tuple(source_points[i] for i in face) for face in source_triangles])',
      'source_shell = Part.Shape()',
      'source_shell.makeShapeFromMesh(source_mesh.Topology, 0.000001)',
      'source_solids = []',
      'for shell in source_shell.Shells:',
      '    if not shell.isClosed():',
      "        raise ValueError('Original ROV STL contains an open shell; no automatic repair is applied.')",
      '    solid = Part.makeSolid(shell)',
      '    if solid.Volume < 0:',
      '        solid.reverse()',
      '    if not solid.isValid() or solid.Volume <= 0:',
      "        raise ValueError('Original ROV STL could not form a valid positive-volume faceted solid.')",
      '    source_solids.append(solid)',
      'if not source_solids:',
      "    raise ValueError('Original ROV STL has no closed solid shell.')",
      'shape = source_solids[0] if len(source_solids) == 1 else Part.makeCompound(source_solids)',
    );
  }
  lines.push(
    'if not shape.isValid() or not shape.Solids or any(not s.isClosed() or s.Volume <= 0 for s in shape.Solids):',
    "    raise ValueError('Original ROV geometry failed the native solid check.')",
    `if len(shape.Solids) != ${model.solidCount}:`,
    "    raise ValueError('ROV source solid count differs from the retained source record.')",
  );
  const color = sourceColorOverrides[model.id];
  if (color !== undefined)
    lines.push(
      `component_colors = ${JSON.stringify([[((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255]])}`,
    );
  return lines.join('\n');
}
