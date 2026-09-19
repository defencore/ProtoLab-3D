import release from '../parts/rocket-release/part';
import recovery from '../parts/rocket-parachute-recovery/part';
import { generateScript } from '../core/freecad';
import { packModel } from '../core/mesh-transfer';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import type { Parameters } from '../core/types';
self.onmessage = (
  event: MessageEvent<{
    partId: 'rocket-release' | 'rocket-parachute-recovery';
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
          : undefined;
    if (!part) throw new Error('Unknown recovery package.');
    const dimensions = part.dimensions(parameters, state);
    const script = generateScript(part, parameters, state, presetId);
    const root = part.buildGeometry(parameters, state);
    root.updateMatrixWorld(true);
    const stl = new STLExporter().parse(root, { binary: true }).buffer;
    const { model, buffers } = packModel(root);
    self.postMessage({ model, dimensions, script, stl }, { transfer: [...buffers, stl] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
