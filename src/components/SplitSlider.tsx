'use client';

import { useCallback, useRef, useState } from 'react';
import styles from './SplitSlider.module.css';

interface Props {
  beforeSrc: string;
  afterSrc: string;
  alt: string;
}

/**
 * Before/after with a draggable divider.
 *
 * The original is the base layer and the mapped result is clipped over it, so the two are always
 * pixel-aligned regardless of how the browser scales them.
 */
export default function SplitSlider({ beforeSrc, afterSrc, alt }: Props) {
  const [position, setPosition] = useState(50);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const moveTo = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, pct)));
  }, []);

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      role="slider"
      tabIndex={0}
      aria-label={`Before and after comparison for ${alt}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position)}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) moveTo(e.clientX);
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setPosition((p) => Math.max(0, p - 2));
        if (e.key === 'ArrowRight') setPosition((p) => Math.min(100, p + 2));
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.base} src={beforeSrc} alt={`${alt}, original`} draggable={false} />
      <div className={styles.overlayWrap} style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.overlay} src={afterSrc} alt={`${alt}, mapped`} draggable={false} />
      </div>
      <span className={`${styles.tag} ${styles.tagLeft}`}>Original</span>
      <span className={`${styles.tag} ${styles.tagRight}`}>Mapped</span>
      <div className={styles.handle} style={{ left: `${position}%` }}>
        <span className={styles.grip}>◂▸</span>
      </div>
    </div>
  );
}
