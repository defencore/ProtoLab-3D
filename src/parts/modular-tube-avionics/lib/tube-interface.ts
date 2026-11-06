import type { Parameters } from '../../../core/types';

/** Qualified nominal interfaces, rather than a promise of arbitrary tube resizing. */
export const tubeProfiles = [
  {
    id: 'd90-86',
    label: 'D90 / D86 · 85.6 mm insert',
    outerDiameter: 90,
    innerDiameter: 86,
    insertDiametralClearance: 0.4,
  },
] as const;

export const defaultTubeProfile = 'd90-86' as const;
export type TubeProfileId = (typeof tubeProfiles)[number]['id'];

export interface TubeInterface {
  readonly id: TubeProfileId;
  readonly label: string;
  readonly outerDiameter: number;
  readonly innerDiameter: number;
  readonly outerRadius: number;
  readonly innerRadius: number;
  readonly wallThickness: number;
  readonly insertDiametralClearance: number;
  readonly insertDiameter: number;
  readonly insertRadius: number;
}

export function validateTubeProfile(p: Parameters): string[] {
  return tubeProfiles.some((profile) => profile.id === p.tubeProfile)
    ? []
    : ['Select the supported D90 / D86 tube profile.'];
}

/** A pure physical interface resolver; no configuration changes module-global state. */
export function resolveTubeProfile(p: Parameters): TubeInterface {
  const profile = tubeProfiles.find((candidate) => candidate.id === p.tubeProfile);
  if (!profile) throw new Error(validateTubeProfile(p).join(' '));
  const insertDiameter = profile.innerDiameter - profile.insertDiametralClearance;
  return {
    ...profile,
    outerRadius: profile.outerDiameter / 2,
    innerRadius: profile.innerDiameter / 2,
    wallThickness: (profile.outerDiameter - profile.innerDiameter) / 2,
    insertDiameter,
    insertRadius: insertDiameter / 2,
  };
}
