import provenance from './source-provenance.json';

/** Fixed current-project module frame; component details remain installation references. */
export const gpsTrackerInterface = {
  model: 'zx908',
  libraryEntryId: 'gps-tracker:zx908',
  dimensions: [35, 20, 4.5],
  bounds: { min: [-17.5, -10, 0], max: [17.5, 10, 4.5] },
  mountingHoles: [],
  sourceComponentId: provenance.sourceComponentId,
  sourceFrame: provenance.sourceFrame,
  sourceFrameScope: provenance.sourceFrameScope,
  latestAssemblyFrame: provenance.latestAssemblyFrame,
  sourceGeometryScope: provenance.geometryScope,
  serviceGeometryVerified: false,
  supportScope:
    'The current platform locates the board edges and uses four separate compliant retainers. Exact safe contact lands, material and compression remain unverified.',
} as const;
