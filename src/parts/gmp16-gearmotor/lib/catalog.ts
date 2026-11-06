export const sourceUrl = 'references/gmp16-gearmotor/tec1636-dimensions.png';
export const listingUrl = 'https://www.aliexpress.com/item/1005011804448445.html';

/** Nominal values transcribed from the supplied GMP16T-TEC1636 table. */
export const reductions = [
  { ratio: 4, stages: 1, length: 12.5 },
  { ratio: 4.75, stages: 1, length: 12.5 },
  { ratio: 16, stages: 2, length: 16 },
  { ratio: 19, stages: 2, length: 16 },
  { ratio: 22.6, stages: 2, length: 16 },
  { ratio: 64, stages: 3, length: 19.5 },
  { ratio: 76, stages: 3, length: 19.5 },
  { ratio: 90, stages: 3, length: 19.5 },
  { ratio: 107, stages: 3, length: 19.5 },
  { ratio: 172, stages: 4, length: 23 },
  { ratio: 224, stages: 4, length: 23 },
  { ratio: 256, stages: 4, length: 23 },
  { ratio: 304, stages: 4, length: 23 },
  { ratio: 361, stages: 4, length: 23 },
  { ratio: 428.7, stages: 4, length: 23 },
  { ratio: 509, stages: 4, length: 23 },
  { ratio: 1024, stages: 5, length: 26.5 },
] as const;

export const models = reductions.flatMap((reduction) =>
  [12, 24].map((voltage) => ({ ...reduction, voltage, id: `${reduction.ratio}-${voltage}` })),
);

/** No interpolation: the attachment publishes performance for these ratios only. */
export const performance: Readonly<
  Record<number, { noLoad: number; rated: number; torque: number }>
> = {
  4: { noLoad: 2700, rated: 2000, torque: 0.1 },
  16: { noLoad: 700, rated: 600, torque: 0.4 },
  22.6: { noLoad: 520, rated: 430, torque: 0.5 },
  64: { noLoad: 180, rated: 150, torque: 1.5 },
  107: { noLoad: 110, rated: 90, torque: 2.8 },
  256: { noLoad: 45, rated: 38, torque: 5 },
  361: { noLoad: 31, rated: 26, torque: 5 },
  1024: { noLoad: 10, rated: 9, torque: 5 },
};

export function selectedModel(id: string | number | boolean) {
  const selected = models.find((model) => model.id === id);
  if (!selected) throw new Error('Select a supported GMP16T-TEC1636 execution.');
  return selected;
}
