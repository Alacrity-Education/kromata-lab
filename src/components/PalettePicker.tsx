'use client';

import styles from './PalettePicker.module.css';

export interface PaletteSummary {
  key: string;
  name: string;
  colors: string[];
  source?: string;
}

interface Props {
  palettes: PaletteSummary[];
  value: string;
  custom: string;
  onChange: (key: string) => void;
  onCustomChange: (text: string) => void;
}

const CUSTOM_KEY = '__custom__';

export default function PalettePicker({
  palettes,
  value,
  custom,
  onChange,
  onCustomChange,
}: Props) {
  const usingCustom = value === CUSTOM_KEY;

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
              <span>{p.name}</span>
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
        <p className={styles.hint}>
          Custom colors are sent with each render and are not stored on the server.
        </p>
      </div>
    </div>
  );
}

export { CUSTOM_KEY };
