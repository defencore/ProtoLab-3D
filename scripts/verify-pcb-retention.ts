/** Prepare native retention cases from production builders, not display triangles. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Parameters } from '../src/core/types';
import { generateScript } from '../src/core/freecad';
import { componentPython } from '../src/core/assembly/detail-instances';
import field from '../src/parts/field-daq-enclosure/part';
import { configuredPieces, libraries } from '../src/parts/field-daq-enclosure/lib/model';
import { layout } from '../src/parts/field-daq-enclosure/lib/layout';
import { retentionNativeInput } from './field-daq-retention-input';
import mount from '../src/parts/pcb-retention-mount/part';
import manufactured from '../src/parts/manufactured-detail/part';
import { detailComponent } from '../src/core/component-recipes';
import { validateParameters } from '../src/core/validation';
import {
  layout as mountLayout,
  pieces as mountPieces,
} from '../src/parts/pcb-retention-mount/lib/model';
import { pcbBridgePose } from '../src/core/pcb-retention-bridge';

const destination = path.resolve('test-results/pcb-retention');
mkdirSync(destination, { recursive: true });
const sourceFiles = [
  'src/core/pcb-retention.ts',
  'src/core/pcb-retention-bridge.ts',
  'src/parts/field-daq-enclosure/lib/board-retention.ts',
  'src/parts/field-daq-enclosure/lib/model.ts',
  'src/parts/pcb-retention-mount/part.ts',
  'src/parts/pcb-retention-mount/lib/model.ts',
  'src/parts/pcb-retention-mount/configurator.ts',
  'scripts/verify-pcb-retention.ts',
  'scripts/verify-pcb-retention.py',
  'scripts/field-daq-retention-checks.py',
];
const cases: Record<string, unknown>[] = [];
for (const patch of [
  { boardThickness: 1.2, fitClearance: 0.15 },
  { boardThickness: 1.6, fitClearance: 0.25 },
  { boardThickness: 2, fitClearance: 0.5 },
]) {
  const p: Parameters = { ...field.defaults, ...patch, showReferences: true };
  const installed = configuredPieces(p, 'assembled');
  const physical = configuredPieces({ ...p, showReferences: false }, 'assembled');
  cases.push({
    kind: 'field-daq',
    name: 'field-daq-t' + p.boardThickness + '-c' + p.fitClearance,
    parameters: p,
    code: componentPython(libraries, installed),
    ids: installed.map((v) => v.component.id),
    physicalCode: componentPython(libraries, physical),
    physicalIds: physical.map((v) => v.component.id),
    layout: layout(p),
    retentionAudit: retentionNativeInput(p),
    macros: ['base', 'retainer', 'retention-coupon'].map((state) => ({
      state,
      code: generateScript(field, p, state),
    })),
  });
}
if (!process.argv.includes('--field-only')) {
  const mixed = mount.presets.find((v) => v.id === 'daq-mixed-60-120')!.parameters;
  const configurations = [
    ...mount.presets.map((preset) => ({
      id: preset.id,
      parameters: preset.parameters,
      presetId: preset.id as string | undefined,
    })),
    ...[
      { id: 'tight-fit', patch: { clearance: 0.15 } },
      { id: 'loose-fit', patch: { clearance: 0.5 } },
      { id: 'high-seat', patch: { seatHeight: 35, antiFlexSupports: 'both' } },
      {
        id: 'wide-gap-mixed-widths',
        patch: { ...mixed, boardGap: 20, board1Width: 40, board2Width: 140 },
      },
      {
        id: 'four-open-no-holes',
        patch: {
          ...mount.presets.find((v) => v.id === 'four-under-supported')!.parameters,
          lockEnabled: false,
          mountingHoles: false,
          antiFlexSupports: 'both',
        },
      },
    ].map((v) => ({
      id: v.id,
      parameters: { ...mount.defaults, ...v.patch } as Parameters,
      presetId: undefined,
    })),
  ];
  for (const configuration of configurations) {
    const p: Parameters = { ...configuration.parameters, showReferences: true };
    const errors = validateParameters(mount, p, 'assembled');
    if (errors.length) throw new Error(configuration.id + ': ' + errors.join(' '));
    const d = mountLayout(p),
      installed = mountPieces(p, 'assembled', true);
    const released = d.specs.map((s, i) => ({
      component: detailComponent(
        'released-' + i,
        'Prescribed lifted-leaf bridge',
        pcbBridgePose(s, 0, 0.9),
        { preserveAuthoredFrame: true },
      ),
      label: 'Prescribed lifted-leaf bridge',
      color: 0xffffff,
      requireSingleSolid: true,
    }));
    cases.push({
      kind: 'mount',
      name: configuration.id,
      parameters: p,
      layout: d,
      code: componentPython([manufactured], installed),
      ids: installed.map((v) => v.component.id),
      physicalIds: mount.composition!(p).components.map((v) => v.id),
      releasedCode: released.length ? componentPython([manufactured], released) : null,
      macros: mount
        .states!.filter((s) => !s.availableWhen || s.availableWhen(p))
        .map((s) => ({
          state: s.id,
          code: generateScript(mount, p, s.id, configuration.presetId),
        })),
    });
  }
}
const manifest = {
  sourceHashes: Object.fromEntries(
    sourceFiles.map((file) => [
      file,
      createHash('sha256').update(readFileSync(file)).digest('hex'),
    ]),
  ),
  prioritySnapshot: path.join(destination, 'field-daq-priority/native-input.json'),
  cases,
};
writeFileSync(path.join(destination, 'native-cases.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ cases: cases.length, output: destination }));
