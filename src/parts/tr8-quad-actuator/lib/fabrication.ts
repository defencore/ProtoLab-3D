import type { FabricationFile, Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { cylinder, subtract, pythonShape } from '../../../core/assembly/boundary/shapes';
import { bearingCheeks, bearingCheekDxf, bearingCheekSvg } from './bearing-cheeks';
import { sharedPlates, sharedPlateNativeSource } from './shared-plates';
import { machiningFiles } from './machining';
import { mechanismLayout } from './layout';
import { forkBlankShape } from './nut-linkage';
import { forkFabricationFiles } from './fork-fabrication';
import { channels } from './placement';
import profiles from './laser-profiles.json';

export function fabricationFiles(_p: Parameters, pieces: ConfiguredPiece[]): FabricationFile[] {
  const result: FabricationFile[] = [...forkFabricationFiles()];
  for (const plate of profiles.plates) {
    for (const extension of ['dxf', 'svg'] as const)
      result.push({ id: plate.id + '-' + extension, label: plate.id + ' · 3 mm laser blank',
        description: 'Merged native cut contours in millimetres, with undersize bearing pilots.',
        name: `TR8-quad-${plate.id}-3mm.${extension}`, type: extension === 'svg' ? 'image/svg+xml' : 'application/dxf', content: plate[extension] });
  }
  const cheeks = bearingCheeks();
  for (const cheek of cheeks)
    for (const extension of ['dxf', 'svg'] as const)
      result.push({ id: cheek.id + '-' + extension, label: cheek.label,
        description: 'Exact line/arc laser contour with Ø12.8 bearing pilot; finish to the specified fit.',
        name: `TR8-quad-${cheek.id}-4mm.${extension}`, type: extension === 'svg' ? 'image/svg+xml' : 'application/dxf',
        content: extension === 'dxf' ? bearingCheekDxf(cheek) : bearingCheekSvg(cheek) });
  const lines = [
    'import FreeCAD as App, Part',
    "doc=App.newDocument('TR8QuadLaserBlanks')",
    'def _pl_transform(shape,translation,rotation):',
    '    for axis,angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],rotation):',
    '        if angle: shape.rotate(App.Vector(),axis,angle)',
    '    shape.translate(App.Vector(*translation))',
    '    return shape',
  ];
  for (const plate of sharedPlates())
    lines.push(sharedPlateNativeSource(plate, 'cut', false),
      `item=doc.addObject('Part::Feature',${JSON.stringify(plate.id.replaceAll('-', '_'))})`,
      `item.Label=${JSON.stringify(plate.label + ' · bearing pilots')}`, 'item.Shape=shape');
  for (const cheek of cheeks) {
    if (cheek.localShape.kind !== 'subtract') throw new Error('Expected analytic cheek bore.');
    const shape = { kind: 'transform' as const, ...cheek.placement, child: subtract(cheek.localShape.children[0], cylinder(6.4, 4.2, [mechanismLayout.outputX, cheek.sheetLowY - .1, 0], 'y')) };
    lines.push(`item=doc.addObject('Part::Feature',${JSON.stringify(cheek.id.replaceAll('-', '_'))})`,
      `item.Label=${JSON.stringify(cheek.label + ' · bearing pilot')}`, `item.Shape=(${pythonShape(shape)}).removeSplitter()`);
  }
  const flatFork = forkBlankShape();
  for (const channel of channels({ angleA: 0, angleB: 0, angleC: 0, angleD: 0 })) for (const positive of [false, true]) {
    const inner = mechanismLayout.coverHalfWidth + .05;
    const installed = { kind: 'transform' as const, translation: channel.origin, rotation: [channel.clock, 0, 0] as [number, number, number],
      child: { kind: 'transform' as const, translation: [mechanismLayout.outputX, positive ? inner + 3 : -inner, 0] as [number, number, number], rotation: [90, 0, 0] as [number, number, number], child: flatFork } };
    lines.push(`item=doc.addObject('Part::Feature',${JSON.stringify(channel.id + (positive ? '_rear' : '_front') + '_fork_blank')})`,
      `item.Label=${JSON.stringify(channel.id.toUpperCase() + ' · 3 mm pinned fork blank · shaft pilot')}`, `item.Shape=(${pythonShape(installed)}).removeSplitter()`);
  }
  lines.push('doc.recompute()', 'if App.GuiUp: Gui.activeDocument().activeView().viewAxonometric(); Gui.activeDocument().activeView().fitAll()');
  result.push({ id: 'laser-native-blanks', label: 'Native laser blanks', description: 'Three discs, eight bearing cheeks and eight flat pinned forks, with pilots before finishing.', name: 'TR8-quad-laser-blanks.FCMacro', type: 'text/x-python', content: lines.join('\n') + '\n' });
  const quote = (v: unknown) => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  const rows = [['ID', 'Component', 'Quantity', 'Library', 'Supply', 'Designation', 'Material'],
    ...pieces.map(({ component: c }) => [c.id, c.name, c.quantity, c.libraryId, c.supply, c.procurement?.designation, c.manufacturing?.material])];
  result.push({ id: 'bill-of-materials', label: 'Four-drive component list', description: 'Every bought and manufactured physical occurrence.', name: 'TR8-quad-component-list.csv', type: 'text/csv;charset=utf-8', content: rows.map((row) => row.map(quote).join(',')).join('\n') + '\n' });
  result.push({ id: 'laser-manifest', label: 'Laser cutting manifest', description: 'Three round discs, eight bearing cheeks and eight identical pinned forks.', name: 'TR8-quad-laser-manifest.json', type: 'application/json', content: JSON.stringify({ units: 'mm', scale: '1:1', mainPlateProfiles: profiles.signature, parts: [...[...sharedPlates(), ...cheeks].map((plate) => ({ id: plate.id, thickness: plate.thickness, quantity: 1 })), { id: 'pinned-fork', thickness: 3, quantity: 8 }], finishing: 'Finish sixteen Ø12.8 bearing pilots to assigned fits (model Ø13.02), and eight Ø5.8 fork pilots to Ø6.05. Match-drill/ream transverse Ø2 pin holes after locating forks on the shaft. Keep 3 mm and 4 mm stock separate.' }, null, 2) + '\n' });
  result.push({ id: 'motion-table', label: 'Per-channel motion table', description: 'Independent angle, nut travel and screw rotation for each identical drive.', name: 'TR8-quad-motion.csv', type: 'text/csv;charset=utf-8', content: 'OutputAngle_deg,NutTravel_mm,ScrewTurns,ScrewRotation_deg\n' + [-20, -10, 0, 10, 20].map((angle) => { const travel = mechanismLayout.radius * Math.tan(angle * Math.PI / 180); return [angle, travel, -travel / 8, -360 * travel / 8].join(','); }).join('\n') + '\n' });
  return [...result, ...machiningFiles()];
}
