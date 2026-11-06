import type { FabricationFile, Parameters } from '../../../core/types';
import { pythonShape } from '../../../core/assembly/boundary/shapes';
import {
  laserPlates,
  laserPlateShape,
  type LaserLoop,
  type LaserPlate,
  type LaserPoint,
} from './laser-plates';

export type LaserStage = 'cut' | 'finished';
export type LaserBounds = [number, number, number, number];
const gap = 10;
const prefix = 'SFK0825-disc';
const xml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const scalar = (value: number) => (Object.is(value, -0) ? '0' : String(value));

export function plateLoops(plate: LaserPlate, stage: LaserStage): LaserLoop[] {
  return [
    plate.outer,
    ...plate.inner.map((inner) => {
      if (inner.loop.kind !== 'circle') return inner.loop;
      const diameter =
        stage === 'cut' ? (inner.cutDiameter ?? inner.finishedDiameter) : inner.finishedDiameter;
      return diameter === undefined ? inner.loop : { ...inner.loop, radius: diameter / 2 };
    }),
  ];
}
export function loopBounds(loop: LaserLoop): LaserBounds {
  if (loop.kind === 'circle')
    return [
      loop.center[0] - loop.radius,
      loop.center[1] - loop.radius,
      loop.center[0] + loop.radius,
      loop.center[1] + loop.radius,
    ];
  return [
    Math.min(...loop.points.map((point) => point[0])),
    Math.min(...loop.points.map((point) => point[1])),
    Math.max(...loop.points.map((point) => point[0])),
    Math.max(...loop.points.map((point) => point[1])),
  ];
}
export function loopArea(loop: LaserLoop): number {
  if (loop.kind === 'circle') return Math.PI * loop.radius ** 2;
  return (
    Math.abs(
      loop.points.reduce((sum, point, index) => {
        const next = loop.points[(index + 1) % loop.points.length];
        return sum + point[0] * next[1] - point[1] * next[0];
      }, 0),
    ) / 2
  );
}
export function plateArea(plate: LaserPlate, stage: LaserStage): number {
  const [outer, ...inner] = plateLoops(plate, stage);
  return loopArea(outer) - inner.reduce((sum, loop) => sum + loopArea(loop), 0);
}
export function nestLayout() {
  let cursor = 0;
  return laserPlates.map((plate) => {
    const bounds = loopBounds(plate.outer);
    const offset: LaserPoint = [cursor - bounds[0], -bounds[1]];
    cursor += bounds[2] - bounds[0] + gap;
    return { plate, offset, bounds };
  });
}
function shifted(loop: LaserLoop, offset: LaserPoint): LaserLoop {
  const point = (value: LaserPoint): LaserPoint => [value[0] + offset[0], value[1] + offset[1]];
  return loop.kind === 'circle'
    ? { ...loop, center: point(loop.center) }
    : { ...loop, points: loop.points.map(point) };
}
function dxfLoops(items: { plate: LaserPlate; offset: LaserPoint }[], stage: LaserStage): string {
  const values: (number | string)[] = [
    0,
    'SECTION',
    2,
    'HEADER',
    9,
    '$ACADVER',
    1,
    'AC1015',
    9,
    '$INSUNITS',
    70,
    4,
    9,
    '$MEASUREMENT',
    70,
    1,
    0,
    'ENDSEC',
    0,
    'SECTION',
    2,
    'ENTITIES',
  ];
  const add = (...pairs: (number | string)[]) => values.push(...pairs);
  for (const { plate, offset } of items)
    plateLoops(plate, stage).forEach((original, index) => {
      const loop = shifted(original, offset);
      const layer = `${plate.id}_${index === 0 ? 'OUTER' : 'INNER'}`;
      if (loop.kind === 'circle')
        add(
          0,
          'CIRCLE',
          100,
          'AcDbEntity',
          8,
          layer,
          100,
          'AcDbCircle',
          10,
          loop.center[0],
          20,
          loop.center[1],
          30,
          0,
          40,
          loop.radius,
        );
      else
        add(
          0,
          'LWPOLYLINE',
          100,
          'AcDbEntity',
          8,
          layer,
          100,
          'AcDbPolyline',
          90,
          loop.points.length,
          70,
          1,
          ...loop.points.flatMap((point) => [10, point[0], 20, point[1]]),
        );
    });
  add(0, 'ENDSEC', 0, 'EOF');
  return (
    values.map((value) => (typeof value === 'number' ? scalar(value) : value)).join('\n') + '\n'
  );
}
export function plateDxf(plate: LaserPlate, stage: LaserStage = 'cut'): string {
  return dxfLoops([{ plate, offset: [0, 0] }], stage);
}
export function nestDxf(): string {
  return dxfLoops(nestLayout(), 'cut');
}
function svgLoops(items: { plate: LaserPlate; offset: LaserPoint }[], stage: LaserStage): string {
  const loops = items.flatMap((item) =>
    plateLoops(item.plate, stage).map((loop) => shifted(loop, item.offset)),
  );
  const bounds = loops.map(loopBounds);
  const minX = Math.min(...bounds.map((value) => value[0])),
    minY = Math.min(...bounds.map((value) => value[1]));
  const maxX = Math.max(...bounds.map((value) => value[2])),
    maxY = Math.max(...bounds.map((value) => value[3]));
  const margin = 2,
    width = maxX - minX + 2 * margin,
    height = maxY - minY + 2 * margin;
  const point = (value: LaserPoint): LaserPoint => [
    value[0] - minX + margin,
    maxY - value[1] + margin,
  ];
  const paths = loops.map((loop) => {
    if (loop.kind === 'circle') {
      const [x, y] = point(loop.center);
      return `<circle cx="${scalar(x)}" cy="${scalar(y)}" r="${scalar(loop.radius)}"/>`;
    }
    const vertices = loop.points.map((value) => point(value).map(scalar).join(' '));
    return `<path d="M ${vertices.join(' L ')} Z"/>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${scalar(width)}mm" height="${scalar(height)}mm" viewBox="0 0 ${scalar(width)} ${scalar(height)}"><title>${xml(prefix)} · 4 mm laser blank · millimetres, scale 1:1</title><g id="CUT" fill="none" stroke="#000000" stroke-width="0.15">${paths.join('')}</g></svg>\n`;
}
export function plateSvg(plate: LaserPlate, stage: LaserStage = 'cut'): string {
  return svgLoops([{ plate, offset: [0, 0] }], stage);
}
export function nestSvg(): string {
  return svgLoops(nestLayout(), 'cut');
}
const transformHelper = `def _pl_transform(shape, translation, rotation):
    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)], rotation):
        if angle: shape.rotate(App.Vector(),axis,angle)
    shape.translate(App.Vector(*translation))
    return shape`;
export function plateNativeSource(plate: LaserPlate, stage: LaserStage, flat = true): string {
  const definition = flat
    ? {
        ...plate,
        placement: {
          translation: [0, 0, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
        },
      }
    : plate;
  return `${transformHelper}\nshape = (${pythonShape(laserPlateShape(definition, stage))}).removeSplitter()\n`;
}
export function manufacturingManifest() {
  return {
    schemaVersion: 1,
    partId: 'sfk-disc-actuator',
    units: 'mm',
    scale: '1:1',
    material: 'Steel sheet; grade per drawing',
    thicknessMm: 4,
    geometryPolicy:
      'All five plates are uniform 4 mm through-cut profiles. No pockets, counterbores, countersinks or plate threads. Bearing bores alone are reamed after laser cutting.',
    kerfCompensation: 'None in these files. Apply process compensation in CAM.',
    plateOccurrences: laserPlates.length,
    totalReamedBearingHoles: laserPlates.reduce(
      (sum, plate) => sum + plate.inner.filter((inner) => inner.operation === 'ream').length,
      0,
    ),
    plates: nestLayout().map(({ plate, offset }) => ({
      ...plate,
      quantity: 1,
      cutLoops: plateLoops(plate, 'cut'),
      finishedLoops: plateLoops(plate, 'finished'),
      cutAreaMm2: plateArea(plate, 'cut'),
      finishedAreaMm2: plateArea(plate, 'finished'),
      nestOffsetMm: offset,
      cutDxf: `${prefix}-${plate.id}-4mm-cut.dxf`,
      cutSvg: `${prefix}-${plate.id}-4mm-cut.svg`,
      nativeCutSource: plateNativeSource(plate, 'cut'),
      nativeFinishedSource: plateNativeSource(plate, 'finished'),
      nativeWorldFinishedSource: plateNativeSource(plate, 'finished', false),
    })),
    nestDxf: `${prefix}-five-plate-4mm-cut-layout.dxf`,
    nestSvg: `${prefix}-five-plate-4mm-cut-layout.svg`,
    nativeBlankMacro: `${prefix}-five-plate-native-blanks.FCMacro`,
  };
}
export function nativeBlankMacro(): string {
  const lines = [
    '# Five actual 4 mm steel laser blanks. Dimensions in mm; no kerf compensation.',
    'import FreeCAD as App',
    'import Part',
    'import math',
    transformHelper,
    'doc = App.ActiveDocument or App.newDocument("SFKDiscLaserBlanks")',
    'root = doc.addObject("App::Part", "SFKDiscLaserBlanks")',
    'root.Label = "SFK0825 · five 4 mm laser blanks · cut bores Ø12.8 before reaming"',
  ];
  for (const { plate, offset } of nestLayout())
    lines.push(
      plateNativeSource(plate, 'cut'),
      `shape.translate(App.Vector(${offset[0]},${offset[1]},0))`,
      'assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1',
      'item = doc.addObject("Part::Feature", "LaserBlank")',
      'item.Shape = shape',
      `item.Label = ${JSON.stringify(plate.label)}`,
      'item.addProperty("App::PropertyString", "PlateId", "Fabrication")',
      `item.PlateId = ${JSON.stringify(plate.id)}`,
      'item.addProperty("App::PropertyLength", "StockThickness", "Fabrication")',
      'item.StockThickness = 4',
      'item.addProperty("App::PropertyString", "Process", "Fabrication")',
      `item.Process = ${JSON.stringify(plate.inner.some((inner) => inner.operation === 'ream') ? 'Laser through-cut; deburr; ream listed bearing bore from Ø12.8 to Ø13.02' : 'Laser through-cut; deburr')}`,
      'root.addObject(item)',
    );
  lines.push(
    'doc.recompute()',
    'if App.GuiUp:',
    '    import FreeCADGui as Gui',
    '    Gui.activeDocument().activeView().viewTop()',
    '    Gui.activeDocument().activeView().fitAll()',
  );
  return lines.join('\n') + '\n';
}
export function laserFabricationFiles(_parameters?: Parameters): FabricationFile[] {
  const files: FabricationFile[] = laserPlates.flatMap((plate) => [
    {
      id: `${plate.id}-cut-dxf`,
      label: `${plate.label} · DXF`,
      description: '4 mm steel laser blank, 1:1 mm; bearing pilots Ø12.8.',
      name: `${prefix}-${plate.id}-4mm-cut.dxf`,
      type: 'application/dxf',
      content: plateDxf(plate),
    },
    {
      id: `${plate.id}-cut-svg`,
      label: `${plate.label} · SVG`,
      description: '1:1 millimetre cut contours, without kerf compensation.',
      name: `${prefix}-${plate.id}-4mm-cut.svg`,
      type: 'image/svg+xml',
      content: plateSvg(plate),
    },
  ]);
  return [
    ...files,
    {
      id: 'five-plate-cut-dxf',
      label: 'Five-plate cutting layout · DXF',
      description: 'Three Ø68 discs and two cheeks; all 4 mm; 10 mm separation.',
      name: `${prefix}-five-plate-4mm-cut-layout.dxf`,
      type: 'application/dxf',
      content: nestDxf(),
    },
    {
      id: 'five-plate-cut-svg',
      label: 'Five-plate cutting layout · SVG',
      description: '1:1 mm layout of all five laser blanks.',
      name: `${prefix}-five-plate-4mm-cut-layout.svg`,
      type: 'image/svg+xml',
      content: nestSvg(),
    },
    {
      id: 'laser-manufacturing-manifest',
      label: 'Cut and finished bore schedule',
      description: 'Five occurrences, exact profiles and four Ø12.8 → Ø13.02 reaming operations.',
      name: `${prefix}-laser-manufacturing.json`,
      type: 'application/json',
      content: JSON.stringify(manufacturingManifest(), null, 2) + '\n',
    },
    {
      id: 'native-laser-blanks',
      label: 'Five native laser blanks · FreeCAD',
      description: 'Actual 4 mm blank solids from the same cutting profiles.',
      name: `${prefix}-five-plate-native-blanks.FCMacro`,
      type: 'text/plain;charset=utf-8',
      content: nativeBlankMacro(),
    },
  ];
}
