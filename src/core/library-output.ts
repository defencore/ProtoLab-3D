import { Box3, Vector3 } from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import type { Parameters, PartDefinition } from './types';
import type { DesignProject } from './product-types';
import { disposeModel } from './mechanical';
import { generateScript } from './freecad';
import { withGeometryMode, type GeometryMode } from './geometry-mode';
import { packModel } from './mesh-transfer';
import { validateParameters } from './validation';

export interface LibraryOutputRequest {
  kind: 'preview' | 'script' | 'stl';
  partId: string;
  parameters: Parameters;
  state: string;
  presetId?: string;
  geometryMode: GeometryMode;
}

export interface ProjectOutputRequest {
  kind: 'project-script';
  project: DesignProject;
  geometryMode: GeometryMode;
}
export interface ProjectOutput {
  kind: 'project-script';
  script: string;
}
export type WorkerOutputRequest = LibraryOutputRequest | ProjectOutputRequest;

/** Preview jobs never generate CAD source or an unused STL. Each export is explicit. */
export function buildLibraryOutput(part: PartDefinition, request: LibraryOutputRequest) {
  if (part.id !== request.partId) throw new Error('The requested library product does not match.');
  const { kind, parameters, state, presetId, geometryMode } = request;
  const errors = validateParameters(part, parameters, state);
  if (errors.length) throw new Error(errors.join(' '));
  return withGeometryMode(kind === 'stl' ? 'simple' : geometryMode, () => {
    if (kind === 'script')
      return {
        kind,
        script: generateScript(part, parameters, state, presetId, undefined, geometryMode),
        buffers: [] as ArrayBuffer[],
      };
    if (kind !== 'preview' && kind !== 'stl') throw new Error('Unknown library output.');
    const root =
      kind === 'stl'
        ? (part.buildExportGeometry?.(parameters, state) ?? part.buildGeometry(parameters, state))
        : part.buildGeometry(parameters, state);
    try {
      root.updateMatrixWorld(true);
      if (kind === 'stl') {
        const stl = new STLExporter().parse(root, { binary: true }).buffer;
        return { kind, stl, buffers: [stl] };
      }
      const dimensions = new Box3().setFromObject(root, true).getSize(new Vector3()).toArray() as [
        number,
        number,
        number,
      ];
      if (dimensions.some((size) => !Number.isFinite(size) || size <= 0))
        throw new Error('This configuration produced an empty model.');
      return { kind, dimensions, ...packModel(root) };
    } finally {
      disposeModel(root);
    }
  });
}

export type LibraryOutput = ReturnType<typeof buildLibraryOutput>;

type WithoutTransferBuffers<T> = T extends unknown ? Omit<T, 'buffers'> : never;

/** Transfer lists belong to postMessage options, not to the receiving message. */
export type LibraryWorkerOutput = WithoutTransferBuffers<LibraryOutput>;
