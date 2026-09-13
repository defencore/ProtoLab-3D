/** Explicit manufacturer checks for contradictory supplier summary attributes.
 * The adapter still requires these values to appear in the actual supplier table.
 * Raw conflicting rows remain in the inventory and the reconciliation is reported.
 */
export interface SourceReconciliation {
  parameters: Record<string, number>;
  referenceUrl: string;
  note: string;
}

const checks: Array<[string[], SourceReconciliation]> = [
  [
    ['8227', '1897', '8228'],
    {
      parameters: { bore: 10, outer: 30, width: 9 },
      referenceUrl:
        'https://www.nsk.com/content/dam/nsk/am/en_us/documents/bearings-americas/Bearing-and-Linear-Replacement-Guide.pdf',
      note: 'NSK 1200 dimensions confirm the supplier technical table; the generic 10/110/22 summary is contradictory.',
    },
  ],
  [
    ['6616', '9980'],
    {
      parameters: { bore: 45, outer: 100, width: 25 },
      referenceUrl:
        'https://www.nsk.com/in-en/engineering/products/bearings/ball-bearings/self-aligning-ball-bearings/1309-apn.html',
      note: 'NSK 1309 dimensions confirm the technical table; the generic supplier summary swaps bore and width.',
    },
  ],
  [
    ['11264'],
    {
      parameters: { bore: 40, outer: 90, width: 33 },
      referenceUrl: 'https://www.nsk.com/eu-es/engineering/2308-apn.html',
      note: 'NSK 2308 dimensions confirm the technical table; the generic supplier summary swaps bore and width.',
    },
  ],
];

export const sourceReconciliations: Record<string, SourceReconciliation> = Object.fromEntries(
  checks.flatMap(([ids, check]) => ids.map((id) => [id, check])),
);
