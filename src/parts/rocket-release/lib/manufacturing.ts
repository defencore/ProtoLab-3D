import { threadMetadata } from '../../../core/thread-callouts';
import { threadFeatures } from '../../../core/assembly/recovery/thread-features';
export {
  threadFeatures,
  type ThreadFeature,
} from '../../../core/assembly/recovery/thread-features';
import type { Piece } from './assembly';
import type { Shape } from '../../../core/assembly/recovery/shapes';
import { fastenerCatalog } from './fastener-catalog';
import { manufactured, material } from './names';

export function threadLabel(piece: Piece): string {
  const callouts = [
    ...new Set(
      threadFeatures(piece.shape).map(
        (t) => `${t.internal ? 'internal' : 'external'} ${t.designation}`,
      ),
    ),
  ];
  return piece.label + (callouts.length ? ` · threads: ${callouts.join('; ')}` : '');
}
export function manufacturingMetadata(piece: Piece): Record<string, string> {
  const catalog = fastenerCatalog(piece.shape, piece.label);
  const make = manufactured(piece);
  const threads = threadFeatures(piece.shape);
  const print = /PRINT|PA12|TPU|PETG/.test(piece.label);
  const threadGroups = new Map<string, number>();
  threads.forEach((t) => {
    const key = `${t.internal ? 'internal' : 'external'} ${t.designation}; nominal tool L${t.length} mm`;
    threadGroups.set(key, (threadGroups.get(key) ?? 0) + 1);
  });
  return {
    Procurement:
      catalog?.procurement ??
      (make ? (print ? 'MAKE_PRINT' : 'MAKE') : 'BUY_ASSEMBLY_OR_COMPONENT'),
    Material: material(piece),
    Standard: catalog?.standard ?? (make ? 'Custom drawing' : 'Supplier specification'),
    OrderDesignation: catalog?.designation ?? piece.label,
    SupplierSource: catalog?.source ?? '',
    ManufacturingProcess:
      catalog?.procurement === 'MAKE_CUSTOM_FASTENER'
        ? 'Turn / thread / socket; drawing required'
        : make
          ? print
            ? '3D print; material/process qualification required'
            : /silicone/.test(piece.label)
              ? 'Cut elastomer'
              : 'Machine / fabricate to drawing'
          : 'Purchase',
    ThreadCallouts:
      [...threadGroups].map(([key, count]) => `${count}× ${key}`).join('; ') ||
      'No generated thread feature',
    ThreadLabels: [
      ...new Set(threads.map((t) => `${t.internal ? 'internal' : 'external'} ${t.designation}`)),
    ].join('; '),
    ThreadFeaturesJSON: JSON.stringify(threads),
    ThreadModel: threads.length ? threadMetadata(threads).ThreadModel : '',
    DrawingStatus: make
      ? 'DRAFT - not released for manufacture; datum, fits, tolerances, deburr and loads require approval'
      : /fit reference|verify|placement reference|envelope reference/.test(piece.label)
        ? 'Supplier interface must be measured'
        : 'Catalog envelope; verify delivered part',
    ProcurementNotes:
      catalog?.note ??
      (/BUY WING MINI|BUY SpeedyBee/.test(piece.label)
        ? 'Subcomponent of ONE F405 WING MINI kit; do not buy one board kit per modeled component.'
        : ''),
    ...piece.metadata,
  };
}
