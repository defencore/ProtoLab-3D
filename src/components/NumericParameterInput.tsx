import React, { useEffect, useRef, useState } from 'react';
import { parseNumericRange } from '../core/numeric-range';

/** Keep the user's decimal text while committing only finite values to the configured model. */
export default function NumericParameterInput({
  id,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  value: number | string | boolean;
  min?: number;
  max?: number;
  onChange: (value: number | string) => void;
}) {
  const [text, setText] = useState(String(value));
  const ownValue = useRef(value);
  useEffect(() => {
    if (value !== ownValue.current) setText(String(value));
    ownValue.current = value;
  }, [value]);
  const parsed = parseNumericRange({ min: text });
  const numeric = parsed.range.min;
  const invalid =
    !text.trim() ||
    parsed.errors.length > 0 ||
    numeric === undefined ||
    (min !== undefined && numeric < min) ||
    (max !== undefined && numeric > max);
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={text}
      aria-invalid={invalid || undefined}
      onChange={(event) => {
        const raw = event.target.value;
        const result = parseNumericRange({ min: raw });
        const next = raw.trim() && !result.errors.length ? result.range.min! : raw;
        ownValue.current = next;
        setText(raw);
        onChange(next);
      }}
    />
  );
}
