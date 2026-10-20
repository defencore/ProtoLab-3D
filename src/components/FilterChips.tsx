import { X } from 'lucide-react';
import './FilterChips.css';

export interface FilterChip {
  id: string;
  label: string;
  removeLabel: string;
  onRemove: () => void;
}
export default function FilterChips({ items, label }: { items: FilterChip[]; label: string }) {
  if (!items.length) return null;
  return (
    <div className="filter-chips" role="group" aria-label={label}>
      {items.map((item) => (
        <button type="button" key={item.id} aria-label={item.removeLabel} onClick={item.onRemove}>
          {item.label}
          <X size={11} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
