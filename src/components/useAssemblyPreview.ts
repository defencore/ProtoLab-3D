import { useEffect, useState } from 'react';
import { unpackModel } from '../core/mesh-transfer';
import type { Parameters } from '../core/types';
import type { Group } from 'three';
import { withGeometryMode, type GeometryMode } from '../core/geometry-mode';
import { requestPreviewOutput } from './requestWorkerOutput';
interface Result {
  key: string;
  model?: Group;
  dimensions?: [number, number, number];
  error?: string;
}
/** Each build has an isolated lifetime: cancelled jobs and their caches are released. */
export function useAssemblyPreview(
  partId: string | undefined,
  parameters: Parameters,
  state: string,
  presetId?: string,
  geometryMode: GeometryMode = 'simple',
  definitionVersion = 0,
) {
  const enabled = partId !== undefined;
  const key = JSON.stringify([
    partId,
    parameters,
    state,
    presetId,
    geometryMode,
    definitionVersion,
  ]);
  const [result, setResult] = useState<Result>();
  useEffect(() => {
    if (!enabled) {
      setResult(undefined);
      return;
    }
    let active = true;
    const controller = new AbortController();
    // Coalesce slider input; termination cancels obsolete synchronous worker jobs.
    const timer = setTimeout(async () => {
      try {
        const output = await requestPreviewOutput(
          { partId: partId!, parameters, state, presetId, geometryMode },
          controller.signal,
        );
        if (!active) return;
        setResult({
          key,
          dimensions: output.dimensions,
          model: withGeometryMode(geometryMode, () => unpackModel(output.model)),
        });
      } catch (cause) {
        if (active)
          setResult({ key, error: cause instanceof Error ? cause.message : String(cause) });
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);
  const current = result?.key === key ? result : undefined;
  return { ...current, pending: enabled && !current, enabled };
}
