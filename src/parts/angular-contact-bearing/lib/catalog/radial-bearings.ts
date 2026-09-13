export type RadialFamily =
  | 'ball'
  | 'cylindrical'
  | 'self-aligning'
  | 'angular'
  | 'spherical'
  | 'tapered'
  | 'needle'
  | 'double-row';

interface SupplierBearing {
  id: string;
  family: RadialFamily;
  designation: string;
  manufacturer: string;
  bore: number;
  outer: number;
  width: number;
  sourceUrl: string;
}
