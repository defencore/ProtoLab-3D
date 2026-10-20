import { recoveryPieceGeometry, recoveryPiecePython } from './library-components';
import { servoCadPython } from '../../bus-servo/part';
import { Group, Box3, Vector3, Mesh, MeshStandardMaterial } from 'three';
import { pythonShape, type Shape, type Vec } from '../../../core/assembly/recovery/shapes';
import { num } from '../../../core/geometry';
import { manufactured, material } from './names';
import { manufacturingMetadata, threadFeatures, threadLabel } from './manufacturing';
import { hatPython } from '../../../core/assembly/recovery/hat';
import { threadPython } from '../../../core/assembly/recovery/thread';
import { springPython } from '../../../core/assembly/recovery/spring';
export interface Piece {
  shape: Shape;
  label: string;
  color: number;
  metadata?: Record<string, string>;
}
function supplierGeometryKind(shape: Shape, kind: 'hat' | 'native'): boolean {
  return (
    shape.kind === kind ||
    ((shape.kind === 'transform' || shape.kind === 'rotate') &&
      supplierGeometryKind(shape.child, kind))
  );
}
export function geometry(pieces: Piece[]): Group {
  return new Group().add(
    ...pieces.map((p) => recoveryPieceGeometry({ ...p, label: threadLabel(p) })),
  );
}
export function python(pieces: Piece[]): string {
  const lines = [
    ...(pieces.some((p) => supplierGeometryKind(p.shape, 'hat')) ? hatPython : []),
    ...springPython,
    ...threadPython(),
    ...(pieces.some((p) => supplierGeometryKind(p.shape, 'native')) ? servoCadPython : []),
    '_release_library_cache={}',
    'def _release_library(code):',
    '    if code not in _release_library_cache:',
    '        scope={"Part":Part,"App":App,"math":math}',
    '        exec(code,scope)',
    '        _release_library_cache[code]=scope["shape"]',
    '    return _release_library_cache[code].copy()',
    '_release_fastener_cache={}',
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
      recoveryPiecePython(p)
        ? `component = _release_library(${JSON.stringify(recoveryPiecePython(p))})`
        : `component = (${pythonShape(p.shape)})${supplierGeometryKind(p.shape, 'hat') ? '' : '.removeSplitter()'}`,
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
  const model = new Group().add(...pieces.map((p) => recoveryPieceGeometry(p)));
  model.updateMatrixWorld(true);
  const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec;
  model.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      (object.material as MeshStandardMaterial).dispose();
    }
  });
  measured = { key, size };
  return [...size];
}
