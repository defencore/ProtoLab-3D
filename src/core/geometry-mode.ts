/** Detail is a presentation/export policy, never part of the physical configuration. */
export type GeometryMode = 'simple' | 'full';

let activeMode: GeometryMode = 'simple';

export function currentGeometryMode(): GeometryMode {
  return activeMode;
}

/** Geometry generators are synchronous; nested scopes restore their caller's policy. */
export function withGeometryMode<T>(mode: GeometryMode, operation: () => T): T {
  if (mode !== 'simple' && mode !== 'full') throw new Error('Choose Simple or Full geometry.');
  const previous = activeMode;
  activeMode = mode;
  try {
    const result = operation();
    if (result && typeof result === 'object' && 'then' in result)
      throw new Error('Geometry mode operations must be synchronous.');
    return result;
  } finally {
    activeMode = previous;
  }
}
