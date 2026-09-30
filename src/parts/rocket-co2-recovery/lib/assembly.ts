import { Group, Box3, Vector3, Matrix4 } from 'three';
import * as rigid from '../../rocket-release/lib/assembly';
import cartridge from '../../co2-cartridge/part';
import cell from '../../li-ion-cell/part';
import lch7 from '../../lch7-controller/part';
import zx908 from '../../gps-tracker/part';
import jhe20b from '../../recovery-buzzer/part';
import pwm from '../../pwm-switch/part';
const moduleParts: Record<string, typeof lch7> = {
  'lch7-v3-2': lch7,
  zx908,
  jhe20b,
  'pwm-switch-17x13': pwm,
};
const libraryPart = (l: NonNullable<Piece['library']>) => {
  const part = l.kind === 'cell' ? cell : l.kind === 'cartridge' ? cartridge : moduleParts[l.model];
  if (!part) throw new Error('Unknown library module: ' + l.model);
  return part;
};
const libraryState = (l: NonNullable<Piece['library']>) =>
  l.kind === 'cartridge' ? 'sealed' : 'assembled';
import type { Piece } from './model';
import { disposeModel } from '../../../core/mechanical';
import { manufacturingMetadata } from '../../rocket-release/lib/manufacturing';
import { threadMetadata } from '../../../core/thread-callouts';
import { threadCallouts as cartridgeThreads } from '../../co2-cartridge/lib/model';
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
export function geometry(pieces: Piece[]) {
  return new Group().add(
    ...pieces.map((p) => {
      if (p.shape) return rigid.geometry([{ shape: p.shape, label: p.label, color: p.color }]);
      const l = p.library!;
      const g = libraryPart(l).buildGeometry({ model: l.model }, libraryState(l));
      g.name = p.label;
      g.rotation.set(l.inverted ? Math.PI : 0, 0, 0);
      if (l.azimuth) g.rotateOnWorldAxis(new Vector3(0, 0, 1), (l.azimuth * Math.PI) / 180);
      g.position.set(...l.offset);
      g.traverse((o) => {
        if (o !== g) o.name = p.label + ' · ' + o.name;
      });
      return g;
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
  const shapes = pieces.filter((p) => p.shape),
    libraries = pieces.filter((p) => p.library);
  const ordered = [...shapes, ...libraries];
  if (ordered.some((p) => !p.group?.length))
    throw new Error('Every CO2 recovery component must belong to a subassembly.');
  return [
    rigid.python(
      shapes.map((p) => ({
        label: p.label,
        color: p.color,
        shape: p.shape!,
        metadata: p.metadata,
      })),
    ),
    ...libraries.flatMap((p) => {
      const l = p.library!,
        code = libraryPart(l).python({ model: l.model }, libraryState(l));
      return [
        '_co2_scope={"App":App,"Part":Part,"math":math}',
        `exec(${JSON.stringify(code)},_co2_scope)`,
        '_co2_piece=_co2_scope["shape"]',
        ...(l.inverted ? ['_co2_piece.rotate(App.Vector(0,0,0),App.Vector(1,0,0),180)'] : []),
        ...(l.azimuth
          ? [`_co2_piece.rotate(App.Vector(0,0,0),App.Vector(0,0,1),${l.azimuth})`]
          : []),
        `_co2_piece.translate(App.Vector(${l.offset.join(',')}))`,
        'components.append(_co2_piece)',
      ];
    }),
    `component_labels=${JSON.stringify(ordered.map((p) => p.label))}`,
    `component_groups=${JSON.stringify(ordered.map((p) => p.group))}`,
    `component_materials=${JSON.stringify(ordered.map((p) => p.material))}`,
    `component_manufactured=${JSON.stringify(
      ordered.map((p) => !p.process.startsWith('BUY') && p.process !== 'REFERENCE'),
    )
      .replace(/true/g, 'True')
      .replace(/false/g, 'False')}`,
    `component_colors=${JSON.stringify(ordered.map((p) => [((p.color >> 16) & 255) / 255, ((p.color >> 8) & 255) / 255, (p.color & 255) / 255]))}`,
    `component_metadata=json.loads(${JSON.stringify(JSON.stringify(ordered.map((p) => ({ ...(p.shape ? manufacturingMetadata({ shape: p.shape, label: p.label, color: p.color }) : p.library ? libraryThreadMetadata(p.library) : {}), ManufacturingProcess: p.process, Material: p.material, DrawingStatus: p.process === 'REFERENCE' ? 'ROUTING ENVELOPE' : 'Prototype geometry; fits and load capacity require verification', ...p.metadata }))))})`,
    'for i,s in enumerate(components):',
    '    if s.isNull() or not s.isValid() or not s.isClosed(): raise ValueError("Invalid CO2 recovery component: "+component_labels[i])',
    '    if component_manufactured[i]:',
    '        number="CR-"+hashlib.sha1(component_labels[i].split(" · ")[0].encode()).hexdigest()[:8].upper()',
    '        component_metadata[i]["PartNumber"]=number',
    '        b=s.optimalBoundingBox(False,False)',
    '        component_labels[i]+=" · MAKE %s · %s · envelope %.2fx%.2fx%.2f mm" % (number,component_materials[i],b.XLength,b.YLength,b.ZLength)',
    'shape=Part.makeCompound(components)',
  ].join('\n');
}
