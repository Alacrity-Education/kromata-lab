'use client';

import { useState } from 'react';
import styles from './PalettePicker.module.css';

export interface PaletteSummary {
  key: string;
  name: string;
  colors: string[];
  source?: string;
  saved: boolean;
}

interface Props {
  palettes: PaletteSummary[];
  value: string;
  custom: string;
  onChange: (key: string) => void;
  onCustomChange: (text: string) => void;
  onSaved: (palettes: PaletteSummary[], key: string) => void;
}

const CUSTOM_KEY = '__custom__';

export default function PalettePicker({
  palettes,
  value,
  custom,
  onChange,
  onCustomChange,
  onSaved,
}: Props) {
  const [saveName, setSaveName] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const usingCustom = value === CUSTOM_KEY;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/palettes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName, colors: custom }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not save that palette');
      setMessage({ text: `Saved "${body.saved.name}"`, ok: true });
      setSaveName('');
      onSaved(body.palettes, `saved:${body.saved.id}`);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Save failed', ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className={styles.list}>
        {palettes.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`${styles.option} ${value === p.key ? styles.active : ''}`}
            onClick={() => onChange(p.key)}
            title={p.source ?? p.name}
          >
            <span className={styles.name}>
              <span>
                {p.name}
                {p.saved ? ' ·' : ''}
              </span>
              <span className={styles.count}>{p.colors.length}</span>
            </span>
            <span className={styles.swatches}>
              {p.colors.map((c, i) => (
                <span key={`${c}-${i}`} className={styles.swatch} style={{ background: c }} />
              ))}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.customBlock}>
        <button
          type="button"
          className={`${styles.option} ${usingCustom ? styles.active : ''}`}
          onClick={() => onChange(CUSTOM_KEY)}
        >
          <span className={styles.name}>
            <span>Custom palette</span>
          </span>
        </button>
        <textarea
          className={styles.textarea}
          value={custom}
          spellCheck={false}
          placeholder="#2e3440, #88c0d0, #a3be8c&#10;one per line or comma separated"
          onChange={(e) => {
            onCustomChange(e.target.value);
            if (!usingCustom) onChange(CUSTOM_KEY);
          }}
        />
        <div className={styles.row}>
          <input
            className={styles.nameInput}
            value={saveName}
            placeholder="Name it to share it"
            onChange={(e) => setSaveName(e.target.value)}
          />
          <button
            type="button"
            className={styles.save}
            disabled={saving || saveName.trim().length === 0 || custom.trim().length === 0}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {message && (
          <p className={`${styles.message} ${message.ok ? styles.ok : styles.error}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

export { CUSTOM_KEY };
