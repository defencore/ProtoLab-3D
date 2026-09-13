// Offline reference dimensions stay available when a part package is replaced.
// Unspecified internal dimensions remain editable prototype defaults.

/** Manufacturer key dimensions are reference defaults, not shop-verified attributes. */
export function cskKeyDimensions(bore: number) {
  const row: Record<number, number[]> = {
    8: [2.5, 0.8, 2, 0.5],
    12: [4, 1.8, 2, 0.6],
    15: [5, 1.2, 2, 0.6],
    17: [5, 1.2, 2, 1],
    20: [6, 1.6, 3, 1.5],
    25: [8, 2, 6, 2],
    30: [8, 2, 6, 2],
    35: [10, 2.4, 8, 2.5],
    40: [12, 3.3, 10, 3],
  };
  // No outer key is specified for CSK 8/12 in the reference table; these are editable examples.
  const [innerKeyWidth, innerKeyDepth, outerKeyWidth, outerKeyDepth] = row[bore] ?? [
    bore * 0.25,
    bore * 0.065,
    bore * 0.2,
    bore * 0.065,
  ];
  return { innerKeyWidth, innerKeyDepth, outerKeyWidth, outerKeyDepth };
}

/** Published light-series dimensions; source provenance is assigned by the adapter. */
export function zarnReferenceDimensions(bore: number) {
  const table: Record<number, number[]> = {
    20: [31, 16, 42, 10],
    30: [35, 20, 52, 10],
    35: [37, 20, 60, 11],
    40: [37, 20, 65, 11],
    50: [42.5, 25, 78, 11.5],
  };
  const row = table[bore];
  return row
    ? { shoulderSpan: row[0], outerWidth: row[1], washerDiameter: row[2], washerThickness: row[3] }
    : undefined;
}
