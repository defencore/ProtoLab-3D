export const jhe42bSourceUrl =
  'https://jhemcu.com/e_productshow/?54-JHEMCU-JHE42B-Finder-BB-Ring-110dB-Buzzer-Alarm-with-LED-Light-Support-BF-CF-Flight-54.html=';
export const jhe42bWiringPhotoUrl = 'https://jhemcu.com/pic/other/2023-07-08-13-38-481.jpg';

/** Nominal page-text envelope; photo-estimated exterior features are not fit datums. */
export const jhe42bInterface = {
  model: 'jhe42b',
  manufacturer: 'JHEMCU',
  productCode: '202378133636',
  dimensions: [23, 17, 17],
  bounds: { min: [-11.5, -8.5, 0], max: [11.5, 8.5, 17] },
  massGrams: 7.4,
  battery: {
    included: true,
    chemistry: 'Not specified by the reviewed manufacturer page',
    capacity: 'Not specified by the reviewed manufacturer page',
    dimensions: 'Not dimensioned; included in the overall envelope',
  },
  mountingHoles: [],
  serviceFaces: [
    {
      role: 'Side-facing buzzer sound mouth',
      face: '-X',
      scope: 'Keep this whole face accessible until actual feature positions are measured.',
    },
    {
      role: 'Three-wire connection, plug withdrawal and cancel-switch actuation',
      face: '+X',
      scope: 'Keep this whole end accessible; mating plug and wire bend space are additional.',
    },
    {
      role: 'White alarm LED visibility',
      face: '+Z',
      scope: 'Keep the LED visible; its geometry is reconstructed from photographs.',
    },
    {
      role: 'Integral rechargeable battery side',
      face: '-Z',
      scope: 'Avoid concentrated clamping loads; actual support lands require hardware inspection.',
    },
  ],
  coordinateScope:
    'Chosen orientation follows manufacturer photos: connector and cancel actuator +X, side sound mouth -X, LED +Z. Page text states length 23 mm, but the manufacturer photo labels 25 mm; the 23 mm nominal basis is retained. No dimensioned feature coordinates are supplied.',
  serviceGeometryVerified: false,
} as const;

/** Latest source-project occupied box; not a verified manufacturer execution. */
export const jhe42bProjectReferenceInterface = {
  model: 'jhe42b-project-reference-26x17x15',
  libraryEntryId: 'jhe42b-finder:jhe42b-project-reference-26x17x15',
  dimensions: [26, 17, 15],
  bounds: { min: [-13, -8.5, 0], max: [13, 8.5, 15] },
  sourceComponentId: 234,
  sourceFrame: { translation: [-21, -12, 149.45], rotation: [0, 0, 90] },
  sourceFrameScope:
    'Historical platform_access_current frame; installed placement follows mountingLayout and assembly_current.',
  latestAssemblyFrame: { translation: [-21, -12, 158], rotation: [0, 0, 90] },
  serviceGeometryVerified: false,
  mountingHoles: [],
  serviceFaces: [],
  coordinateScope:
    'The current project specifies only this occupied box and its placement. Connector, sound outlet, LED, button, battery and safe clamping lands are not identified by that geometry.',
} as const;

export function jhe42bModelInterface(parameters: { model?: unknown }) {
  if (parameters.model === jhe42bInterface.model) return jhe42bInterface;
  if (parameters.model === jhe42bProjectReferenceInterface.model)
    return jhe42bProjectReferenceInterface;
  throw new Error('Select the standard JHE42B or the explicit current-project reference.');
}
