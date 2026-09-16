'use client';

import { useCallback, useRef, useState } from 'react';
import styles from './Dropzone.module.css';

export interface RejectedFile {
  name: string;
  reason: string;
}

interface Props {
  onFiles: (files: File[]) => void;
  busy: boolean;
  rejected: RejectedFile[];
}

/**
 * Drag-and-drop plus a plain file picker. The picker is not a fallback: dragging out of a folder
 * is convenient, but people paste paths and use keyboards too.
 */
export default function Dropzone({ onFiles, busy, rejected }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div>
      <div
        className={`${styles.zone} ${over ? styles.over : ''} ${busy ? styles.busy : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
      >
        <p className={styles.headline}>{busy ? 'Uploading…' : 'Drop images here'}</p>
        <p className={styles.hint}>JPEG, PNG or WebP · up to 25 MB each</p>
        <button type="button" className={styles.pick} onClick={() => inputRef.current?.click()}>
          Choose files
        </button>
        <input
          ref={inputRef}
          className={styles.input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) onFiles(files);
            // Reset so picking the same file twice in a row still fires a change event.
            e.target.value = '';
          }}
        />
      </div>
      {rejected.length > 0 && (
        <ul className={styles.rejects}>
          {rejected.map((r, i) => (
            <li key={`${r.name}-${i}`}>
              <strong>{r.name}</strong>: {r.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
