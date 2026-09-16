/** Millimetre dimensions explicitly annotated in the supplied profile drawings. */
export interface AluminiumProfileDimensions {
  slotOpening: number;
  slotOpeningOuter: number;
  slotCavityWidth: number;
  slotDepth: number;
  slotInnerDepth: number;
  topLipThickness: number;
  baseThickness: number;
  sideOpening: number;
  sideCavityHeight: number;
  sideCavityDepth: number;
  sidePocketWidth: number;
  sideLipWidth: number;
  sideWallThickness: number;
  centralWebWidth: number;
  boreDiameter: number;
  slotPitch: number;
  outerCornerRadius: number;
  diagonalWebThickness: number;
  nominalWallThickness: number;
}

export type AluminiumProfileId =
  'eu1020' | 'eu1030' | 'eu1040' | 'eu1050' | '2020' | '2040' | 'gb1020h' | 'eu1540';

export interface AluminiumProfileReference {
  id: AluminiumProfileId;
  name: string;
  width: number;
  height: number;
  dimensions: Partial<AluminiumProfileDimensions>;
  sourceFiles: string[];
  /** Offered cut lengths, only where the supplied listing shows these options. */
  stockLengths?: number[];
  /** Supplier-stated mass per metre; not a mass inferred from the model. */
  massKgPerM?: number;
  /** Symmetric ± tolerances in millimetres, explicitly printed in the drawing. */
  tolerances?: { width?: number; slotOpening?: number; sideOpening?: number };
  notes: string[];
}

export const aluminiumProfileReferenceFiles = {
  eu1020: '',
  eu1030: '',
  eu1040: '',
  eu1050: '',
  euLengthOptions: '',
  profile2020: '',
  profile2040: '',
  eu1030Mass: '',
  gb1020h: '',
  eu1540: '',
};

const source = aluminiumProfileReferenceFiles;
const euCutLengths = Array.from({ length: 11 }, (_, index) => (index + 1) * 50);

