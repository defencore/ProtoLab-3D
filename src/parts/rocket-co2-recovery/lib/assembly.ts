import { Group, Box3, Vector3, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import detail from '../../recovery-detail/part';
import purchased from '../../purchased-recovery-component/part';
import { component } from '../../../core/assembly/recovery/shapes';
import { recoveryDetailPython } from '../../../core/assembly/recovery/python';
import { threadFeatures } from '../../../core/assembly/recovery/thread-features';
import { fastenerCatalog } from '../../rocket-release/lib/fastener-catalog';
import { libraryPart, pieceComponent } from './composition';
import type { Piece } from './model';
import { disposeModel } from '../../../core/mechanical';
import { threadMetadata } from '../../../core/thread-callouts';
import { threadCallouts as cartridgeThreads } from '../../co2-cartridge/lib/model';
import { num } from '../../../core/geometry';

function libraryThreadMetadata(l: NonNullable<Piece['library']>) {
  if (l.kind !== 'cartridge') return {};
  const transform = new Matrix4()
    .makeTranslation(...l.offset)
    .multiply(new Matrix4().makeRotationZ(((l.azimuth ?? 0) * Math.PI) / 180))
    .multiply(new Matrix4().makeRotationX(l.inverted ? Math.PI : 0));
  return threadMetadata(
    cartridgeThreads({ model: l.model }).map((t) => ({
      ...t,
      origin: new Vector3().fromArray(t.origin!).applyMatrix4(transform).toArray(),
      axis: new Vector3().fromArray(t.axis!).transformDirection(transform).toArray(),
    })),
  );
}
function definition(piece: Piece) {
  if (piece.library) return libraryPart(piece.library);
  return piece.process.startsWith('BUY') ? purchased : detail;
}
function metadata(piece: Piece, index: number): Record<string, string> {
  const configured = pieceComponent(piece, index);
  const features = piece.shape ? threadFeatures(piece.shape) : [];
  const catalog =
    piece.shape && piece.process.startsWith('BUY')
      ? fastenerCatalog(piece.shape, piece.label)
      : undefined;
  const manufactured = !piece.process.startsWith('BUY') && piece.process !== 'REFERENCE';
  const groups = new Map<string, number>();
  for (const feature of features) {
    const key = `${feature.internal ? 'internal' : 'external'} ${feature.designation}; nominal tool L${feature.length} mm`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return {
    Procurement:
      catalog?.procurement ??
      (manufactured
        ? piece.process === '3D PRINT'
          ? 'MAKE_PRINT'
          : 'MAKE'
        : piece.process === 'REFERENCE'
          ? 'REFERENCE'
          : 'BUY_ASSEMBLY_OR_COMPONENT'),
    Standard: catalog?.standard ?? (manufactured ? 'Custom drawing' : 'Supplier specification'),
    OrderDesignation: catalog?.designation ?? configured?.procurement?.designation ?? piece.label,
    SupplierSource: catalog?.source ?? configured?.procurement?.source ?? '',
    ProcurementNotes: catalog?.note ?? piece.metadata?.SupplierScope ?? '',
    LibraryId: configured?.libraryId ?? 'reference-routing',
    ConfigurationJSON: JSON.stringify(configured?.parameters ?? {}),
    PhysicalOccurrenceId: configured?.id ?? '',
    Supply: configured?.supply ?? 'reference',
    OrganizationPath: JSON.stringify(piece.group),
    ManufacturingProcess: piece.process,
    Material: piece.material,
    ThreadCallouts:
      [...groups].map(([key, count]) => `${count}× ${key}`).join('; ') ||
      'No generated thread feature',
    ThreadLabels: [
      ...new Set(features.map((t) => `${t.internal ? 'internal' : 'external'} ${t.designation}`)),
    ].join('; '),
    ThreadFeaturesJSON: JSON.stringify(features),
    ThreadModel: features.length ? threadMetadata(features).ThreadModel : '',
    ...(piece.library ? libraryThreadMetadata(piece.library) : {}),
    DrawingStatus:
      piece.process === 'REFERENCE'
        ? 'ROUTING ENVELOPE'
        : 'Prototype geometry; fits and load capacity require verification',
    ...piece.metadata,
  };
}

export function geometry(pieces: Piece[]) {
  return new Group().add(
    ...pieces.map((piece, index) => {
      const configured = pieceComponent(piece, index);
      const group = configured
        ? definition(piece).buildGeometry(configured.parameters, configured.state)
        : component(piece.shape!, piece.label, piece.color);
      if (configured) {
        group.position.set(...configured.placement.translation);
        group.rotation.set(
          ...(configured.placement.rotation.map((angle) => (angle * Math.PI) / 180) as [
            number,
            number,
            number,
          ]),
          'ZYX',
        );
        group.userData.libraryId = configured.libraryId;
        group.userData.configuration = configured.parameters;
      }
      group.name = piece.label;
      group.userData.supply = configured?.supply ?? 'reference';
      group.userData.organizationPath = piece.group;
      group.userData.supplierUnitId = piece.metadata?.SupplierUnitId;
      group.traverse((object) => {
        if (object !== group) object.name = piece.label + ' · ' + object.name;
        if (object instanceof Mesh)
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            if (material instanceof MeshStandardMaterial) material.color.setHex(piece.color);
      });
      return group;
    }),
  );
}
export function dimensions(pieces: Piece[]): [number, number, number] {
  const g = geometry(pieces);
  g.updateMatrixWorld(true);
  try {
    return new Box3().setFromObject(g, true).getSize(new Vector3()).toArray() as [
      number,
      number,
      number,
    ];
  } finally {
    disposeModel(g);
  }
}
export function python(pieces: Piece[]) {
  const ordered = [...pieces.filter((p) => p.shape), ...pieces.filter((p) => p.library)];
  if (ordered.some((piece) => !piece.group?.length))
    throw new Error('Every CO2 recovery component must belong to an organizational group.');
  const lines = [
    'import hashlib,json',
    '_co2_cache={}',
    'def _co2_component(source):',
    '    if source not in _co2_cache:',
    '        scope={"App":App,"Part":Part,"math":math}',
    '        exec(source,scope)',
    '        _co2_cache[source]=scope["shape"]',
    '    return _co2_cache[source].copy()',
    'components=[]',
  ];
  for (const [index, piece] of ordered.entries()) {
    const configured = pieceComponent(piece, index);
    const code = configured
      ? definition(piece).python(configured.parameters, configured.state)
      : recoveryDetailPython(piece.shape!);
    lines.push(`component=_co2_component(${JSON.stringify(code)})`);
    if (configured) {
      for (const [axis, angle] of configured.placement.rotation.entries())
        if (angle)
          lines.push(
            `component.rotate(App.Vector(0,0,0),App.Vector(${[0, 1, 2].map((value) => (value === axis ? 1 : 0)).join(',')}),${num(angle)})`,
          );
      lines.push(
        `component.translate(App.Vector(${configured.placement.translation.map(num).join(',')}))`,
      );
    }
    lines.push('components.append(component)');
  }
  return [
    ...lines,
    `component_labels=${JSON.stringify(ordered.map((p) => p.label))}`,
    `component_groups=${JSON.stringify(ordered.map((p) => p.group))}`,
    `component_materials=${JSON.stringify(ordered.map((p) => p.material))}`,
    `component_manufactured=${JSON.stringify(
      ordered.map((p) => !p.process.startsWith('BUY') && p.process !== 'REFERENCE'),
    )
      .replace(/true/g, 'True')
      .replace(/false/g, 'False')}`,
    `component_colors=${JSON.stringify(ordered.map((p) => [((p.color >> 16) & 255) / 255, ((p.color >> 8) & 255) / 255, (p.color & 255) / 255]))}`,
    `component_metadata=json.loads(${JSON.stringify(JSON.stringify(ordered.map(metadata)))})`,
    'for i,s in enumerate(components):',
    '    if s.isNull() or not s.isValid() or not s.isClosed(): raise ValueError("Invalid CO2 recovery component: "+component_labels[i])',
    '    component_metadata[i]["ShapeDigest"]=hashlib.sha256(s.exportBrepToString().encode()).hexdigest()',
    '    if component_manufactured[i]:',
    '        number="CR-"+hashlib.sha1(component_labels[i].split(" · ")[0].encode()).hexdigest()[:8].upper()',
    '        component_metadata[i]["PartNumber"]=number',
    '        b=s.optimalBoundingBox(False,False)',
    '        component_labels[i]+=" · MAKE %s · %s · envelope %.2fx%.2fx%.2f mm" % (number,component_materials[i],b.XLength,b.YLength,b.ZLength)',
    'shape=Part.makeCompound(components)',
  ].join('\n');
}
