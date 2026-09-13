import type { Preset } from '../core/types';

export function ReferenceSpecifications({ catalog }: { catalog?: Preset['catalog'] }) {
  if (!catalog?.specifications?.length) return null;
  return (
    <details className="reference-specifications">
      <summary>Reference specifications</summary>
      <dl>
        {catalog.specifications.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <p>Values from the reference apply to the original product, not to modified geometry.</p>
    </details>
  );
}
