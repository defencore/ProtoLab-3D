import { guideSource } from '../../cnc-guide-rail/part';
import type { MillingPiece } from './composition';

/** A requested factory execution is distinct from a delivered grade certificate. */
export function specifyMillingGuides(pieces: MillingPiece[]) {
  for (const piece of pieces) {
    const c = piece.component;
    if (!['cnc-guide-rail', 'cnc-guide-carriage'].includes(c.libraryId)) continue;
    const axis = c.id[0].toUpperCase();
    const rail = c.libraryId === 'cnc-guide-rail';
    c.procurement = {
      manufacturer: 'HIWIN',
      source: guideSource,
      designation: `HIWIN ${rail ? 'HGR20 / ' + Number(c.parameters.length) + ' mm' : 'HGH20CA'} / axis ${axis} factory-matched SP accuracy, ZA preload requested; quote and certificate pending`,
    };
    c.notes =
      'Order as one identified axis set with two rails and four carriages: requested SP accuracy and ZA medium preload (5–7% C). Preserve master rail, carriage/set markings and reference faces. The library has nominal HG20 installation geometry; no delivered SP/ZA execution, actual stiffness or machine accuracy is certified. Specify rail end-hole distances, straightness, parallelism, datum machining and mounting torque on the released installation drawing. Catalog HG20C ZA radial stiffness 460 N/µm is not a lateral/angular stiffness measurement of this assembly.';
  }
}
