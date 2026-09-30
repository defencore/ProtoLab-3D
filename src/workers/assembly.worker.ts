import { geometry as bandGeometry } from '../parts/automatic-band-saw/lib/assembly';
import { machinePieces as bandPieces } from '../parts/automatic-band-saw/lib/model';
import { disposeModel } from '../core/mechanical';
import bandSaw from '../parts/automatic-band-saw/part';
import saw from '../parts/automatic-tube-saw/part';
import { Box3, Vector3 } from 'three';
import release from '../parts/rocket-release/part';
import recovery from '../parts/rocket-parachute-recovery/part';
import co2Recovery from '../parts/rocket-co2-recovery/part';
import { generateScript } from '../core/freecad';
import { packModel } from '../core/mesh-transfer';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import type { Parameters } from '../core/types';
self.onmessage = (
  event: MessageEvent<{
    partId:
      | 'rocket-release'
      | 'rocket-parachute-recovery'
      | 'rocket-co2-recovery'
      | 'automatic-tube-saw'
      | 'automatic-band-saw';
    parameters: Parameters;
    state: string;
    presetId?: string;
  }>,
) => {
  try {
    const { partId, parameters, state, presetId } = event.data;
    const part =
      partId === 'rocket-release'
        ? release
        : partId === 'rocket-parachute-recovery'
          ? recovery
          : partId === 'rocket-co2-recovery'
            ? co2Recovery
            : partId === 'automatic-tube-saw'
              ? saw
              : partId === 'automatic-band-saw'
                ? bandSaw
                : undefined;
    if (!part) throw new Error('Unknown assembly package.');
    const root = part.buildGeometry(parameters, state);
    root.updateMatrixWorld(true);
    const dimensions =
      partId === 'automatic-tube-saw' || partId === 'automatic-band-saw'
        ? (new Box3().setFromObject(root, true).getSize(new Vector3()).toArray() as [
            number,
            number,
            number,
          ])
        : part.dimensions(parameters, state);
    // Reuse the measured bounds rather than rebuilding the assembly for export.
    const script = generateScript(
      { ...part, dimensions: () => dimensions },
      parameters,
      state,
      presetId,
    );
    const exportRoot =
      partId === 'automatic-band-saw' ? bandGeometry(bandPieces(parameters, state), true) : root;
    exportRoot.updateMatrixWorld(true);
    const stl = new STLExporter().parse(exportRoot, { binary: true }).buffer;
    if (exportRoot !== root) disposeModel(exportRoot);
    const { model, buffers } = packModel(root);
    self.postMessage({ model, dimensions, script, stl }, { transfer: [...buffers, stl] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
