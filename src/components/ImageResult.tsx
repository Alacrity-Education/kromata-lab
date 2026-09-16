'use client';

import SplitSlider from './SplitSlider';
import styles from './ImageResult.module.css';

export type ViewMode = 'split' | 'pair' | 'grid';

export interface Item {
  id: string;
  name: string;
  width: number;
  height: number;
  status: 'pending' | 'working' | 'done' | 'error';
  resultUrl?: string;
  conversionId?: string;
  ms?: number;
  error?: string;
  rating?: 1 | -1;
}

interface Props {
  item: Item;
  view: ViewMode;
  onRate: (item: Item, rating: 1 | -1) => void;
  onDownload: (item: Item) => void;
  onRemove: (item: Item) => void;
  downloading: boolean;
}

export default function ImageResult({
  item,
  view,
  onRate,
  onDownload,
  onRemove,
  downloading,
}: Props) {
  const before = `/api/preview/${item.id}`;
  const working = item.status === 'working' || item.status === 'pending';

  return (
    <div className={styles.card}>
      <div className={styles.body}>
        {item.status === 'error' ? (
          <p className={styles.error}>{item.error}</p>
        ) : !item.resultUrl ? (
          // Nothing mapped yet, so show the original rather than an empty box.
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className={`${styles.img} ${styles.working}`} src={before} alt={item.name} />
        ) : view === 'split' ? (
          <div className={working ? styles.working : undefined}>
            <SplitSlider beforeSrc={before} afterSrc={item.resultUrl} alt={item.name} />
          </div>
        ) : view === 'pair' ? (
          <div className={`${styles.pair} ${working ? styles.working : ''}`}>
            <div className={styles.half}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.img} src={before} alt={`${item.name}, original`} />
              <span className={styles.halfTag}>Original</span>
            </div>
            <div className={styles.half}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.img} src={item.resultUrl} alt={`${item.name}, mapped`} />
              <span className={styles.halfTag}>Mapped</span>
            </div>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className={`${styles.img} ${working ? styles.working : ''}`}
            src={item.resultUrl}
            alt={`${item.name}, mapped`}
          />
        )}
        {item.ms !== undefined && item.status === 'done' && (
          <span className={styles.badge}>{item.ms} ms</span>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.name} title={item.name}>
          {item.name}
        </span>
        <span className={styles.dims}>
          {item.width}×{item.height}
        </span>
        <span className={styles.actions}>
          <button
            type="button"
            className={`${styles.iconBtn} ${item.rating === 1 ? styles.rated : ''}`}
            title="Good result"
            aria-pressed={item.rating === 1}
            disabled={!item.conversionId}
            onClick={() => onRate(item, 1)}
          >
            ▲
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${item.rating === -1 ? styles.rated : ''}`}
            title="Bad result"
            aria-pressed={item.rating === -1}
            disabled={!item.conversionId}
            onClick={() => onRate(item, -1)}
          >
            ▼
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Download at full resolution"
            disabled={downloading || item.status === 'error'}
            onClick={() => onDownload(item)}
          >
            {downloading ? '…' : '↓'}
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.remove}`}
            title="Remove from the workspace"
            onClick={() => onRemove(item)}
          >
            ✕
          </button>
        </span>
      </div>
    </div>
  );
}
