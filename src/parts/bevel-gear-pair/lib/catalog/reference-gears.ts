export interface BevelReferenceRow {
  module: number;
  teeth: number;
  boreMin: number;
  boreMax: number;
  outer: number;
  largeTip: number;
  mounting: number;
  overall: number;
  face: number;
  hub: number;
  hubLength: number;
  bodyLength: number;
}

export const gearReferenceFiles = {
  spur: 'references/spur-pinion-options.png',
  bevel: 'references/bevel-gear-dimensions.png',
  mounting: 'references/bevel-gear-mounting-table.png',
  pairPhoto: 'references/bevel-gear-1-to-2-photo.png',
  m2Options: 'references/bevel-gear-m2-15-30-bore-options.png',
};
