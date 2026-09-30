/** Drawing information is independent of the simplified CAD thread envelope. */
export interface ThreadCallout {
  designation: string;
  internal: boolean;
  length: number;
  nominalDiameter: number;
  pitch: number;
  origin?: number[];
  axis?: number[];
  representation: 'nominal-cylinder' | 'printed-helix';
}

export function metricThreadCallout(
  diameter: number,
  pitch: number,
  length: number,
  internal: boolean,
  handedness: unknown = 'right',
): ThreadCallout {
  return {
    designation: `M${diameter}×${pitch} ${handedness === 'left' ? 'LH' : 'RH'}`,
    internal,
    length,
    nominalDiameter: diameter,
    pitch,
    representation: 'nominal-cylinder',
  };
}

export function threadMetadata(features: ThreadCallout[]): Record<string, string> {
  const groups = new Map<string, number>();
  for (const t of features) {
    const key = `${t.internal ? 'internal' : 'external'} ${t.designation}; nominal span ${t.length} mm`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return {
    ThreadCallouts: [...groups].map(([key, count]) => `${count}× ${key}`).join('; '),
    ThreadLabels: [
      ...new Set(features.map((t) => `${t.internal ? 'internal' : 'external'} ${t.designation}`)),
    ].join('; '),
    ThreadFeaturesJSON: JSON.stringify(features),
    ThreadModel: features.some((t) => t.representation === 'printed-helix')
      ? 'Printed threads retain helical geometry and print fit allowance; machined threads use nominal cylinders.'
      : 'Smooth nominal-diameter bores and shafts without helical faces. Bore diameter is a symbolic thread envelope, NOT a tap-drill or clearance-hole size. Use callouts and depth notes; specify fit and tolerance class on the drawing.',
  };
}

export function threadMetadataPython(features: ThreadCallout[]): string {
  return `component_metadata = [${JSON.stringify(threadMetadata(features))}]`;
}
