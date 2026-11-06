import type { Parameters, Preset } from '../core/types';
import { ballScrewReferences } from './ball-screw-reference';
import { ek6Ef6Ends } from '../parts/ball-screw/lib/parts/ball-screw-ends';

export const miniatureShaftLengths = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550];

function presets(defaults: Parameters, standalone: boolean): Preset[] {
  return ballScrewReferences.flatMap((reference) => {
    const miniature = reference.parameters.family === 'SFK';
    const lengths =
      miniature && !standalone
        ? miniatureShaftLengths
        : [
            Math.max(
              200,
              Number(reference.parameters.nutLength) +
                Math.max(80, 2 * Number(reference.parameters.lead) + 20),
            ),
          ];
    return lengths.flatMap((length): Preset[] => {
      const d = Number(reference.parameters.shaftDiameter);
      const designation = reference.designation;
      const alias = ['SFK082.5', 'SFK0825'].includes(designation)
        ? 'SFK08025 / SFK0825 / SFK082.5'
        : designation;
      const supplierPrefix = reference.id?.startsWith('kaiyade-') ? 'KAIYADE ' : '';
      const catalog = reference.catalog
        ? {
            ...reference.catalog,
            verifiedParameters: [
              ...reference.catalog.verifiedParameters,
              ...(miniature && !standalone ? ['length'] : []),
            ],
            alternateSourceUrls: [
              ...(reference.catalog.alternateSourceUrls ?? []),
              ...(miniature ? ['https://www.aliexpress.com/item/1005006967499422.html'] : []),
            ],
          }
        : undefined;
      const preset: Preset = {
        id: `${reference.id ?? designation.toLowerCase().replaceAll('.', '-')}${standalone ? '' : `-${length}`}`,
        name: `${supplierPrefix}${alias}${standalone ? '' : ` · ${length} mm · Unmachined`}`,
        description: `${reference.parameters.shaftDiameter} mm shaft · ${reference.parameters.lead} mm lead · ${reference.parameters.nutDiameter} × ${reference.parameters.nutLength} mm nut. ${miniature && reference.catalog && !standalone ? 'Nut dimensions use the manufacturer reference; 100–550 mm shaft-length options come from the supplied listing. Supplier interchangeability is unverified. ' : ''}${reference.note ?? ''} ${standalone ? 'Unsourced internal geometry remains editable for prototyping.' : 'End journals, accuracy class and unsourced internals remain editable prototype settings.'}`,
        parameters: {
          ...defaults,
          ...reference.parameters,
          length,
          endMachining: 'none',
          fixedJournalDiameter: d * 0.75,
          fixedJournalLength: Math.min(100, d * 1.2),
          driveJournalDiameter: d * 0.6,
          driveJournalLength: d,
          supportJournalDiameter: d * 0.65,
          supportJournalLength: d * 0.9,
        },
        catalog,
      };
      if (standalone || !supplierPrefix || d !== 8) return [preset];
      const exactDrawing = designation === 'SFK0802';
      return [
        preset,
        {
          ...preset,
          id: `${preset.id}-end-machine`,
          name: preset.name.replace('Unmachined', 'End Machine · EK6/EF6'),
          description: `${preset.description} End envelope follows the supplied EK6/EF6 drawing marked 0802: Ø6 × 30 mm fixed journal, Ø4 × 8 mm drive, Ø6 × 9 mm support, and Ø5.7 × 0.8 mm retaining groove. ${exactDrawing ? '' : 'The supplied end drawing is for 0802, so its reuse with this lead is a layout reference and is not a verified supplier execution. '}M6×0.75 over 10 mm is represented by its nominal major-diameter cylinder. End thread form, fits and chamfers are not modeled.`,
          parameters: { ...preset.parameters, endMachining: 'ek6-ef6', ...ek6Ef6Ends },
          catalog: {
            ...catalog!,
            verifiedParameters: [
              ...catalog!.verifiedParameters,
              ...(exactDrawing
                ? [
                    'endMachining',
                    'fixedJournalDiameter',
                    'fixedJournalLength',
                    'driveJournalDiameter',
                    'driveJournalLength',
                    'supportJournalDiameter',
                    'supportJournalLength',
                    'supportGrooveDiameter',
                    'supportGrooveWidth',
                    'supportGrooveOffset',
                  ]
                : []),
            ],
            specifications: [
              ...(catalog!.specifications ?? []),
              {
                label: 'End machining reference',
                value: exactDrawing
                  ? 'EK6/EF6 · drawing 0802'
                  : 'EK6/EF6 · 0802 envelope reused; actual execution unverified',
              },
              {
                label: 'Fixed-end locking thread',
                value: 'M6 × 0.75 · 10 mm length · nominal envelope',
              },
            ],
          },
        },
      ];
    });
  });
}

export const ballScrewPresets = (defaults: Parameters) => presets(defaults, false);
export const ballNutPresets = (defaults: Parameters) => presets(defaults, true);
