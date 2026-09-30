import type { Piece } from './assembly';
import { fastener, fastenerCatalog } from './fastener-catalog';
export function named(piece: Piece): Piece {
  const spec = fastenerCatalog(piece.shape, piece.label);
  return spec
    ? { ...piece, label: `${piece.label} · ${spec.standard} · ${spec.designation}` }
    : piece;
}
export function manufactured(piece: Piece): boolean {
  const spec = fastenerCatalog(piece.shape, piece.label);
  if (spec) return spec.procurement === 'MAKE_CUSTOM_FASTENER';
  if (piece.label.startsWith('BUY ')) return false;
  if (/PRINT|PA12|TPU|PETG|silicone/.test(piece.label)) return true;
  return (
    !piece.label.startsWith('BUY ') &&
    !piece.label.includes(' · BUY ') &&
    !piece.label.includes(' · ISO') &&
    !piece.label.startsWith('ST3215 ·') &&
    !piece.label.startsWith('Gearmotor ')
  );
}
export function material(piece: Piece): string {
  if (piece.label.includes('nickel')) return 'Ni200';
  if (piece.label.startsWith('BUY 18650 cell') && !/terminal|tab/.test(piece.label))
    return 'Li-ion cell';
  if (piece.label.startsWith('BUY Tattu')) return 'LiPo pack';
  if (piece.label.startsWith('BUY TowerPro')) return 'ABS / metal gear assembly';
  if (piece.label.startsWith('BUY SpeedyBee')) return 'FR4 / electronic assembly';
  if (piece.label.includes('nylon hook-and-loop')) return 'nylon';
  const spec = fastenerCatalog(piece.shape, piece.label);
  if (spec?.procurement.startsWith('BUY_')) {
    if (/\bPA66\b/.test(spec.designation)) return 'PA66 nylon';
    const grade = spec.designation.match(/\bA[24](?:-\d+)?\b/)?.[0];
    return grade ? `stainless steel ${grade}` : 'steel - grade to specify';
  }
  if (fastener(piece.shape) || piece.label.includes('steel')) return 'steel - grade to specify';
  if (piece.label.includes('copper')) return 'copper';
  if (piece.label.includes('brass')) return 'brass';
  if (piece.label.startsWith('BUY WING MINI')) return 'electronic subcomponent - supplier assembly';
  if (piece.label.includes('Al7075')) return 'Al7075';
  if (piece.label.includes('Al5052')) return 'Al5052';
  if (piece.label.includes('PTFE')) return 'PTFE';
  if (piece.label.includes('composite')) return 'composite - laminate to specify';
  if (piece.label.includes('silicone')) return 'silicone';
  if (piece.label.includes('PA12')) return 'PA12';
  if (piece.label.includes('TPU')) return 'TPU 95A';
  if (piece.label.includes('PETG')) return 'PETG';
  if (piece.label.includes('POM') || piece.label.includes('pinion')) return 'POM';
  if (piece.color === 0xb99450) return 'bronze';
  if (piece.color === 0x929eac) return 'steel';
  return 'Al6061';
}
