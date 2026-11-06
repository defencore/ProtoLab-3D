/** User measurements of the installed unit, separate from published supplier CAD. */
export const holderUnitObservation = {
  sourceId: 'li-ion-battery-holder:beilamoo-3s',
  occurrenceId: 'power-extra-3s-holder',
  body: { length: 78, width: 59.6, height: 21 },
  bankOuterWidth: 57.3,
  cellTopBelowRim: 1,
  legs: { length: 4, width: 1.5, thickness: 0.5, centeredOnCellAxes: true },
  heightExcludesLegs: true,
  provenance:
    'User measurements supplied in this project; no delivered-unit tolerance or full internal drawing was supplied.',
  completeProductFitVerified: false,
} as const;

/** Installation allowances are design choices, not purchased-product dimensions. */
export const holderFitAllowances = {
  axialBodyGap: 0.5,
  terminalSlotWidth: 3,
  terminalSlotEndAllowance: 0.3,
} as const;
