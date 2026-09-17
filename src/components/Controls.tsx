'use client';

import styles from './Controls.module.css';

export interface Settings {
  mode: 'nearest' | 'average';
  averageBoxSize: number;
  blur: number;
  dither: 'none' | 'floyd-steinberg';
  colorSpace: 'rgb' | 'lab';
}

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.segmented}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={`${styles.segment} ${value === o.value ? styles.on : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Controls({ settings, onChange }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className={styles.group}>
      <div className={styles.field}>
        <span className={styles.label}>Mode</span>
        <Segmented
          value={settings.mode}
          onChange={(v) => set('mode', v)}
          options={[
            { value: 'nearest' as const, label: 'Nearest' },
            { value: 'average' as const, label: 'Average' },
          ]}
        />
      </div>

      {/* Box size only means anything in average mode, so it only appears there. */}
      {settings.mode === 'average' && (
        <div className={styles.field}>
          <span className={styles.label}>
            Box size <span className={styles.value}>{settings.averageBoxSize} px</span>
          </span>
          <input
            className={styles.range}
            type="range"
            min={1}
            max={32}
            step={1}
            value={settings.averageBoxSize}
            onChange={(e) => set('averageBoxSize', Number(e.target.value))}
          />
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.label}>
          Blur <span className={styles.value}>{settings.blur === 0 ? 'off' : `σ ${settings.blur}`}</span>
        </span>
        <input
          className={styles.range}
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={settings.blur}
          onChange={(e) => set('blur', Number(e.target.value))}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Dither</span>
        <Segmented
          value={settings.dither}
          onChange={(v) => set('dither', v)}
          options={[
            { value: 'none' as const, label: 'None' },
            { value: 'floyd-steinberg' as const, label: 'Floyd–Steinberg' },
          ]}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Color space</span>
        <Segmented
          value={settings.colorSpace}
          onChange={(v) => set('colorSpace', v)}
          options={[
            { value: 'rgb' as const, label: 'RGB' },
            { value: 'lab' as const, label: 'LAB' },
          ]}
        />
      </div>
    </div>
  );
}
