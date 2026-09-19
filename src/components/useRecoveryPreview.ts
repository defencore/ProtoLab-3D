import { useEffect, useState } from 'react';
import { unpackModel, type PackedModel } from '../core/mesh-transfer';
import type { Parameters } from '../core/types';
import type { Group } from 'three';
interface Result {
  key: string;
  model?: Group;
  dimensions?: [number, number, number];
  script?: string;
  stl?: ArrayBuffer;
  error?: string;
}
/** Each build has an isolated lifetime: cancelled jobs and their caches are released. */
export function useRecoveryPreview(
  partId: 'rocket-release' | 'rocket-parachute-recovery' | undefined,
  parameters: Parameters,
  state: string,
  presetId?: string,
) {
  const enabled = partId !== undefined;
  const key = JSON.stringify([partId, parameters, state, presetId]);
  const [result, setResult] = useState<Result>();
  useEffect(() => {
    if (!enabled) {
      setResult(undefined);
      return;
    }
    let active = true;
    let worker: Worker | undefined;
    // Coalesce slider input; termination cancels obsolete synchronous worker jobs.
    const timer = setTimeout(() => {
      worker = new Worker(new URL('../workers/recovery.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (
        event: MessageEvent<Omit<Result, 'key' | 'model'> & { model?: PackedModel }>,
      ) => {
        if (!active) return;
        try {
          setResult({
            ...event.data,
            key,
            model: event.data.model ? unpackModel(event.data.model) : undefined,
          });
        } catch (error) {
          setResult({ key, error: String(error) });
        }
        worker?.terminate();
      };
      worker.onerror = (event) => {
        if (!active) return;
        setResult({ key, error: event.message || 'Model worker failed.' });
        worker?.terminate();
      };
      worker.postMessage({ partId, parameters, state, presetId });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [key]);
  const current = result?.key === key ? result : undefined;
  return { ...current, pending: enabled && !current, enabled };
}
