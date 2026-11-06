import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { libraryEntryId } from '../core/library-identity';
import { selectedMatchingPreset } from '../core/preset-resolution';
import { copyText } from '../core/clipboard';
import type { Parameters, PartDefinition } from '../core/types';

interface Props {
  part: PartDefinition;
  parameters: Parameters;
  presetId: string;
  configurationKey?: string;
}

function useIdentityCopy() {
  const [copyStatus, setCopyStatus] = useState<{
    value: string;
    message: string;
    copied: boolean;
  }>();
  async function copy(label: string, value: string) {
    try {
      await copyText(value);
      setCopyStatus({ value, message: `${label} copied.`, copied: true });
    } catch {
      setCopyStatus({ value, message: 'Select the value and copy it.', copied: false });
    }
  }
  return { copyStatus, copy };
}

export function LibraryId({ part, parameters, presetId }: Omit<Props, 'configurationKey'>) {
  const preset = selectedMatchingPreset(part, parameters, presetId);
  const id = libraryEntryId(part.id, preset?.id);
  const { copyStatus, copy } = useIdentityCopy();
  const copied = copyStatus?.value === id && copyStatus.copied;
  return (
    <div className="library-id-strip" aria-label="Library ID">
      <span className="library-id-label">Library ID</span>
      <code className="library-id-text" tabIndex={0} title={id}>
        {id}
      </code>
      <button
        type="button"
        className="library-id-copy"
        aria-label="Copy ID"
        onClick={() => void copy('ID', id)}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        <span>{copied ? 'Copied' : 'Copy ID'}</span>
      </button>
      <span className="library-id-status" role="status">
        {copyStatus?.value === id ? copyStatus.message : ''}
      </span>
    </div>
  );
}

export default function LibraryIdentity({ part, parameters, presetId, configurationKey }: Props) {
  const preset = selectedMatchingPreset(part, parameters, presetId);
  const { copyStatus, copy } = useIdentityCopy();
  const values = [
    { label: 'Family ID', value: part.id },
    ...(preset ? [{ label: 'Model ID', value: libraryEntryId(part.id, preset.id) }] : []),
    ...(configurationKey ? [{ label: 'Configuration key', value: configurationKey }] : []),
  ];

  return (
    <section className="library-identity" aria-label="Library identity">
      <div className="section-label">LIBRARY IDENTITY</div>
      {values.map(({ label, value }) => (
        <div className="library-identity-row" key={label}>
          <span>{label}</span>
          <div className="library-identity-value">
            <input
              aria-label={label}
              title={value}
              value={value}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className="icon-button"
              title={`Copy ${label.toLowerCase()}`}
              aria-label={`Copy ${label.toLowerCase()}`}
              onClick={() => void copy(label, value)}
            >
              {copyStatus?.value === value && copyStatus.copied ? (
                <Check size={14} />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        </div>
      ))}
      <p className="library-identity-status" role="status">
        {values.some(({ value }) => value === copyStatus?.value) ? copyStatus?.message : ''}
      </p>
    </section>
  );
}