// Missing dimensions are deliberate: an undimensioned silhouette does not verify
// slot floors, internal cavities, hole positions, small fillets or wall thickness.
// Neither an alloy/temper nor a material strength is specified by these sources.
export const aluminiumProfileReferences: readonly AluminiumProfileReference[] = [
  {
    id: 'eu1020',
    name: 'EU 1020',
    width: 20,
    height: 10,
    dimensions: {
      slotOpening: 6.2,
      topLipThickness: 1.8,
      baseThickness: 3.9,
      boreDiameter: 4.2,
    },
    sourceFiles: [source.eu1020, source.euLengthOptions],
    stockLengths: [...euCutLengths],
    notes: [
      'The drawing shows one top T-slot and two longitudinal bores.',
      'Slot cavity width, bore centres and corner radii are not dimensioned.',
    ],
  },
  {
    id: 'eu1030',
    name: 'EU 1030',
    width: 29.8,
    height: 9.9,
    dimensions: {
      slotOpening: 6,
      topLipThickness: 1.9,
      baseThickness: 3.9,
      sideOpening: 4.7,
      sideCavityDepth: 5.9,
      sideLipWidth: 1.9,
      sideWallThickness: 1.4,
      nominalWallThickness: 1.9,
    },
    sourceFiles: [source.eu1030, source.eu1030Mass, source.euLengthOptions],
    stockLengths: [...euCutLengths],
    massKgPerM: 0.54,
    notes: [
      'The actual annotated section is 29.8 × 9.9 mm despite the EU 1030 name.',
      'The drawing shows one top T-slot, two side slots and no longitudinal bore.',
      'The supplier text states 1.9 mm thickness; the drawing separately labels a 1.4 mm side-slot bottom wall.',
      'Top-slot cavity width, upper side-slot wall and corner radii are not dimensioned.',
    ],
  },
  {
    id: 'eu1040',
    name: 'EU 1040',
    width: 40,
    height: 10,
    dimensions: {
      slotOpening: 5.4,
      topLipThickness: 2,
      slotDepth: 6.5,
      boreDiameter: 3.2,
      outerCornerRadius: 1,
    },
    sourceFiles: [source.eu1040, source.euLengthOptions],
    stockLengths: [...euCutLengths],
    notes: [
      'The drawing shows two top T-slots, two longitudinal bores and a central hollow.',
      'Slot centres, bore centres, slot cavity widths and the central hollow dimensions are not annotated.',
    ],
  },
  {
    id: 'eu1050',
    name: 'EU 1050',
    width: 50,
    height: 10,
    dimensions: {
      slotOpening: 6.2,
      slotOpeningOuter: 7.2,
      slotDepth: 6.1,
      slotInnerDepth: 4.1,
      slotPitch: 20,
      sideOpening: 4.5,
      sidePocketWidth: 4,
      sideLipWidth: 2,
      sideWallThickness: 1.4,
      boreDiameter: 4.3,
      outerCornerRadius: 1,
    },
    sourceFiles: [source.eu1050, source.euLengthOptions],
    stockLengths: [...euCutLengths],
    notes: [
      'The drawing shows two top T-slots, two side slots and one central longitudinal bore.',
      'The top opening has separately annotated 6.2 mm and 7.2 mm steps.',
      'The 4.1 mm inner depth and 6.1 mm full slot depth share the slot floor datum.',
      'The 4 mm side pocket is measured behind the 2 mm side lip, giving a derived total side-slot depth of 6 mm.',
      'A small vertical annotation near the left slot resembles 1.51, but its value and endpoints are ambiguous; it is not used as a verified dimension.',
      'Top-slot cavity width, step heights and the lower side-slot wall are not dimensioned.',
    ],
  },
  {
    id: '2020',
    name: '2020',
    width: 20,
    height: 20,
    dimensions: {
      slotOpening: 6.2,
      slotCavityWidth: 11,
      boreDiameter: 5,
    },
    sourceFiles: [source.profile2020],
    notes: [
      'The drawing shows four face slots and one central longitudinal bore.',
      'Slot depth, lip thickness, corner radii and cut lengths are not supplied.',
    ],
  },
  {
    id: '2040',
    name: '2040',
    width: 40,
    height: 20,
    dimensions: {
      slotOpening: 6.1,
      sideOpening: 6.2,
      slotCavityWidth: 11,
      topLipThickness: 1.8,
      sideLipWidth: 1.8,
      slotPitch: 20,
      boreDiameter: 5,
      outerCornerRadius: 1.5,
      diagonalWebThickness: 1.5,
    },
    sourceFiles: [source.profile2040],
    notes: [
      'The drawing shows two slots on each wide face, one slot on each narrow face, two bores and a central hollow.',
      'The top opening is labelled 6.1 mm while the side opening is separately labelled 6.2 mm.',
      'The diagonal web is annotated 1.5 mm; the complete central hollow shape is not dimensioned.',
      'Slot depth, internal fillets and cut lengths are not supplied.',
    ],
  },
  {
    id: 'gb1020h',
    name: 'GB 1020H',
    width: 20,
    height: 10,
    dimensions: {
      sideOpening: 4.5,
      sideCavityHeight: 7.2,
      sideLipWidth: 2,
      centralWebWidth: 8,
      boreDiameter: 3.2,
      nominalWallThickness: 2,
    },
    sourceFiles: [source.gb1020h],
    massKgPerM: 0.32,
    tolerances: { width: 0.2, sideOpening: 0.2 },
    notes: [
      'The drawing shows two side slots and one central longitudinal bore.',
      'The source states width 20 ± 0.2 mm and side opening 4.5 ± 0.2 mm.',
      'The supplier text states 2 mm wall thickness; the drawing independently labels 7.2 mm cavity height inside a 10 mm section.',
      'Corner radii and cut lengths are not supplied.',
    ],
  },
  {
    id: 'eu1540',
    name: 'EU profile · 40 × 15 mm',
    width: 40,
    height: 15,
    dimensions: {
      slotOpening: 8.3,
      slotDepth: 9.3,
      topLipThickness: 2,
      sideCavityDepth: 6.2,
      sideLipWidth: 2,
      boreDiameter: 4.4,
      outerCornerRadius: 1,
      nominalWallThickness: 2,
    },
    sourceFiles: [source.eu1540],
    massKgPerM: 0.95,
    notes: [
      'EU 1540 is a descriptive catalogue label for the supplied 40 × 15 mm European profile; that model code is not printed in the source.',
      'The drawing shows one top T-slot, two side slots and two longitudinal bores.',
      'Side openings, bore centres, slot cavity width and cut lengths are not supplied.',
    ],
  },
];
