import type { FabricationFile, Parameters } from '../../../core/types';
import { composition } from './model';

export function fabricationFiles(p: Parameters): FabricationFile[] {
  const grouped = new Map<
    string,
    {
      name: string;
      quantity: number;
      supply: string;
      process: string;
      material: string;
      source: string;
    }
  >();
  for (const item of composition(p).components) {
    const key = JSON.stringify([item.libraryId, item.parameters, item.state, item.manufacturing]);
    const existing = grouped.get(key);
    if (existing) existing.quantity += item.quantity;
    else
      grouped.set(key, {
        name: item.name.replace(/^CH\d+ · /, ''),
        quantity: item.quantity,
        supply: item.supply,
        process: item.manufacturing?.processes.join(' / ') ?? '',
        material: item.manufacturing?.material ?? '',
        source: item.procurement?.source ?? '',
      });
  }
  const csv = (rows: (string | number)[][]) =>
    rows
      .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
      .join('\r\n') + '\r\n';
  const rows = [...grouped.values()];
  return [
    {
      id: 'bill-of-materials',
      label: 'Bill of materials',
      name: 'MPR10-bill-of-materials.csv',
      type: 'text/csv',
      description: 'Grouped hardware and fabricated components for the complete neutral assembly.',
      content: csv([
        ['Item', 'Quantity', 'Supply', 'Process', 'Material', 'Source'],
        ...rows.map((r) => [r.name, r.quantity, r.supply, r.process, r.material, r.source]),
      ]),
    },
    {
      id: 'print-list',
      label: 'Printed parts list',
      name: 'MPR10-print-list.csv',
      type: 'text/csv',
      description:
        'Quantities of each distinct print. Orient individual parts and inspect supports in the slicer.',
      content: csv([
        ['Printed part', 'Quantity', 'Material'],
        ...rows
          .filter((r) => r.process.includes('printing'))
          .map((r) => [r.name, r.quantity, r.material]),
      ]),
    },
  ];
}
