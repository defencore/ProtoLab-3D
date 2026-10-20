import { useEffect, useState } from 'react';
import { unpackModel, type PackedModel } from '../core/mesh-transfer';
import type { Parameters } from '../core/types';
import type { Group } from 'three';
import { withGeometryMode, type GeometryMode } from '../core/geometry-mode';
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
    let worker: Worker | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(deadline);
      worker?.terminate();
    };
    // Coalesce slider input; termination cancels obsolete synchronous worker jobs.
    const timer = setTimeout(() => {
      try {
        worker = new Worker(new URL('../workers/assembly.worker.ts', import.meta.url), {
          type: 'module',
        });
        deadline = setTimeout(() => {
          finish();
          if (active)
            setResult({
              key,
              error: 'The preview took too long. Try Simple mode or a smaller assembly.',
            });
        }, 120_000);
        worker.onmessage = (
          event: MessageEvent<Omit<Result, 'key' | 'model'> & { model?: PackedModel }>,
        ) => {
          if (!active) return;
          try {
            setResult({
              ...event.data,
              key,
              model: event.data.model
                ? withGeometryMode(geometryMode, () => unpackModel(event.data.model!))
                : undefined,
            });
          } catch (error) {
            setResult({ key, error: String(error) });
          }
          finish();
        };
        worker.onerror = (event) => {
          if (!active) return;
          setResult({ key, error: event.message || 'Model worker failed.' });
          finish();
        };
        worker.postMessage({ kind: 'preview', partId, parameters, state, presetId, geometryMode });
      } catch (cause) {
        finish();
        if (active)
          setResult({ key, error: cause instanceof Error ? cause.message : String(cause) });
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
      finish();
    };
  }, [key]);
  const current = result?.key === key ? result : undefined;
  return { ...current, pending: enabled && !current, enabled };
}
