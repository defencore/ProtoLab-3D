import React, { useId } from 'react';

export interface NumericRangeFilterValue {
  min?: string | number;
  max?: string | number;
}
export interface NumericRangeFilterProps {
  label: string;
  value: NumericRangeFilterValue;
  onChange: (value: { min?: string; max?: string }) => void;
  unit?: string;
  error?: string;
  id?: string;
  minLabel?: string;
  maxLabel?: string;
  className?: string;
  showLabel?: boolean;
}

/** Raw decimal text stays controlled; validation belongs to the shared numeric range contract. */
export default function NumericRangeFilter({
  label,
  value,
  onChange,
  unit,
  error,
  id,
  minLabel,
  maxLabel,
  className = '',
  showLabel = false,
}: NumericRangeFilterProps) {
  const generatedId = useId();
  const prefix = id ?? `numeric-range-${generatedId}`;
  const descriptionId = `${prefix}-error`;
  function change(side: 'min' | 'max', text: string) {
    onChange({
      min: value.min === undefined ? undefined : String(value.min),
      max: value.max === undefined ? undefined : String(value.max),
      [side]: text,
    });
  }
  return (
    <div className={`numeric-range-filter ${className}`}>
      {showLabel && (
        <label htmlFor={`${prefix}-min`}>
          {label}
          {unit && <small>{unit}</small>}
        </label>
      )}
      <div className="numeric-range-inputs">
        <input
          id={`${prefix}-min`}
          type="text"
          inputMode="decimal"
          placeholder="From"
          aria-label={minLabel ?? `Minimum ${label.toLowerCase()}`}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? descriptionId : undefined}
          value={value.min ?? ''}
          onChange={(event) => change('min', event.target.value)}
        />
        <span aria-hidden="true">–</span>
        <input
          id={`${prefix}-max`}
          type="text"
          inputMode="decimal"
          placeholder="To"
          aria-label={maxLabel ?? `Maximum ${label.toLowerCase()}`}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? descriptionId : undefined}
          value={value.max ?? ''}
          onChange={(event) => change('max', event.target.value)}
        />
      </div>
      {error && (
        <p className="numeric-range-error" id={descriptionId}>
          {error}
        </p>
      )}
    </div>
  );
}
