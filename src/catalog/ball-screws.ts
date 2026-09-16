import type { Parameters, Preset } from '../core/types';
import { ballScrewReferences } from './ball-screw-reference';

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
    return lengths.map((length) => {
      const d = Number(reference.parameters.shaftDiameter);
      const designation = reference.designation;
      const alias = designation === 'SFK082.5' ? 'SFK0825 / SFK082.5' : designation;
      const catalog = reference.catalog
        ? {
            ...reference.catalog,
            verifiedParameters: [
              ...reference.catalog.verifiedParameters,
              ...(miniature && !standalone ? ['length'] : []),
            ],
            alternateSourceUrls: [
              ...(reference.catalog.alternateSourceUrls ?? []),
              ...(miniature
                ? [
                    '',
                    '',
                  ]
                : []),
            ],
          }
        : undefined;
      return {
        id: `${designation.toLowerCase().replaceAll('.', '-')}${standalone ? '' : `-${length}`}`,
        name: `${alias}${standalone ? '' : ` · ${length} mm`}`,
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
    });
  });
}

export const ballScrewPresets = (defaults: Parameters) => presets(defaults, false);
export const ballNutPresets = (defaults: Parameters) => presets(defaults, true);
