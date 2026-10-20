import { useCallback, useEffect, useRef, useState } from 'react';
import type { LibraryWorkerOutput, LibraryOutputRequest } from '../core/library-output';

import { requestLibraryOutput } from './requestWorkerOutput';

type ExportKind = 'script' | 'stl';
type Output = LibraryWorkerOutput;

/** Cache only this configured item's requested exports. Cancel stale jobs on selection changes. */
export function useLibraryOutputs(
  request: Omit<LibraryOutputRequest, 'kind'>,
  definitionVersion = 0,
) {
  const key = JSON.stringify([request, definitionVersion]);
  const activeKey = useRef(key);
  activeKey.current = key;
  const jobs = useRef(new Map<string, { controller: AbortController; promise: Promise<Output> }>());
  const cache = useRef(new Map<string, Output>());
  const [, update] = useState(0);
  const [error, setError] = useState<{ key: string; message: string }>();
  useEffect(() => {
    cache.current.clear();
    return () => {
      jobs.current.forEach(({ controller }) => controller.abort());
      jobs.current.clear();
      cache.current.clear();
    };
  }, [key]);
  const prepare = useCallback(
    (kind: ExportKind) => {
      if (activeKey.current !== key)
        return Promise.reject(new DOMException('Export cancelled.', 'AbortError'));
      const jobKey = `${key}/${kind}`;
      const ready = cache.current.get(jobKey);
      if (ready) return Promise.resolve(ready);
      const existing = jobs.current.get(jobKey);
      if (existing) return existing.promise;
      const controller = new AbortController();
      const promise = requestLibraryOutput({ ...request, kind }, controller.signal)
        .then((output) => {
          if (controller.signal.aborted || activeKey.current !== key)
            throw new DOMException('Export cancelled.', 'AbortError');
          cache.current.set(jobKey, output);
          return output;
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted && activeKey.current === key)
            setError({ key, message: cause instanceof Error ? cause.message : String(cause) });
          throw cause;
        })
        .finally(() => {
          if (jobs.current.get(jobKey)?.controller === controller) jobs.current.delete(jobKey);
          update((value) => value + 1);
        });
      jobs.current.set(jobKey, { controller, promise });
      setError(undefined);
      update((value) => value + 1);
      return promise;
    },
    [key],
  );
  const script = cache.current.get(`${key}/script`)?.script;
  return {
    key,
    prepare,
    script,
    pending: [...jobs.current.keys()].some((jobKey) => jobKey.startsWith(`${key}/`)),
    error: error?.key === key ? error.message : undefined,
  };
}
