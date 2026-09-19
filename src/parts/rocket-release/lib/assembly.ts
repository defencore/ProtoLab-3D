import { Group, Box3, Vector3, Mesh, MeshStandardMaterial } from 'three';
import { component, pythonShape, type Shape, type Vec } from './shapes';
import { num } from '../../../core/geometry';
import { manufactured, material } from './names';
import { manufacturingMetadata } from './manufacturing';
import native from './st3215-native.json';
import { hatPython } from './hat';
import { threadPython } from './thread';
import { springPython } from './spring';
export interface Piece {
  shape: Shape;
  label: string;
  color: number;
  metadata?: Record<string, string>;
}
export function geometry(pieces: Piece[]): Group {
  return new Group().add(...pieces.map((p) => component(p.shape, p.label, p.color)));
}
export function python(pieces: Piece[]): string {
  const lines = [
    ...(pieces.some((p) => p.label.startsWith('BUY Waveshare Bus Servo')) ? hatPython : []),
    ...springPython,
    ...threadPython,
    'import base64,zlib',
    '_release_native_data=' + JSON.stringify(native.components.map((c) => c.brep)),
    '_release_fastener_cache={}',
    'def _release_native(index):',
    '    s=Part.Shape()',
    '    s.importBrepFromString(zlib.decompress(base64.b64decode(_release_native_data[index])).decode())',
    '    return s',
    'def _release_fastener(code,offset):',
    '    if code not in _release_fastener_cache:',
    '        scope={"Part":Part,"App":App,"math":math}',
    '        exec(code,scope)',
    '        s=scope["shape"]',
    '        s.translate(App.Vector(0,0,offset))',
    '        _release_fastener_cache[code]=s',
    '    return _release_fastener_cache[code].copy()',
    'def _release_rotate(shape,angle,axis):',
    '    shape.rotate(App.Vector(0,0,0),App.Vector(1,0,0) if axis=="x" else App.Vector(0,1,0),angle)',
    '    return shape',

    'def _release_place(shape, angle, offset):',
    '    shape.rotate(App.Vector(0,0,0),App.Vector(0,0,1),angle)',
    '    shape.translate(App.Vector(*offset))',
    '    return shape',
    'components = []',
  ];
  for (const p of pieces)
    lines.push(
      `component = (${pythonShape(p.shape)})${p.label.startsWith('BUY Waveshare Bus Servo') ? '' : '.removeSplitter()'}`,
      'components.append(component)',
    );
  lines.push(
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(pieces.map((p) => p.label))}`,
    `component_manufactured = ${JSON.stringify(pieces.map(manufactured)).replace(/true/g, 'True').replace(/false/g, 'False')}`,
    `component_materials = ${JSON.stringify(pieces.map(material))}`,
    'import hashlib,json',
    `component_metadata = json.loads(${JSON.stringify(JSON.stringify(pieces.map(manufacturingMetadata)))})`,
    'for i,s in enumerate(components):',
    '    component_metadata[i]["ShapeDigest"] = hashlib.sha256(s.exportBrepToString().encode()).hexdigest()',
    '    if component_manufactured[i]:',
    '        component_metadata[i]["PartNumber"] = "RR-" + hashlib.sha1(component_labels[i].split(" · ")[0].encode()).hexdigest()[:8].upper()',
    '        b=s.optimalBoundingBox(False,False)',
    '        component_labels[i] += " · MAKE RR-%s · %s · envelope %.2f×%.2f×%.2f mm" % (hashlib.sha1(component_labels[i].split(" · ")[0].encode()).hexdigest()[:8].upper(),component_materials[i],b.XLength,b.YLength,b.ZLength)',
    `component_colors = [${pieces.map((p) => `(${num(((p.color >> 16) & 255) / 255)},${num(((p.color >> 8) & 255) / 255)},${num((p.color & 255) / 255)})`).join(',')}]`,
  );
  return lines.join('\n');
}
let measured: { key: string; size: Vec } | undefined;
export function dimensions(pieces: Piece[]): Vec {
  const key = JSON.stringify(pieces.map((piece) => piece.shape));
  if (measured?.key === key) return [...measured.size];
  // Metrology only reads attributes: do not allocate another full assembly's
  // vertex buffers for each dimensions/export request in the configurator.
  const model = new Group().add(...pieces.map((p) => component(p.shape, p.label, p.color, false)));
  model.updateMatrixWorld(true);
  const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec;
  model.traverse((object) => {
    if (object instanceof Mesh) {
      (object.material as MeshStandardMaterial).dispose();
    }
  });
  measured = { key, size };
  return [...size];
}
