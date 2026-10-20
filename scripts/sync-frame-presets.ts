import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { Preset } from '../src/core/types';
import { defaults } from '../src/parts/multicopter-frame/configurator';
import { frames, models, sourceFrame } from '../src/parts/multicopter-frame-component/lib/frames';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Project pinned local CAD metadata into portable catalogs only during an explicit refresh. */
export function framePresetSnapshots(): Record<string, Preset[]> {
  return {
    'multicopter-frame': frames.map((frame) => ({
      id: frame.id,
      name: frame.name,
      description: frame.description,
      parameters: {
        ...defaults,
        model: frame.id,
        mass: frame.mass,
        motorThrust: frame.motorThrust,
        rotorHeight: frame.rotorHeight,
        propDiameter: frame.propDiameter,
      },
      catalog: {
        designation: frame.name + ' · pinned source CAD',
        manufacturer: frame.name + ' project',
        sourceName: 'Original project CAD',
        sourceUrl: frame.source.url,
        verifiedParameters: ['model'],
        attributes: {
          motorCount: String(frame.motorCount),
          armCount: frame.arms.length,
          construction: frame.id === 'comet-y6' ? 'Printed PC/CF' : 'Carbon sheets',
        },
        geometryEvidence: {
          kind: 'manufacturer-cad',
          summary: `${frame.parts.length} native source components. Fixed contours and thicknesses; no geometric scaling.`,
          limitations: [
            ...frame.hardware,
            ...frame.changes,
            'Local materials and complete-aircraft flight qualification still require verification.',
          ].join(' '),
          sourceUrl: frame.source.url,
          sourceSha256: frame.source.sha256,
        },
      },
    })),
    'multicopter-frame-component': models.map((model) => ({
      id: model.id,
      name: sourceFrame(model.frameId).name + ' · ' + model.label,
      description: 'Fixed upstream CAD component. No stretching or material substitution.',
      parameters: { component: model.id },
      product: { supply: model.route === 'purchase' ? 'purchased' : 'manufactured' },
      catalog: {
        designation: model.label,
        manufacturer: sourceFrame(model.frameId).name + ' project',
        sourceName: 'Pinned upstream CAD',
        sourceUrl: model.sourceFile?.url ?? sourceFrame(model.frameId).source.url,
        verifiedParameters: ['component'],
        geometryEvidence: {
          kind: 'manufacturer-cad',
          summary:
            'Native BRep extracted from pinned original project CAD; preview tessellated at 0.025 mm chord tolerance.',
          limitations:
            'Source geometry does not establish material properties, fastener grade or flight qualification. Original CAD tolerances are retained. ' +
            (model.previewNotes?.join(' ') ?? ''),
          sourceUrl: model.sourceFile?.url ?? sourceFrame(model.frameId).source.url,
          sourceSha256: model.sourceFile?.sha256 ?? sourceFrame(model.frameId).source.sha256,
        },
        attributes: {
          width: model.dimensions[0],
          depth: model.dimensions[1],
          height: model.dimensions[2],
          volume: model.volume,
          route: model.route,
          frame: sourceFrame(model.frameId).name,
        },
      },
    })),
  };
}

export async function syncFramePresets(root = repository, check = false) {
  const updates = await Promise.all(
    Object.entries(framePresetSnapshots()).map(async ([id, presets]) => {
      const file = path.join(root, 'src/parts', id, 'presets.json');
      const saved: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
      return { id, file, presets, changed: !isDeepStrictEqual(saved, presets) };
    }),
  );
  if (!check)
    for (const update of updates)
      if (update.changed)
        await fs.writeFile(update.file, JSON.stringify(update.presets, null, 2) + '\n');
  return updates.map(({ id, presets, changed }) => ({ id, presets: presets.length, changed }));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check'))
    throw new Error('Usage: node --import tsx scripts/sync-frame-presets.ts [--check]');
  const check = args.includes('--check');
  const rows = await syncFramePresets(repository, check);
  for (const row of rows)
    console.log(
      `${row.id}: ${row.presets} presets (${row.changed ? (check ? 'refresh required' : 'updated') : 'current'})`,
    );
  if (check && rows.some((row) => row.changed)) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
